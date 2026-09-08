/**
 * WP03 — deck-scope guard NARROWING (#47, FR-003/FR-006/FR-009). Prior to this
 * WP, `guardDeck` wrapped all five Markua passes so every one was a no-op on a
 * Presentation page (WP02's posture). Now only `markuaTocDemote` stays wrapped:
 * the four content passes (`markuaNormalise`, `markuaAttributes`,
 * `markuaCallouts`, `markuaFigure`) are registered BARE at `config.ts` and are
 * themselves deck-capable (D2–D6) — a deck-agnostic figure/aside/callout/
 * attribute pipeline runs on slides exactly as it does on docs pages, with the
 * three deck-specific seams (wrapper-boundary termination, forced `dk-callout`
 * theme, hero-image skip) proven by each pass's OWN unit tests, not by a
 * registration-site guard.
 *
 * Four surfaces:
 *  1. **Narrowed no-op matrix (T010, D6)** — `guardDeck` still no-ops
 *     `markuaTocDemote` on a deck-shaped tree (and gates correctly off-deck);
 *     each of the four content passes, run BARE on a deck VFile, still ACTS
 *     (proving they are no longer silenced at the config site).
 *  2. **Membership (T009, was C36f)** — the built `config.ts` remark array is
 *     the three bare content passes (no `__inner`); the rehype array is
 *     `[markuaFigure (bare), guardDeck(markuaTocDemote)]` — only
 *     `markuaTocDemote` exposes `__inner`.
 *  3. **C36b/C36c (mechanism + no proliferation, unchanged)** — `guardDeck`
 *     itself stays transparent to the `#35` parity enumerator, and the runtime
 *     deck-guard count stays ≤ the baseline; `markua-figure.ts`'s fold is now
 *     its own `data-deck-hero` structural discriminator (T012, D4), not the
 *     blanket `isPresentationFile` self-guard WP02 removed.
 *  4. **Deck ↔ Markua composition (T011, C-COMPOSE-02/03)** — a deck body whose
 *     Markua markers do NOT straddle a `##`/`###`/`---` boundary yields the
 *     SAME `deckSection` structure as the marker-free deck, with mapped
 *     callouts forced onto the `dk-callout` theme path; a `{aside}`/`{blurb}`
 *     wrapper that DOES straddle a boundary closes at the boundary (the
 *     boundary survives, slide count preserved) and records the D3 warning —
 *     retargeting the structure-adversarial fixture to prove the boundary is
 *     no longer swallowed (the D7 flip: deck-awareness now lives inside
 *     `markuaNormalise` itself, not at a registration-site guard).
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
import markuaFootnotes from '../lib/remark/markua-footnotes.js';
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
  name?: string;
  tagName?: string;
  properties?: Record<string, unknown>;
  children?: AnyNode[];
  data?: Record<string, unknown>;
  [key: string]: unknown;
}

/** A deck-shaped remark/rehype VFile (Astro injects `data.astro.frontmatter`).
 *  Optionally records every `file.message(...)` call into `messages` (T001/D3
 *  wrapper-boundary warning capture). */
function deckFile(
  extra: Record<string, unknown> = {},
  messages?: string[],
): {
  data: { astro: { frontmatter: Record<string, unknown> } };
  message: (reason?: string) => void;
} {
  return {
    data: { astro: { frontmatter: { kind: 'Presentation', title: 'Deck', description: 'd', ...extra } } },
    message: (reason?: string) => {
      if (reason !== undefined) messages?.push(reason);
    },
  };
}

/** The off-deck contrast VFile shape (`kind: Reference`) — proves a guard/seam
 *  actually gates on the predicate rather than being dead code. */
function refFile(extra: Record<string, unknown> = {}): ReturnType<typeof deckFile> {
  return {
    data: { astro: { frontmatter: { kind: 'Reference', title: 'Doc', description: 'd', ...extra } } },
    message: () => {},
  };
}

/** Parse a Markdown string to mdast (remark-gfm parse extensions applied). */
function parse(md: string): AnyNode {
  return unified().use(remarkParse).use(remarkGfm).parse(md) as unknown as AnyNode;
}

type Plugin = () => (tree: unknown, file?: unknown) => void;

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

/**
 * Run the production remark order (`markuaNormalise → markuaAttributes →
 * markuaCallouts`, all BARE — #47) against `passFile`, then `deckSplit`
 * against `splitFile` (defaults to `passFile`). `deckSplit` self-guards on
 * `kind: Presentation` (it is NEVER wrapped — the deck processor is out of
 * scope for `guardDeck` by design), so a `splitFile` override lets a test run
 * the content passes off-deck while still exercising the split.
 */
function runFullChain(
  md: string,
  passFile: ReturnType<typeof deckFile>,
  splitFile: ReturnType<typeof deckFile> = passFile,
): AnyNode {
  const tree = parse(md);
  for (const p of [markuaNormalise, markuaAttributes, markuaCallouts] as Plugin[]) {
    p()(tree, passFile);
  }
  (deckSplit as Plugin)()(tree, splitFile);
  return tree;
}

/** Collect the `name` of every `containerDirective` in a tree (post-callouts,
 *  a mapped/theme callout's name is `dk-callout`; a still-native one keeps its
 *  Starlight name). */
function collectDirectiveNames(node: AnyNode, out: string[] = []): string[] {
  if (node.type === 'containerDirective' && typeof node.name === 'string') out.push(node.name);
  for (const child of node.children ?? []) collectDirectiveNames(child, out);
  return out;
}

// ---------------------------------------------------------------------------
// 1. guardDeck narrows to `markuaTocDemote` only (T010, D6, C-COMPOSE-06)
// ---------------------------------------------------------------------------

describe('guardDeck — narrowed to `markuaTocDemote` only (D6, C-COMPOSE-06)', () => {
  /** A hast tree an in-container heading demotion WOULD touch: an `<aside
   *  class="dk-callout …">` wrapping an `<h3>`. */
  const tocSeed = (): AnyNode => ({
    type: 'root',
    children: [
      {
        type: 'element',
        tagName: 'aside',
        properties: { className: ['dk-callout', 'dk-callout--tip'] },
        children: [
          { type: 'element', tagName: 'h3', properties: {}, children: [{ type: 'text', value: 'Tips' }] },
        ],
      },
    ],
  });

  it('guardDeck(markuaTocDemote) still no-ops on a deck', () => {
    const tree = tocSeed();
    const before = structuredClone(tree);
    guardDeck(markuaTocDemote as Plugin)()(tree, deckFile());
    expect(tree).toEqual(before);
  });

  it('the guard actually gates on the predicate (off-deck, the in-container heading IS demoted)', () => {
    const tree = tocSeed();
    guardDeck(markuaTocDemote as Plugin)()(tree, refFile());
    expect(tree).not.toEqual(tocSeed()); // <h3> demoted to <p role="heading" aria-level="3">
  });

  it('markuaNormalise, registered BARE, still acts on a deck (not guarded at the config site)', () => {
    const tree = parse('W> a warning line.\n');
    const before = structuredClone(tree);
    (markuaNormalise as Plugin)()(tree, deckFile());
    expect(tree).not.toEqual(before); // the line-prefix run compiled to a containerDirective
  });

  it('markuaAttributes, registered BARE, still acts on a deck', () => {
    const tree = parse('{width:"50%"}\n\n![cap](/img.png)\n');
    const before = structuredClone(tree);
    (markuaAttributes as Plugin)()(tree, deckFile());
    expect(tree).not.toEqual(before); // the attribute-list paragraph folded onto the image, then dropped
  });

  it('markuaCallouts, registered BARE, forces the `dk-callout` theme path on a deck (C-COMPOSE-04)', () => {
    const tree = parse('T> a tip.\n'); // `T>` maps to the native `tip` aside OFF a deck
    (markuaNormalise as Plugin)()(tree, deckFile()); // compile the line-prefix run to a directive first
    (markuaCallouts as Plugin)()(tree, deckFile());
    const names = collectDirectiveNames(tree);
    expect(names).toEqual(['dk-callout']); // NOT left `tip` for `remarkAsides` to rebuild
  });

  it('markuaFigure, registered BARE, still acts on a deck', () => {
    const tree: AnyNode = {
      type: 'root',
      children: [
        {
          type: 'element',
          tagName: 'p',
          children: [
            { type: 'element', tagName: 'img', properties: { src: '/a.png', alt: 'cap' }, children: [] },
          ],
        },
      ],
    };
    (markuaFigure as Plugin)()(tree, deckFile());
    expect(tree.children?.[0]?.tagName).toBe('figure'); // wrapped, not left a bare <p><img></p>
  });
});

// ---------------------------------------------------------------------------
// 2. C36c — identity transparency (guardDeck mechanism itself, unchanged)
// ---------------------------------------------------------------------------

describe('guardDeck — transparent to the parity enumerator (C36c)', () => {
  it('exposes __inner and preserves the wrapped name', () => {
    const wrapped = guardDeck(markuaFigure as Plugin) as unknown as { __inner: unknown; name: string };
    expect(wrapped.__inner).toBe(markuaFigure);
    expect(wrapped.name).toBe((markuaFigure as { name: string }).name);
  });
});

// ---------------------------------------------------------------------------
// 3. Registration-array membership (T009, was C36f) — narrowed to markuaTocDemote
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

describe('config.ts — registration-array membership narrows to `markuaTocDemote` (T009, D6/D7)', () => {
  it('the remark array is normalise → guardDeck(footnotes) → attributes → callouts, in order', () => {
    const { remark } = markuaArrays();
    // The three content passes are BARE (deck-capable by delegation, #47);
    // `markuaFootnotes` is the one deck-AGNOSTIC remark pass, so it is
    // `guardDeck`-wrapped at the registration site (ADR-0041) — its real identity
    // is reachable through `.__inner`, exactly like the rehype `markuaTocDemote`.
    expect(remark.length).toBe(4);
    expect(remark[0]).toBe(markuaNormalise);
    expect((remark[1] as { __inner?: unknown }).__inner).toBe(markuaFootnotes);
    expect(remark[2]).toBe(markuaAttributes);
    expect(remark[3]).toBe(markuaCallouts);
  });

  it('only the footnotes pass exposes __inner (the sole guardDeck-wrapped remark member)', () => {
    const { remark } = markuaArrays();
    const wrapped = remark.filter((m) => (m as { __inner?: unknown }).__inner !== undefined);
    expect(wrapped.length).toBe(1);
    expect((wrapped[0] as { __inner?: unknown }).__inner).toBe(markuaFootnotes);
    // The three content passes stay BARE (deck-capable by delegation).
    for (const bare of [markuaNormalise, markuaAttributes, markuaCallouts]) {
      expect((bare as { __inner?: unknown }).__inner).toBeUndefined();
    }
  });

  it('the rehype array is [markuaFigure (bare), guardDeck(markuaTocDemote)]', () => {
    const { rehype } = markuaArrays();
    expect(rehype.length).toBe(2);
    expect(rehype[0]).toBe(markuaFigure);
    expect((rehype[0] as { __inner?: unknown }).__inner).toBeUndefined();
    expect((rehype[1] as { __inner?: unknown }).__inner).toBe(markuaTocDemote);
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
    // only runtime string checks left; `markua-figure.ts` carries none (#47 — its
    // hero-skip discriminator is the structural `data-deck-hero` tag, not a
    // page-kind check).
    expect(runtimeGuardCount(read('deck/is-presentation.ts'))).toBe(2);
    expect(runtimeGuardCount(read('remark/deck-split.ts'))).toBe(1); // the deck processor — never folded
    expect(runtimeGuardCount(read('rehype/markua-figure.ts'))).toBe(0);
    expect(runtimeGuardCount(read('remark/glossary-autolink.ts'))).toBe(0);
    expect(runtimeGuardCount(read('metadata.ts'))).toBe(0);
  });

  it('every folded deck-aware site routes through the shared predicate — except markua-figure, whose #47 hero-skip is its own explicit structural discriminator', () => {
    // #47/T012 (D4): WP02 removed markua-figure's blanket `isPresentationFile`
    // self-guard entirely — it now wraps every slide body image and skips ONLY
    // the synthesized hero via the `data-deck-hero` tag `deck-split.internal.ts`
    // sets on it, never importing the shared page-kind predicate.
    expect(read('rehype/markua-figure.ts')).not.toContain("from '../deck/is-presentation.js'");
    expect(read('rehype/markua-figure.ts')).not.toContain('isPresentationFile');
    expect(read('rehype/markua-figure.ts')).toContain('data-deck-hero');
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
// 5. Deck ↔ Markua composition (T011, C-COMPOSE-02/03)
// ---------------------------------------------------------------------------

describe('deck-Markua composition — non-crossing markers preserve slide structure (C-COMPOSE-02)', () => {
  // A mapped callout (`T>` → native `tip` off-deck) and an attribute-list image,
  // neither straddling a slide boundary.
  const NON_CROSSING = [
    '## Slide One',
    '',
    'T> A tip for slide one.',
    '',
    '### Slide Two',
    '',
    '{width:"50%"}',
    '',
    '![cap](/img.png)',
    '',
  ].join('\n');

  // The marker-free equivalent: same headings, no Markua syntax.
  const NON_CROSSING_MARKER_FREE = [
    '## Slide One',
    '',
    'A tip for slide one.',
    '',
    '### Slide Two',
    '',
    '![cap](/img.png)',
    '',
  ].join('\n');

  it('full Markua chain + deckSplit yields the SAME deckSection structure as the marker-free deck', () => {
    const withMarkers = runFullChain(NON_CROSSING, deckFile());
    const markerFree = runFullChain(NON_CROSSING_MARKER_FREE, deckFile());
    expect(countSections(withMarkers)).toBe(countSections(markerFree));
    expect(topLevelSections(withMarkers)).toBe(topLevelSections(markerFree));
  });

  it('the mapped callout renders as `dk-callout`, never left native for `remarkAsides`', () => {
    const tree = runFullChain(NON_CROSSING, deckFile());
    const names = collectDirectiveNames(tree);
    expect(names.length).toBeGreaterThan(0);
    for (const name of names) expect(name).toBe('dk-callout');
  });
});

describe('deck-Markua composition — a wrapper may not cross a slide boundary (C-COMPOSE-03)', () => {
  // `{aside}` wraps a `###` slide boundary and a `W>` warning line before closing.
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

  it('the wrapper closes AT the boundary — the heading survives in root.children and a warning is recorded', () => {
    const messages: string[] = [];
    const tree = parse(WITH_MARKERS);
    (markuaNormalise as Plugin)()(tree, deckFile({}, messages));
    const swallowedHeading = (tree.children ?? []).find(
      (c) =>
        c.type === 'heading' &&
        c.depth === 3 &&
        (c.children ?? []).some((t) => t.value === 'Swallowed Slide'),
    );
    expect(swallowedHeading).toBeDefined(); // NOT re-parented inside the aside container
    expect(messages).toContain(
      'Markua {aside}/{blurb} cannot span a slide boundary; closed at the boundary.',
    );
  });

  it('full Markua chain + deckSplit on the marker deck == deckSplit on the marker-free deck (structure preserved)', () => {
    const guarded = runFullChain(WITH_MARKERS, deckFile());
    const markerFree = runFullChain(MARKER_FREE, deckFile());
    expect(countSections(guarded)).toBe(countSections(markerFree));
    expect(topLevelSections(guarded)).toBe(topLevelSections(markerFree));
  });

  it('the fixture is structure-adversarial (D7 flip): run with the content passes UNAWARE of the deck (off-deck upstream), the same markers DO swallow the boundary — fewer sections than the deck-aware run', () => {
    // Deck-awareness now lives inside `markuaNormalise` itself (T001/D3), not at
    // a registration-site guard. Running the content passes against a
    // NON-deck file (so the boundary predicate never engages) reproduces the
    // pre-#47 swallow — `deckSplit` still needs a deck-kind file to act, hence
    // the explicit `splitFile` override.
    const deckAware = runFullChain(WITH_MARKERS, deckFile());
    const deckUnaware = runFullChain(WITH_MARKERS, refFile(), deckFile());
    expect(countSections(deckUnaware)).not.toBe(countSections(deckAware));
  });
});
