/**
 * WP02 — deck-scope symmetry. Proves the registration-site deck guard
 * (`guardDeck` + the shared `isPresentationFile`/`isPresentationEntry`
 * predicates) makes ALL FIVE Markua passes no-op on Presentation pages, that the
 * guard is transparent to the parity enumerator, and that no scattered inline
 * `kind === 'Presentation'` copy survives (C36a/C36b/C36c/C36f, FR-005/006,
 * NFR-002).
 *
 * Four surfaces:
 *  1. **Per-pass no-op** — each of the five real plugins, once `guardDeck`-wrapped,
 *     leaves a deck-shaped tree untouched.
 *  2. **C36f (auto-guard)** — every member of the BUILT `config.ts` remark `:604`
 *     and rehype `:606` arrays exposes `__inner` (a 6th pass added outside
 *     `.map(guardDeck)` reds here).
 *  3. **C36b (no proliferation)** — the runtime deck-guard count stays ≤ the
 *     baseline of 4 and every folded site routes through the shared predicate.
 *  4. **C36a (deck-Markua inertness)** — a structure-adversarial deck body with
 *     `{…}`, `W>`, and `{aside}` markers, run through the guarded remark chain +
 *     `deckSplit`, yields the SAME slide/section structure as the marker-free
 *     deck (and a proof that UNGUARDED it would not).
 */
import { describe, it, expect, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { unified } from 'unified';
import remarkParse from 'remark-parse';
import remarkGfm from 'remark-gfm';
import { guardDeck } from '../lib/markua/deck-guard.js';
import { isPresentationFile, isPresentationEntry } from '../lib/deck/is-presentation.js';
import markuaNormalise from '../lib/remark/markua-normalise.js';
import markuaAttributes from '../lib/remark/markua-attributes.js';
import markuaCallouts from '../lib/remark/markua-callouts.js';
import markuaFigure from '../lib/rehype/markua-figure.js';
import markuaTocDemote from '../lib/rehype/markua-toc-demote.js';
import deckSplit from '../lib/remark/deck-split.js';

// Same mocks as the sibling config tests: Starlight is stubbed so the integration
// entry is locatable, glossary presence/codegen are controlled without I/O.
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
  GLOSSARY_OUTPUT_DIRNAME: 'glossary',
}));

const { defineDocKittyIntegrations } = await import('../lib/config.js');

// ---------------------------------------------------------------------------
// helpers
// ---------------------------------------------------------------------------

interface AnyNode {
  type: string;
  depth?: number;
  value?: string;
  children?: AnyNode[];
  data?: Record<string, unknown>;
  [key: string]: unknown;
}

/** A deck-shaped remark/rehype VFile (Astro injects `data.astro.frontmatter`). */
function deckFile(extra: Record<string, unknown> = {}): {
  data: { astro: { frontmatter: Record<string, unknown> } };
  message: () => void;
} {
  return {
    data: { astro: { frontmatter: { kind: 'Presentation', title: 'Deck', description: 'd', ...extra } } },
    message: () => {},
  };
}

/** Parse a Markdown string to mdast (remark-gfm parse extensions applied). */
function parse(md: string): AnyNode {
  return unified().use(remarkParse).use(remarkGfm).parse(md) as unknown as AnyNode;
}

type Plugin = () => (tree: unknown, file?: unknown) => void;

/** Named list of the five Markua passes for the per-pass no-op matrix. */
const FIVE_PASSES: Array<[string, Plugin]> = [
  ['markuaNormalise', markuaNormalise as Plugin],
  ['markuaAttributes', markuaAttributes as Plugin],
  ['markuaCallouts', markuaCallouts as Plugin],
  ['markuaFigure', markuaFigure as Plugin],
  ['markuaTocDemote', markuaTocDemote as Plugin],
];

/** Count every `deckSection` node in a split tree (top-level + inner stack). */
function countSections(node: AnyNode): number {
  let n = node.type === 'deckSection' ? 1 : 0;
  for (const child of node.children ?? []) n += countSections(child);
  return n;
}

/** Top-level `deckSection` children only (title slide + horizontals/stacks). */
function topLevelSections(root: AnyNode): number {
  return (root.children ?? []).filter((c) => c.type === 'deckSection').length;
}

/** Run the ordered remark plugins (each with `wrap`), then `deckSplit`. */
function runChain(md: string, wrap: (p: Plugin) => Plugin): AnyNode {
  const tree = parse(md);
  const file = deckFile();
  for (const p of [markuaNormalise, markuaAttributes, markuaCallouts] as Plugin[]) {
    wrap(p)()(tree, file);
  }
  (deckSplit as Plugin)()(tree, file); // deckSplit is NEVER wrapped (the deck processor)
  return tree;
}

const identity = <P>(p: P): P => p;

// ---------------------------------------------------------------------------
// 1. per-pass no-op on a deck (T010a)
// ---------------------------------------------------------------------------

describe('guardDeck — every Markua pass no-ops on a Presentation page (C36a)', () => {
  // A tree carrying content each pass WOULD otherwise touch (attr list, aside
  // container, lone image), so an unguarded run would mutate it.
  const seed = (): AnyNode => ({
    type: 'root',
    children: [
      { type: 'paragraph', children: [{ type: 'text', value: '{width:"50%"}' }] },
      { type: 'paragraph', children: [{ type: 'text', value: 'W> warn' }] },
      {
        type: 'containerDirective',
        name: 'aside',
        children: [{ type: 'paragraph', children: [{ type: 'text', value: 'x' }] }],
      },
      { type: 'image', url: '/a.png', alt: 'cap' },
    ],
  });

  for (const [name, plugin] of FIVE_PASSES) {
    it(`${name} leaves a deck tree untouched`, () => {
      const tree = seed();
      const before = structuredClone(tree);
      guardDeck(plugin)()(tree, deckFile());
      expect(tree).toEqual(before);
    });
  }

  it('the guard actually gates on the predicate (non-deck file is NOT skipped)', () => {
    // Sanity: on a NON-deck file the wrapped plugin delegates (proves the no-op
    // above is the guard firing, not a dead plugin).
    const tree = seed();
    const nonDeck = { data: { astro: { frontmatter: { kind: 'Reference' } } }, message: () => {} };
    guardDeck(markuaAttributes as Plugin)()(tree, nonDeck);
    expect(tree).not.toEqual(seed()); // markuaAttributes consumed the `{…}` paragraph
  });
});

// ---------------------------------------------------------------------------
// 2. C36c — identity transparency
// ---------------------------------------------------------------------------

describe('guardDeck — transparent to the parity enumerator (C36c)', () => {
  it('exposes __inner and preserves the wrapped name', () => {
    const wrapped = guardDeck(markuaFigure as Plugin) as unknown as { __inner: unknown; name: string };
    expect(wrapped.__inner).toBe(markuaFigure);
    expect(wrapped.name).toBe((markuaFigure as { name: string }).name);
  });
});

// ---------------------------------------------------------------------------
// 3. C36f — every built array member is deck-guarded
// ---------------------------------------------------------------------------

interface MdReg {
  markdown?: { remarkPlugins?: unknown[]; rehypePlugins?: unknown[] };
}
function markuaArrays(): { remark: unknown[]; rehype: unknown[] } {
  const arr = defineDocKittyIntegrations({ title: 'Docs', markua: true }) as Array<{
    name?: string;
    hooks?: Record<string, unknown>;
  }>;
  const markua = arr.find((i) => i.name === 'doc-kitty:markua');
  if (!markua) throw new Error('doc-kitty:markua integration not registered');
  const hook = markua.hooks?.['astro:config:setup'] as
    | ((o: { updateConfig: (c: MdReg) => void; injectScript: () => void }) => void)
    | undefined;
  if (!hook) throw new Error('markua integration has no astro:config:setup hook');
  const configs: MdReg[] = [];
  hook({ updateConfig: (c) => configs.push(c), injectScript: () => {} });
  const md = configs.find((c) => c.markdown)?.markdown;
  return { remark: md?.remarkPlugins ?? [], rehype: md?.rehypePlugins ?? [] };
}

describe('config.ts — every registration-array member is deck-guarded (C36f)', () => {
  it('every :604 remark member exposes __inner', () => {
    const { remark } = markuaArrays();
    expect(remark.length).toBeGreaterThan(0);
    for (const member of remark) {
      expect((member as { __inner?: unknown }).__inner, `remark member ${(member as { name?: string }).name}`).toBeDefined();
    }
  });

  it('every :606 rehype member exposes __inner', () => {
    const { rehype } = markuaArrays();
    expect(rehype.length).toBeGreaterThan(0);
    for (const member of rehype) {
      expect((member as { __inner?: unknown }).__inner, `rehype member ${(member as { name?: string }).name}`).toBeDefined();
    }
  });

  it('the wrapped members are exactly the five Markua passes, in order', () => {
    const { remark, rehype } = markuaArrays();
    const inner = (e: unknown) => (e as { __inner?: unknown }).__inner;
    expect(remark.map(inner)).toEqual([markuaNormalise, markuaAttributes, markuaCallouts]);
    expect(rehype.map(inner)).toEqual([markuaFigure, markuaTocDemote]);
  });
});

// ---------------------------------------------------------------------------
// 4. C36b — one predicate, no proliferation (automated)
// ---------------------------------------------------------------------------

describe('deck-guard predicate — no runtime-guard proliferation (C36b)', () => {
  const libDir = fileURLToPath(new URL('../lib', import.meta.url));
  const read = (rel: string) => readFileSync(`${libDir}/${rel}`, 'utf8');

  /** Count RUNTIME `=== 'Presentation'` / `!== 'Presentation'` checks, skipping
   *  comment lines and (by construction) enum declarations, which use `| '…'`. */
  const runtimeGuardCount = (src: string): number =>
    src
      .split('\n')
      .filter((line) => {
        const t = line.trim();
        if (t.startsWith('*') || t.startsWith('//') || t.startsWith('/*')) return false;
        return /(===|!==)\s*'Presentation'/.test(t);
      }).length;

  it('the total runtime deck-guard count stays ≤ the baseline of 4', () => {
    const files = [
      'deck/is-presentation.ts',
      'remark/deck-split.ts',
      'rehype/markua-figure.ts',
      'remark/glossary-autolink.ts',
      'metadata.ts',
      'config.ts',
    ];
    const total = files.reduce((sum, f) => sum + runtimeGuardCount(read(f)), 0);
    expect(total).toBeLessThanOrEqual(4);
  });

  it('the shared predicate is the single home (deck/is-presentation.ts) + deck-split keeps its own', () => {
    // Consolidated: the predicate file (2 shapes) and the deck processor are the
    // only runtime string checks left; the folded sites carry none.
    expect(runtimeGuardCount(read('deck/is-presentation.ts'))).toBe(2);
    expect(runtimeGuardCount(read('remark/deck-split.ts'))).toBe(1); // the deck processor — never folded
    expect(runtimeGuardCount(read('rehype/markua-figure.ts'))).toBe(0);
    expect(runtimeGuardCount(read('remark/glossary-autolink.ts'))).toBe(0);
    expect(runtimeGuardCount(read('metadata.ts'))).toBe(0);
  });

  it('every folded deck-aware site routes through the shared predicate', () => {
    expect(read('rehype/markua-figure.ts')).toContain("from '../deck/is-presentation.js'");
    expect(read('rehype/markua-figure.ts')).toContain('isPresentationFile(file)');
    expect(read('remark/glossary-autolink.ts')).toContain("from '../deck/is-presentation.js'");
    expect(read('remark/glossary-autolink.ts')).toContain('isPresentationFile(file)');
    expect(read('metadata.ts')).toContain("from './deck/is-presentation.js'");
    expect(read('metadata.ts')).toContain('isPresentationEntry(entry)');
  });

  it('the predicate reads the two documented shapes correctly', () => {
    expect(isPresentationFile({ data: { astro: { frontmatter: { kind: 'Presentation' } } } })).toBe(true);
    expect(isPresentationFile({ data: { astro: { frontmatter: { kind: 'Reference' } } } })).toBe(false);
    expect(isPresentationFile(undefined)).toBe(false); // defensive optional-chain (non-Astro VFile)
    expect(isPresentationFile({})).toBe(false);
    expect(isPresentationEntry({ data: { kind: 'Presentation' } })).toBe(true);
    expect(isPresentationEntry({ data: { kind: 'Reference' } })).toBe(false);
    expect(isPresentationEntry(undefined)).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// 5. C36a — deck-Markua inertness by STRUCTURE (structure-adversarial)
// ---------------------------------------------------------------------------

describe('deck-Markua inertness — guarded chain preserves slide structure (C36a)', () => {
  // A deck body whose `{aside}` wraps a `###` slide boundary. If markuaNormalise
  // ran, it would compile `{aside}…{/aside}` into a containerDirective, hiding the
  // inner `### Swallowed Slide` from deckSplit → a DIFFERENT slide count. `W>` and
  // `{width:"50%"}` exercise the other two Markua syntaxes.
  const WITH_MARKERS = [
    '## Slide One',
    '',
    'Intro paragraph.',
    '',
    '{aside}',
    '',
    '### Swallowed Slide',
    '',
    'W> A warning line.',
    '',
    '{/aside}',
    '',
    '### Real Slide Two',
    '',
    '{width:"50%"}',
    '',
    '![cap](/img.png)',
    '',
  ].join('\n');

  // The marker-free deck: the SAME slide boundaries, no Markua wrappers.
  const MARKER_FREE = [
    '## Slide One',
    '',
    'Intro paragraph.',
    '',
    '### Swallowed Slide',
    '',
    'A warning line.',
    '',
    '### Real Slide Two',
    '',
    '![cap](/img.png)',
    '',
  ].join('\n');

  it('guarded chain on the marker deck == deckSplit on the marker-free deck (structure)', () => {
    const guarded = runChain(WITH_MARKERS, guardDeck);
    const markerFree = runChain(MARKER_FREE, guardDeck);
    expect(countSections(guarded)).toBe(countSections(markerFree));
    expect(topLevelSections(guarded)).toBe(topLevelSections(markerFree));
  });

  it('the fixture is structure-adversarial: UNGUARDED, the markers change the slide count', () => {
    const guarded = runChain(WITH_MARKERS, guardDeck);
    const unguarded = runChain(WITH_MARKERS, identity); // markua NOT guarded
    expect(countSections(unguarded)).not.toBe(countSections(guarded));
  });
});
