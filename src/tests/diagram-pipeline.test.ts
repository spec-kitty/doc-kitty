/**
 * Pipeline-level unit (T007, #59 red-first — WP01 diagram-component-css
 * mission): runs the REAL chain `diagramMeta → mermaidFenceTransform →
 * mdast-util-to-hast (13.2.1, the exact library/version the #59 defect lives
 * in) → diagramFigure` on a ```mermaid fence, and asserts the resulting
 * `<figure class="dk-diagram">` has NO `<pre>` ancestor.
 *
 * Why this test exists alongside `diagram-figure.test.ts`: that file hand-
 * builds its hast fixture directly (a `<pre class="mermaid">` element it
 * constructs by hand), so it is BLIND to #59 — the defect lives entirely at
 * the remark→hast boundary that hand-built fixture skips straight past. This
 * test drives the REAL `mdast-util-to-hast` conversion instead, so it goes RED
 * if the fence-transform retype (T001, `config.ts`'s `mermaidFenceTransform`)
 * is reverted and a still-`code`-typed mermaid node's `hName` projection
 * reintroduces the stray outer `<pre>` (`mdast-util-to-hast`'s `code` handler
 * unconditionally wraps its output in an extra `<pre>` — verified against the
 * installed source, `handlers/code.js`).
 */
import { describe, it, expect } from 'vitest';
import { unified } from 'unified';
import remarkParse from 'remark-parse';
import { toHast } from 'mdast-util-to-hast';
import diagramMeta from '../lib/remark/diagram-meta.js';
import { mermaidFenceTransform } from '../lib/config.js';
import diagramFigure from '../lib/rehype/diagram-figure.js';
import deckSplit from '../lib/remark/deck-split.js';

/** Minimal structural hast node — enough to walk parent/child relationships. */
interface HastNode {
  type: string;
  tagName?: string;
  properties?: Record<string, unknown>;
  children?: HastNode[];
  value?: string;
  [key: string]: unknown;
}

/** The subset of the rehype VFile `diagramFigure` reads/writes, mirroring the
 * shape `diagramMeta` populates on `file.data.dkDiagrams`. */
interface PipelineFile {
  data?: Record<string, unknown>;
}

function classListOf(node: HastNode): string[] {
  const raw = node.properties?.className;
  if (Array.isArray(raw)) return raw.map(String);
  if (typeof raw === 'string') return raw.split(/\s+/).filter(Boolean);
  return [];
}

const isDkDiagramFigure = (n: HastNode): boolean =>
  n.type === 'element' && n.tagName === 'figure' && classListOf(n).includes('dk-diagram');

/** True if ANY node in the tree matching `match` has a `<pre>` ancestor
 * (i.e. is nested — directly or transitively — inside a `<pre>` element). */
function hasNodeWithPreAncestor(root: HastNode, match: (n: HastNode) => boolean): boolean {
  let found = false;
  const walk = (node: HastNode, ancestors: HastNode[]): void => {
    if (match(node) && ancestors.some((a) => a.tagName === 'pre')) found = true;
    for (const child of node.children ?? []) walk(child, [...ancestors, node]);
  };
  walk(root, []);
  return found;
}

/** The first node in the tree matching `match`, depth-first, or `undefined`. */
function findFirst(root: HastNode, match: (n: HastNode) => boolean): HastNode | undefined {
  if (match(root)) return root;
  for (const child of root.children ?? []) {
    const found = findFirst(child, match);
    if (found) return found;
  }
  return undefined;
}

/**
 * Run the REAL chain on `markdown`: parse → `diagramMeta` (remark, stashes
 * caption fields on `file.data.dkDiagrams` + injects accTitle/accDescr) →
 * `mermaidFenceTransform` (remark, config.ts's fence→`<pre class="mermaid">`
 * projection — retyped off `code`, T001) → `toHast` (the REAL
 * `mdast-util-to-hast`, not a hand-built fixture) → `diagramFigure` (rehype,
 * wraps the mermaid `<pre>` in the accessible `<figure>`). Mirrors the pinned
 * plugin order `config.ts` wires: `remarkPlugins: [diagramMeta,
 * mermaidFenceTransform]`, `rehypePlugins: [diagramFigure]`.
 */
function renderPipeline(markdown: string): HastNode {
  const processor = unified().use(remarkParse);
  const mdastTree = processor.parse(markdown) as never;
  const file: PipelineFile = {};

  // Remark stage — the exact functions `config.ts` registers, in the pinned order.
  diagramMeta()(mdastTree as never, file as never);
  mermaidFenceTransform()(mdastTree as never);

  // mdast → hast — the REAL `mdast-util-to-hast` (13.2.1), not a hand-built fixture.
  const hastTree = toHast(mdastTree, { allowDangerousHtml: false }) as unknown as HastNode;

  // Rehype stage — wraps the mermaid `<pre>` in `<figure class="dk-diagram">`.
  diagramFigure()(hastTree as never, file as never);

  return hastTree;
}

const MERMAID_FENCE = [
  '```mermaid',
  '%% description: A minimal pipeline-proof diagram.',
  'flowchart TD',
  '  A --> B',
  '```',
].join('\n');

/**
 * The deck-path twin of {@link renderPipeline}: runs the SAME real remark
 * stage, then ALSO runs `deckSplit` (`config.ts`'s `deckSplitIntegration`
 * registers it after every other markdown plugin — pinned real order) before
 * `toHast`/`diagramFigure`, mirroring exactly what a `kind: Presentation` deck
 * page renders through (`DeckLayout.astro`'s `render(entry)` uses the SAME
 * global `markdown.remarkPlugins`/`rehypePlugins`, T007's own header comment).
 *
 * Regression guard: `diagram-pipeline.test.ts` above proves the mermaid fence
 * retype survives `diagramMeta → mermaidFenceTransform → toHast` for a DOCS
 * page, but is blind to a deck — the retyped `dkMermaid` node also has to
 * survive `deckSplit`'s tree restructuring into `deckSection`s. This closes
 * that gap: if a future `deckSplit` change ever reconstructs/clones a content
 * node in a way that drops its `data`/`type` bag (rather than re-parenting the
 * SAME node reference), this test goes red on the deck path while the
 * docs-only test above stays green — exactly the split this mission's
 * investigation had to rule out.
 */
function renderDeckPipeline(markdown: string): HastNode {
  const processor = unified().use(remarkParse);
  const mdastTree = processor.parse(markdown) as never;
  const file: PipelineFile & {
    data: { astro: { frontmatter: { kind: string; title: string } } };
    message: (reason: string) => void;
  } = {
    data: { astro: { frontmatter: { kind: 'Presentation', title: 'Test Deck' } } },
    message: () => undefined,
  };

  diagramMeta()(mdastTree as never, file as never);
  mermaidFenceTransform()(mdastTree as never);
  deckSplit()(mdastTree as never, file as never);

  const hastTree = toHast(mdastTree, { allowDangerousHtml: false }) as unknown as HastNode;
  diagramFigure()(hastTree as never, file as never);
  return hastTree;
}

describe('diagram pipeline (T007, real remark→hast→rehype chain)', () => {
  it('produces a <figure class="dk-diagram"> with NO <pre> ancestor (#59)', () => {
    const tree = renderPipeline(MERMAID_FENCE);

    const figure = findFirst(tree, isDkDiagramFigure);
    expect(figure, 'expected a <figure class="dk-diagram"> in the rendered hast').toBeDefined();

    // The load-bearing #59 assertion: the figure must NOT be nested inside a
    // <pre> anywhere on its ancestor chain. Fails RED if a reverted retype
    // (still `type: 'code'`) lets mdast-util-to-hast's `code` handler wrap the
    // fence-transform's own `<pre class="mermaid">` in an extra outer `<pre>`.
    expect(
      hasNodeWithPreAncestor(tree, isDkDiagramFigure),
      'the <figure class="dk-diagram"> has a <pre> ancestor — the #59 double-wrap defect is present',
    ).toBe(false);
  });

  it('the figure carries exactly one <pre class="mermaid"> child (no stray inner wrapper either)', () => {
    const tree = renderPipeline(MERMAID_FENCE);
    const figure = findFirst(tree, isDkDiagramFigure);
    expect(figure).toBeDefined();

    const isMermaidPre = (n: HastNode): boolean =>
      n.type === 'element' && n.tagName === 'pre' && classListOf(n).includes('mermaid');
    const mermaidPres: HastNode[] = [];
    const collect = (n: HastNode): void => {
      if (isMermaidPre(n)) mermaidPres.push(n);
      for (const child of n.children ?? []) collect(child);
    };
    collect(figure as HastNode);

    expect(mermaidPres).toHaveLength(1);
    // The single `<pre class="mermaid">` must be a DIRECT child of the figure
    // (diagramFigure wraps the pre in place, it does not re-nest it).
    expect(figure?.children?.includes(mermaidPres[0])).toBe(true);
  });

  it('accTitle/accDescr injection survives the retype (NFR-003)', () => {
    const tree = renderPipeline(MERMAID_FENCE);
    const figure = findFirst(tree, isDkDiagramFigure);
    const pre = findFirst(figure as HastNode, (n) => n.tagName === 'pre');
    const source = pre?.children?.map((c) => c.value ?? '').join('') ?? '';

    // No `%% title`, so accTitle falls back to the description (diagram-meta's
    // documented fallback) — proving the injection ran through the real chain.
    expect(source).toContain('accTitle: A minimal pipeline-proof diagram.');
    expect(source).toContain('accDescr: A minimal pipeline-proof diagram.');
  });

  it('the figure keeps role="group" (NFR-003 accessible figure preserved)', () => {
    const tree = renderPipeline(MERMAID_FENCE);
    const figure = findFirst(tree, isDkDiagramFigure);
    expect(figure?.properties?.role).toBe('group');
  });

  it('a captioned figure carries aria-labelledby pointing at its own figcaption id (#68 finding 5)', () => {
    // `role="group"` overrides <figure>'s native figcaption-based naming (HTML
    // AAM), so the group wrapper must name itself explicitly — without this,
    // the wrapper is an unnamed group even though a caption is right there.
    const tree = renderPipeline(MERMAID_FENCE);
    const figure = findFirst(tree, isDkDiagramFigure);
    const figcaption = findFirst(figure as HastNode, (n) => n.tagName === 'figcaption');
    expect(figcaption).toBeDefined();
    const captionId = figcaption?.properties?.id;
    expect(typeof captionId).toBe('string');
    expect(captionId).toBeTruthy();
    expect(figure?.properties?.['aria-labelledby']).toBe(captionId);
  });
});

describe('diagram pipeline — deck path (real remark→deckSplit→hast→rehype chain)', () => {
  it('produces a <figure class="dk-diagram"> with NO <pre> ancestor on a Presentation deck', () => {
    const tree = renderDeckPipeline(MERMAID_FENCE);

    const figure = findFirst(tree, isDkDiagramFigure);
    expect(figure, 'expected a <figure class="dk-diagram"> in the deck-rendered hast').toBeDefined();

    // The deck-path twin of the #59 assertion above: `deckSplit` re-parents
    // content nodes into `deckSection`s (real registration order — it runs
    // AFTER `mermaidFenceTransform`, config.ts's pinned plugin array), so this
    // proves the retype survives THAT restructuring too, not just a plain
    // remark→hast pass with no deck involved.
    expect(
      hasNodeWithPreAncestor(tree, isDkDiagramFigure),
      'the deck figure has a <pre> ancestor — the retype did not survive deckSplit',
    ).toBe(false);
  });

  it('the deck figure carries exactly one <pre class="mermaid"> child, nested inside a <section>', () => {
    const tree = renderDeckPipeline(MERMAID_FENCE);
    const figure = findFirst(tree, isDkDiagramFigure);
    expect(figure).toBeDefined();

    const isMermaidPre = (n: HastNode): boolean =>
      n.type === 'element' && n.tagName === 'pre' && classListOf(n).includes('mermaid');
    const mermaidPres: HastNode[] = [];
    const collect = (n: HastNode): void => {
      if (isMermaidPre(n)) mermaidPres.push(n);
      for (const child of n.children ?? []) collect(child);
    };
    collect(figure as HastNode);

    expect(mermaidPres).toHaveLength(1);
    expect(figure?.children?.includes(mermaidPres[0])).toBe(true);

    // Sanity: deckSplit actually ran (the figure lives inside the synthesized
    // title <section>, not at document root) — proves this test exercises the
    // deck path, not an accidental no-op.
    const section = findFirst(tree, (n) => n.type === 'element' && n.tagName === 'section');
    expect(section, 'expected deckSplit to have wrapped content in a <section>').toBeDefined();
  });
});
