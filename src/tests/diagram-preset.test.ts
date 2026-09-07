/**
 * T013 — Opt-in diagrams preset (FR-001, contract `render-token-and-assertions`
 * PR-1).
 *
 * `defineDocKittyIntegrations({ diagrams })` must gate the ENTIRE diagram seam on
 * a single flag:
 *   - **off** (absent or `false`) → the integrations array carries no diagram
 *     integration at all (no markdown plugins, no injected render owner) — a
 *     diagram-free site pays nothing.
 *   - **on** (`true`) → a `doc-kitty:diagrams` integration is prepended BEFORE
 *     `starlight()`, and its `astro:config:setup` hook wires the pipeline for the
 *     RESOLVED mode (#13). The membership + ordering is mode-agnostic; the WIRING
 *     is MODE-AWARE (C-005) and asserted for BOTH branches here:
 *       - CLIENT (fallback, NFR-002): `diagramMeta` + fence transform (remark) +
 *         `diagramFigure` (rehype) + the single client render owner injected.
 *       - BUILD (#13): `diagramMeta` only (remark) + `@beoe/rehype-mermaid` →
 *         `sentinelThemeRewrite` → `diagramFigure` (rehype), NO render owner.
 *     The mode is forced per-test via `DK_DIAGRAM_BUILD_RENDER` so both branches
 *     are proven regardless of whether the runner has Chromium.
 *
 * Spike note: the build path (@beoe/rehype-mermaid) renders to static SVG; the client path stays byte-identical to pre-#13 (dual-mode, #13)
 * own-transform fallback (see `config.ts`) — there is deliberately NO
 * astro-mermaid `mermaid()` integration in the array. "Prepended before
 * Starlight" is proven here on our own `doc-kitty:diagrams` integration, which is
 * what actually carries the transform + render wiring.
 *
 * As in `config-invariants.test.ts`, `@astrojs/starlight` is mocked so the
 * Starlight entry is locatable; the other integrations run for real (they only
 * return integration objects).
 */
import { describe, it, expect, vi, afterEach } from 'vitest';
import diagramMeta from '../lib/remark/diagram-meta.js';
import plantumlMeta from '../lib/remark/plantuml-meta.js';
import diagramFigure from '../lib/rehype/diagram-figure.js';
import {
  sentinelThemeRewrite,
  BUILD_MERMAID_OPTS,
  resolveDiagramMode,
  DIAGRAM_SENTINELS,
  SENTINEL_THEME_VARIABLES,
} from '../lib/config.js';

vi.mock('@astrojs/starlight', () => ({
  default: (config: Record<string, unknown>) => ({
    name: '@astrojs/starlight',
    __starlightConfig: config,
    hooks: {},
  }),
}));

// Imported AFTER the mock is declared (vi.mock is hoisted, so this is safe).
const { defineDocKittyIntegrations } = await import('../lib/config.js');

const DIAGRAMS = 'doc-kitty:diagrams';
const STARLIGHT = '@astrojs/starlight';

interface NamedIntegration {
  name: string;
  hooks?: Record<string, unknown>;
}

/** The named integrations, in array order (relative order preserved). */
function named(integrations: unknown[]): NamedIntegration[] {
  return integrations.filter(
    (i): i is NamedIntegration =>
      typeof i === 'object' &&
      i !== null &&
      'name' in i &&
      typeof (i as { name: unknown }).name === 'string',
  );
}

interface MarkdownRegistration {
  markdown?: { remarkPlugins?: unknown[]; rehypePlugins?: unknown[] };
}
interface SetupHook {
  (opts: {
    updateConfig: (config: MarkdownRegistration) => void;
    injectScript: (stage: string, code: string) => void;
  }): void | Promise<void>;
}

// The mode is resolved inside the hook from `DK_DIAGRAM_BUILD_RENDER` (config.ts's
// `resolveDiagramMode`), so a test FORCES a mode with the env flag rather than
// depending on whether Chromium happens to be installed in the runner (C-005:
// gates prove BOTH branches deterministically).
afterEach(() => {
  delete process.env.DK_DIAGRAM_BUILD_RENDER;
});

/** Run the diagrams integration's `astro:config:setup` hook (async: the build
 * branch lazy-imports `@beoe/rehype-mermaid`) with the mode forced by `flag`,
 * and capture what it registers (markdown plugins) and injects (page scripts). */
async function runDiagramsSetup(
  integrations: unknown[],
  flag: 'on' | 'off',
): Promise<{
  configs: MarkdownRegistration[];
  scripts: Array<{ stage: string; code: string }>;
}> {
  process.env.DK_DIAGRAM_BUILD_RENDER = flag;
  const entry = named(integrations).find((i) => i.name === DIAGRAMS);
  if (!entry) throw new Error('diagrams integration not registered');
  const hook = entry.hooks?.['astro:config:setup'] as SetupHook | undefined;
  if (!hook) throw new Error('diagrams integration has no astro:config:setup hook');
  const configs: MarkdownRegistration[] = [];
  const scripts: Array<{ stage: string; code: string }> = [];
  await hook({
    updateConfig: (config) => configs.push(config),
    injectScript: (stage, code) => scripts.push({ stage, code }),
  });
  return { configs, scripts };
}

describe('defineDocKittyIntegrations diagrams preset (opt-in, FR-001)', () => {
  it('omits the diagrams integration by default (off adds nothing)', () => {
    const names = named(defineDocKittyIntegrations({ title: 'Docs' })).map((i) => i.name);
    expect(names).not.toContain(DIAGRAMS);
    // Starlight is still there — the default path is otherwise unchanged.
    expect(names).toContain(STARLIGHT);
  });

  it('omits the diagrams integration when diagrams:false', () => {
    const names = named(
      defineDocKittyIntegrations({ title: 'Docs', diagrams: false }),
    ).map((i) => i.name);
    expect(names).not.toContain(DIAGRAMS);
  });

  it('prepends the diagrams integration BEFORE starlight when diagrams:true', () => {
    const names = named(
      defineDocKittyIntegrations({ title: 'Docs', diagrams: true }),
    ).map((i) => i.name);
    expect(names).toContain(DIAGRAMS);
    expect(names.indexOf(DIAGRAMS)).toBeLessThan(names.indexOf(STARLIGHT));
  });

  // -- CLIENT mode (DK_DIAGRAM_BUILD_RENDER=off): the pre-#13 wiring, unchanged
  //    (NFR-002). ------------------------------------------------------------
  it('[client mode] registers diagramMeta + fence (remark, in order) and diagramFigure (rehype)', async () => {
    const { configs } = await runDiagramsSetup(
      defineDocKittyIntegrations({ title: 'Docs', diagrams: true }),
      'off',
    );
    const md = configs.find((c) => c.markdown)?.markdown;
    // diagramMeta parses/injects metadata BEFORE the fence transform rewrites the
    // node into `<pre class="mermaid">`.
    expect(md?.remarkPlugins?.[0]).toBe(diagramMeta);
    expect(md?.remarkPlugins).toHaveLength(2);
    expect(typeof md?.remarkPlugins?.[1]).toBe('function');
    // diagramFigure wraps the transformed `<pre>` AFTER, as the sole rehype plugin.
    expect(md?.rehypePlugins).toEqual([diagramFigure]);
  });

  it('[client mode] injects the single client render owner page-wide', async () => {
    const { scripts } = await runDiagramsSetup(
      defineDocKittyIntegrations({ title: 'Docs', diagrams: true }),
      'off',
    );
    expect(scripts).toHaveLength(1);
    expect(scripts[0].stage).toBe('page');
    expect(scripts[0].code).toContain('initDiagrams');
    expect(scripts[0].code).toContain('diagram-render.client');
  });

  // -- BUILD mode (DK_DIAGRAM_BUILD_RENDER=on): the #13 build-render wiring. The
  //    fence transform is DROPPED (the standard `code.language-mermaid` survives
  //    to hast for `@beoe/rehype-mermaid`), the rehype stage becomes
  //    beoe → sentinelThemeRewrite → diagramFigure, and NO client render owner
  //    is injected (the figure is fully static). ------------------------------
  it('[build mode] registers diagramMeta only (no fence) + beoe→rewrite→figure rehype chain', async () => {
    const { configs } = await runDiagramsSetup(
      defineDocKittyIntegrations({ title: 'Docs', diagrams: true }),
      'on',
    );
    const md = configs.find((c) => c.markdown)?.markdown;
    // remark side (#13 WP02): `diagramMeta` (Mermaid `%%`-metadata) runs FIRST so
    // the baked SVG carries `<title>`/`<desc>`; then `plantumlMeta` (the PlantUML
    // `'`-metadata twin + skinparam sentinel preamble); then `astro-plantuml`'s
    // own render plugin (a lazily-loaded function). The client fence transform is
    // absent (the standard `code.language-mermaid` survives to hast for @beoe).
    expect(md?.remarkPlugins?.[0]).toBe(diagramMeta);
    expect(md?.remarkPlugins?.[1]).toBe(plantumlMeta);
    expect(md?.remarkPlugins).toHaveLength(3);
    expect(typeof md?.remarkPlugins?.[2]).toBe('function'); // astro-plantuml createRemarkPlugin

    // The rehype chain: `@beoe/rehype-mermaid` (with the build opts tuple) → the
    // sentinel→var theme rewrite → the shared figure wrapper, in that order.
    const rehype = md?.rehypePlugins ?? [];
    expect(rehype).toHaveLength(3);
    const beoeEntry = rehype[0] as [unknown, unknown];
    expect(Array.isArray(beoeEntry)).toBe(true);
    expect(typeof beoeEntry[0]).toBe('function'); // the @beoe plugin
    expect(beoeEntry[1]).toBe(BUILD_MERMAID_OPTS); // exact registered build opts
    expect(BUILD_MERMAID_OPTS).toMatchObject({
      strategy: 'inline',
      mermaidConfig: { theme: 'base', securityLevel: 'strict' },
    });
    expect(rehype[1]).toBe(sentinelThemeRewrite);
    expect(rehype[2]).toBe(diagramFigure);
  });

  it('[build mode] injects NO client render owner (the build figure is static)', async () => {
    const { scripts } = await runDiagramsSetup(
      defineDocKittyIntegrations({ title: 'Docs', diagrams: true }),
      'on',
    );
    expect(scripts).toHaveLength(0);
  });
});

describe('resolveDiagramMode (FR-005 — deterministic, gate-observable mode)', () => {
  it('an explicit truthy flag forces build mode (env wins over auto-detect)', () => {
    for (const v of ['1', 'true', 'on', 'yes', 'build', 'BUILD', ' On ']) {
      expect(resolveDiagramMode({ DK_DIAGRAM_BUILD_RENDER: v })).toBe('build');
    }
  });

  it('an explicit falsy flag forces client mode (the fallback, never a hard fail)', () => {
    for (const v of ['0', 'false', 'off', 'no', 'client', 'OFF']) {
      expect(resolveDiagramMode({ DK_DIAGRAM_BUILD_RENDER: v })).toBe('client');
    }
  });

  it('resolves a concrete mode when the flag is absent/unrecognised (auto-detect)', () => {
    // No env override → auto-detect Chromium; the value depends on the runner but
    // must be one of the two deterministic modes (never undefined/throwing).
    expect(['build', 'client']).toContain(resolveDiagramMode({}));
    expect(['build', 'client']).toContain(
      resolveDiagramMode({ DK_DIAGRAM_BUILD_RENDER: 'maybe' }),
    );
  });
});

describe('build-render sentinel table (D2/D7 — six-token theme rewrite source)', () => {
  const SIX_TOKENS = [
    'node-fill',
    'node-border',
    'node-text',
    'edge',
    'subgraph-title',
    'cluster-fill',
  ];

  it('defines exactly the six --dk-diagram-* tokens, each a distinct sentinel hex', () => {
    expect(Object.keys(DIAGRAM_SENTINELS).sort()).toEqual([...SIX_TOKENS].sort());
    const hexes = Object.values(DIAGRAM_SENTINELS);
    // Every sentinel is a full 6-digit hex (non-shortenable so SVGO never
    // collapses it to a form the rewrite would miss) and mutually DISTINCT.
    for (const hex of hexes) expect(hex).toMatch(/^#[0-9a-f]{6}$/i);
    expect(new Set(hexes.map((h) => h.toLowerCase())).size).toBe(hexes.length);
  });

  it('maps every pinned Mermaid themeVariable to one of the six sentinels', () => {
    const sentinelSet = new Set(Object.values(DIAGRAM_SENTINELS).map((h) => h.toLowerCase()));
    const values = Object.values(SENTINEL_THEME_VARIABLES);
    expect(values.length).toBeGreaterThanOrEqual(11); // superset of dkThemeVars()
    for (const v of values) expect(sentinelSet.has(v.toLowerCase())).toBe(true);
    // All six tokens are actually used by at least one themeVariable.
    expect(new Set(values.map((v) => v.toLowerCase())).size).toBe(6);
  });
});
