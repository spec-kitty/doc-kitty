import { describe, it, expect, vi } from 'vitest';
import path from 'node:path';
import process from 'node:process';
import { restoreInternalEnv } from './helpers/restore-internal-env';
import type { DocKittyTheme } from '../lib/theme.js';
import { PINNED_INTEGRATION_ORDER } from './helpers/integration-names.js';

/**
 * T036 — Components-map invariant (ADR-0013 seam 3 / ADR-0015 decision 3/4).
 *
 * `defineDocKittyIntegrations` must register EXACTLY the six chrome carriers
 * (`Head`, `PageTitle`, `MarkdownContent`, `Footer`, `Header`, `Sidebar`; ADR-0044
 * added `Header`, ADR-0063 `Sidebar`) on the Starlight integration's `components`
 * map — in EVERY case (no theme, a brand-like theme, and even when a consumer's
 * `starlight` escape hatch tries to add a seventh override). The one exception
 * is the test-only `DK_INTERNAL_STOCK_HEADER=on`, which drops `Header` alone. A theme addresses the carriers' `dk:` slot names, never Starlight's
 * `components` map, so no pass-through may expand it. This is the config-level
 * decision point where seam 3 is actually made — proven here, not just observed
 * in the rendered dist.
 *
 * `defineDocKittyIntegrations` hides its Starlight config inside the integration
 * factory's closure, so we mock `@astrojs/starlight` to capture the config it is
 * called with. `@astrojs/sitemap` and the manifest integration run for real
 * (they only return integration objects). The Starlight entry is located by the
 * captured config it carries, NOT by array index.
 */
vi.mock('@astrojs/starlight', () => ({
  default: (config: Record<string, unknown>) => ({
    name: '@astrojs/starlight',
    __starlightConfig: config,
    hooks: {},
  }),
}));

// The glossary presence probe is wrapped (real behaviour by default) so the
// gherkin-placement invariant below can force the glossary-ACTIVE array shape
// without a `.contextive/definitions.yaml` on disk. Only the array-build probe is
// overridden, and only per-test via `mockReturnValueOnce`; no hook is run with it.
vi.mock('../lib/glossary/load.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../lib/glossary/load.js')>();
  return { ...actual, isGlossaryActive: vi.fn(actual.isGlossaryActive) };
});

// Imported AFTER the mock is declared (vi.mock is hoisted, so this is safe).
const { defineDocKittyIntegrations } = await import('../lib/config.js');
const { isGlossaryActive } = await import('../lib/glossary/load.js');
const { default: gherkinFence } = await import('../lib/remark/gherkin-fence.js');

// The `./config` entry's runtime export list, pinned (#174). Taken from main
// (a76c5563) before `sitemapDraftFilter` moved to `integrations/route-shaping.ts`;
// dropping a re-export from `config.ts` must go red here.
it('pins the runtime export list of ./config', async () => {
  expect(Object.keys(await import('../lib/config.js')).sort()).toEqual([
    'BUILD_MERMAID_CONFIG',
    'BUILD_MERMAID_OPTS',
    'BUILD_SVGO_CONFIG',
    'DEFAULT_PLANTUML_SERVER_URL',
    'DIAGRAM_SENTINELS',
    'DK_DOCS_ROOT_ENV',
    'DK_INDEX_BASENAME_ENV',
    'ROUTE_MIDDLEWARE',
    'ROUTE_SHAPING_MODULE_ID',
    'SCENARIO_INDEX_MODULE_ID',
    'SENTINEL_THEME_VARIABLES',
    'defineDocKittyIntegrations',
    'draftPublicationIntegration',
    'findOwnScenarioIndexPage',
    'hasOwnScenarioIndexPage',
    'mermaidFenceTransform',
    'resolveDiagramMode',
    'resolvePlantumlServerUrl',
    'routeShapingIntegration',
    'routeShapingSource',
    'sentinelThemeRewrite',
    'sitemapDraftFilter',
  ]);
});

const EXPECTED_CARRIER_KEYS = ['Footer', 'Head', 'Header', 'MarkdownContent', 'PageTitle', 'Sidebar'];

/** The captured `components` map itself, for assertions on its values. */
function componentsOf(entry: {
  __starlightConfig: { components?: Record<string, unknown> };
}): Record<string, unknown> {
  return entry.__starlightConfig.components ?? {};
}

/** Extract the Starlight integration's captured `components` map from the
 * integrations array, locating the entry by the config it carries (not index). */
function carrierKeysOf(integrations: unknown[]): string[] {
  const starlightEntry = integrations.find(
    (i): i is { __starlightConfig: { components?: Record<string, unknown> } } =>
      typeof i === 'object' &&
      i !== null &&
      '__starlightConfig' in i &&
      typeof (i as { __starlightConfig: unknown }).__starlightConfig === 'object',
  );
  if (!starlightEntry) {
    throw new Error('no Starlight integration found in defineDocKittyIntegrations() output');
  }
  return Object.keys(componentsOf(starlightEntry)).sort();
}

// A brand-LIKE fixture (not the real Spec Kitty brand — do not couple this test
// to WP04). It carries tokens/customCss/slots/layouts a theme legitimately sets;
// none of these may add a seventh `components` carrier.
const brandLikeTheme: DocKittyTheme = {
  name: 'fixture-brand',
  tokens: { '--dk-color-accent': '#abcdef', '--dk-radius-md': '0.75rem' },
  customCss: ['fixture/tokens.css', 'fixture/brand.css'],
  assets: { logo: 'fixture/logo.svg', favicon: 'fixture/favicon.svg' },
  // `dk:site-header` is resolved inside the Header carrier (ADR-0044), so filling
  // it must not change the carrier map either.
  slots: { 'dk:site-footer': 'fixture/SiteFooter.astro', 'dk:site-header': 'fixture/SiteHeader.astro' },
  layouts: { Persona: 'fixture/Persona.astro' },
};

restoreInternalEnv();

describe('defineDocKittyIntegrations components map (seam 3)', () => {
  it('registers exactly the six carriers with NO theme', () => {
    const integrations = defineDocKittyIntegrations({ title: 'Docs' });
    expect(carrierKeysOf(integrations)).toEqual(EXPECTED_CARRIER_KEYS);
  });

  it('registers exactly the six carriers WITH a brand-like theme', () => {
    const integrations = defineDocKittyIntegrations({ title: 'Docs', theme: brandLikeTheme });
    expect(carrierKeysOf(integrations)).toEqual(EXPECTED_CARRIER_KEYS);
  });

  it('does not let a consumer starlight escape hatch add a seventh carrier', () => {
    const integrations = defineDocKittyIntegrations({
      title: 'Docs',
      theme: brandLikeTheme,
      // A pass-through override attempting to register a seventh component must
      // NOT expand the map — `components` is applied AFTER `...overrides`.
      starlight: { components: { PageSidebar: 'consumer/PageSidebar.astro' } as never },
    });
    expect(carrierKeysOf(integrations)).toEqual(EXPECTED_CARRIER_KEYS);
  });

  it('keeps the toolkit Header carrier when the escape hatch names its own Header', () => {
    const integrations = defineDocKittyIntegrations({
      title: 'Docs',
      starlight: { components: { Header: 'consumer/Header.astro' } },
    });
    expect(carrierKeysOf(integrations)).toEqual(EXPECTED_CARRIER_KEYS);
    const starlightEntry = integrations.find(
      (i) => typeof i === 'object' && i !== null && '__starlightConfig' in i,
    ) as unknown as { __starlightConfig: { components?: Record<string, unknown> } };
    expect(componentsOf(starlightEntry).Header).toBe(
      '@spec-kitty/doc-toolkit/components/Header.astro',
    );
  });

  it('keeps the toolkit Sidebar carrier when the escape hatch names its own Sidebar', () => {
    const integrations = defineDocKittyIntegrations({
      title: 'Docs',
      starlight: { components: { Sidebar: 'consumer/Sidebar.astro' } },
    });
    expect(carrierKeysOf(integrations)).toEqual(EXPECTED_CARRIER_KEYS);
    const starlightEntry = integrations.find(
      (i) => typeof i === 'object' && i !== null && '__starlightConfig' in i,
    ) as unknown as { __starlightConfig: { components?: Record<string, unknown> } };
    expect(componentsOf(starlightEntry).Sidebar).toBe(
      '@spec-kitty/doc-toolkit/components/Sidebar.astro',
    );
  });
});

/**
 * WP03 T016 — the test-only stock-header switch (research D-01). WP04's capture
 * script builds the real example without the `Header` carrier by setting
 * `DK_INTERNAL_STOCK_HEADER=on`. Only exactly `on` counts; it is read when the
 * config is built, and it is not an internal handoff name.
 */
describe('DK_INTERNAL_STOCK_HEADER (test-only, WP03 T016)', () => {
  const NAME = 'DK_INTERNAL_STOCK_HEADER';

  function withSwitch<T>(value: string | undefined, run: () => T): T {
    const saved = process.env[NAME];
    if (value === undefined) delete process.env[NAME];
    else process.env[NAME] = value;
    try {
      return run();
    } finally {
      if (saved === undefined) delete process.env[NAME];
      else process.env[NAME] = saved;
    }
  }

  it('unset: all six carriers', () => {
    withSwitch(undefined, () => {
      expect(carrierKeysOf(defineDocKittyIntegrations({ title: 'Docs' }))).toEqual(EXPECTED_CARRIER_KEYS);
    });
  });

  it('on: exactly the five carriers without Header', () => {
    withSwitch('on', () => {
      expect(carrierKeysOf(defineDocKittyIntegrations({ title: 'Docs' }))).toEqual(
        EXPECTED_CARRIER_KEYS.filter((key) => key !== 'Header'),
      );
      // A theme does not bring it back either.
      expect(
        carrierKeysOf(defineDocKittyIntegrations({ title: 'Docs', theme: brandLikeTheme })),
      ).toEqual(['Footer', 'Head', 'MarkdownContent', 'PageTitle', 'Sidebar']);
    });
  });

  it('on: warns in the build output that Header is disabled; unset: stays silent', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    try {
      withSwitch('on', () => defineDocKittyIntegrations({ title: 'Docs' }));
      expect(warn.mock.calls.some(([m]) => String(m).includes('DK_INTERNAL_STOCK_HEADER=on'))).toBe(true);
      warn.mockClear();
      withSwitch(undefined, () => defineDocKittyIntegrations({ title: 'Docs' }));
      expect(warn.mock.calls.some(([m]) => String(m).includes('DK_INTERNAL_STOCK_HEADER'))).toBe(false);
    } finally {
      warn.mockRestore();
    }
  });

  it('is read at config time, not import time', () => {
    withSwitch('on', () => {
      expect(carrierKeysOf(defineDocKittyIntegrations({ title: 'Docs' }))).not.toContain('Header');
    });
    withSwitch(undefined, () => {
      expect(carrierKeysOf(defineDocKittyIntegrations({ title: 'Docs' }))).toContain('Header');
    });
  });

  for (const value of ['yes', '1', 'ON', 'true', '']) {
    it(`${JSON.stringify(value)}: all six carriers (only exactly "on" counts)`, () => {
      withSwitch(value, () => {
        expect(carrierKeysOf(defineDocKittyIntegrations({ title: 'Docs' }))).toEqual(EXPECTED_CARRIER_KEYS);
      });
    });
  }

  it('is not an internal handoff name, so createConfig never clears it', async () => {
    const { INTERNAL_ENV_NAMES } = await import('../lib/internal-env.mjs');
    expect(INTERNAL_ENV_NAMES).not.toContain(NAME);
    withSwitch('on', () => {
      defineDocKittyIntegrations({ title: 'Docs' });
      expect(process.env[NAME]).toBe('on');
    });
  });
});

/**
 * WP06 — the opt-in gherkin seam (ADR-0046) must be ZERO-cost when absent and a
 * pure array insertion when set. The named-integration order, the Starlight config
 * and every markdown remark/rehype registration are compared off-vs-on, so a
 * future change that registers the gherkin integration unconditionally, moves it,
 * or makes it contribute a markdown plugin fails here loudly. (The hook's runtime
 * behaviour is covered end-to-end in `gherkin-integration.test.ts`.)
 *
 * ADR-0051 adds a SECOND gherkin integration, `doc-kitty:gherkin-fence` (the
 * in-page remark stage), registered whenever the option is set and `fences` is
 * not `false`. The two sit together immediately before Starlight, codegen first.
 * The codegen integration still adds no markdown plugin (pinned with
 * `fences: false`); the fence stage's ONE remark plugin is pinned on its own.
 */
describe('defineDocKittyIntegrations gherkin opt-in seam (ADR-0046)', () => {
  const GHERKIN = 'doc-kitty:gherkin';
  const FENCE = 'doc-kitty:gherkin-fence';
  const GLOSSARY = 'doc-kitty:glossary';
  const STARLIGHT = '@astrojs/starlight';
  const GHERKIN_OPTS = { sources: ['features'] };

  // The plain-path (no theme/diagrams/markua, glossary-free) named order — the
  // same pinned baseline `glossary-config.test.ts` guards.
  const PINNED_BASELINE = [...PINNED_INTEGRATION_ORDER];

  interface Named {
    name: string;
    hooks?: Record<string, unknown>;
    __starlightConfig?: unknown;
  }
  const named = (integrations: unknown[]): Named[] =>
    integrations.filter(
      (i): i is Named =>
        typeof i === 'object' && i !== null && typeof (i as { name?: unknown }).name === 'string',
    );
  const namesOf = (integrations: unknown[]) => named(integrations).map((i) => i.name);
  const starlightConfigOf = (integrations: unknown[]) =>
    named(integrations).find((i) => i.name === STARLIGHT)?.__starlightConfig;

  /** Run every doc-kitty `astro:config:setup` hook EXCEPT the codegen gherkin one
   * (which reads the filesystem) and collect the markdown plugin lists in
   * registration order. The fence stage's hook only touches the error sink. */
  function markdownRegistrations(integrations: unknown[]) {
    const remark: unknown[] = [];
    const rehype: unknown[] = [];
    for (const i of named(integrations)) {
      if (i.name === GHERKIN || !i.name.startsWith('doc-kitty:')) continue;
      const hook = i.hooks?.['astro:config:setup'] as ((ctx: unknown) => unknown) | undefined;
      hook?.({
        updateConfig: (c: { markdown?: { remarkPlugins?: unknown[]; rehypePlugins?: unknown[] } }) => {
          remark.push(...(c.markdown?.remarkPlugins ?? []));
          rehype.push(...(c.markdown?.rehypePlugins ?? []));
        },
        injectScript: () => {},
        injectRoute: () => {},
        addWatchFile: () => {},
        logger: { warn: () => {}, info: () => {} },
      });
    }
    return { remark, rehype };
  }

  /** Structural fingerprint of a plugin list: functions become `fn:<name>`. */
  const shapeOf = (value: unknown): unknown =>
    typeof value === 'function'
      ? `fn:${value.name}`
      : Array.isArray(value)
        ? value.map(shapeOf)
        : value !== null && typeof value === 'object'
          ? Object.fromEntries(Object.entries(value).map(([k, v]) => [k, shapeOf(v)]))
          : value;

  it('is absent (byte-identical array) when the option is omitted or undefined', () => {
    const omitted = defineDocKittyIntegrations({ title: 'Docs' });
    const undef = defineDocKittyIntegrations({ title: 'Docs', gherkin: undefined });
    expect(namesOf(omitted)).toEqual(PINNED_BASELINE);
    expect(namesOf(undef)).toEqual(PINNED_BASELINE);
    expect(starlightConfigOf(undef)).toEqual(starlightConfigOf(omitted));
  });

  it('always injects /api/content-graph.json through a package-exported entrypoint (#176)', async () => {
    const { readFileSync } = await import('node:fs');
    const exportsMap = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8')).exports;
    const graph = named(defineDocKittyIntegrations({ title: 'Docs' })).find(
      (i) => i.name === 'doc-kitty:content-graph',
    );
    const injected: Array<{ pattern: string; entrypoint: string }> = [];
    (graph?.hooks?.['astro:config:setup'] as (ctx: unknown) => void)({
      updateConfig: () => {},
      injectRoute: (r: { pattern: string; entrypoint: string }) => injected.push(r),
    });
    expect(injected).toEqual([
      expect.objectContaining({ pattern: '/api/content-graph.json', prerender: true }),
    ]);
    // The entrypoint is a package specifier a consuming site resolves, not a file path.
    const subpath = injected[0].entrypoint.replace('@spec-kitty/doc-toolkit/', './');
    expect(exportsMap[subpath]).toBe('./lib/routes/content-graph-injected.ts');
  });

  it('adds exactly one doc-kitty:gherkin then one doc-kitty:gherkin-fence, immediately before starlight, when set', () => {
    const names = namesOf(defineDocKittyIntegrations({ title: 'Docs', gherkin: GHERKIN_OPTS }));
    expect(names.filter((n) => n === GHERKIN)).toHaveLength(1);
    expect(names.filter((n) => n === FENCE)).toHaveLength(1);
    // A pure insertion of two: removing them yields the pinned baseline unchanged.
    expect(names.filter((n) => n !== GHERKIN && n !== FENCE)).toEqual(PINNED_BASELINE);
    expect(names.indexOf(FENCE)).toBe(names.indexOf(GHERKIN) + 1);
    expect(names.indexOf(STARLIGHT)).toBe(names.indexOf(FENCE) + 1);
  });

  it('sits immediately AFTER the glossary integration when the glossary is active', () => {
    vi.mocked(isGlossaryActive).mockReturnValueOnce(true);
    const names = namesOf(
      defineDocKittyIntegrations({ title: 'Docs', markua: true, gherkin: GHERKIN_OPTS }),
    );
    expect(names.indexOf(GHERKIN)).toBe(names.indexOf(GLOSSARY) + 1);
    expect(names.indexOf(FENCE)).toBe(names.indexOf(GHERKIN) + 1);
    expect(names.indexOf(STARLIGHT)).toBe(names.indexOf(FENCE) + 1);
  });

  it('declares only the codegen hook and leaves the Starlight config unchanged', () => {
    const off = defineDocKittyIntegrations({ title: 'Docs', markua: true });
    const on = defineDocKittyIntegrations({ title: 'Docs', markua: true, gherkin: GHERKIN_OPTS });
    const gherkin = named(on).find((i) => i.name === GHERKIN);
    // config:setup generates the pages and injects the scenario index (#126); it
    // does not touch the markdown pipeline.
    expect(Object.keys(gherkin?.hooks ?? {})).toEqual(['astro:config:setup']);
    expect(starlightConfigOf(on)).toEqual(starlightConfigOf(off));
  });

  // ADR-0051: generated pages hang off `sources`, not off the option's presence.
  // `gherkin: true` (and an object without `sources`) must add no codegen
  // integration and leave the Starlight config (sidebar included) untouched; the
  // in-page fence stage is a separate integration and is pinned on its own.
  it.each([
    ['true', true as const],
    ['{}', {}],
    ['{ includeRoots }', { includeRoots: ['features'] }],
    ['{ fences: false }', { fences: false }],
  ])('gherkin: %s adds no doc-kitty:gherkin codegen integration (no sources)', (_label, gherkin) => {
    const off = defineDocKittyIntegrations({ title: 'Docs', markua: true });
    const on = defineDocKittyIntegrations({ title: 'Docs', markua: true, gherkin });
    expect(namesOf(on)).not.toContain(GHERKIN);
    expect(starlightConfigOf(on)).toEqual(starlightConfigOf(off));
  });

  it.each([
    ['{ sources, fences: false }', { ...GHERKIN_OPTS, fences: false }, false],
    ['{ sources, includeRoots }', { ...GHERKIN_OPTS, includeRoots: ['specs'] }, true],
  ])('gherkin: %s still adds exactly one doc-kitty:gherkin', (_label, gherkin, fences) => {
    const names = namesOf(defineDocKittyIntegrations({ title: 'Docs', gherkin }));
    expect(names.filter((n) => n === GHERKIN)).toHaveLength(1);
    expect(names.filter((n) => n === FENCE)).toHaveLength(fences ? 1 : 0);
    expect(names.indexOf(GHERKIN)).toBe(names.indexOf(STARLIGHT) - (fences ? 2 : 1));
  });

  // ADR-0051: the in-page stage hangs off the option's presence and `fences`,
  // NOT off `sources`.
  it.each([
    ['true', true as const, true],
    ['{}', {}, true],
    ['{ includeRoots }', { includeRoots: ['features'] }, true],
    ['{ fences: false }', { fences: false }, false],
    // ADR-0055: results on generated pages need the stage even without fences.
    ['{ fences: false, results }', { fences: false, results: 'reports/cucumber.ndjson' }, true],
  ])('gherkin: %s registers the fence stage only when fences are on, or results are set', (_label, gherkin, fences) => {
    const names = namesOf(defineDocKittyIntegrations({ title: 'Docs', gherkin }));
    if (fences) {
      expect(names.filter((n) => n === FENCE)).toHaveLength(1);
      expect(names.indexOf(STARLIGHT)).toBe(names.indexOf(FENCE) + 1);
      expect(names.filter((n) => n !== FENCE)).toEqual(PINNED_BASELINE);
    } else {
      expect(names).toEqual(PINNED_BASELINE);
    }
  });

  it('leaves every remark/rehype plugin list unchanged with { sources, fences: false } (no plugin-order pin moves)', () => {
    const off = markdownRegistrations(defineDocKittyIntegrations({ title: 'Docs', markua: true }));
    const on = markdownRegistrations(
      defineDocKittyIntegrations({ title: 'Docs', markua: true, gherkin: { ...GHERKIN_OPTS, fences: false } }),
    );
    // Sanity: the comparison is over a non-trivial stack (markua + always-on seams).
    expect(off.remark.length).toBeGreaterThan(0);
    expect(off.rehype.length).toBeGreaterThan(0);
    // Some seams build their plugin closures per `defineDocKittyIntegrations` call,
    // so compare by SHAPE (functions → their names, options deep) rather than by
    // identity: same plugins, same order, same options.
    expect(shapeOf(on.remark)).toEqual(shapeOf(off.remark));
    expect(shapeOf(on.rehype)).toEqual(shapeOf(off.rehype));
  });

  // The fence stage's own pin (02 §Config surface): with fences on, the ONLY
  // markdown change is ONE `gherkinFence` remark plugin, registered as a
  // `[plugin, options]` tuple carrying the normalised include options, appended
  // after every plugin of the integrations before Starlight (Markua's here; the
  // glossary's integration sits before it too, pinned by the name order above),
  // and before the ones registered after it (deck-split); rehype is untouched.
  const isFence = (p: unknown) => Array.isArray(p) && p[0] === gherkinFence;
  it.each([
    ['true', true as const, { includeRoots: [], sourceRoot: '.' }],
    ['{ sources }', GHERKIN_OPTS, { includeRoots: ['features'], sourceRoot: '.' }],
    [
      '{ includeRoots, sourceRoot, sourceUrlPrefix }',
      { includeRoots: ['specs'], sourceRoot: 'repo', sourceUrlPrefix: 'https://x/' },
      { includeRoots: ['specs'], sourceRoot: 'repo', sourceUrlPrefix: 'https://x/' },
    ],
  ])('gherkin: %s adds exactly one gherkinFence remark plugin, before every post-Starlight plugin', (_label, gherkin, fenceOptions) => {
    const offArr = defineDocKittyIntegrations({ title: 'Docs', markua: true });
    const onArr = defineDocKittyIntegrations({ title: 'Docs', markua: true, gherkin });
    const off = markdownRegistrations(offArr);
    const on = markdownRegistrations(onArr);
    expect(on.remark.filter(isFence)).toEqual([[gherkinFence, fenceOptions]]);
    expect(shapeOf(on.remark.filter((p) => !isFence(p)))).toEqual(shapeOf(off.remark));
    expect(shapeOf(on.rehype)).toEqual(shapeOf(off.rehype));
    // Everything registered by the integrations BEFORE Starlight precedes it.
    const names = namesOf(onArr);
    const before = named(onArr).filter((i) => i.name !== FENCE && names.indexOf(i.name) < names.indexOf(STARLIGHT));
    const beforeCount = markdownRegistrations(before).remark.length;
    expect(beforeCount).toBeGreaterThan(0); // the directive owner + Markua's passes
    const at = on.remark.findIndex(isFence);
    expect(at).toBe(beforeCount);
    expect(at).toBeLessThan(on.remark.length - 1); // deck-split comes after it
  });

  it('the fence stage declares config:setup + build:done hooks and leaves the Starlight config unchanged', () => {
    const off = defineDocKittyIntegrations({ title: 'Docs', markua: true });
    const on = defineDocKittyIntegrations({ title: 'Docs', markua: true, gherkin: true });
    const fence = named(on).find((i) => i.name === FENCE);
    expect(Object.keys(fence?.hooks ?? {})).toEqual(['astro:config:setup', 'astro:build:done']);
    expect(starlightConfigOf(on)).toEqual(starlightConfigOf(off));
  });
});

// Starlight 0.41+ runs its Markdown transforms (asides, heading links, RTL code)
// only on `src/content/docs` and `markdown.processedDirs` (#144, spike B5), and
// 0.34 turned heading links on by default (B7). Operator decision 2026-10-18:
// keep heading links off for parity; adopting anchors is a separate later change.
describe('Starlight markdown options (#144: B5 processedDirs, B7 headingLinks)', () => {
  const markdownOf = (integrations: unknown[]) => {
    const entry = integrations.find(
      (i): i is { __starlightConfig: { markdown?: { processedDirs?: string[]; headingLinks?: boolean } } } =>
        typeof i === 'object' && i !== null && '__starlightConfig' in i,
    );
    return entry?.__starlightConfig.markdown;
  };

  it('adds the docs root to processedDirs and turns heading links off', () => {
    const md = markdownOf(defineDocKittyIntegrations({ title: 'Docs', docsDir: 'docs' }));
    expect(md?.headingLinks).toBe(false);
    expect(md?.processedDirs).toHaveLength(1);
    expect(path.resolve(md?.processedDirs?.[0] ?? '')).toBe(path.resolve('docs'));
  });

  it('does not list the docs root twice when the consumer already names it', () => {
    const md = markdownOf(
      defineDocKittyIntegrations({
        title: 'Docs',
        docsDir: 'docs',
        starlight: { markdown: { processedDirs: ['./docs/', 'extra'] } },
      }),
    );
    expect(md?.processedDirs?.map((p) => path.relative(process.cwd(), path.resolve(p)))).toEqual([
      'docs',
      'extra',
    ]);
  });

  it('keeps a consumer markdown override and their extra processedDirs', () => {
    const md = markdownOf(
      defineDocKittyIntegrations({
        title: 'Docs',
        docsDir: 'docs',
        starlight: { markdown: { headingLinks: true, processedDirs: ['extra'] } },
      }),
    );
    expect(md?.headingLinks).toBe(true);
    expect(md?.processedDirs?.map((p) => path.relative(process.cwd(), path.resolve(p)))).toEqual([
      'docs',
      'extra',
    ]);
  });
});
