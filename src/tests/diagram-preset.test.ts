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
 *     `starlight()`, and its `astro:config:setup` hook registers the WP02
 *     `diagramMeta` (remark, first) + the fence transform (remark, second) and
 *     `diagramFigure` (rehype), then injects the single client render owner
 *     page-wide.
 *
 * Spike note: astro-mermaid renders unconditionally, so the preset takes the
 * own-transform fallback (see `config.ts`) — there is deliberately NO
 * astro-mermaid `mermaid()` integration in the array. "Prepended before
 * Starlight" is proven here on our own `doc-kitty:diagrams` integration, which is
 * what actually carries the transform + render wiring.
 *
 * As in `config-invariants.test.ts`, `@astrojs/starlight` is mocked so the
 * Starlight entry is locatable; the other integrations run for real (they only
 * return integration objects).
 */
import { describe, it, expect, vi } from 'vitest';
import diagramMeta from '../lib/remark/diagram-meta.js';
import diagramFigure from '../lib/rehype/diagram-figure.js';

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
  }): void;
}

/** Run the diagrams integration's `astro:config:setup` hook and capture what it
 * registers (markdown plugins) and injects (page scripts). */
function runDiagramsSetup(integrations: unknown[]): {
  configs: MarkdownRegistration[];
  scripts: Array<{ stage: string; code: string }>;
} {
  const entry = named(integrations).find((i) => i.name === DIAGRAMS);
  if (!entry) throw new Error('diagrams integration not registered');
  const hook = entry.hooks?.['astro:config:setup'] as SetupHook | undefined;
  if (!hook) throw new Error('diagrams integration has no astro:config:setup hook');
  const configs: MarkdownRegistration[] = [];
  const scripts: Array<{ stage: string; code: string }> = [];
  hook({
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

  it('registers diagramMeta + fence (remark, in order) and diagramFigure (rehype)', () => {
    const { configs } = runDiagramsSetup(
      defineDocKittyIntegrations({ title: 'Docs', diagrams: true }),
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

  it('injects the single client render owner page-wide', () => {
    const { scripts } = runDiagramsSetup(
      defineDocKittyIntegrations({ title: 'Docs', diagrams: true }),
    );
    expect(scripts).toHaveLength(1);
    expect(scripts[0].stage).toBe('page');
    expect(scripts[0].code).toContain('initDiagrams');
    expect(scripts[0].code).toContain('diagram-render.client');
  });
});
