/**
 * `singleH1` — keep the page title the page's only `<h1>` (#191, WCAG 2.2 AA).
 *
 * Starlight renders the frontmatter `title` as the page's `<h1 id="_top">` (the
 * skip-link and back-to-top target, and the "Overview" entry of the on-page ToC).
 * A body that also starts with `# Title` therefore publishes two `<h1>`s. This
 * pass fixes it in the body, so Starlight's title semantics stay as they are:
 *
 * - the FIRST body `<h1>`, wherever it sits (an MDX component, a badge, a
 *   callout or an intro paragraph may precede it), is dropped when its text
 *   repeats the title. An empty `<span id="…">` takes its place with the id
 *   `rehypeHeadingIds` would have given the heading, so links to `#overview`
 *   keep working;
 * - every other body `<h1>` becomes an `<h2>`, so its text and outline position
 *   survive.
 *
 * Text is compared after undoing what remark-smartypants did to the body
 * (curly quotes, dashes, ellipses), with case and runs of whitespace ignored, so
 * `# Don't panic` repeats `title: "Don't panic"`.
 *
 * ── Ordering ─────────────────────────────────────────────────────────────────
 * Astro runs USER rehype plugins before `rehypeHeadingIds`, so a demoted heading
 * gets its `id` and its ToC entry as an `<h2>`, and a dropped one never reaches
 * the collector. `rehypeHeadingIds` slugs with github-slugger, so the alias id
 * does too; when a later heading would take the same id once this one is gone,
 * no alias is emitted (ids stay unique).
 *
 * ── Scope ────────────────────────────────────────────────────────────────────
 * A no-op on a file with no Astro frontmatter `title`, and on a
 * `kind: Presentation` deck, whose slide `<h1>`s are the deck layout's own.
 */
import GithubSlugger from 'github-slugger';
import { isPresentationFile } from '../deck/is-presentation.js';
import { textOf } from '../glossary/link-node.js';

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

const isHeading = (node: HastNode) => node.type === 'element' && /^h[1-6]$/.test(node.tagName ?? '');

/** Every heading under `node`, in document order. */
function headingsIn(node: HastNode, out: HastNode[] = []): HastNode[] {
  if (isHeading(node)) out.push(node);
  for (const child of node.children ?? []) headingsIn(child, out);
  return out;
}

/** Swap `target` for `replacement` in its parent's children. */
function replaceNode(parent: HastNode, target: HastNode, replacement: HastNode[]): boolean {
  const children = parent.children ?? [];
  const at = children.indexOf(target);
  if (at >= 0) {
    children.splice(at, 1, ...replacement);
    return true;
  }
  return children.some((child) => replaceNode(child, target, replacement));
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

    const headings = headingsIn(tree);
    const first = headings.find(isH1);
    if (first && comparableTitle(textOf(first)) === comparableTitle(title)) {
      // Slug the headings that stay, as `rehypeHeadingIds` will: if one of them
      // takes the bare slug, an alias would duplicate its id.
      const slugger = new GithubSlugger();
      const taken = new Set(headings.filter((h) => h !== first).map((h) => slugger.slug(textOf(h))));
      const id = new GithubSlugger().slug(textOf(first));
      const alias: HastNode[] =
        id && !taken.has(id)
          ? [{ type: 'element', tagName: 'span', properties: { id }, children: [] }]
          : [];
      replaceNode(tree, first, alias);
    }
    demoteH1s(tree);
  };
}
