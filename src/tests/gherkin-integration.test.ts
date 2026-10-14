/**
 * WP06 — the opt-in `doc-kitty:gherkin` integration seam in `config.ts`
 * (ADR-0046; plan 02-architecture §Config surface / §Integration wiring).
 *
 * Exercised END-TO-END against a real temp site (no loader/generator mocks): the
 * hook resolves `sources`/`docsDir`/`sourceRoot` against `process.cwd()` exactly
 * like the glossary hook, so each test `chdir`s into a fresh `mkdtemp` site and
 * restores the original cwd afterwards. `@astrojs/starlight` is mocked (as in the
 * sibling config tests) so the captured Starlight config — and its registry
 * sidebar — is inspectable.
 *
 * Proven here:
 *  - `config:setup` generates `docs/<section>/**` before the glob sync;
 *  - `addWatchFile` once per loaded source, in model (sorted) order;
 *  - one `[dk-gherkin]` info line with the counts; a re-run is byte-stable;
 *  - NO markdown plugins / scripts are registered (no plugin-order pin moves);
 *  - a malformed `.feature` makes the hook throw `[dk-gherkin] file:line:col`;
 *  - eager option validation in `defineDocKittyIntegrations`;
 *  - `sourceRoot` / `sourceUrlPrefix` shape `sources[0].resource`;
 *  - the section id is threaded into the registry sidebar's `generatedIds`.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { restoreIndexBasenameEnv } from './helpers/restore-index-env';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import matter from 'gray-matter';

vi.mock('@astrojs/starlight', () => ({
  default: (config: Record<string, unknown>) => ({
    name: '@astrojs/starlight',
    __starlightConfig: config,
    hooks: {},
  }),
}));

// Imported AFTER the mock is declared (vi.mock is hoisted, so this is safe).
const { defineDocKittyIntegrations, DK_DOCS_ROOT_ENV } = await import('../lib/config.js');

const GHERKIN = 'doc-kitty:gherkin';

const FEATURE_X = `Feature: Book a consignment
  Shippers book consignments for collection.

  Scenario: Book a single pallet
    Given a shipper with an account
    When they book one pallet
    Then a consignment is created
`;

interface NamedIntegration {
  name: string;
  hooks?: Record<string, unknown>;
  __starlightConfig?: Record<string, unknown>;
}

function named(integrations: unknown[]): NamedIntegration[] {
  return integrations.filter(
    (i): i is NamedIntegration =>
      typeof i === 'object' &&
      i !== null &&
      'name' in i &&
      typeof (i as { name: unknown }).name === 'string',
  );
}

interface StubContext {
  addWatchFile: ReturnType<typeof vi.fn>;
  updateConfig: ReturnType<typeof vi.fn>;
  injectScript: ReturnType<typeof vi.fn>;
  logger: { warn: ReturnType<typeof vi.fn>; info?: ReturnType<typeof vi.fn> };
}

function stubContext(withInfo = true): StubContext {
  return {
    addWatchFile: vi.fn(),
    updateConfig: vi.fn(),
    injectScript: vi.fn(),
    logger: withInfo ? { warn: vi.fn(), info: vi.fn() } : { warn: vi.fn() },
  };
}

/** Locate `doc-kitty:gherkin` and run its `astro:config:setup` hook with `ctx`. */
function runGherkinSetup(integrations: unknown[], ctx: StubContext = stubContext()): StubContext {
  const entry = named(integrations).find((i) => i.name === GHERKIN);
  if (!entry) throw new Error('gherkin integration not registered');
  const hook = entry.hooks?.['astro:config:setup'] as ((c: StubContext) => void) | undefined;
  if (!hook) throw new Error('gherkin integration has no astro:config:setup hook');
  hook(ctx);
  return ctx;
}

let originalCwd: string;
let originalDocsRootEnv: string | undefined;
let tmp: string;

/** Write `files` (POSIX path → contents) under the temp dir. */
function writeTree(files: Record<string, string>): void {
  for (const [rel, contents] of Object.entries(files)) {
    const abs = path.join(tmp, ...rel.split('/'));
    mkdirSync(path.dirname(abs), { recursive: true });
    writeFileSync(abs, contents);
  }
}

/** Create the site dir (`rel` under tmp) with an empty `docs/`, and chdir into it. */
function enterSite(rel = '.'): string {
  const site = path.resolve(tmp, rel);
  mkdirSync(path.join(site, 'docs'), { recursive: true });
  process.chdir(site);
  return site;
}

function frontmatterOf(abs: string): Record<string, unknown> {
  return matter(readFileSync(abs, 'utf8')).data as Record<string, unknown>;
}

beforeEach(() => {
  originalCwd = process.cwd();
  originalDocsRootEnv = process.env[DK_DOCS_ROOT_ENV];
  tmp = mkdtempSync(path.join(tmpdir(), 'dk-gherkin-int-'));
});

afterEach(() => {
  process.chdir(originalCwd);
  if (originalDocsRootEnv === undefined) delete process.env[DK_DOCS_ROOT_ENV];
  else process.env[DK_DOCS_ROOT_ENV] = originalDocsRootEnv;
  rmSync(tmp, { recursive: true, force: true });
  vi.restoreAllMocks();
});

restoreIndexBasenameEnv();

describe('doc-kitty:gherkin config:setup (generate-before-glob)', () => {
  it('generates the section pages under docs/behaviour/** by default', () => {
    writeTree({ 'features/shipping/x.feature': FEATURE_X });
    const site = enterSite();
    runGherkinSetup(defineDocKittyIntegrations({ title: 't', gherkin: { sources: ['features'] } }));

    const out = path.join(site, 'docs', 'behaviour');
    expect(existsSync(path.join(out, 'README.md'))).toBe(true);
    expect(existsSync(path.join(out, 'shipping', 'README.md'))).toBe(true);
    const page = path.join(out, 'shipping', 'x.md');
    expect(existsSync(page)).toBe(true);
    const fm = frontmatterOf(page);
    expect(fm.title).toBe('Book a consignment');
    expect(fm.generated).toMatchObject({ by: 'doc-kitty/gherkin' });
    expect(fm.sources).toEqual([
      { resource: 'features/shipping/x.feature', title: 'Gherkin source' },
    ]);
  });

  it('honours a custom section and indexBasename', () => {
    writeTree({ 'features/shipping/x.feature': FEATURE_X });
    const site = enterSite();
    runGherkinSetup(
      defineDocKittyIntegrations({
        title: 't',
        indexBasename: ['index', 'README'],
        gherkin: { sources: ['features'], section: 'specs' },
      }),
    );
    const out = path.join(site, 'docs', 'specs');
    expect(existsSync(path.join(out, 'index.md'))).toBe(true);
    expect(existsSync(path.join(out, 'shipping', 'x.md'))).toBe(true);
    expect(existsSync(path.join(site, 'docs', 'behaviour'))).toBe(false);
  });

  it('passes gherkin.titles to the generator (#125)', () => {
    writeTree({ 'features/shipping/x.feature': FEATURE_X });
    const site = enterSite();
    runGherkinSetup(
      defineDocKittyIntegrations({ title: 't', gherkin: { sources: ['features'], titles: { shipping: 'Shipping (EU)' } } }),
    );
    expect(frontmatterOf(path.join(site, 'docs', 'behaviour', 'shipping', 'README.md')).title).toBe('Shipping (EU)');
  });

  it('calls addWatchFile once per source file, in sorted model order', () => {
    writeTree({
      'features/shipping/x.feature': FEATURE_X,
      'features/billing.feature': 'Feature: Billing\n',
      'features/a/z.feature': 'Feature: Zed\n',
      'more/m.feature': 'Feature: More\n',
    });
    const site = enterSite();
    const ctx = runGherkinSetup(
      defineDocKittyIntegrations({ title: 't', gherkin: { sources: ['features', 'more'] } }),
    );
    expect(ctx.addWatchFile.mock.calls.map(([p]) => p)).toEqual([
      path.join(site, 'features', 'a', 'z.feature'),
      path.join(site, 'features', 'billing.feature'),
      path.join(site, 'features', 'shipping', 'x.feature'),
      path.join(site, 'more', 'm.feature'),
    ]);
  });

  it('logs one [dk-gherkin] info line with the counts, and a re-run is byte-stable', () => {
    writeTree({ 'features/shipping/x.feature': FEATURE_X });
    enterSite();
    const integrations = defineDocKittyIntegrations({
      title: 't',
      gherkin: { sources: ['features'] },
    });

    const first = runGherkinSetup(integrations);
    expect(first.logger.info).toHaveBeenCalledTimes(1);
    const firstLine = first.logger.info?.mock.calls[0][0] as string;
    expect(firstLine.startsWith('[dk-gherkin] ')).toBe(true);
    expect(firstLine).toContain('3 written, 0 unchanged, 0 removed');

    const second = runGherkinSetup(integrations);
    expect(second.logger.info?.mock.calls[0][0]).toContain('0 written, 3 unchanged, 0 removed');
    expect(second.logger.warn).not.toHaveBeenCalled();
  });

  it('prunes a page whose source was deleted on the next run', () => {
    writeTree({
      'features/shipping/x.feature': FEATURE_X,
      'features/billing.feature': 'Feature: Billing\n',
    });
    const site = enterSite();
    const integrations = defineDocKittyIntegrations({
      title: 't',
      gherkin: { sources: ['features'] },
    });
    runGherkinSetup(integrations);
    const billing = path.join(site, 'docs', 'behaviour', 'billing.md');
    expect(existsSync(billing)).toBe(true);

    rmSync(path.join(site, 'features', 'billing.feature'));
    const ctx = runGherkinSetup(integrations);
    expect(existsSync(billing)).toBe(false);
    expect(ctx.logger.info?.mock.calls[0][0]).toContain('1 removed');
  });

  it('tolerates a logger without info (no throw, nothing logged)', () => {
    writeTree({ 'features/shipping/x.feature': FEATURE_X });
    const site = enterSite();
    const ctx = runGherkinSetup(
      defineDocKittyIntegrations({ title: 't', gherkin: { sources: ['features'] } }),
      stubContext(false),
    );
    expect(ctx.logger.warn).not.toHaveBeenCalled();
    expect(existsSync(path.join(site, 'docs', 'behaviour', 'shipping', 'x.md'))).toBe(true);
  });

  it('registers NO markdown plugins and injects NO scripts', () => {
    writeTree({ 'features/shipping/x.feature': FEATURE_X });
    enterSite();
    const ctx = runGherkinSetup(
      defineDocKittyIntegrations({ title: 't', gherkin: { sources: ['features'] } }),
    );
    expect(ctx.updateConfig).not.toHaveBeenCalled();
    expect(ctx.injectScript).not.toHaveBeenCalled();
  });
});

describe('doc-kitty:gherkin errors are build-fatal', () => {
  it('throws [dk-gherkin] file:line:col for a malformed .feature, before writing', () => {
    writeTree({
      'features/shipping/x.feature': FEATURE_X,
      'features/shipping/bad.feature':
        'Feature: Bad table\n  Scenario: s\n    Given rows:\n      | a | b |\n      | 1 |\n',
    });
    const site = enterSite();
    const integrations = defineDocKittyIntegrations({
      title: 't',
      gherkin: { sources: ['features'] },
    });
    expect(() => runGherkinSetup(integrations)).toThrow(
      /^\[dk-gherkin\] features\/shipping\/bad\.feature:5:7 /,
    );
    expect(existsSync(path.join(site, 'docs', 'behaviour'))).toBe(false);
  });

  it('throws [dk-gherkin] for a missing source directory, named as configured', () => {
    // Pins how config.ts hands `sources` to the loader: the message must name the
    // directory as the site wrote it, not a path the hook resolved first.
    enterSite();
    const integrations = defineDocKittyIntegrations({ title: 't', gherkin: { sources: ['nope'] } });
    expect(() => runGherkinSetup(integrations)).toThrow(/\[dk-gherkin\] source directory not found: nope/);
  });

  it('stops on an empty source set while pages exist; gherkin.allowEmpty: true removes them', () => {
    writeTree({ 'features/shipping/x.feature': FEATURE_X });
    const site = enterSite();
    const page = path.join(site, 'docs', 'behaviour', 'shipping', 'x.md');
    runGherkinSetup(defineDocKittyIntegrations({ title: 't', gherkin: { sources: ['features'] } }));
    expect(existsSync(page)).toBe(true);

    rmSync(path.join(site, 'features', 'shipping', 'x.feature'));
    expect(() =>
      runGherkinSetup(defineDocKittyIntegrations({ title: 't', gherkin: { sources: ['features'] } })),
    ).toThrow(/^\[dk-gherkin\] no \.feature files found in features, but 3 generated page\(s\)/);
    expect(existsSync(page)).toBe(true);

    // The pass-through in config.ts is the only thing that makes this arm work.
    expect(() =>
      runGherkinSetup(
        defineDocKittyIntegrations({ title: 't', gherkin: { sources: ['features'], allowEmpty: true } }),
      ),
    ).not.toThrow();
    expect(existsSync(page)).toBe(false);
  });

});

describe('defineDocKittyIntegrations validates the gherkin option eagerly', () => {
  const define = (gherkin: unknown) => () =>
    defineDocKittyIntegrations({ title: 't', gherkin: gherkin as { sources: string[] } });

  it.each([
    ['empty', ''],
    ['a nested path', 'a/b'],
    ['a backslash path', 'a\\b'],
    ['a parent hop', '..'],
    ['a dot-folder', '.hidden'],
  ])('rejects a section that is %s', (_label, section) => {
    expect(define({ sources: ['features'], section })).toThrow(
      /^\[dk-gherkin\] gherkin\.section must be a single folder name/,
    );
  });

  it('rejects a reserved section through the list config.ts passes (_meta)', () => {
    // config.ts passes its own reserved list (`_meta` + the build-generated
    // sections), not the options default, so only this path pins it.
    expect(define({ sources: ['features'], section: '_meta' })).toThrow(
      /^\[dk-gherkin\] gherkin\.section "_meta" is reserved/,
    );
  });

  it('accepts a valid option without touching the filesystem', () => {
    enterSite();
    expect(define({ sources: ['does-not-exist-yet'], section: 'specs' })).not.toThrow();
  });
});

describe('sourceRoot / sourceUrlPrefix shape sources[0].resource', () => {
  // Layout: <tmp>/features/** at the "repo root", the site in <tmp>/site.
  beforeEach(() => {
    writeTree({ 'features/shipping/x.feature': FEATURE_X });
  });

  const resourceOf = (site: string) =>
    (frontmatterOf(path.join(site, 'docs', 'behaviour', 'shipping', 'x.md')).sources as Array<{
      resource: string;
    }>)[0].resource;

  it("reports paths relative to sourceRoot: '..'", () => {
    const site = enterSite('site');
    runGherkinSetup(
      defineDocKittyIntegrations({
        title: 't',
        gherkin: { sources: ['../features'], sourceRoot: '..' },
      }),
    );
    expect(resourceOf(site)).toBe('features/shipping/x.feature');
  });

  it('prepends sourceUrlPrefix to the sourceRoot-relative path', () => {
    const site = enterSite('site');
    runGherkinSetup(
      defineDocKittyIntegrations({
        title: 't',
        gherkin: {
          sources: ['../features'],
          sourceRoot: '..',
          sourceUrlPrefix: 'https://github.com/o/r/blob/main/',
        },
      }),
    );
    expect(resourceOf(site)).toBe(
      'https://github.com/o/r/blob/main/features/shipping/x.feature',
    );
  });
});

describe('the gherkin section is threaded into the registry sidebar generatedIds', () => {
  const SECTIONS_YAML = `version: 1
sections:
  - id: context
    label: Context
    order: 10
    type: Context
  - id: behaviour
    label: Behaviour
    order: 20
    type: Context
`;

  function sidebarOf(integrations: unknown[]): unknown {
    return named(integrations).find((i) => i.name === '@astrojs/starlight')?.__starlightConfig
      ?.sidebar;
  }

  beforeEach(() => {
    writeTree({
      'docs/_meta/sections.yaml': SECTIONS_YAML,
      'docs/context/README.md': '---\ntitle: Context\n---\n',
      'features/x.feature': FEATURE_X,
    });
  });

  it('warns about the not-yet-generated folder when gherkin is OFF (unchanged behaviour)', () => {
    enterSite();
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const sidebar = sidebarOf(defineDocKittyIntegrations({ title: 't' }));
    expect(warn.mock.calls.some(([m]) => String(m).includes('"behaviour"'))).toBe(true);
    expect(sidebar).toEqual([{ label: 'Context', autogenerate: { directory: 'docs/context' } }]);
  });

  it('treats gherkin: true like OFF (no sources ⇒ no generated section, ADR-0051)', () => {
    enterSite();
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const sidebar = sidebarOf(defineDocKittyIntegrations({ title: 't', gherkin: true }));
    expect(warn.mock.calls.some(([m]) => String(m).includes('"behaviour"'))).toBe(true);
    expect(sidebar).toEqual([{ label: 'Context', autogenerate: { directory: 'docs/context' } }]);
  });

  it('emits the group without warning when gherkin is ON (section is build-generated)', () => {
    enterSite();
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const sidebar = sidebarOf(
      defineDocKittyIntegrations({ title: 't', gherkin: { sources: ['features'] } }),
    );
    expect(warn).not.toHaveBeenCalled();
    expect(sidebar).toEqual([
      { label: 'Context', autogenerate: { directory: 'docs/context' } },
      { label: 'Behaviour', autogenerate: { directory: 'docs/behaviour' } },
    ]);
  });
});

// ---------------------------------------------------------------------------
// Review #6 — ONE option validator for the integration AND the bare-Node CLI
// ---------------------------------------------------------------------------

describe('gherkin option validation is single-sourced (review #6)', () => {
  it('config.ts validates through the shared options.mjs (no second copy of the rules)', () => {
    const src = readFileSync(new URL('../lib/config.ts', import.meta.url), 'utf8');
    expect(src).toMatch(/from '\.\/gherkin\/options\.mjs'/);
    expect(src).not.toMatch(/must be a single folder name/);
  });

  it('the shared reserved-section default equals _meta + the build-generated sections', async () => {
    const { RESERVED_GHERKIN_SECTIONS } = await import('../lib/gherkin/options.mjs');
    const { BUILD_GENERATED_SECTION_IDS } = await import('../lib/sections.js');
    expect([...RESERVED_GHERKIN_SECTIONS]).toEqual(['_meta', ...BUILD_GENERATED_SECTION_IDS]);
  });

  it('validateGherkinPages names the option the caller uses', async () => {
    const { validateGherkinPages } = await import('../lib/gherkin/options.mjs');
    expect(() => validateGherkinPages({ sources: ['f'], section: '../x' })).toThrow(
      /^\[dk-gherkin\] gherkin\.section must be a single folder name/,
    );
    expect(() =>
      validateGherkinPages({ sources: ['f'], section: '../x' }, { optionName: (k: string) => `--${k}` }),
    ).toThrow(/^\[dk-gherkin\] --section must be a single folder name/);
    expect(validateGherkinPages({ sources: ['f'] })).toEqual({ sources: ['f'], section: 'behaviour', sourceRoot: '.' });
  });

  it('validateIndexBasenames rejects a name with surrounding whitespace, as the glossary does', async () => {
    const { validateIndexBasenames } = await import('../lib/gherkin/options.mjs');
    expect(() => validateIndexBasenames(['README', ' index'])).toThrow(/must be a plain file name/);
    expect(() => validateIndexBasenames(['README', 'index'])).not.toThrow();
    // `log.md` is never walked, so such an index page would never publish.
    expect(() => validateIndexBasenames(['README', 'Log'])).toThrow(/must be a plain file name/);
    const { isPlainIndexName } = await import('../lib/vocabulary-core.mjs');
    expect(isPlainIndexName('')).toBe(false);
  });
});

describe('doc-kitty:gherkin build:done — an advertised scenario index must exist (#126)', () => {
  const ADVERTISED = 'Scenario index: https://example.test/api/scenarios.json';

  /** Run the hook over a fake build output holding `files` (POSIX path → contents). */
  function buildDone(files: Record<string, string>): () => unknown {
    const out = path.join(tmp, 'dist');
    mkdirSync(out, { recursive: true });
    for (const [rel, contents] of Object.entries(files)) {
      const abs = path.join(out, ...rel.split('/'));
      mkdirSync(path.dirname(abs), { recursive: true });
      writeFileSync(abs, contents);
    }
    const entry = named(defineDocKittyIntegrations({ title: 't', gherkin: { sources: ['features'] } })).find(
      (i) => i.name === GHERKIN,
    );
    const hook = entry?.hooks?.['astro:build:done'] as ((ctx: { dir: URL }) => unknown) | undefined;
    if (!hook) throw new Error('gherkin integration has no astro:build:done hook');
    return () => hook({ dir: pathToFileURL(`${out}${path.sep}`) });
  }

  it('fails when llms.txt advertises /api/scenarios.json and the build has none', () => {
    const run = buildDone({ 'llms.txt': `# Site\n\n${ADVERTISED}\n` });
    expect(run).toThrow(/^\[dk-gherkin\] llms\.txt advertises \/api\/scenarios\.json, but the build has no api\/scenarios\.json/);
    expect(run).toThrow('src/pages/api/scenarios.json.ts');
  });

  it.each([
    ['both the line and the index', { 'llms.txt': `${ADVERTISED}\n`, 'api/scenarios.json': '{}' }],
    ['neither', { 'llms.txt': '# Site\n' }],
    ['no llms.txt at all', {}],
  ])('passes with %s', (_label, files) => {
    expect(buildDone(files)).not.toThrow();
  });
});
