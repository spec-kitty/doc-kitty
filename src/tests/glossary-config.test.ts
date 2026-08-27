/**
 * WP08 — the single glossary integration seam in `config.ts` (T027/T028;
 * ADR-0025/0026/0027, contract `autolink-and-term.md`; FR-008/013, NFR-002).
 *
 * Two things are proven here:
 *
 *  1. **Committed byte-identity gate (R-4, NFR-002).** With NO
 *     `.contextive/definitions.yaml`, `defineDocKittyIntegrations` must contribute
 *     NOTHING for the glossary — the named-integration array equals a PINNED
 *     glossary-free baseline. This is the re-runnable assertion that fails loudly
 *     if a future change registers the glossary plugins unconditionally (the most
 *     common presence-gating miss), exactly as `diagram-preset.test.ts` guards
 *     `diagrams: false`.
 *
 *  2. **Active wiring.** With a definitions file present, the `doc-kitty:glossary`
 *     integration is prepended before Starlight and its `astro:config:setup` hook
 *     (a) generates the glossary pages before the glob sync, (b) registers the
 *     remark plugins in the PINNED order `remarkDirective → glossary-term →
 *     glossary-autolink` (threading the ONE shared index + `DEFAULT_IGNORE_LIST`
 *     into both) plus the `glossaryDefinitions` rehype payload, and (c) injects the
 *     preview island page-wide.
 *
 * `@astrojs/starlight` is mocked (as in the sibling config tests) so the Starlight
 * entry is locatable; `../lib/glossary/load.js` and `.../generate.js` are mocked so
 * presence and codegen are controlled without touching the filesystem.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import remarkDirective from 'remark-directive';
import glossaryTerm from '../lib/remark/glossary-term.js';
import glossaryAutolink from '../lib/remark/glossary-autolink.js';
import { DEFAULT_IGNORE_LIST } from '../lib/glossary/ignore-list.js';
import { glossaryDefinitions } from '../lib/glossary/definitions-payload.js';
import type { SharedTermIndex } from '../lib/glossary/types.js';

vi.mock('@astrojs/starlight', () => ({
  default: (config: Record<string, unknown>) => ({
    name: '@astrojs/starlight',
    __starlightConfig: config,
    hooks: {},
  }),
}));

vi.mock('../lib/glossary/load.js', () => ({
  isGlossaryActive: vi.fn(() => false),
  loadGlossary: vi.fn(() => ({ present: false })),
}));

vi.mock('../lib/glossary/generate.js', () => ({
  generateGlossaryPages: vi.fn(() => []),
}));

// Imported AFTER the mocks are declared (vi.mock is hoisted, so this is safe).
const { isGlossaryActive, loadGlossary } = await import('../lib/glossary/load.js');
const { generateGlossaryPages } = await import('../lib/glossary/generate.js');
const { defineDocKittyIntegrations } = await import('../lib/config.js');

const GLOSSARY = 'doc-kitty:glossary';
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

/** Run the glossary integration's `astro:config:setup` hook and capture what it
 * registers (markdown plugins) and injects (page scripts). */
function runGlossarySetup(integrations: unknown[]): {
  configs: MarkdownRegistration[];
  scripts: Array<{ stage: string; code: string }>;
} {
  const entry = named(integrations).find((i) => i.name === GLOSSARY);
  if (!entry) throw new Error('glossary integration not registered');
  const hook = entry.hooks?.['astro:config:setup'] as SetupHook | undefined;
  if (!hook) throw new Error('glossary integration has no astro:config:setup hook');
  const configs: MarkdownRegistration[] = [];
  const scripts: Array<{ stage: string; code: string }> = [];
  hook({
    updateConfig: (config) => configs.push(config),
    injectScript: (stage, code) => scripts.push({ stage, code }),
  });
  return { configs, scripts };
}

/** A tiny, non-empty shared index — enough to exercise the active path. */
const fakeIndex: SharedTermIndex = {
  bySurface: new Map([
    ['term', [{ context: 'Ctx', anchor: 'term', termName: 'Term' }]],
  ]),
  contexts: new Map([
    ['Ctx', { slug: 'ctx', terms: [{ name: 'Term', definition: 'A **thing**.' }] }],
  ]),
};

beforeEach(() => {
  vi.mocked(isGlossaryActive).mockReturnValue(false);
  vi.mocked(loadGlossary).mockReturnValue({ present: false });
  vi.mocked(generateGlossaryPages).mockClear();
});

describe('defineDocKittyIntegrations glossary presence-gate (byte-identity, R-4)', () => {
  it('omits the glossary integration when no definitions file exists', () => {
    const names = named(defineDocKittyIntegrations({ title: 'Docs' })).map((i) => i.name);
    expect(names).not.toContain(GLOSSARY);
    expect(names).toContain(STARLIGHT);
  });

  it('keeps the glossary-free named array byte-identical to the pinned baseline', () => {
    // PINNED baseline — the pre-M4 named-integration order for the plain
    // (no theme, no diagrams) path. A future unconditional glossary registration
    // makes this list grow and this assertion fails loudly.
    const PINNED_GLOSSARY_FREE_BASELINE = [
      '@astrojs/starlight',
      'doc-kitty:deck-split',
      '@astrojs/sitemap',
      'doc-kitty:manifest',
      'doc-kitty:favicon',
    ];
    const names = named(defineDocKittyIntegrations({ title: 'Docs' })).map((i) => i.name);
    expect(names).toEqual(PINNED_GLOSSARY_FREE_BASELINE);
  });

  it('stays glossary-free even with diagrams on (glossary is independent)', () => {
    const names = named(
      defineDocKittyIntegrations({ title: 'Docs', diagrams: true }),
    ).map((i) => i.name);
    expect(names).not.toContain(GLOSSARY);
  });
});

describe('defineDocKittyIntegrations glossary active wiring', () => {
  beforeEach(() => {
    vi.mocked(isGlossaryActive).mockReturnValue(true);
    vi.mocked(loadGlossary).mockReturnValue({ present: true, index: fakeIndex });
  });

  it('prepends the glossary integration BEFORE starlight when active', () => {
    const names = named(defineDocKittyIntegrations({ title: 'Docs' })).map((i) => i.name);
    expect(names).toContain(GLOSSARY);
    expect(names.indexOf(GLOSSARY)).toBeLessThan(names.indexOf(STARLIGHT));
  });

  it('generates the glossary pages in config:setup (generate-before-glob)', () => {
    runGlossarySetup(defineDocKittyIntegrations({ title: 'Docs' }));
    expect(generateGlossaryPages).toHaveBeenCalledTimes(1);
    // Called with the shared index and an absolute docs dir (resolved from cwd).
    const [passedIndex, outDir] = vi.mocked(generateGlossaryPages).mock.calls[0];
    expect(passedIndex).toBe(fakeIndex);
    expect(typeof outDir).toBe('string');
    expect((outDir as string).endsWith('/docs') || (outDir as string).endsWith('\\docs')).toBe(true);
  });

  it('registers the remark plugins in the pinned order with the shared index + ignore-list', () => {
    const { configs } = runGlossarySetup(defineDocKittyIntegrations({ title: 'Docs' }));
    const md = configs.find((c) => c.markdown)?.markdown;
    const remark = md?.remarkPlugins ?? [];
    expect(remark).toHaveLength(3);
    // 1. remarkDirective (so `:term` is a real directive node) FIRST.
    expect(remark[0]).toBe(remarkDirective);
    // 2. glossary-term, threaded with the shared index + DEFAULT_IGNORE_LIST.
    expect(Array.isArray(remark[1])).toBe(true);
    const term = remark[1] as [unknown, { index: unknown; ignoreList: unknown }];
    expect(term[0]).toBe(glossaryTerm);
    expect(term[1].index).toBe(fakeIndex);
    expect(term[1].ignoreList).toBe(DEFAULT_IGNORE_LIST);
    // 3. glossary-autolink LAST, same index + ignore-list.
    expect(Array.isArray(remark[2])).toBe(true);
    const autolink = remark[2] as [unknown, { index: unknown; ignoreList: unknown }];
    expect(autolink[0]).toBe(glossaryAutolink);
    expect(autolink[1].index).toBe(fakeIndex);
    expect(autolink[1].ignoreList).toBe(DEFAULT_IGNORE_LIST);
  });

  it('registers the definitions-payload rehype plugin carrying the global payload', () => {
    const { configs } = runGlossarySetup(defineDocKittyIntegrations({ title: 'Docs' }));
    const md = configs.find((c) => c.markdown)?.markdown;
    const rehype = md?.rehypePlugins ?? [];
    expect(rehype).toHaveLength(1);
    expect(Array.isArray(rehype[0])).toBe(true);
    const payload = rehype[0] as [unknown, { json: string }];
    expect(payload[0]).toBe(glossaryDefinitions);
    // The JSON is the global, markdown-stripped payload keyed by context/term.
    expect(payload[1].json).toContain('"Ctx"');
    expect(payload[1].json).toContain('"Term"');
    expect(payload[1].json).toContain('A thing.'); // markdown stripped from "A **thing**."
  });

  it('injects the preview island page-wide with a .catch guard', () => {
    const { scripts } = runGlossarySetup(defineDocKittyIntegrations({ title: 'Docs' }));
    expect(scripts).toHaveLength(1);
    expect(scripts[0].stage).toBe('page');
    expect(scripts[0].code).toContain('initGlossaryPreview');
    expect(scripts[0].code).toContain('preview.client');
    expect(scripts[0].code).toContain('.catch');
  });
});
