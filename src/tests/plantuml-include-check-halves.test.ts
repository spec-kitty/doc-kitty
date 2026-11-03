/**
 * Half-removal proofs, edge cases, NFR-001 pair, docker failures and unset-profile rows of
 * the PlantUML include-check CLI (#268: FR-002, FR-004, FR-006, FR-011, NFR-001, C-003).
 * Everything runs the REAL command through the shared harness against a fake PlantUML
 * service, a fake `docker` and free ports; nothing here binds the fixed declared port.
 *
 * Each half-removal row differs from a passing baseline in exactly one half. It asserts
 * its own stable substring AND the absence of every other row's substring, so a row can
 * only go red for its own reason.
 *
 * ---------------------------------------------------------------------------------------
 * MUTATION RECORD (USE_MUTATION_TESTING_TO_VALIDATE_TEST_QUALITY), done by hand against
 * src/scripts/plantuml-mode-check.mjs at commit 0749380 (WP06 cycle 2): the cited lines
 * were deleted locally one half at a time, this file run, and the change reverted.
 *
 *   row   | half removed (each line replaced by `;`)                | rows that turned red (and nothing else)
 *   ------+---------------------------------------------------------+----------------------------------------
 *   a     | :508 fail('allowed-refused', ...)                       | row a
 *   b     | :448 fail(`not-reachable-${which}`, ...)                | row b; edge 7 (allowed-path variant)
 *   c1    | :531 profile !== 'ALLOWLIST' -> profile-mismatch        | row c1
 *   c2,c3 | :537 fail('entries-differ', ...) (one shared check)     | rows c2 and c3
 *   c4    | :535 if (diff.emptyItems) fail('empty-entry', ...)      | row c4
 *   i     | :387 fail('needs-container', ...)                       | row i; allowlist without container (AS3)
 *   ii    | :541 internet profile !== 'INTERNET' -> mismatch        | row ii
 *   edge 8| :489 fail('redirect-followed', ...)                     | edge 8 (followed redirect)
 *   NFR-1 | :496 fail('stray-request', ...)                         | NFR-001 stray-path variant
 *   sys   | :524 fail('system-properties', ...) (declared modes)    | Java properties row; plantuml.* env row
 *   u4    | :314 checkUnsetProfile system-property return          | the three u4 rows
 *   u0    | :317 checkUnsetProfile SANDBOX-is-ok return             | u0
 *   u1-u3 | :318 checkUnsetProfile profile-mismatch return          | u1, u2, u3
 *
 * In every mutated run both baselines stayed green: only the cited rows moved. (u5 and the docker
 * rows depend on the config reader in plantuml-service-config.mjs, not on a half above.)
 * ---------------------------------------------------------------------------------------
 */
import { afterEach, describe, expect, it } from 'vitest';
import { createServer } from 'node:http';
import { existsSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { encodePlantuml } from '../scripts/plantuml-include-guard.mjs';
import {
  canaryPort,
  closeAll,
  normalizePorts,
  prefixPolicy,
  runCheck,
  startFakePlantuml,
  trackServer,
  type CheckResult,
  type FakePlantumlOptions,
} from './helpers/plantuml-check-harness';

const FIXTURES = path.resolve(path.dirname(fileURLToPath(import.meta.url)), 'fixtures');
const GOLDEN_DIR = path.join(FIXTURES, 'plantuml-include-check');
const CAPTURE = JSON.parse(readFileSync(path.join(FIXTURES, 'plantuml-fake-docker/inspect-capture.json'), 'utf8')) as string[];
const ARGS_TEMPLATE = '[{{json .Config.Entrypoint}},{{json .Config.Cmd}},{{json .Args}}]';
const ARGS_PROPERTIES = path.join(FIXTURES, 'plantuml-fake-docker/inspect-args-capture-properties.json');

const canaryEntry = (port: number) => `http://127.0.0.1:${port}/dk-canary/allowed/`;
const all = (r: CheckResult) => `${r.stdout}\n${r.stderr}`;

afterEach(closeAll);

/** A temp file holding the captured container env with the given keys replaced (null deletes) and extras appended. */
function inspectFile(overrides: Record<string, string | null> = {}, extra: string[] = []): string {
  const kept = CAPTURE.filter((item) => !Object.hasOwn(overrides, item.slice(0, item.indexOf('='))));
  const set = Object.entries(overrides)
    .filter(([, v]) => v !== null)
    .map(([k, v]) => `${k}=${v}`);
  const file = path.join(mkdtempSync(path.join(tmpdir(), 'dk-inspect-')), 'inspect.json');
  writeFileSync(file, JSON.stringify([...kept, ...set, ...extra]));
  return file;
}

interface Setup {
  /** The declared entry's own server: it must never be requested (NFR-001). */
  declaredHits: string[];
  declaredEntry: string;
  canaryPort: number;
  fake: Awaited<ReturnType<typeof startFakePlantuml>>;
  expected: string;
}

/** Ports, a request-counting server for the declared entry, and a fake service. */
async function setup(
  policy: 'allowlist' | 'refuse' = 'allowlist',
  options: FakePlantumlOptions = {},
): Promise<Setup> {
  const port = await canaryPort();
  const declaredHits: string[] = [];
  const declared = trackServer(
    createServer((req, res) => {
      declaredHits.push(req.url ?? '');
      res.writeHead(200).end('declared');
    }),
  );
  await new Promise<void>((r) => declared.listen(0, '127.0.0.1', r));
  const declaredPort = (declared.address() as { port: number }).port;
  const declaredEntry = `http://127.0.0.1:${declaredPort}/dk-declared/`;
  const fake = await startFakePlantuml(
    policy === 'allowlist' ? prefixPolicy([canaryEntry(port)]) : 'refuse',
    { fetchCount: 2, ...options },
  );
  return { declaredHits, declaredEntry, canaryPort: port, fake, expected: `${declaredEntry};${canaryEntry(port)}` };
}

interface RunOptions {
  declared?: string;
  container?: boolean;
  inspect?: string;
  env?: Record<string, string>;
  canaryPort?: number;
}

const runDeclared = (s: Setup, o: RunOptions = {}) =>
  runCheck(
    [
      '--server',
      s.fake.url,
      '--canary-port',
      String(o.canaryPort ?? s.canaryPort),
      ...(o.container === false ? [] : ['--service-container', 'fake']),
    ],
    {
      fakeDocker: true,
      env: {
        DK_PLANTUML_ALLOW_EXTERNAL: o.declared ?? s.declaredEntry,
        DK_FAKE_DOCKER_INSPECT_FILE:
          o.inspect ?? inspectFile({ PLANTUML_SECURITY_PROFILE: 'ALLOWLIST', PLANTUML_ALLOWLIST_URL: s.expected }),
        ...o.env,
      },
    },
  );

describe('half-removal table', () => {
  type Row = {
    name: string;
    substring: string;
    run: () => Promise<CheckResult>;
    /** The matching passing baseline. */
    baseline: 'allowlist' | 'internet';
  };
  const profileAllow = (s: Setup, allowlist: string) =>
    inspectFile({ PLANTUML_SECURITY_PROFILE: 'ALLOWLIST', PLANTUML_ALLOWLIST_URL: allowlist });

  const rows: Row[] = [
    {
      name: 'a',
      substring: 'the allowed path was refused',
      baseline: 'allowlist',
      run: async () => runDeclared(await setup('refuse')),
    },
    {
      name: 'b',
      substring: "the canary's denied path is not reachable from the service",
      baseline: 'allowlist',
      run: async () => runDeclared(await setup(), { env: { DK_FAKE_DOCKER_EXEC_FAIL_MATCH: '/dk-canary/denied/' } }),
    },
    {
      name: 'c1',
      substring: "declared allowlist, but the service's PLANTUML_SECURITY_PROFILE is",
      baseline: 'allowlist',
      run: async () => {
        const s = await setup();
        return runDeclared(s, {
          inspect: inspectFile({ PLANTUML_SECURITY_PROFILE: 'SANDBOX', PLANTUML_ALLOWLIST_URL: s.expected }),
        });
      },
    },
    {
      name: 'c2',
      substring: 'extra: ',
      baseline: 'allowlist',
      run: async () => {
        const s = await setup();
        return runDeclared(s, { inspect: profileAllow(s, `${s.expected};http://extra.example/x/`) });
      },
    },
    {
      name: 'c3',
      substring: 'missing: ',
      baseline: 'allowlist',
      run: async () => {
        const s = await setup();
        return runDeclared(s, { inspect: profileAllow(s, canaryEntry(s.canaryPort)) });
      },
    },
    {
      name: 'c4',
      substring: 'has an empty entry, which allows every URL',
      baseline: 'allowlist',
      run: async () => {
        const s = await setup();
        return runDeclared(s, { inspect: profileAllow(s, `;${s.expected}`) });
      },
    },
    {
      name: 'i',
      substring: "declared internet needs --service-container to read the service's security profile",
      baseline: 'internet',
      run: async () => {
        const s = await setup('refuse');
        return runDeclared(s, { declared: 'internet', container: false });
      },
    },
    {
      name: 'ii',
      substring: "declared internet, but the service's PLANTUML_SECURITY_PROFILE is",
      baseline: 'internet',
      run: async () => {
        const s = await setup('refuse');
        return runDeclared(s, { declared: 'internet', inspect: inspectFile({ PLANTUML_SECURITY_PROFILE: 'ALLOWLIST' }) });
      },
    },
  ];

  /** Baselines: every row differs from one of these in exactly one half. */
  const baselines = {
    allowlist: async () => runDeclared(await setup()),
    internet: async () =>
      runDeclared(await setup('refuse'), { declared: 'internet', inspect: inspectFile({ PLANTUML_SECURITY_PROFILE: 'INTERNET' }) }),
  };

  it('allowlist baseline passes and contains no row substring', async () => {
    const out = await baselines.allowlist();
    expect(out.exit).toBe(0);
    expect(all(out)).toContain('OK — declared allowlist matches the service');
    for (const row of rows) expect(all(out), `baseline vs ${row.name}`).not.toContain(row.substring);
  });

  it('internet baseline passes (a real INTERNET service refuses the private canary, F1)', async () => {
    const out = await baselines.internet();
    expect(out.exit).toBe(0);
    expect(all(out)).toContain('OK — declared internet matches the service');
    for (const row of rows) expect(all(out), `baseline vs ${row.name}`).not.toContain(row.substring);
  });

  for (const row of rows) {
    it(`row ${row.name}: exit 1, own substring present, every other row's substring absent`, async () => {
      const out = await row.run();
      expect(out.exit).toBe(1);
      expect(out.stderr).toContain(row.substring);
      for (const other of rows.filter((r) => r !== row)) {
        expect(all(out), `row ${row.name} must not print row ${other.name}'s substring`).not.toContain(other.substring);
      }
    });
  }
});

describe('edge cases at the command', () => {
  const bad = ['yes', 'INTERNET', 'ftp://a/', 'https://a.example/a@b/'];

  it.each(bad)('1/9: malformed %j exits 2 before rendering or probing', async (value) => {
    const s = await setup();
    const log = path.join(mkdtempSync(path.join(tmpdir(), 'dk-log-')), 'docker.log');
    const out = await runCheck(['--server', s.fake.url, '--service-container', 'fake'], {
      fakeDocker: true,
      env: { DK_PLANTUML_ALLOW_EXTERNAL: value, DK_FAKE_DOCKER_LOG: log },
    });
    expect(out.exit).toBe(2);
    expect(out.stderr).toContain('invalid DK_PLANTUML_ALLOW_EXTERNAL (environment)');
    expect(out.stderr).toContain('accepted:');
    expect(s.fake.includes).toEqual([]);
    expect(existsSync(log)).toBe(false);
  });

  it('1/9 positive control: a valid value on the same setup renders and probes', async () => {
    const s = await setup();
    const log = path.join(mkdtempSync(path.join(tmpdir(), 'dk-log-')), 'docker.log');
    const out = await runDeclared(s, { env: { DK_FAKE_DOCKER_LOG: log } });
    expect(out.exit).toBe(0);
    expect(s.fake.includes.length).toBeGreaterThan(0);
    expect(readFileSync(log, 'utf8').length).toBeGreaterThan(0);
  });

  it('2: an empty allowlist ";" exits 2', async () => {
    const out = await runCheck(['--print-declared'], { env: { DK_PLANTUML_ALLOW_EXTERNAL: ';' } });
    expect(out.exit).toBe(2);
    expect(out.stderr).toContain('an empty allowlist is not sandbox');
  });

  it('3: a bare host exits 2 and a slash-terminated one is accepted', async () => {
    const bad = await runCheck(['--print-declared'], { env: { DK_PLANTUML_ALLOW_EXTERNAL: 'http://host' } });
    expect(bad.exit).toBe(2);
    expect(bad.stderr).toContain('must end with "/"');
    const ok = await runCheck(['--print-declared'], { env: { DK_PLANTUML_ALLOW_EXTERNAL: 'http://host/' } });
    expect(ok.exit).toBe(0);
  });

  it('4/6: ";" in the env value separates entries; the source is the environment', async () => {
    const out = await runCheck(['--print-declared'], {
      env: { DK_PLANTUML_ALLOW_EXTERNAL: 'https://a.example/x/;https://b.example/y/' },
    });
    expect(out.exit).toBe(0);
    expect(out.stdout).toContain('"source":"environment"');
    expect(JSON.parse(out.stdout)).toEqual({
      mode: 'allowlist',
      entries: ['https://a.example/x/', 'https://b.example/y/'],
      source: 'environment',
    });
  });

  it('5: an empty env value is unset: output equals the unset golden', async () => {
    const fake = await startFakePlantuml('refuse');
    const out = await runCheck(['--server', fake.url], { env: { DK_PLANTUML_ALLOW_EXTERNAL: '' } });
    const golden = (ext: string) => readFileSync(path.join(GOLDEN_DIR, `golden-unset-refuse-no-container.${ext}`), 'utf8');
    expect(normalizePorts(out.stdout)).toBe(golden('stdout'));
    expect(normalizePorts(out.stderr)).toBe(golden('stderr'));
    expect(`${out.exit}\n`).toBe(golden('exit'));
  });

  it('7: an unreachable canary fails a declared allowlist; unset reproduces the golden', async () => {
    const s = await setup();
    const declaredOut = await runDeclared(s, { env: { DK_FAKE_DOCKER_EXEC_FAIL: '1' } });
    expect(declaredOut.exit).toBe(1);
    expect(declaredOut.stderr).toContain("the canary's allowed path is not reachable");

    const fake = await startFakePlantuml('refuse');
    const unset = await runCheck(['--server', fake.url, '--service-container', 'fake'], {
      fakeDocker: true,
      env: {
        DK_FAKE_DOCKER_INSPECT_FILE: path.join(GOLDEN_DIR, 'inspect-sandbox.json'),
        DK_FAKE_DOCKER_EXEC_FAIL: '1',
      },
    });
    const golden = (ext: string) => readFileSync(path.join(GOLDEN_DIR, `golden-unset-canary-unreachable.${ext}`), 'utf8');
    expect(normalizePorts(unset.stdout)).toBe(golden('stdout'));
    expect(normalizePorts(unset.stderr)).toBe(golden('stderr'));
    expect(`${unset.exit}\n`).toBe(golden('exit'));
  });

  it('8: a refused redirect renders HTTP 200 and passes; a followed redirect fails, judged from the log (F3)', async () => {
    const passing = await runDeclared(await setup());
    expect(passing.exit).toBe(0);
    expect(passing.stdout).toMatch(/redirect: HTTP 200/);

    const s = await setup('allowlist', { followRedirects: true });
    const out = await runDeclared(s);
    expect(out.exit).toBe(1);
    expect(out.stderr).toContain("the allowed path's redirect to the denied path was followed");
  });

  it('9: --astro-config naming a missing file exits 2', async () => {
    const out = await runCheck(['--print-declared', '--astro-config', path.join(tmpdir(), 'dk-missing', 'astro.config.mjs')]);
    expect(out.exit).toBe(2);
    expect(all(out)).toContain('no such file');
  });
});

describe('NFR-001, docker failures and Java system properties', () => {
  it('NFR-001: the declared entry receives 0 requests on the passing run (positive control: the run did render)', async () => {
    const s = await setup();
    const out = await runDeclared(s);
    expect(out.exit).toBe(0);
    expect(s.fake.includes.length).toBeGreaterThan(0);
    expect(s.declaredHits).toEqual([]);
  });

  it('NFR-001: a stray canary request exits 1 with the stray path', async () => {
    const s = await setup('allowlist', { strayPath: '/dk-canary/stray' });
    const out = await runDeclared(s);
    expect(out.exit).toBe(1);
    expect(out.stderr).toContain('the canary received a request outside its two paths: /dk-canary/stray');
    expect(s.declaredHits).toEqual([]);
  });

  it('docker missing (node-only PATH) fails an allowlist with the unreadable-config message', async () => {
    const s = await setup();
    const out = await runCheck(['--server', s.fake.url, '--service-container', 'fake', '--canary-port', String(s.canaryPort)], {
      pathMode: 'node-only',
      env: { DK_PLANTUML_ALLOW_EXTERNAL: s.declaredEntry },
    });
    expect(out.exit).toBe(1);
    expect(out.stderr).toContain('could not read the service configuration');
    expect(out.stderr).toContain('docker not found on PATH');
  });

  it('docker erroring (DK_FAKE_DOCKER_FAIL) fails the same way; the same setup passes without it', async () => {
    const s = await setup();
    const out = await runDeclared(s, { env: { DK_FAKE_DOCKER_FAIL: '1' } });
    expect(out.exit).toBe(1);
    expect(out.stderr).toContain('could not read the service configuration');
    const control = await runDeclared(await setup());
    expect(control.exit).toBe(0);
  });

  it('Java system properties in the container env fail a declared allowlist', async () => {
    const s = await setup();
    const out = await runDeclared(s, {
      inspect: inspectFile(
        { PLANTUML_SECURITY_PROFILE: 'ALLOWLIST', PLANTUML_ALLOWLIST_URL: s.expected },
        ['JAVA_OPTS=-Dplantuml.security.profile=INTERNET'],
      ),
    });
    expect(out.exit).toBe(1);
    expect(out.stderr).toContain('configured through Java system properties');
  });

  it('an allowlist without --service-container fails (US1 AS3)', async () => {
    const out = await runDeclared(await setup(), { container: false });
    expect(out.exit).toBe(1);
    expect(out.stderr).toContain('declared allowlist needs --service-container');
  });

  it('C-003: every docker argv on a passing run is exactly the inspect or the exec-curl form', async () => {
    const s = await setup();
    const log = path.join(mkdtempSync(path.join(tmpdir(), 'dk-log-')), 'docker.log');
    const out = await runDeclared(s, { env: { DK_FAKE_DOCKER_LOG: log } });
    expect(out.exit).toBe(0);
    const argvs = readFileSync(log, 'utf8').trim().split('\n').map((l) => JSON.parse(l) as string[]);
    expect(argvs.length).toBeGreaterThan(2);
    for (const argv of argvs) {
      const isInspect =
        JSON.stringify(argv) === JSON.stringify(['inspect', '-f', '{{json .Config.Env}}', 'fake']) ||
        JSON.stringify(argv) === JSON.stringify(['inspect', '-f', ARGS_TEMPLATE, 'fake']) ||
        JSON.stringify(argv) === JSON.stringify(['inspect', '-f', '{{json .NetworkSettings.Ports}}', 'fake']);
      const isExec =
        argv.length === 9 &&
        JSON.stringify(argv.slice(0, 8)) ===
          JSON.stringify(['exec', 'fake', 'curl', '-sf', '--max-time', '5', '-o', '/dev/null']) &&
        argv[8].startsWith(`http://127.0.0.1:${s.canaryPort}/dk-canary/`);
      expect(isInspect || isExec, JSON.stringify(argv)).toBe(true);
    }
    expect(argvs.some((a) => a[0] === 'inspect' && a[2] === ARGS_TEMPLATE)).toBe(true);
    expect(argvs.some((a) => a[0] === 'inspect' && a[2] === '{{json .Config.Env}}')).toBe(true);
    expect(argvs.some((a) => a[0] === 'inspect' && a[2] === '{{json .NetworkSettings.Ports}}')).toBe(true);
    expect(argvs.some((a) => a[0] === 'exec')).toBe(true);
  });

  it('a busy canary port exits 2 (positive control: a free port passes)', async () => {
    const s = await setup();
    const busy = trackServer(createServer());
    await new Promise<void>((r) => busy.listen(0, '127.0.0.1', r));
    const busyPort = (busy.address() as { port: number }).port;
    const out = await runDeclared(s, { canaryPort: busyPort });
    expect(out.exit).toBe(2);
    expect(out.stderr).toContain('cannot listen on canary port');
    expect((await runDeclared(await setup())).exit).toBe(0);
  });

  it('US1 AS4 (fake-only): a render of an undeclared URL is refused, a declared canary URL is fetched', async () => {
    const s = await setup();
    const render = (url: string) =>
      fetch(`${s.fake.url}${encodePlantuml(`@startuml\n!includeurl ${url}\n@enduml`)}`);
    const canaryServer = trackServer(createServer((_q, r) => r.writeHead(200).end('ok')));
    // Serve the allowed canary prefix so the fetch has somewhere to go.
    await new Promise<void>((r) => canaryServer.listen(s.canaryPort, '127.0.0.1', r));
    const fetched = await render(`${canaryEntry(s.canaryPort)}x`);
    expect(fetched.status).toBe(200);
    const refused = await render('http://undeclared.example/x');
    expect(refused.status).toBe(400);
    expect(refused.headers.get('x-plantuml-diagram-error')).toBeTruthy();
  });
});

describe('unset mode with a service container (profile rows u0-u5)', () => {
  const runUnset = async (inspect: string, env: Record<string, string> = {}) => {
    const fake = await startFakePlantuml('refuse');
    return runCheck(['--server', fake.url, '--service-container', 'fake'], {
      fakeDocker: true,
      env: { DK_FAKE_DOCKER_INSPECT_FILE: inspect, ...env },
    });
  };
  const refuses = (out: CheckResult, text: string) => {
    expect(out.exit).toBe(1);
    expect(out.stderr).toContain(text);
    expect(out.stdout).not.toContain('OK —');
  };

  it('u0: a SANDBOX profile equals the unset golden, with no new line', async () => {
    const out = await runUnset(inspectFile({ PLANTUML_SECURITY_PROFILE: 'SANDBOX', PLANTUML_ALLOWLIST_URL: null }));
    const golden = (ext: string) => readFileSync(path.join(GOLDEN_DIR, `golden-unset-refuse-container.${ext}`), 'utf8');
    expect(normalizePorts(out.stdout)).toBe(golden('stdout'));
    expect(normalizePorts(out.stderr)).toBe(golden('stderr'));
    expect(`${out.exit}\n`).toBe(golden('exit'));
  });

  it('u1: INTERNET fails', async () => {
    refuses(
      await runUnset(inspectFile({ PLANTUML_SECURITY_PROFILE: 'INTERNET' })),
      'opt-in unset (sandbox), but the service\'s PLANTUML_SECURITY_PROFILE is "INTERNET"',
    );
  });

  it('u2: no profile entry fails', async () => {
    refuses(
      await runUnset(inspectFile({ PLANTUML_SECURITY_PROFILE: null })),
      'PLANTUML_SECURITY_PROFILE is not set (the image default is INTERNET)',
    );
  });

  it('u3: ALLOWLIST with other entries only fails even though the canary is refused', async () => {
    refuses(
      await runUnset(inspectFile({ PLANTUML_SECURITY_PROFILE: 'ALLOWLIST', PLANTUML_ALLOWLIST_URL: 'http://other.example/x/' })),
      'opt-in unset (sandbox), but the service\'s PLANTUML_SECURITY_PROFILE is "ALLOWLIST"',
    );
  });

  it.each([
    ['JAVA_TOOL_OPTIONS=-DPLANTUML_SECURITY_PROFILE=INTERNET'],
    ['JAVA_TOOL_OPTIONS=-Dplantuml.security.profile=INTERNET'],
    ['plantuml.security.profile=INTERNET'],
  ])('u4: %s fails closed even with SANDBOX', async (extra) => {
    refuses(
      await runUnset(inspectFile({ PLANTUML_SECURITY_PROFILE: 'SANDBOX' }, [extra])),
      'configured through Java system properties',
    );
  });

  it('u5: a failing inspect after a passing behavioural check fails closed', async () => {
    refuses(
      await runUnset(inspectFile({ PLANTUML_SECURITY_PROFILE: 'SANDBOX' }), { DK_FAKE_DOCKER_INSPECT_FAIL: '1' }),
      'could not read the service configuration',
    );
  });

  it('declared modes also fail closed on a plantuml.* env key', async () => {
    const s = await setup();
    const out = await runDeclared(s, {
      inspect: inspectFile({ PLANTUML_SECURITY_PROFILE: 'ALLOWLIST', PLANTUML_ALLOWLIST_URL: s.expected }, [
        'plantuml.allowlist.url=http://x/',
      ]),
    });
    expect(out.exit).toBe(1);
    expect(out.stderr).toContain('configured through Java system properties');
  });
});

/*
 * Java system properties on the container command line (post-merge fold, #268).
 *
 * EXPERIMENT, 2026-11-03, real docker on a dev machine, pinned image
 * plantuml/plantuml-server:jetty-v1.2026.9@sha256:065c66adc6728ba6dd353a29d4ada73f8358b68549a0f710c4bf46b43c103618.
 * An include file was served by `busybox httpd` as http://dk-inc:8000/inc.puml on a user
 * network (dk-args-net; the host port was firewalled from containers), and rendered with
 * `!include http://dk-inc:8000/inc.puml` through the service's /svg/ endpoint.
 *
 *   docker run -e PLANTUML_SECURITY_PROFILE=SANDBOX -e PLANTUML_ALLOWLIST_URL=http://dk-inc:8000/ \
 *     <image> -DPLANTUML_SECURITY_PROFILE=ALLOWLIST                      → HTTP 400 "Cannot open URL" (not honoured)
 *   docker run -e PLANTUML_SECURITY_PROFILE=ALLOWLIST -e PLANTUML_ALLOWLIST_URL=http://dk-none:8000/ \
 *     <image> -Dplantuml.allowlist.url=http://dk-inc:8000/ -DPLANTUML_SECURITY_PROFILE=INTERNET
 *                                                                        → HTTP 400 (not honoured)
 *   control, env only, ALLOWLIST + PLANTUML_ALLOWLIST_URL=http://dk-inc:8000/ → HTTP 200, fetched
 *
 * Why the args form is not honoured on this image: the jetty entrypoint sources the
 * pre-generated /var/lib/jetty/jetty.start, a fixed `exec java … XmlConfiguration …` line
 * that drops "$@"; `jcmd <java pid> VM.system_properties` shows no -D from the args.
 * When a -D does reach the JVM (`--entrypoint /bin/sh` running jetty.start with
 * `-Dplantuml.allowlist.url=http://dk-inc:8000/` spliced in, env allowlist http://dk-none:8000/)
 * the include IS fetched (HTTP 200): PlantUML's SecurityUtils.getenv prefers System.getProperty.
 * A spliced `-DPLANTUML_SECURITY_PROFILE=ALLOWLIST` is not honoured: the servlet's
 * DiagramResponse static init re-sets that property to INTERNET and then to the env value.
 * The check cannot tell which case a container is in, so it fails closed on any PlantUML
 * property in the entrypoint, command or args, in every mode.
 * Mutation (same day): `commandLineProperties` reduced to `return false` turned exactly the
 * five failing-case tests below red; their positive controls stayed green.
 *
 * `docker inspect -f '[{{json .Config.Entrypoint}},{{json .Config.Cmd}},{{json .Args}}]'` showed:
 *   no command:        [["/entrypoint.sh"],null,[]]                       (inspect-args-capture.json)
 *   `<image> -D… -D…`: [["/entrypoint.sh"],["-D…","-D…"],["-D…","-D…"]]   (inspect-args-capture-properties.json)
 *   `--entrypoint /bin/sh <image> -c '…-Dplantuml.allowlist.url=…'`:
 *                      [["/bin/sh"],["-c","eval … -Dplantuml.allowlist.url=… …"],["-c", …]]
 */
describe('Java system properties on the container command line', () => {
  /** A temp command-line capture: the real no-command capture with `words` as Cmd and Args. */
  function argsFile(words: string[]): string {
    const file = path.join(mkdtempSync(path.join(tmpdir(), 'dk-args-')), 'args.json');
    writeFileSync(file, `${JSON.stringify([['/entrypoint.sh'], words, words])}\n`);
    return file;
  }
  const TEXT = 'configured through Java system properties on the container command line';
  const sandboxInspect = () => inspectFile({ PLANTUML_SECURITY_PROFILE: 'SANDBOX', PLANTUML_ALLOWLIST_URL: null });
  const runUnset = async (env: Record<string, string>) => {
    const fake = await startFakePlantuml('refuse');
    return runCheck(['--server', fake.url, '--service-container', 'fake'], {
      fakeDocker: true,
      env: { DK_FAKE_DOCKER_INSPECT_FILE: sandboxInspect(), ...env },
    });
  };

  it('allowlist: the real -D capture fails; an unrelated arg passes (positive control)', async () => {
    const s = await setup();
    const out = await runDeclared(s, { env: { DK_FAKE_DOCKER_ARGS_FILE: ARGS_PROPERTIES } });
    expect(out.exit).toBe(1);
    expect(out.stderr).toContain(TEXT);
    expect(out.stderr).toContain('declared allowlist: ');
    const control = await runDeclared(await setup(), { env: { DK_FAKE_DOCKER_ARGS_FILE: argsFile(['-Dfoo.bar=1']) } });
    expect(control.exit).toBe(0);
    expect(all(control)).not.toContain(TEXT);
  });

  it.each([['-DPLANTUML_SECURITY_PROFILE=INTERNET'], ['-Dplantuml.allowlist.url=http://x/'], ['plantuml.security.profile=INTERNET']])(
    'internet: %s fails even with profile INTERNET',
    async (word) => {
      const s = await setup('refuse');
      const out = await runDeclared(s, {
        declared: 'internet',
        inspect: inspectFile({ PLANTUML_SECURITY_PROFILE: 'INTERNET' }),
        env: { DK_FAKE_DOCKER_ARGS_FILE: argsFile([word]) },
      });
      expect(out.exit).toBe(1);
      expect(out.stderr).toContain(TEXT);
    },
  );

  it('unset, container named: the real -D capture fails closed with SANDBOX in the env', async () => {
    const out = await runUnset({ DK_FAKE_DOCKER_ARGS_FILE: ARGS_PROPERTIES });
    expect(out.exit).toBe(1);
    expect(out.stderr).toContain(`FAIL — ${TEXT}`);
    expect(out.stdout).not.toContain('OK —');
  });

  it('unset positive control: an unrelated arg reproduces the unset golden', async () => {
    const out = await runUnset({ DK_FAKE_DOCKER_ARGS_FILE: argsFile(['-Dfoo.bar=1', '-Xmx1g']) });
    const golden = (ext: string) => readFileSync(path.join(GOLDEN_DIR, `golden-unset-refuse-container.${ext}`), 'utf8');
    expect(normalizePorts(out.stdout)).toBe(golden('stdout'));
    expect(normalizePorts(out.stderr)).toBe(golden('stderr'));
    expect(`${out.exit}\n`).toBe(golden('exit'));
  });
});

/*
 * PLANTUML_PROPERTY_FILE (post-merge fold, #268).
 *
 * EXPERIMENT, 2026-11-03, same pinned image and dk-inc include server as above:
 *   p.properties = "PLANTUML_SECURITY_PROFILE=ALLOWLIST\nplantuml.allowlist.url=http://dk-inc:8000/"
 *   docker run -v $PWD/props:/props:ro -e PLANTUML_SECURITY_PROFILE=SANDBOX \
 *     -e PLANTUML_PROPERTY_FILE=/props/p.properties <image>          → HTTP 200, include fetched
 *   control, same env without PLANTUML_PROPERTY_FILE                  → HTTP 400 "Cannot open URL"
 *   jcmd <java pid> VM.system_properties on the first: PLANTUML_SECURITY_PROFILE=ALLOWLIST,
 *   plantuml.allowlist.url=http://dk-inc:8000/. The servlet loads the file after it sets the
 *   profile from the env, so the file overrides both. The check cannot read the file: it
 *   fails closed in every mode with a container.
 */
describe('PLANTUML_PROPERTY_FILE in the service env', () => {
  const TEXT = 'configured through a PlantUML property file (PLANTUML_PROPERTY_FILE)';
  const runUnset = async (value: string | null) => {
    const fake = await startFakePlantuml('refuse');
    return runCheck(['--server', fake.url, '--service-container', 'fake'], {
      fakeDocker: true,
      env: {
        DK_FAKE_DOCKER_INSPECT_FILE: inspectFile({
          PLANTUML_SECURITY_PROFILE: 'SANDBOX',
          PLANTUML_ALLOWLIST_URL: null,
          PLANTUML_PROPERTY_FILE: value,
        }),
      },
    });
  };

  it('unset, container named: fails closed with SANDBOX in the env', async () => {
    const out = await runUnset('/props/p.properties');
    expect(out.exit).toBe(1);
    expect(out.stderr).toContain(`FAIL — ${TEXT}`);
    expect(out.stdout).not.toContain('OK —');
  });

  it.each([[null], ['']])('unset positive control: PLANTUML_PROPERTY_FILE %j reproduces the unset golden', async (value) => {
    const out = await runUnset(value);
    const golden = (ext: string) => readFileSync(path.join(GOLDEN_DIR, `golden-unset-refuse-container.${ext}`), 'utf8');
    expect(normalizePorts(out.stdout)).toBe(golden('stdout'));
    expect(normalizePorts(out.stderr)).toBe(golden('stderr'));
    expect(`${out.exit}\n`).toBe(golden('exit'));
  });

  it('allowlist: fails; the same setup with an empty value passes (positive control)', async () => {
    const s = await setup();
    const env = (v: string) =>
      inspectFile({ PLANTUML_SECURITY_PROFILE: 'ALLOWLIST', PLANTUML_ALLOWLIST_URL: s.expected, PLANTUML_PROPERTY_FILE: v });
    const out = await runDeclared(s, { inspect: env('/props/p.properties') });
    expect(out.exit).toBe(1);
    expect(out.stderr).toContain(`declared allowlist: ${TEXT}`);
    const control = await runDeclared(s, { inspect: env('') });
    expect(control.exit).toBe(0);
    expect(all(control)).not.toContain(TEXT);
  });

  it('internet: fails even with profile INTERNET', async () => {
    const s = await setup('refuse');
    const out = await runDeclared(s, {
      declared: 'internet',
      inspect: inspectFile({ PLANTUML_SECURITY_PROFILE: 'INTERNET', PLANTUML_PROPERTY_FILE: '/props/p.properties' }),
    });
    expect(out.exit).toBe(1);
    expect(out.stderr).toContain(`declared internet: ${TEXT}`);
  });
});

describe('system properties in any env value, and a property file inside sh -c (pre-PR fold)', () => {
  const TEXT = 'configured through Java system properties';
  const allowlistInspect = (s: Setup, extra: string[]) =>
    inspectFile({ PLANTUML_SECURITY_PROFILE: 'ALLOWLIST', PLANTUML_ALLOWLIST_URL: s.expected }, extra);

  it.each([['_JAVA_OPTIONS=-Dplantuml.allowlist.url=http://x/'], ['JETTY_OPTS=-DPLANTUML_SECURITY_PROFILE=INTERNET']])(
    'allowlist: %s fails closed',
    async (extra) => {
      const s = await setup();
      const out = await runDeclared(s, { inspect: allowlistInspect(s, [extra]) });
      expect(out.exit).toBe(1);
      expect(out.stderr).toContain(TEXT);
    },
  );

  it("allowlist: sh -c 'PLANTUML_PROPERTY_FILE=… exec …' as the command fails closed", async () => {
    const s = await setup();
    const file = path.join(mkdtempSync(path.join(tmpdir(), 'dk-args-')), 'args.json');
    const cmd = ['-c', 'PLANTUML_PROPERTY_FILE=/props/p.properties exec /entrypoint.sh'];
    writeFileSync(file, `${JSON.stringify([['/bin/sh'], cmd, cmd])}\n`);
    const out = await runDeclared(s, { env: { DK_FAKE_DOCKER_ARGS_FILE: file } });
    expect(out.exit).toBe(1);
    expect(out.stderr).toContain('configured through Java system properties on the container command line');
  });

  it('positive control: unrelated _JAVA_OPTIONS and JETTY_OPTS values pass', async () => {
    const s = await setup();
    const out = await runDeclared(s, { inspect: allowlistInspect(s, ['_JAVA_OPTIONS=-Xmx1g', 'JETTY_OPTS=-Dfoo.bar=1']) });
    expect(out.exit).toBe(0);
    expect(all(out)).not.toContain(TEXT);
  });
});

/*
 * Container identity: --server must be served by --service-container (pre-PR fold, #268).
 *
 * EXPERIMENT, 2026-11-03, real docker 29.9.2, pinned image (the host firewall blocks
 * container-to-host traffic here, so the decoy shares the host network to reach the canary):
 *   docker run -d --name dk-decoy --network host --entrypoint sleep -e PLANTUML_SECURITY_PROFILE=SANDBOX <image> infinity
 *   docker run -d --name dk-real -p 18621:8080 -e PLANTUML_SECURITY_PROFILE=INTERNET <image>
 *   assert-plantuml-no-remote-include --server http://localhost:18621/svg/ --service-container dk-decoy
 *     before this fold → exit 0, "OK — 2 remote include(s) refused by http://localhost:18621/svg/, with the
 *                        canary proven reachable from the server": the real INTERNET service refuses the
 *                        private canary (F1), the decoy reaches it and its env says SANDBOX
 *     after            → exit 1, "FAIL — the service container does not publish the --server port 18621
 *                        (published: none), so the check would read one container and test another service"
 *   Positive control on real inspect output: dk-good (-p 18622:8080, SANDBOX) with --server port 18622
 *   → { ok: true }; dk-real with port 18622 → mismatch "(published: 0.0.0.0:18621->8080/tcp, :::18621->8080/tcp)".
 * `docker inspect -f '{{json .NetworkSettings.Ports}}'` showed (inspect-ports-capture.json is the second):
 *   -p 127.0.0.1:18601:8080 → {"8080/tcp":[{"HostIp":"127.0.0.1","HostPort":"18601"}]}
 *   -p 18602:8080           → {"8080/tcp":[{"HostIp":"0.0.0.0","HostPort":"18602"},{"HostIp":"::","HostPort":"18602"}]}
 *   no -p                   → {"8080/tcp":null}
 */
describe('container identity: --server must be served by --service-container', () => {
  const TEXT = 'the service container does not publish the --server port';
  const runUnset = async (env: Record<string, string> = {}, server?: string) => {
    const fake = await startFakePlantuml('refuse');
    return runCheck(['--server', server ?? fake.url, '--service-container', 'fake'], {
      fakeDocker: true,
      env: { DK_FAKE_DOCKER_INSPECT_FILE: inspectFile({ PLANTUML_SECURITY_PROFILE: 'SANDBOX', PLANTUML_ALLOWLIST_URL: null }), ...env },
    });
  };

  it('unset: a container publishing another port fails closed', async () => {
    const out = await runUnset({ DK_FAKE_DOCKER_PUBLISHED_PORT: '18602' });
    expect(out.exit).toBe(1);
    expect(out.stderr).toContain(`FAIL — ${TEXT}`);
    expect(out.stderr).toContain('(published: 0.0.0.0:18602->8080/tcp, :::18602->8080/tcp)');
    expect(out.stdout).not.toContain('OK —');
  });

  it('unset: a container publishing nothing fails closed (published: none)', async () => {
    const file = path.join(mkdtempSync(path.join(tmpdir(), 'dk-ports-')), 'ports.json');
    writeFileSync(file, '{"8080/tcp":null}\n');
    const out = await runUnset({ DK_FAKE_DOCKER_PORTS_FILE: file });
    expect(out.exit).toBe(1);
    expect(out.stderr).toContain('(published: none)');
  });

  it('unset positive control: the container publishing the --server port reproduces the golden', async () => {
    const out = await runUnset();
    const golden = (ext: string) => readFileSync(path.join(GOLDEN_DIR, `golden-unset-refuse-container.${ext}`), 'utf8');
    expect(normalizePorts(out.stdout)).toBe(golden('stdout'));
    expect(normalizePorts(out.stderr)).toBe(golden('stderr'));
    expect(`${out.exit}\n`).toBe(golden('exit'));
  });

  it('allowlist: a decoy container fails; the same setup with the right port passes', async () => {
    const s = await setup();
    const out = await runDeclared(s, { env: { DK_FAKE_DOCKER_PUBLISHED_PORT: '18602' } });
    expect(out.exit).toBe(1);
    expect(out.stderr).toContain(`declared allowlist: ${TEXT}`);
    expect((await runDeclared(s)).exit).toBe(0);
  });

  it('internet: a decoy container fails even with profile INTERNET', async () => {
    const s = await setup('refuse');
    const out = await runDeclared(s, {
      declared: 'internet',
      inspect: inspectFile({ PLANTUML_SECURITY_PROFILE: 'INTERNET' }),
      env: { DK_FAKE_DOCKER_PUBLISHED_PORT: '18602' },
    });
    expect(out.exit).toBe(1);
    expect(out.stderr).toContain(`declared internet: ${TEXT}`);
  });
});
