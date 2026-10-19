/**
 * `singleH1` — keep the page title the page's only `<h1>` (#191, WCAG 2.2 AA).
 *
 * Starlight renders the frontmatter `title` as the page's `<h1 id="_top">` (the
 * skip-link and back-to-top target, and the "Overview" entry of the on-page ToC).
 * A body that also starts with `# Title` therefore publishes two `<h1>`s. This
 * pass fixes it in the body, so Starlight's title semantics stay as they are:
 *
 * - a LEADING body `<h1>` whose text repeats the title is dropped;
 * - every other body `<h1>` (a leading one that says something else, or one
 *   further down) becomes an `<h2>`, so its text and outline position survive.
 *
 * "Leading" skips whitespace, HTML comments and MDX `import`/`export` lines.
 * Text is compared after undoing what remark-smartypants did to the body (curly
 * quotes, dashes, ellipses), with case and runs of whitespace ignored, so
 * `# Don't panic` repeats `title: "Don't panic"`.
 *
 * ── Ordering ─────────────────────────────────────────────────────────────────
 * Astro runs USER rehype plugins before `rehypeHeadingIds`, so a demoted heading
 * gets its `id` and its ToC entry as an `<h2>`, and a dropped one never reaches
 * the collector.
 *
 * ── Scope ────────────────────────────────────────────────────────────────────
 * A no-op on a file with no Astro frontmatter `title`, and on a
 * `kind: Presentation` deck, whose slide `<h1>`s are the deck layout's own.
 */
import { isPresentationFile } from '../deck/is-presentation.js';

/** Minimal structural hast node. */
interface HastNode {
  type: string;
  tagName?: string;
  value?: string;
  children?: HastNode[];
  [key: string]: unknown;
}

/** The subset of the rehype VFile this plugin reads (Astro injects `data.astro`). */
interface SingleH1VFile {
  data?: { astro?: { frontmatter?: Record<string, unknown> } };
}

const isH1 = (node: HastNode) => node.type === 'element' && node.tagName === 'h1';

function textOf(node: HastNode): string {
  if (typeof node.value === 'string') return node.type === 'comment' ? '' : node.value;
  return (node.children ?? []).map(textOf).join('');
}

/** Undo smartypants, then fold case and whitespace, for a title comparison. */
export function comparableTitle(text: string): string {
  return text
    .normalize('NFKC')
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201C\u201D]/g, '"')
    .replace(/\u2014/g, '---')
    .replace(/\u2013/g, '--')
    .replace(/\u2026/g, '...')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

/** Nodes that never render as content: comments and MDX `import`/`export`. */
const SKIPPED = new Set(['comment', 'mdxjsEsm']);

/** The first child that is not whitespace, a comment or an MDX import. */
function leadingNode(tree: HastNode): HastNode | undefined {
  return (tree.children ?? []).find(
    (node) => !SKIPPED.has(node.type) && !(node.type === 'text' && !node.value?.trim()),
  );
}

function demoteH1s(node: HastNode): void {
  if (isH1(node)) node.tagName = 'h2';
  for (const child of node.children ?? []) demoteH1s(child);
}

/**
 * Rehype plugin factory. Returns the transformer Astro runs over each page's
 * hast; assignable to Astro's `RehypePlugin` (a unified `Plugin<[], Root>`).
 */
export default function singleH1() {
  return function transformer(tree: HastNode, file: SingleH1VFile): void {
    const title = file.data?.astro?.frontmatter?.title;
    if (typeof title !== 'string' || isPresentationFile(file)) return;

    const lead = leadingNode(tree);
    if (lead && isH1(lead) && comparableTitle(textOf(lead)) === comparableTitle(title)) {
      tree.children = (tree.children ?? []).filter((node) => node !== lead);
    }
    demoteH1s(tree);
  };
}
