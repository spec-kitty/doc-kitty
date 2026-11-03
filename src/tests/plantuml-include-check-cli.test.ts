/**
 * Command-level 9-cell matrix for the PlantUML include check (#268, FR-005, FR-011, SC-002).
 *
 * Every row spawns the real CLI against a fake PlantUML service and the strict fake
 * `docker`. In declared modes the observed class is the profile read from the container,
 * so every declared row passes `--service-container fake` and an inspect file whose
 * PLANTUML_SECURITY_PROFILE sets the column (spike F1, D5). The oracle is
 * contracts/include-check-cli.md; assertions use stable substrings, never hit counts.
 * Free ports only (never the fixed declared-mode default).
 */
import { describe, it, expect, afterEach } from 'vitest';
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { createServer } from 'node:http';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { encodePlantuml } from '../scripts/plantuml-include-guard.mjs';
import {
  closeAll,
  canaryPort,
  normalizePorts,
  prefixPolicy,
  runCheck,
  startFakePlantuml,
  trackServer,
  type CheckResult,
  type FakePlantuml,
} from './helpers/plantuml-check-harness';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const FIXTURES = path.join(HERE, 'fixtures');
const GOLDEN_DIR = path.join(FIXTURES, 'plantuml-include-check');
const CAPTURE = JSON.parse(readFileSync(path.join(FIXTURES, 'plantuml-fake-docker/inspect-capture.json'), 'utf8')) as string[];
const SCRIPTS = path.resolve(HERE, '../scripts');
const CLI = path.join(SCRIPTS, 'assert-plantuml-no-remote-include.mjs');
const NAME = 'assert-plantuml-no-remote-include';

afterEach(closeAll);

/** A temp inspect file: the verbatim capture with the row's profile (and optional allowlist). */
function inspectFile(profile: string | null, allowlist?: string): string {
  const env = CAPTURE.filter(
    (e) => !e.startsWith('PLANTUML_SECURITY_PROFILE=') && !(allowlist !== undefined && e.startsWith('PLANTUML_ALLOWLIST_URL=')),
  );
  if (profile !== null) env.push(`PLANTUML_SECURITY_PROFILE=${profile}`);
  if (allowlist !== undefined) env.push(`PLANTUML_ALLOWLIST_URL=${allowlist}`);
  const file = path.join(mkdtempSync(path.join(tmpdir(), 'dk-inspect-')), 'inspect.json');
  writeFileSync(file, JSON.stringify(env));
  return file;
}

/** A local server standing in for the declared entry; the check must never call it. */
async function declaredServer(): Promise<{ entry: string; requests: string[] }> {
  const requests: string[] = [];
  const server = trackServer(
    createServer((req, res) => {
      requests.push(req.url ?? '');
      res.writeHead(200).end('declared');
    }),
  );
  await new Promise<void>((r) => server.listen(0, '127.0.0.1', r));
  const { port } = server.address() as { port: number };
  return { entry: `http://127.0.0.1:${port}/dk-declared/`, requests };
}

// T033 – the service fixtures (fetchCount 2 in declared rows, like the real image; spike F4).
const sandboxService = () => startFakePlantuml('refuse', { fetchCount: 2 });
const allowlistService = (prefixes: string[]) => startFakePlantuml(prefixPolicy(prefixes), { fetchCount: 2 });
/** Realistic internet: fetches public URLs, refuses dotless / IP-literal hosts like the canary (F1). */
const internetService = () => startFakePlantuml('fetch', { fetchCount: 2, refusePrivateHosts: true });
/** Non-real: fetches everything and follows redirects. Only where a row needs a denied fetch. */
const fetchAllService = () => startFakePlantuml('fetch', { fetchCount: 2, followRedirects: true });

const canaryAllowed = (port: number) => `http://127.0.0.1:${port}/dk-canary/allowed/`;

describe('service fixtures are not permissive by accident', () => {
  const probe = (svc: FakePlantuml, url: string) => {
    const before = svc.includes.length;
    return fetch(svc.url + encodePlantuml(`@startuml\n!includeurl ${url}\n@enduml`)).then((r) => ({
      status: r.status,
      asked: svc.includes.length - before,
    }));
  };
  it('sandbox refuses, allowlist refuses outside its prefixes, internet refuses private hosts', async () => {
    const canary = await createCanary();
    const url = `${canary.base}/dk-canary/allowed/x`;
    const sandbox = await probe(await sandboxService(), url);
    const allow = await probe(await allowlistService(['http://example.invalid/']), url);
    const internet = await probe(await internetService(), url);
    expect([sandbox.status, allow.status, internet.status]).toEqual([400, 400, 400]);
    // positive control: the same URL is fetched when the policy permits it
    const permitted = await probe(await allowlistService([canary.base]), url);
    const fetchAll = await probe(await fetchAllService(), url);
    expect([permitted.status, fetchAll.status]).toEqual([200, 200]);
    expect(canary.hits.length).toBeGreaterThan(0);
  });
});

async function createCanary(): Promise<{ base: string; hits: string[] }> {
  const hits: string[] = [];
  const server = trackServer(
    createServer((req, res) => {
      hits.push(req.url ?? '');
      res.writeHead(200).end('canary');
    }),
  );
  await new Promise<void>((r) => server.listen(0, '127.0.0.1', r));
  return { base: `http://127.0.0.1:${(server.address() as { port: number }).port}`, hits };
}

interface Row {
  id: string;
  /** DK_PLANTUML_ALLOW_EXTERNAL: undefined = unset, 'internet', or 'allowlist' (the declared entry). */
  declared?: 'internet' | 'allowlist';
  service: (ctx: Ctx) => Promise<FakePlantuml>;
  /** Pass `--service-container fake` with an inspect file of this profile (null entry = no container). */
  profile?: string | null;
  allowlistEnv?: (ctx: Ctx) => string;
  exit: number;
  mustContain: string[];
  mustNotContain?: string[];
}
interface Ctx {
  canaryPort: number;
  declaredEntry: string;
}

const ctxEntry = (c: Ctx) => canaryAllowed(c.canaryPort);

const ROWS: Row[] = [
  { id: 'M2 unset/allowlist-canary, no container', service: (c) => allowlistService([ctxEntry(c)]), exit: 1, mustContain: ['the server FETCHED the remote include'] },
  {
    id: 'M2c unset/allowlist-canary, container', service: (c) => allowlistService([ctxEntry(c)]), profile: 'ALLOWLIST', exit: 1,
    mustContain: ['the server FETCHED the remote include'],
    mustNotContain: ['PLANTUML_SECURITY_PROFILE'],
  },
  {
    id: 'M2d unset/allowlist-other, container', service: (c) => allowlistService([c.declaredEntry]), profile: 'ALLOWLIST', exit: 1,
    mustContain: ['opt-in unset (sandbox), but the service\'s PLANTUML_SECURITY_PROFILE is "ALLOWLIST"'],
    mustNotContain: ['the server FETCHED the remote include'],
  },
  // M3 is a fake-only proof: the real INTERNET image refuses the private canary, so without a
  // container the cell is undetectable (spec Limits).
  { id: 'M3 unset/fetch-all (fake-only), no container', service: () => fetchAllService(), exit: 1, mustContain: ['the server FETCHED the remote include'] },
  {
    id: 'M3c unset/internet, container', service: () => internetService(), profile: 'INTERNET', exit: 1,
    mustContain: ['opt-in unset (sandbox), but the service\'s PLANTUML_SECURITY_PROFILE is "INTERNET"'],
  },
  {
    id: 'M4 allowlist/sandbox', declared: 'allowlist', service: () => sandboxService(), profile: 'SANDBOX', exit: 1,
    mustContain: ['declared allowlist, but the allowed path was refused', '(observed: sandbox)', '/dk-canary/allowed/'],
  },
  {
    id: 'M5 allowlist/allowlist', declared: 'allowlist', service: (c) => allowlistService([c.declaredEntry, ctxEntry(c)]),
    profile: 'ALLOWLIST', allowlistEnv: (c) => `${c.declaredEntry};${ctxEntry(c)}`, exit: 0,
    mustContain: ['OK — declared allowlist matches the service', 'verdict: declared allowlist, observed allowlist'],
  },
  {
    id: 'M6 allowlist/looks-allowlist but INTERNET profile', declared: 'allowlist', service: (c) => allowlistService([c.declaredEntry, ctxEntry(c)]),
    profile: 'INTERNET', exit: 1,
    mustContain: ['declared allowlist, but the service\'s PLANTUML_SECURITY_PROFILE is "INTERNET"', '(observed: internet)'],
  },
  {
    id: 'M6b allowlist/fetch-all, INTERNET profile', declared: 'allowlist', service: () => fetchAllService(), profile: 'INTERNET', exit: 1,
    mustContain: [
      'declared allowlist, but the service\'s PLANTUML_SECURITY_PROFILE is "INTERNET"',
      '(observed: internet)',
      'declared allowlist, but the denied path was fetched',
      '/dk-canary/denied/',
    ],
  },
  {
    id: 'M7 internet/sandbox', declared: 'internet', service: () => sandboxService(), profile: 'SANDBOX', exit: 1,
    mustContain: ['declared internet, but the service\'s PLANTUML_SECURITY_PROFILE is "SANDBOX"', '(observed: sandbox)'],
  },
  {
    id: 'M8 internet/allowlist', declared: 'internet', service: (c) => allowlistService([ctxEntry(c)]), profile: 'ALLOWLIST', exit: 1,
    mustContain: ['declared internet, but the service\'s PLANTUML_SECURITY_PROFILE is "ALLOWLIST"', '(observed: allowlist)'],
  },
  {
    // M9 passes with a fake that refuses the private canary (the real image's behaviour, F1).
    id: 'M9 internet/internet', declared: 'internet', service: () => internetService(), profile: 'INTERNET', exit: 0,
    mustContain: ['OK — declared internet matches the service', 'verdict: declared internet, observed internet'],
  },
];

const STDERR_ONLY = ['warning — declared internet'];

async function runRow(row: Row): Promise<{ res: CheckResult; fake: FakePlantuml; declared: Awaited<ReturnType<typeof declaredServer>> }> {
  const port = await canaryPort();
  const declared = await declaredServer();
  const ctx: Ctx = { canaryPort: port, declaredEntry: declared.entry };
  const fake = await row.service(ctx);
  const args = ['--server', fake.url, '--canary-host', '127.0.0.1', '--canary-port', String(port)];
  const env: Record<string, string> = {};
  if (row.declared === 'internet') env.DK_PLANTUML_ALLOW_EXTERNAL = 'internet';
  if (row.declared === 'allowlist') env.DK_PLANTUML_ALLOW_EXTERNAL = declared.entry;
  if (row.profile !== undefined && row.profile !== null) {
    args.push('--service-container', 'fake');
    env.DK_FAKE_DOCKER_INSPECT_FILE = inspectFile(row.profile, row.allowlistEnv?.(ctx));
  }
  const res = await runCheck(args, { env, fakeDocker: true });
  return { res, fake, declared };
}

describe('matrix (9 cells)', () => {
  it('M1 unset/sandbox: output equals the golden', async () => {
    const fake = await startFakePlantuml('refuse');
    const res = await runCheck(['--server', fake.url, '--canary-port', String(await canaryPort())]);
    expect(res.exit).toBe(0);
    const g = (ext: string) => readFileSync(path.join(GOLDEN_DIR, `golden-unset-refuse-no-container.${ext}`), 'utf8');
    expect(normalizePorts(res.stdout)).toBe(g('stdout'));
    expect(normalizePorts(res.stderr)).toBe(g('stderr'));
  });

  it.each(ROWS.map((r) => [r.id, r] as const))('%s', async (_id, row) => {
    const { res, declared } = await runRow(row);
    expect(res.exit).toBe(row.exit);
    const out = `${res.stdout}\n${res.stderr}`;
    for (const s of row.mustContain) expect(out).toContain(s);
    for (const s of row.mustNotContain ?? []) expect(out).not.toContain(s);
    if (row.id.startsWith('M9')) {
      expect(res.stderr).toContain(STDERR_ONLY[0]);
      expect(res.stdout).not.toContain(STDERR_ONLY[0]);
    }
    expect(declared.requests).toEqual([]); // NFR-001: the declared entry is never requested
  });
});

describe('output shape', () => {
  const declaredRows = ROWS.filter((r) => r.declared);
  const unsetRows = ROWS.filter((r) => !r.declared);

  it.each(declaredRows.map((r) => [r.id, r] as const))('%s: declared first line, exactly one verdict line', async (_id, row) => {
    const { res } = await runRow(row);
    const lines = res.stdout.split('\n');
    expect(lines[0].startsWith(`${NAME}: declared: `)).toBe(true);
    const verdicts = lines.filter((l) => /verdict: declared (allowlist|internet), observed (sandbox|allowlist|internet|no class)$/.test(l));
    expect(verdicts).toHaveLength(1);
    expect(lines.filter((l) => l.includes('verdict:'))).toHaveLength(1);
  });

  it.each(unsetRows.map((r) => [r.id, r] as const))('%s: no declared and no verdict line', async (_id, row) => {
    const { res } = await runRow(row);
    expect(res.exit).toBe(row.exit); // positive control: the row ran and reached its verdict
    const out = `${res.stdout}\n${res.stderr}`;
    expect(out).not.toContain('declared:');
    expect(out).not.toContain('verdict:');
  });
});

describe('C-006: the check loads with Node built-ins only', () => {
  it('imports site-config-eval dynamically, never statically', () => {
    const text = readFileSync(CLI, 'utf8');
    expect(text).not.toMatch(/^import .*site-config-eval/m);
    expect(text).toMatch(/import\(\s*['"]\.\/site-config-eval\.mjs['"]\s*\)/);
  });

  it.each([
    path.join(SCRIPTS, 'plantuml-mode-check.mjs'),
    path.join(SCRIPTS, 'plantuml-include-guard.mjs'),
    path.resolve(HERE, '../lib/plantuml-external.mjs'),
  ])('%s has only node: or relative top-level imports', (file) => {
    const specs = [...readFileSync(file, 'utf8').matchAll(/^import\s[\s\S]*?from\s+['"]([^'"]+)['"]/gm)].map((m) => m[1]);
    for (const spec of specs) expect(spec.startsWith('node:') || spec.startsWith('.')).toBe(true);
    // positive control: the regex does find imports where they exist
    if (file.endsWith('plantuml-include-guard.mjs')) expect(specs.length).toBeGreaterThan(0);
  });
});

describe('--print-declared', () => {
  it('prints one JSON line and exits 0 without contacting the service', async () => {
    const fake = await startFakePlantuml('refuse');
    const res = await runCheck(['--server', fake.url, '--print-declared'], { env: { DK_PLANTUML_ALLOW_EXTERNAL: 'internet' } });
    expect(res.exit).toBe(0);
    expect(res.stdout.trimEnd().split('\n')).toHaveLength(1);
    expect(JSON.parse(res.stdout)).toEqual({ mode: 'internet', entries: [], source: 'environment' });
    expect(res.stdout).toBe('{"mode":"internet","entries":[],"source":"environment"}\n');
    expect(fake.includes).toEqual([]);
    // positive control: without the flag the same service is contacted
    await runCheck(['--server', fake.url, '--service-container', 'fake', '--canary-port', String(await canaryPort())], {
      fakeDocker: true,
      env: { DK_PLANTUML_ALLOW_EXTERNAL: 'internet', DK_FAKE_DOCKER_INSPECT_FILE: inspectFile('INTERNET') },
    });
    expect(fake.includes.length).toBeGreaterThan(0);
  });
});

describe('FR-007: --canary-port leaves the unset goldens byte-identical', () => {
  const INSPECT_FILE = path.join(GOLDEN_DIR, 'inspect-sandbox.json');
  const containerEnv = { DK_FAKE_DOCKER_INSPECT_FILE: INSPECT_FILE };
  const cases: Array<[string, () => Promise<CheckResult>]> = [
    ['refuse-no-container', async () => runCheck(['--server', (await startFakePlantuml('refuse')).url, '--canary-port', String(await canaryPort())])],
    [
      'refuse-container',
      async () =>
        runCheck(['--server', (await startFakePlantuml('refuse')).url, '--service-container', 'fake', '--canary-port', String(await canaryPort())], {
          fakeDocker: true,
          env: containerEnv,
        }),
    ],
    ['fetch', async () => runCheck(['--server', (await startFakePlantuml('fetch')).url, '--canary-port', String(await canaryPort())])],
    [
      'canary-unreachable',
      async () =>
        runCheck(['--server', (await startFakePlantuml('refuse')).url, '--service-container', 'fake', '--canary-port', String(await canaryPort())], {
          fakeDocker: true,
          env: { ...containerEnv, DK_FAKE_DOCKER_EXEC_FAIL: '1' },
        }),
    ],
    [
      'control-fails',
      async () => runCheck(['--server', (await startFakePlantuml('refuse', { broken: true })).url, '--canary-port', String(await canaryPort())]),
    ],
  ];
  it.each(cases)('%s', async (name, run) => {
    const out = await run();
    const g = (ext: string) => readFileSync(path.join(GOLDEN_DIR, `golden-unset-${name}.${ext}`), 'utf8');
    expect(normalizePorts(out.stdout)).toBe(g('stdout'));
    expect(normalizePorts(out.stderr)).toBe(g('stderr'));
    expect(`${out.exit}\n`).toBe(g('exit'));
  });

  it('a busy --canary-port exits 2 with one fixed line (positive control: a free port passes)', async () => {
    const port = await canaryPort();
    const blocker = trackServer(createServer());
    await new Promise<void>((r) => blocker.listen(port, '0.0.0.0', r));
    const fake = await startFakePlantuml('refuse');
    const out = await runCheck(['--server', fake.url, '--service-container', 'fake', '--canary-port', String(port)], {
      fakeDocker: true,
      env: containerEnv,
    });
    expect(out).toMatchObject({ exit: 2, stdout: '', stderr: `${NAME}: cannot listen on canary port ${port}: in use\n` });
    const free = await runCheck(['--server', fake.url, '--service-container', 'fake', '--canary-port', String(await canaryPort())], {
      fakeDocker: true,
      env: containerEnv,
    });
    expect(free.exit).toBe(0);
  });
});
