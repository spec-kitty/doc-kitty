/**
 * The declared-mode decision logic of the PlantUML include check (#268, WP06): pure
 * classifiers, the raw allowlist comparison, the container env reader, the stable
 * messages, and `checkDeclaredMode` against a fake PlantUML service and the real canary.
 * Command-level proofs (the 9-cell matrix, the half-removal table) live in WP07 / WP12.
 */
import { afterEach, describe, expect, it } from 'vitest';
import { createServer } from 'node:http';
import {
  MESSAGES,
  ServiceConfigError,
  canaryEntry,
  checkDeclaredMode,
  checkServiceIdentity,
  checkUnsetProfile,
  classifyObserved,
  commandLineProperties,
  compareAllowlist,
  formatVerdictLine,
  isPortBusy,
  parseContainerArgs,
  parseContainerEnv,
  parseContainerPorts,
  profileClass,
  propertyFileConfig,
  systemPropertyConfig,
} from '../scripts/plantuml-mode-check.mjs';
import { canaryPort, closeAll, prefixPolicy, startFakePlantuml, trackServer } from './helpers/plantuml-check-harness';

// The spike's real `docker inspect -f '{{json .Config.Env}}'` capture (research.md Q6),
// with the long JETTY_GPG_KEYS value shortened.
const SPIKE_CAPTURE = [
  'PLANTUML_ALLOWLIST_URL=http://dk-canary:18091/dk-declared/;http://dk-canary:18091/dk-canary/allowed/',
  'GITHUB_ACTIONS=true',
  'CI=true',
  'PLANTUML_SECURITY_PROFILE=ALLOWLIST',
  'PATH=/usr/local/jetty/bin:/opt/java/openjdk/bin:/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin',
  'JAVA_HOME=/opt/java/openjdk',
  'LANG=en_US.UTF-8',
  'LANGUAGE=en_US:en',
  'LC_ALL=en_US.UTF-8',
  'JAVA_VERSION=jdk-21.0.10+7',
  'JETTY_VERSION=12.1.6',
  'JETTY_HOME=/usr/local/jetty',
  'JETTY_BASE=/var/lib/jetty',
  'TMPDIR=/tmp/jetty',
  'JETTY_TGZ_URL=https://repo1.maven.org/maven2/org/eclipse/jetty/jetty-home/12.1.6/jetty-home-12.1.6.tar.gz',
  'JETTY_GPG_KEYS=AED5EE6C45D0FE8D5D1B164F27DED4BF6216DB8F \t2A684B57436A81FA8706B53C61C3351A438A3B7D',
  'WEBAPP_PATH=/var/lib/jetty/webapps',
];
const CANARY = canaryEntry('dk-canary', 18091);
const DECLARED_ENTRY = 'https://styles.example.org/plantuml/';

afterEach(closeAll);

describe('canaryEntry', () => {
  it('names the allowed prefix on the canary host and port', () => {
    expect(canaryEntry('dk-canary', 18091)).toBe('http://dk-canary:18091/dk-canary/allowed/');
  });
});

describe('profileClass', () => {
  it.each([
    ['SANDBOX', 'sandbox'],
    ['ALLOWLIST', 'allowlist'],
    ['INTERNET', 'internet'],
    ['internet', null],
    ['Allowlist', null],
    ['', null],
    [' ALLOWLIST', null],
  ])('%j → %j', (value, expected) => {
    expect(profileClass({ PLANTUML_SECURITY_PROFILE: value })).toBe(expected);
  });
  it('missing → null', () => {
    expect(profileClass({})).toBeNull();
    expect(profileClass(undefined)).toBeNull();
  });
});

describe('classifyObserved', () => {
  // Built from a log where every fetched URL appears twice (the real image, F4).
  const fromLog = (log: string[], fixtures: string[]) =>
    fixtures.map((f) => ({
      allowed: log.some((e) => e.startsWith(`/dk-canary/allowed/include/${f}`)),
      denied: log.some((e) => e.startsWith(`/dk-canary/denied/include/${f}`)),
    }));
  const twice = (paths: string[]) => paths.flatMap((p) => [p, p]);

  it('no fetches → sandbox', () => {
    expect(classifyObserved(fromLog([], ['a', 'b']))).toBe('sandbox');
  });
  it('allowed only → allowlist', () => {
    const log = twice(['/dk-canary/allowed/include/a', '/dk-canary/allowed/include/b']);
    expect(classifyObserved(fromLog(log, ['a', 'b']))).toBe('allowlist');
  });
  it('both → internet', () => {
    const log = twice([
      '/dk-canary/allowed/include/a',
      '/dk-canary/denied/include/a',
      '/dk-canary/allowed/include/b',
      '/dk-canary/denied/include/b',
    ]);
    expect(classifyObserved(fromLog(log, ['a', 'b']))).toBe('internet');
  });
  it('denied without allowed → no class', () => {
    expect(classifyObserved([{ allowed: false, denied: true }])).toBeNull();
  });
  it('fixtures disagreeing → no class', () => {
    expect(
      classifyObserved([
        { allowed: true, denied: false },
        { allowed: true, denied: true },
      ]),
    ).toBeNull();
  });
  it('no fixtures → no class', () => {
    expect(classifyObserved([])).toBeNull();
  });
});

describe('compareAllowlist (raw, set semantics)', () => {
  const equal = { extra: [], missing: [], emptyItems: false };
  it('same entries, different order → no diff', () => {
    expect(compareAllowlist(`${CANARY};${DECLARED_ENTRY}`, [DECLARED_ENTRY], CANARY)).toMatchObject(equal);
  });
  it('duplicate → no diff', () => {
    expect(compareAllowlist(`${DECLARED_ENTRY};${CANARY};${DECLARED_ENTRY}`, [DECLARED_ENTRY], CANARY)).toMatchObject(
      equal,
    );
  });
  it('…/x vs …/x/ → one extra and one missing', () => {
    expect(compareAllowlist(`http://h/x;${CANARY}`, ['http://h/x/'], CANARY)).toMatchObject({
      extra: ['http://h/x'],
      missing: ['http://h/x/'],
      emptyItems: false,
    });
  });
  it('leading space differs (no trimming)', () => {
    expect(compareAllowlist(` ${DECLARED_ENTRY};${CANARY}`, [DECLARED_ENTRY], CANARY)).toMatchObject({
      extra: [` ${DECLARED_ENTRY}`],
      missing: [DECLARED_ENTRY],
    });
  });
  it('case differs (no normalization)', () => {
    expect(compareAllowlist(`HTTP://h/x/;${CANARY}`, ['http://h/x/'], CANARY)).toMatchObject({
      extra: ['HTTP://h/x/'],
      missing: ['http://h/x/'],
    });
  });
  it('one trailing ; is equal', () => {
    expect(compareAllowlist(`${DECLARED_ENTRY};${CANARY};`, [DECLARED_ENTRY], CANARY)).toMatchObject(equal);
  });
  it('leading ; → emptyItems, and the empty item is in neither extra nor missing', () => {
    expect(compareAllowlist(`;http://a/;${CANARY}`, ['http://a/'], CANARY)).toEqual({
      extra: [],
      missing: [],
      emptyItems: true,
      expected: `http://a/;${CANARY}`,
    });
  });
  it('a;;b → emptyItems', () => {
    expect(compareAllowlist(`http://a/;;${CANARY}`, ['http://a/'], CANARY).emptyItems).toBe(true);
  });
  it('two trailing ; → emptyItems (only one is tolerated)', () => {
    expect(compareAllowlist(`http://a/;${CANARY};;`, ['http://a/'], CANARY).emptyItems).toBe(true);
  });
  it('absent value → everything missing, no empty item', () => {
    expect(compareAllowlist(undefined, ['http://a/'], CANARY)).toMatchObject({
      extra: [],
      missing: ['http://a/', CANARY],
      emptyItems: false,
    });
  });
  it('expected is declared entries then the canary, joined by ;', () => {
    expect(compareAllowlist('', ['http://a/', 'http://b/'], CANARY).expected).toBe(`http://a/;http://b/;${CANARY}`);
  });
});

describe('parseContainerEnv', () => {
  it('splits on the first =', () => {
    expect({ ...parseContainerEnv('["A=1","B=x=y"]') }).toEqual({ A: '1', B: 'x=y' });
  });
  it('reads keys by name from a shuffled spike capture', () => {
    const capture = SPIKE_CAPTURE;
    const rest = capture.filter((e) => !e.startsWith('GITHUB_ACTIONS=') && !e.startsWith('CI='));
    const shuffled = ['GITHUB_ACTIONS=true', 'CI=true', ...[...rest].reverse()];
    for (const text of [JSON.stringify(capture), JSON.stringify(shuffled)]) {
      const env = parseContainerEnv(text);
      expect(env.PLANTUML_SECURITY_PROFILE).toBe('ALLOWLIST');
      expect(env.PLANTUML_ALLOWLIST_URL).toBe(
        'http://dk-canary:18091/dk-declared/;http://dk-canary:18091/dk-canary/allowed/',
      );
    }
  });
  it.each(['not json', '{"A":"1"}', '"A=1"', '[1]'])('%j → ServiceConfigError', (text) => {
    expect(() => parseContainerEnv(text)).toThrow(ServiceConfigError);
    expect(() => parseContainerEnv(text)).toThrow(/could not read the service configuration/);
  });
  it('a PLANTUML_* key set twice with different values fails closed', () => {
    expect(() =>
      parseContainerEnv('["PLANTUML_SECURITY_PROFILE=ALLOWLIST","PLANTUML_SECURITY_PROFILE=INTERNET"]'),
    ).toThrow(ServiceConfigError);
    // Positive control: the same key twice with the same value is fine.
    expect(parseContainerEnv('["PLANTUML_SECURITY_PROFILE=ALLOWLIST","PLANTUML_SECURITY_PROFILE=ALLOWLIST"]')
      .PLANTUML_SECURITY_PROFILE).toBe('ALLOWLIST');
  });
});

// SecurityUtils.getenv(name) returns System.getProperty(name) first, so the upper-case
// underscore form overrides the env variable; every env value is scanned, not a fixed list.
describe('systemPropertyConfig (one positive/negative table)', () => {
  const VARS = ['JAVA_OPTS', 'JAVA_OPTIONS', 'JAVA_TOOL_OPTIONS', 'JDK_JAVA_OPTIONS', 'CATALINA_OPTS'];
  const POSITIVE = [
    '-Xmx1g -Dplantuml.security.profile=INTERNET',
    '-Dplantuml.allowlist.url=http://x/',
    '-Dplantuml.include.path=/x',
    '-DPLANTUML_SECURITY_PROFILE=INTERNET',
    '-Xmx1g -DPLANTUML_ALLOWLIST_URL=http://x/',
    '-D"plantuml_property_file=/p"',
    '-DPlantUml.Security.Profile=INTERNET',
  ];
  // Harmless PlantUML tuning is not a security setting: it must not fail the check.
  const NEGATIVE = ['-Xmx1g', '-Dfoo=bar -Xmx1g', '-DPLANTUML_LIMIT_SIZE=8192 -Dplantuml.dot.timeout=30'];

  it.each(VARS)('%s: every PlantUML property form → true; unrelated or tuning values → false', (name) => {
    for (const value of POSITIVE) expect(systemPropertyConfig({ [name]: value }), `${name}=${value}`).toBe(true);
    for (const value of NEGATIVE) expect(systemPropertyConfig({ [name]: value }), `${name}=${value}`).toBe(false);
  });

  it.each([
    ['_JAVA_OPTIONS', '-Dplantuml.allowlist.url=http://x/'],
    ['JETTY_OPTS', '-DPLANTUML_SECURITY_PROFILE=INTERNET'],
    ['START_OPTIONS', '-Xmx1g -Dplantuml.security.profile=INTERNET'],
    ['OTHER', '-Dplantuml.include.path=/x'],
    ['WRAPPER', "sh -c 'PLANTUML_PROPERTY_FILE=/p exec /entrypoint.sh'"],
    ['JAVA_TOOL_OPTIONS', '-Xmx1g @/opt/args.txt'],
  ])('any env value is scanned: %s=%s → true', (name, value) => {
    expect(systemPropertyConfig({ PLANTUML_SECURITY_PROFILE: 'SANDBOX', [name]: value })).toBe(true);
  });

  it('an env variable named plantuml.* fails closed', () => {
    expect(systemPropertyConfig({ 'plantuml.allowlist.url': 'http://evil/' })).toBe(true);
    expect(systemPropertyConfig({ 'PlantUML.security.profile': 'INTERNET' })).toBe(true);
  });

  it('negatives: PLANTUML_* values themselves, unrelated values and empty input pass', () => {
    expect(systemPropertyConfig({ PLANTUML_ALLOWLIST_URL: 'http://a/', PLANTUML_SECURITY_PROFILE: 'ALLOWLIST' })).toBe(false);
    expect(
      systemPropertyConfig({
        _JAVA_OPTIONS: '-Xmx1g -Dfoo.bar=1',
        JETTY_OPTS: '-Djetty.http.port=8080',
        PLANTUML_SECURITY_PROFILE: 'ALLOWLIST',
        PLANTUML_ALLOWLIST_URL: 'https://styles.example.org/plantuml/;http://dk-canary:18091/dk-canary/allowed/',
        PATH: '/usr/local/bin:/usr/bin',
      }),
    ).toBe(false);
    expect(systemPropertyConfig({ JAVA_OPTS: '-Xmx1g', PATH: '/bin' })).toBe(false);
    expect(systemPropertyConfig({})).toBe(false);
  });
});

// Real `docker inspect -f '[{{json .Config.Entrypoint}},{{json .Config.Cmd}},{{json .Args}}]'`
// captures of the pinned image (2026-11-03; the experiment is recorded in
// plantuml-include-check-halves.test.ts): run with no command, and run with two -D words.
const ARGS_CLEAN = '[["/entrypoint.sh"],null,[]]\n';
const ARGS_PROPERTIES =
  '[["/entrypoint.sh"],["-Dplantuml.allowlist.url=http://dk-inc:8000/","-DPLANTUML_SECURITY_PROFILE=INTERNET"],["-Dplantuml.allowlist.url=http://dk-inc:8000/","-DPLANTUML_SECURITY_PROFILE=INTERNET"]]\n';

describe('parseContainerArgs', () => {
  it('flattens entrypoint, cmd and args, skipping null parts', () => {
    expect(parseContainerArgs(ARGS_CLEAN)).toEqual(['/entrypoint.sh']);
    expect(parseContainerArgs(ARGS_PROPERTIES)).toHaveLength(5);
  });
  it.each([
    ['not json', 'nope'],
    ['not an array', '{}'],
    ['two parts', '[null,null]'],
    ['four parts', '[null,null,null,null]'],
    ['a string part', '["/entrypoint.sh",null,[]]'],
    ['a non-string word', '[[1],null,[]]'],
  ])('%s fails closed', (_name, text) => {
    expect(() => parseContainerArgs(text)).toThrow(ServiceConfigError);
  });
});

describe('commandLineProperties', () => {
  it.each([
    ['-DPLANTUML_SECURITY_PROFILE=INTERNET'],
    ['-Dplantuml.security.profile=INTERNET'],
    ['-Dplantuml.allowlist.url=http://x/'],
    ['-DPlantUml_Include_Path=/x'],
    ['eval "$(tail -1 jetty.start | sed "s#java #java -Dplantuml.allowlist.url=http://x/ #")"'],
    ['plantuml.allowlist.url=http://x/'],
    ['@/opt/args.txt'],
  ])('%s → true', (word) => {
    expect(commandLineProperties(['/entrypoint.sh', word])).toBe(true);
  });
  it('positive control: unrelated words pass', () => {
    expect(commandLineProperties(['/entrypoint.sh', '-Dfoo.bar=1', '-Xmx1g', '--module=http', '/plantuml.war'])).toBe(false);
    expect(commandLineProperties(parseContainerArgs(ARGS_CLEAN))).toBe(false);
    expect(commandLineProperties([])).toBe(false);
    expect(commandLineProperties(['/entrypoint.sh', '-DPLANTUML_LIMIT_SIZE=8192'])).toBe(false);
  });
  it('the real capture with -D words → true', () => {
    expect(commandLineProperties(parseContainerArgs(ARGS_PROPERTIES))).toBe(true);
  });
});

describe('propertyFileConfig', () => {
  it('a non-empty PLANTUML_PROPERTY_FILE → true; unset or empty → false (positive control)', () => {
    expect(propertyFileConfig({ PLANTUML_PROPERTY_FILE: '/props/p.properties' })).toBe(true);
    expect(propertyFileConfig({ PLANTUML_PROPERTY_FILE: '' })).toBe(false);
    expect(propertyFileConfig({ PLANTUML_SECURITY_PROFILE: 'SANDBOX' })).toBe(false);
    expect(propertyFileConfig(undefined)).toBe(false);
  });
});

describe('commandLineProperties: a property file set inside sh -c', () => {
  it("sh -c 'PLANTUML_PROPERTY_FILE=… exec …' → true; an unrelated sh -c → false", () => {
    expect(commandLineProperties(['/bin/sh', '-c', 'PLANTUML_PROPERTY_FILE=/props/p.properties exec /entrypoint.sh'])).toBe(true);
    expect(commandLineProperties(['/bin/sh', '-c', 'FOO=1 exec /entrypoint.sh'])).toBe(false);
  });
});

describe('checkUnsetProfile', () => {
  it('fails closed on PLANTUML_PROPERTY_FILE even with SANDBOX; an empty value passes', () => {
    const r = checkUnsetProfile({ PLANTUML_SECURITY_PROFILE: 'SANDBOX', PLANTUML_PROPERTY_FILE: '/p' }, []);
    expect(r).toMatchObject({ ok: false, reason: 'property-file' });
    expect(r.ok === false && r.message).toContain('configured through a PlantUML property file (PLANTUML_PROPERTY_FILE)');
    expect(checkUnsetProfile({ PLANTUML_SECURITY_PROFILE: 'SANDBOX', PLANTUML_PROPERTY_FILE: '' }, [])).toEqual({ ok: true });
  });

  it('fails closed on command-line properties even with SANDBOX; an unrelated word passes', () => {
    const r = checkUnsetProfile({ PLANTUML_SECURITY_PROFILE: 'SANDBOX' }, ['-DPLANTUML_SECURITY_PROFILE=INTERNET']);
    expect(r).toMatchObject({ ok: false, reason: 'command-line-properties' });
    expect(r.ok === false && r.message).toContain('configured through Java system properties on the container command line');
    expect(checkUnsetProfile({ PLANTUML_SECURITY_PROFILE: 'SANDBOX' }, ['-Dfoo.bar=1'])).toEqual({ ok: true });
  });

  it('fails on -DPLANTUML_SECURITY_PROFILE=INTERNET even with SANDBOX; -Dfoo=bar passes', () => {
    const r = checkUnsetProfile({ PLANTUML_SECURITY_PROFILE: 'SANDBOX', JAVA_TOOL_OPTIONS: '-DPLANTUML_SECURITY_PROFILE=INTERNET' });
    expect(r).toMatchObject({ ok: false, reason: 'system-properties' });
    expect(r.ok === false && r.message).toContain('configured through Java system properties');
    expect(checkUnsetProfile({ PLANTUML_SECURITY_PROFILE: 'SANDBOX', JAVA_TOOL_OPTIONS: '-Dfoo=bar' })).toEqual({ ok: true });
  });
  it('fails on an env variable named plantuml.allowlist.url; positive control without it passes', () => {
    expect(checkUnsetProfile({ PLANTUML_SECURITY_PROFILE: 'SANDBOX', 'plantuml.allowlist.url': 'http://x/' })).toMatchObject({
      ok: false,
      reason: 'system-properties',
    });
    expect(checkUnsetProfile({ PLANTUML_SECURITY_PROFILE: 'SANDBOX' })).toEqual({ ok: true });
  });

  it('SANDBOX → ok', () => {
    expect(checkUnsetProfile({ PLANTUML_SECURITY_PROFILE: 'SANDBOX' })).toEqual({ ok: true });
  });
  it.each(['INTERNET', 'ALLOWLIST', 'sandbox'])('%s → names the value', (value) => {
    const r = checkUnsetProfile({ PLANTUML_SECURITY_PROFILE: value });
    expect(r.ok).toBe(false);
    expect(r).toMatchObject({
      message: `opt-in unset (sandbox), but the service's PLANTUML_SECURITY_PROFILE is "${value}"`,
    });
  });
  it('absent → image default INTERNET', () => {
    expect(checkUnsetProfile({})).toMatchObject({
      ok: false,
      message: "opt-in unset (sandbox), but the service's PLANTUML_SECURITY_PROFILE is not set (the image default is INTERNET)",
    });
  });
});

/** The container publishes the port of `url` on every address (like `-p <port>:8080`). */
const publishes = (url: string) => [{ containerPort: '8080/tcp', hostIp: '0.0.0.0', hostPort: Number(new URL(url).port) }];

// Real `docker inspect -f '{{json .NetworkSettings.Ports}}'` captures of the pinned image
// (2026-11-03): `-p 127.0.0.1:18601:8080`, `-p 18602:8080`, and no -p.
const PORTS_LOOPBACK = '{"8080/tcp":[{"HostIp":"127.0.0.1","HostPort":"18601"}]}\n';
const PORTS_ALL = '{"8080/tcp":[{"HostIp":"0.0.0.0","HostPort":"18602"},{"HostIp":"::","HostPort":"18602"}]}\n';
const PORTS_V6_LOOPBACK = '{"8080/tcp":[{"HostIp":"::1","HostPort":"18603"}]}\n';
const PORTS_NONE = '{"8080/tcp":null}\n';

describe('parseContainerPorts', () => {
  it('flattens the real captures', () => {
    expect(parseContainerPorts(PORTS_LOOPBACK)).toEqual([{ containerPort: '8080/tcp', hostIp: '127.0.0.1', hostPort: 18601 }]);
    expect(parseContainerPorts(PORTS_ALL)).toHaveLength(2);
    expect(parseContainerPorts(PORTS_NONE)).toEqual([]);
    expect(parseContainerPorts('{}')).toEqual([]);
    expect(parseContainerPorts('null')).toEqual([]);
  });
  it.each([['nope'], ['[]'], ['{"8080/tcp":{}}'], ['{"8080/tcp":[{"HostIp":"0.0.0.0","HostPort":8091}]}'], ['{"8080/tcp":[{"HostPort":"8091"}]}']])(
    '%s fails closed',
    (text) => {
      expect(() => parseContainerPorts(text)).toThrow(ServiceConfigError);
    },
  );
});

describe('checkServiceIdentity', () => {
  it.each([
    ['http://localhost:18602/svg/', PORTS_ALL],
    ['http://127.0.0.1:18602/svg/', PORTS_ALL],
    ['http://[::1]:18602/svg/', PORTS_ALL],
    ['http://127.0.0.1:18601/svg/', PORTS_LOOPBACK],
    ['http://localhost.:18602/svg/', PORTS_ALL],
    ['http://localhost:18601/svg/', PORTS_LOOPBACK],
    ['http://[::1]:18603/svg/', PORTS_V6_LOOPBACK],
    ['http://[::ffff:127.0.0.1]:18602/svg/', PORTS_ALL],
  ])('%s is served by the container → ok (positive control)', (url, ports) => {
    expect(checkServiceIdentity(url, parseContainerPorts(ports))).toEqual({ ok: true });
  });
  it.each([
    ['http://localhost:8091/svg/', PORTS_ALL, 'published: 0.0.0.0:18602->8080/tcp, :::18602->8080/tcp'],
    ['http://localhost:8091/svg/', PORTS_NONE, 'published: none'],
    ['http://127.0.0.2:8091/svg/', PORTS_NONE, 'published: none'],
    ['http://127.0.0.5:18601/svg/', PORTS_LOOPBACK, 'published: 127.0.0.1:18601->8080/tcp'],
    ['http://127.0.0.1:18603/svg/', PORTS_V6_LOOPBACK, 'published: ::1:18603->8080/tcp'],
  ])('%s with another published port → decoy, fails', (url, ports, published) => {
    const r = checkServiceIdentity(url, parseContainerPorts(ports));
    expect(r.ok).toBe(false);
    expect(r.ok === false && r.message).toBe(
      `the service container does not publish the --server port ${new URL(url).port} (${published}), so the check would read one container and test another service`,
    );
  });
  it('checkDeclaredMode prints the note once for a non-local --server and still passes', async () => {
    const port = await canaryPort();
    const fake = await startFakePlantuml('refuse');
    const viaName = 'http://plantuml:8080/svg/';
    const { verdict, lines } = await checkDeclaredMode({
      declared: { mode: 'internet', entries: [], source: 'environment' },
      serverUrl: viaName,
      canaryPort: port,
      container: 'svc',
      probe: async () => undefined,
      readPorts: async () => [],
      readArgs: async () => [],
      readEnv: async () => ({ PLANTUML_SECURITY_PROFILE: 'INTERNET' }),
      // The docker-network name does not resolve here: send the renders to the fake instead.
      fetchImpl: (url, init) => fetch(String(url).replace(viaName, fake.url), init),
    });
    expect(verdict).toMatchObject({ ok: true });
    expect(lines.filter((l) => l.includes('service identity was not verified'))).toEqual([
      'note — the --server host plantuml is not local, so the check cannot tie it to --service-container: service identity was not verified',
    ]);
  });
  it('a host-networked container publishes no ports: passes with a note naming host networking', () => {
    expect(checkServiceIdentity('http://127.0.0.1:8091/svg/', [], 'host')).toEqual({
      ok: true,
      note: 'note — the service container uses host networking and publishes no ports, so the check cannot tie --server to --service-container: service identity was not verified',
    });
    expect(checkServiceIdentity('http://127.0.0.1:8091/svg/', [], 'bridge')).toMatchObject({ ok: false });
  });
  it('a non-local host passes with a note that identity was not verified', () => {
    expect(checkServiceIdentity('http://plantuml:8080/svg/', [])).toEqual({
      ok: true,
      note: 'note — the --server host plantuml is not local, so the check cannot tie it to --service-container: service identity was not verified',
    });
  });
});

describe('isPortBusy', () => {
  it('matches on code and port, never on the message text', () => {
    const busy = Object.assign(new Error('anything'), { code: 'EADDRINUSE', port: 20001 });
    expect(isPortBusy(busy, 20001)).toBe(true);
    expect(isPortBusy(busy, 20002)).toBe(false);
    expect(isPortBusy(new Error(MESSAGES.portBusy(20001)), 20001)).toBe(false);
    expect(isPortBusy(undefined, 20001)).toBe(false);
  });
});

describe('MESSAGES and the verdict line', () => {
  const declaredTag = /declared (allowlist|internet)/;
  const observedTag = /\(observed: (sandbox|allowlist|internet|no class)\)/;
  const declaredModeMessages: [string, string, string[]][] = [
    ['allowed refused', MESSAGES.allowedRefused('sandbox'), ['declared allowlist, but the allowed path was refused', '(observed: sandbox)', '/dk-canary/allowed/']],
    ['denied fetched', MESSAGES.deniedFetched('internet'), ['declared allowlist, but the denied path was fetched', '/dk-canary/denied/']],
    ['entries differ', MESSAGES.entriesDiffer('allowlist', { extra: ['http://e/'], missing: ['http://m/'], expected: 'http://m/;c' }), ["declared allowlist, but the service's allowlist differs", '(observed: allowlist)', 'extra: http://e/', 'missing: http://m/', 'expected PLANTUML_ALLOWLIST_URL=http://m/;c']],
    ['allowlist profile', MESSAGES.profileMismatch('allowlist', 'INTERNET', 'internet'), ['declared allowlist, but the service\'s PLANTUML_SECURITY_PROFILE is "INTERNET"', '(observed: internet)']],
    ['internet profile SANDBOX', MESSAGES.profileMismatch('internet', 'SANDBOX', 'sandbox'), ['declared internet, but the service\'s PLANTUML_SECURITY_PROFILE is "SANDBOX"', '(observed: sandbox)']],
    ['internet profile ALLOWLIST', MESSAGES.profileMismatch('internet', 'ALLOWLIST', 'allowlist'), ['declared internet, but the service\'s PLANTUML_SECURITY_PROFILE is "ALLOWLIST"', '(observed: allowlist)']],
    ['internet profile unset', MESSAGES.profileMismatch('internet', undefined, null), ["declared internet, but the service's PLANTUML_SECURITY_PROFILE is", '(observed: no class)']],
    ['allowlist needs container', MESSAGES.needsContainer('allowlist'), ['declared allowlist needs --service-container to prove the denied path was reachable and the entries match']],
    ['internet needs container', MESSAGES.needsContainer('internet'), ["declared internet needs --service-container to read the service's security profile"]],
    ['empty entry', MESSAGES.emptyEntry('allowlist'), ["the service's PLANTUML_ALLOWLIST_URL has an empty entry, which allows every URL"]],
    ['allowed unreachable', MESSAGES.notReachable('allowlist', 'allowed', 'allowlist'), ["the canary's allowed path is not reachable from the service, so its fetch proves nothing"]],
    ['denied unreachable', MESSAGES.notReachable('allowlist', 'denied', 'allowlist'), ["the canary's denied path is not reachable from the service, so its refusal proves nothing"]],
    ['redirect', MESSAGES.redirectFollowed('allowlist', ['/dk-canary/denied/redirected/x']), ["the allowed path's redirect to the denied path was followed"]],
    ['stray', MESSAGES.strayRequest('internet', 'internet', '/dk-canary/stray'), ['the canary received a request outside its two paths: /dk-canary/stray']],
    ['inconsistent', MESSAGES.inconsistentFetches([{ fixture: 'a.puml', allowed: false, denied: true }]), ['inconsistent fetches', '(observed: no class)', 'a.puml allowed refused, denied fetched']],
    ['system properties', MESSAGES.inMode('allowlist', 'allowlist', MESSAGES.systemProperties()), ['configured through Java system properties; the check reads only PLANTUML_SECURITY_PROFILE and PLANTUML_ALLOWLIST_URL']],
    ['config unreadable', MESSAGES.inMode('internet', null, MESSAGES.configUnreadable('docker: not found')), ['could not read the service configuration (docker: not found)']],
    ['port busy', MESSAGES.inMode('allowlist', null, MESSAGES.portBusy(18091)), ['cannot listen on canary port 18091']],
    ['control no answer', MESSAGES.inMode('allowlist', null, MESSAGES.controlNoAnswer('http://s/svg/', 'ECONNREFUSED')), ['control: the PlantUML server at http://s/svg/ did not answer']],
    ['control not rendered', MESSAGES.inMode('allowlist', null, MESSAGES.controlNotRendered(500)), ['control: a plain diagram did not render']],
  ];
  it.each(declaredModeMessages)('%s carries its stable substrings, the declared mode and the observed class', (_n, text, subs) => {
    for (const sub of subs) expect(text).toContain(sub);
    expect(text).toMatch(declaredTag);
    expect(text).toMatch(observedTag);
  });
  it('omits extra: and missing: when empty', () => {
    const onlyMissing = MESSAGES.entriesDiffer('allowlist', { extra: [], missing: ['http://m/'], expected: 'x' });
    expect(onlyMissing).not.toContain('extra: ');
    expect(onlyMissing).toContain('missing: http://m/');
    const onlyExtra = MESSAGES.entriesDiffer('allowlist', { extra: ['http://e/'], missing: [], expected: 'x' });
    expect(onlyExtra).not.toContain('missing: ');
    expect(onlyExtra).toContain('extra: http://e/');
  });
  it('OK and warning texts', () => {
    expect(MESSAGES.allowlistOk([DECLARED_ENTRY])).toContain('OK — declared allowlist matches the service: ');
    expect(MESSAGES.internetOk()).toBe('OK — declared internet matches the service');
    expect(MESSAGES.internetWarning()).toBe(
      'warning — declared internet: the service may fetch any URL, including internal networks and cloud metadata endpoints',
    );
    expect(MESSAGES.failLine('x')).toBe('assert-plantuml-no-remote-include: FAIL — x');
  });
  it('formatVerdictLine', () => {
    expect(formatVerdictLine({ declared: 'allowlist', observed: 'allowlist' })).toBe(
      'assert-plantuml-no-remote-include: verdict: declared allowlist, observed allowlist',
    );
    expect(formatVerdictLine({ declared: { mode: 'internet', entries: [], source: 'environment' }, observed: null })).toBe(
      'assert-plantuml-no-remote-include: verdict: declared internet, observed no class',
    );
  });
});

describe('checkDeclaredMode', () => {
  const allowlist = { mode: 'allowlist' as const, entries: [DECLARED_ENTRY], source: 'environment' as const };
  const internet = { mode: 'internet' as const, entries: [], source: 'environment' as const };
  const fetchProbe = async (url: string) => {
    await fetch(url).then((r) => r.arrayBuffer());
  };
  const allowlistEnv = (port: number, extra: Record<string, string> = {}) => ({
    PLANTUML_SECURITY_PROFILE: 'ALLOWLIST',
    PLANTUML_ALLOWLIST_URL: `${DECLARED_ENTRY};${canaryEntry('127.0.0.1', port)}`,
    ...extra,
  });
  /** A fake ALLOWLIST service: fetches the allowed prefix only, twice per include (F4). */
  const allowlistService = (port: number, options = {}) =>
    startFakePlantuml(prefixPolicy([canaryEntry('127.0.0.1', port)]), { fetchCount: 2, ...options });

  it('passes a correctly configured allowlist service; the refused redirect is HTTP 200 (F3)', async () => {
    const port = await canaryPort();
    const fake = await allowlistService(port);
    const { verdict, lines } = await checkDeclaredMode({
      declared: allowlist,
      serverUrl: fake.url,
      canaryPort: port,
      container: 'svc',
      probe: fetchProbe,
      readPorts: async () => publishes(fake.url),
      readArgs: async () => [],
      readEnv: async () => allowlistEnv(port),
    });
    expect(verdict.messages).toEqual([]);
    expect(verdict).toMatchObject({
      ok: true,
      exitCode: 0,
      observed: 'allowlist',
      reachability: { allowed: true, denied: true },
      entries: { extra: [], missing: [] },
    });
    expect(lines).toContain('include-url.puml → allowed: HTTP 200, canary requests 2');
    expect(lines).toContain('include-url.puml → denied: HTTP 400, canary requests 0');
    expect(lines).toContain('include-url.puml → redirect: HTTP 200, canary requests 1');
    // NFR-001: the declared entry was never requested (the fake saw only canary URLs).
    expect(fake.includes.every((u) => u.startsWith(`http://127.0.0.1:${port}/dk-canary/`))).toBe(true);
  });

  it('positive control for F3: a followed redirect fails, judged from the log', async () => {
    const port = await canaryPort();
    const fake = await allowlistService(port, { followRedirects: true });
    const { verdict } = await checkDeclaredMode({
      declared: allowlist,
      serverUrl: fake.url,
      canaryPort: port,
      container: 'svc',
      probe: fetchProbe,
      readPorts: async () => publishes(fake.url),
      readArgs: async () => [],
      readEnv: async () => allowlistEnv(port),
    });
    expect(verdict.exitCode).toBe(1);
    expect(verdict.reasons).toEqual(['redirect-followed']);
    expect(verdict.messages[0]).toContain("the allowed path's redirect to the denied path was followed");
  });

  it('fails an allowlist run whose canary looks like allowlist but whose profile is INTERNET (F1 ii)', async () => {
    const port = await canaryPort();
    const fake = await allowlistService(port);
    const { verdict } = await checkDeclaredMode({
      declared: allowlist,
      serverUrl: fake.url,
      canaryPort: port,
      container: 'svc',
      probe: fetchProbe,
      readPorts: async () => publishes(fake.url),
      readArgs: async () => [],
      readEnv: async () => allowlistEnv(port, { PLANTUML_SECURITY_PROFILE: 'INTERNET' }),
    });
    expect(verdict).toMatchObject({ ok: false, exitCode: 1, observed: 'internet', reasons: ['profile-mismatch'] });
    expect(verdict.messages[0]).toContain(
      'declared allowlist, but the service\'s PLANTUML_SECURITY_PROFILE is "INTERNET" (observed: internet)',
    );
    expect(verdict.messages.join('\n')).not.toContain('the denied path was fetched');
  });

  it('reports every failing half: sandbox service with wrong entries', async () => {
    const port = await canaryPort();
    const fake = await startFakePlantuml('refuse');
    const { verdict } = await checkDeclaredMode({
      declared: allowlist,
      serverUrl: fake.url,
      canaryPort: port,
      container: 'svc',
      probe: fetchProbe,
      readPorts: async () => publishes(fake.url),
      readArgs: async () => [],
      readEnv: async () => ({ PLANTUML_SECURITY_PROFILE: 'SANDBOX', PLANTUML_ALLOWLIST_URL: ';http://other/' }),
    });
    expect(verdict.observed).toBe('sandbox');
    expect(verdict.reasons).toEqual(['allowed-refused', 'profile-mismatch', 'empty-entry', 'entries-differ']);
    const all = verdict.messages.join('\n');
    expect(all).toContain('declared allowlist, but the allowed path was refused');
    expect(all).toContain('(observed: sandbox)');
    expect(all).toContain('extra: http://other/');
    expect(all).toContain(`missing: ${DECLARED_ENTRY}, ${canaryEntry('127.0.0.1', port)}`);
  });

  it('fails when the denied path is not reachable from the service (edge case 7)', async () => {
    const port = await canaryPort();
    const fake = await allowlistService(port);
    const { verdict } = await checkDeclaredMode({
      declared: allowlist,
      serverUrl: fake.url,
      canaryPort: port,
      container: 'svc',
      probe: async (url) => (url.includes('/denied/') ? undefined : fetchProbe(url)),
      readPorts: async () => publishes(fake.url),
      readArgs: async () => [],
      readEnv: async () => allowlistEnv(port),
    });
    expect(verdict.reasons).toEqual(['not-reachable-denied']);
    expect(verdict.reachability).toEqual({ allowed: true, denied: false });
    expect(verdict.messages[0]).toContain("the canary's denied path is not reachable from the service");
  });

  it('fails on a request outside the two canary paths (NFR-001)', async () => {
    const port = await canaryPort();
    const fake = await allowlistService(port, { strayPath: '/dk-canary/stray' });
    const { verdict } = await checkDeclaredMode({
      declared: allowlist,
      serverUrl: fake.url,
      canaryPort: port,
      container: 'svc',
      probe: fetchProbe,
      readPorts: async () => publishes(fake.url),
      readArgs: async () => [],
      readEnv: async () => allowlistEnv(port),
    });
    expect(verdict.reasons).toEqual(['stray-request']);
    expect(verdict.messages[0]).toContain('the canary received a request outside its two paths: /dk-canary/stray');
  });

  it('fails closed on system properties and on an unreadable configuration', async () => {
    const port = await canaryPort();
    const fake = await allowlistService(port);
    const base = {
      declared: allowlist,
      serverUrl: fake.url,
      canaryPort: port,
      container: 'svc',
      probe: fetchProbe,
      readPorts: async () => publishes(fake.url),
    };
    const sys = await checkDeclaredMode({
      ...base,
      readPorts: async () => publishes(fake.url),
      readArgs: async () => [],
      readEnv: async () => allowlistEnv(port, { CATALINA_OPTS: '-Dplantuml.allowlist.url=http://x/' }),
    });
    expect(sys.verdict.reasons).toEqual(['system-properties']);
    const cmd = await checkDeclaredMode({
      ...base,
      readEnv: async () => allowlistEnv(port),
      readArgs: async () => parseContainerArgs(ARGS_PROPERTIES),
    });
    expect(cmd.verdict.reasons).toEqual(['command-line-properties']);
    expect(cmd.verdict.messages[0]).toContain('configured through Java system properties on the container command line');
    const unrelated = await checkDeclaredMode({
      ...base,
      readEnv: async () => allowlistEnv(port),
      readArgs: async () => ['/entrypoint.sh', '-Dfoo.bar=1'],
    });
    expect(unrelated.verdict).toMatchObject({ ok: true, reasons: [] });
    const argsUnreadable = await checkDeclaredMode({
      ...base,
      readEnv: async () => allowlistEnv(port),
      readArgs: async () => {
        throw new ServiceConfigError('docker inspect exited 1');
      },
    });
    expect(argsUnreadable.verdict).toMatchObject({ exitCode: 1, reasons: ['config-unreadable'] });
    // A container without a command-line reader is a programming error, never a silent skip.
    await expect(checkDeclaredMode({ ...base, readEnv: async () => allowlistEnv(port) })).rejects.toThrow(/readArgs/);
    await expect(
      checkDeclaredMode({ ...base, readPorts: undefined, readEnv: async () => allowlistEnv(port), readArgs: async () => [] }),
    ).rejects.toThrow(/readPorts/);
    const unreadable = await checkDeclaredMode({
      ...base,
      readPorts: async () => publishes(fake.url),
      readArgs: async () => [],
      readEnv: async () => {
        throw new ServiceConfigError('docker: command not found');
      },
    });
    expect(unreadable.verdict).toMatchObject({ exitCode: 1, observed: null, reasons: ['config-unreadable'] });
    expect(unreadable.verdict.messages[0]).toContain('could not read the service configuration (docker: command not found)');
  });

  it('passes internet mode on profile INTERNET although the service refuses the canary (F1)', async () => {
    const port = await canaryPort();
    const fake = await startFakePlantuml('fetch', { refusePrivateHosts: true, fetchCount: 2 });
    const { verdict, lines } = await checkDeclaredMode({
      declared: internet,
      serverUrl: fake.url,
      canaryPort: port,
      container: 'svc',
      probe: fetchProbe,
      readPorts: async () => publishes(fake.url),
      readArgs: async () => [],
      readEnv: async () => ({ PLANTUML_SECURITY_PROFILE: 'INTERNET' }),
    });
    expect(verdict).toMatchObject({ ok: true, exitCode: 0, observed: 'internet', messages: [] });
    expect(verdict.warnings).toEqual([MESSAGES.internetWarning()]);
    expect(lines).toContain('include-url.puml → denied: HTTP 400, canary requests 0');
  });

  it('fails internet mode on profile ALLOWLIST even when the fake fetches both paths', async () => {
    const port = await canaryPort();
    const fake = await startFakePlantuml('fetch', { fetchCount: 2 });
    const { verdict } = await checkDeclaredMode({
      declared: internet,
      serverUrl: fake.url,
      canaryPort: port,
      container: 'svc',
      probe: fetchProbe,
      readPorts: async () => publishes(fake.url),
      readArgs: async () => [],
      readEnv: async () => ({ PLANTUML_SECURITY_PROFILE: 'ALLOWLIST' }),
    });
    expect(verdict).toMatchObject({ ok: false, exitCode: 1, observed: 'allowlist', reasons: ['profile-mismatch'] });
    expect(verdict.messages[0]).toContain(
      'declared internet, but the service\'s PLANTUML_SECURITY_PROFILE is "ALLOWLIST" (observed: allowlist)',
    );
    expect(verdict.warnings).toEqual([]);
  });

  it.each([
    ['allowlist', 'JAVA_TOOL_OPTIONS', '-DPLANTUML_SECURITY_PROFILE=INTERNET'],
    ['allowlist', 'plantuml.allowlist.url', 'http://evil/'],
    ['internet', 'JAVA_TOOL_OPTIONS', '-DPLANTUML_SECURITY_PROFILE=SANDBOX'],
    ['internet', 'plantuml.security.profile', 'SANDBOX'],
  ] as const)('%s fails closed on %s=%s; -Dfoo=bar on the same run passes', async (mode, key, value) => {
    const port = await canaryPort();
    const fake =
      mode === 'allowlist'
        ? await allowlistService(port)
        : await startFakePlantuml('fetch', { refusePrivateHosts: true, fetchCount: 2 });
    const env = mode === 'allowlist' ? allowlistEnv(port) : { PLANTUML_SECURITY_PROFILE: 'INTERNET' };
    const run = (extra: Record<string, string>) =>
      checkDeclaredMode({
        declared: mode === 'allowlist' ? allowlist : internet,
        serverUrl: fake.url,
        canaryPort: port,
        container: 'svc',
        probe: fetchProbe,
        readPorts: async () => publishes(fake.url),
        readArgs: async () => [],
        readEnv: async () => ({ ...env, ...extra }),
      });
    const bad = await run({ [key]: value });
    expect(bad.verdict).toMatchObject({ ok: false, exitCode: 1, reasons: ['system-properties'] });
    expect(bad.verdict.messages[0]).toContain('configured through Java system properties');
    const good = await run({ JAVA_TOOL_OPTIONS: '-Dfoo=bar' });
    expect(good.verdict).toMatchObject({ ok: true, exitCode: 0, messages: [] });
  });

  it.each([
    ['property-file', { PLANTUML_PROPERTY_FILE: '/props/p.properties' }, [] as string[]],
    ['command-line-properties', {}, ['-Dplantuml.allowlist.url=http://x/']],
  ])('internet fails closed on the %s channel too', async (reason, extra, args) => {
    const port = await canaryPort();
    const fake = await startFakePlantuml('fetch', { refusePrivateHosts: true, fetchCount: 2 });
    const { verdict } = await checkDeclaredMode({
      declared: internet,
      serverUrl: fake.url,
      canaryPort: port,
      container: 'svc',
      probe: fetchProbe,
      readPorts: async () => publishes(fake.url),
      readArgs: async () => args,
      readEnv: async () => ({ PLANTUML_SECURITY_PROFILE: 'INTERNET', ...extra }),
    });
    expect(verdict).toMatchObject({ ok: false, exitCode: 1 });
    expect(verdict.reasons).toContain(reason);
  });

  it('matches include paths exactly: a fixture whose name prefixes another does not borrow its fetches', async () => {
    const source = '@startuml\n!include {{CANARY_URL}}\nAlice -> Bob : local\n@enduml\n';
    // a.puml2 renders first, so a prefix match would credit its fetch to a.puml.
    const fixtures = [
      { name: 'a.puml2', source },
      { name: 'a.puml', source },
    ];
    const port = await canaryPort();
    const allowedA2 = `${canaryEntry('127.0.0.1', port)}include/a.puml2`;
    const fake = await startFakePlantuml((url) => (url === allowedA2 ? 'fetch' : 'refuse'), { fetchCount: 2 });
    const { verdict } = await checkDeclaredMode({
      declared: allowlist,
      serverUrl: fake.url,
      canaryPort: port,
      container: 'svc',
      probe: fetchProbe,
      readPorts: async () => publishes(fake.url),
      readArgs: async () => [],
      readEnv: async () => allowlistEnv(port),
      fixtures,
    });
    expect(verdict.reasons).toEqual(['inconsistent fetches']);
    expect(verdict.messages[0]).toContain('a.puml allowed refused');
    expect(verdict.messages[0]).toContain('a.puml2 allowed fetched');
    // Positive control, same fixtures: a service fetching both allowed paths passes.
    const port2 = await canaryPort();
    const both = await allowlistService(port2);
    const control = await checkDeclaredMode({
      declared: allowlist,
      serverUrl: both.url,
      canaryPort: port2,
      container: 'svc',
      probe: fetchProbe,
      readPorts: async () => publishes(both.url),
      readArgs: async () => [],
      readEnv: async () => allowlistEnv(port2),
      fixtures,
    });
    expect(control.verdict).toMatchObject({ ok: true, messages: [] });
  });

  describe('without a container', () => {
    // The canary port is held by the test: had the check started the canary, it would
    // report "cannot listen" (exit 2) instead (positive control below).
    async function heldPort() {
      const server = trackServer(createServer());
      await new Promise<void>((r) => server.listen(0, '0.0.0.0', r));
      return (server.address() as { port: number }).port;
    }

    it.each([
      ['allowlist', allowlist, 'declared allowlist needs --service-container'],
      ['internet', internet, 'declared internet needs --service-container to read the service\'s security profile'],
    ] as const)('%s fails before starting the canary', async (_m, declared, text) => {
      const port = await heldPort();
      const fake = await startFakePlantuml('fetch');
      let called = 0;
      const { verdict } = await checkDeclaredMode({
        declared,
        serverUrl: fake.url,
        canaryPort: port,
        probe: async () => void called++,
        readPorts: async () => publishes(fake.url),
        readArgs: async () => [],
        readEnv: async () => (called++, {}),
      });
      expect(verdict).toMatchObject({ ok: false, exitCode: 1, observed: null, reasons: ['needs-container'] });
      expect(verdict.messages[0]).toContain(text);
      expect(called).toBe(0);
      expect(fake.includes).toEqual([]);
    });

    it('positive control: with a container the held port is a busy canary port (exit 2)', async () => {
      const port = await heldPort();
      const fake = await startFakePlantuml('fetch');
      const { verdict } = await checkDeclaredMode({
        declared: allowlist,
        serverUrl: fake.url,
        canaryPort: port,
        container: 'svc',
        probe: fetchProbe,
        readPorts: async () => publishes(fake.url),
        readArgs: async () => [],
        readEnv: async () => ({}),
      });
      expect(verdict).toMatchObject({ ok: false, exitCode: 2, reasons: ['port-busy'] });
      expect(verdict.messages[0]).toContain(`cannot listen on canary port ${port}`);
    });
  });
});
