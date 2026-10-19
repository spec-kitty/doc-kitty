/**
 * One `<h1>` per published page (#191). Starlight renders the frontmatter
 * `title` as the page's `<h1 id="_top">`, so a body `# Title` adds a second one.
 * `singleH1` drops a LEADING body `<h1>` that repeats the title, and demotes any
 * other body `<h1>` to `<h2>`, so the title stays the page's only `<h1>`. A
 * `kind: Presentation` deck is left alone: its slides own their headings.
 */
import { describe, it, expect } from 'vitest';
import { unified } from 'unified';
import remarkParse from 'remark-parse';
import remarkSmartypants from 'remark-smartypants';
import { toHast } from 'mdast-util-to-hast';
import singleH1 from '../lib/rehype/single-h1.js';

interface Hast {
  type: string;
  tagName?: string;
  value?: string;
  children?: Hast[];
}

/** remark → hast with the Astro VFile shape (`data.astro.frontmatter`), then `singleH1`. */
function render(markdown: string, frontmatter: Record<string, unknown> | undefined): Hast {
  const processor = unified().use(remarkParse).use(remarkSmartypants);
  const file = { data: frontmatter ? { astro: { frontmatter } } : {} };
  const mdast = processor.runSync(processor.parse(markdown));
  const hast = toHast(mdast as Parameters<typeof toHast>[0], { allowDangerousHtml: true }) as unknown as Hast;
  singleH1()(hast, file);
  return hast;
}

const textOf = (node: Hast): string => node.value ?? (node.children ?? []).map(textOf).join('');

/** `tag: text` for every heading, in document order. */
function headings(node: Hast, out: string[] = []): string[] {
  if (node.type === 'element' && /^h[1-6]$/.test(node.tagName ?? '')) out.push(`${node.tagName}: ${textOf(node)}`);
  for (const child of node.children ?? []) headings(child, out);
  return out;
}

const h1s = (tree: Hast) => headings(tree).filter((h) => h.startsWith('h1:')).length;

describe('singleH1 — a body H1 never adds a second page <h1> (#191)', () => {
  it('drops a leading body H1 that repeats the title', () => {
    const tree = render('# Getting started\n\nIntro.\n\n## Next\n', { title: 'Getting started' });
    expect(h1s(tree)).toBe(0);
    expect(headings(tree)).toEqual(['h2: Next']);
  });

  it('matches the title across smart quotes, dashes, case and spacing', () => {
    const tree = render("# Don't   panic -- it's fine\n\nBody.\n", { title: "don't panic -- it's fine" });
    expect(h1s(tree)).toBe(0);
  });

  it('matches a title whose H1 carries inline markup', () => {
    const tree = render('# The `doc-kitty` *toolkit*\n\nBody.\n', { title: 'The doc-kitty toolkit' });
    expect(h1s(tree)).toBe(0);
  });

  it('skips a leading HTML comment when finding the leading H1', () => {
    // A `.md` comment is still a `raw` node when user rehype plugins run.
    const tree = render('<!-- markdownlint-disable -->\n\n# Title\n\n## Next\n', { title: 'Title' });
    expect(headings(tree)).toEqual(['h2: Next']);
  });

  it('skips several leading comments, but not other leading raw HTML', () => {
    expect(headings(render('<!-- a -->\n<!-- b -->\n\n# Title\n', { title: 'Title' }))).toEqual([]);
    expect(headings(render('<div>x</div>\n\n# Title\n', { title: 'Title' }))).toEqual(['h2: Title']);
  });

  it('skips a leading MDX comment expression when finding the leading H1', () => {
    const h1 = { type: 'element', tagName: 'h1', children: [{ type: 'text', value: 'Title' }] };
    const tree: Hast = { type: 'root', children: [{ type: 'mdxFlowExpression', value: '/* note */' }, h1] };
    singleH1()(tree, { data: { astro: { frontmatter: { title: 'Title' } } } });
    expect(headings(tree)).toEqual([]);
  });

  it('skips a leading MDX import when finding the leading H1', () => {
    const h1 = { type: 'element', tagName: 'h1', children: [{ type: 'text', value: 'Title' }] };
    const tree: Hast = { type: 'root', children: [{ type: 'mdxjsEsm', value: "import X from './x';" }, h1] };
    singleH1()(tree, { data: { astro: { frontmatter: { title: 'Title' } } } });
    expect(h1s(tree)).toBe(0);
    expect(headings(tree)).toEqual([]);
  });

  it('demotes a leading H1 that differs from the title to h2', () => {
    const tree = render('# v0.1.0 — 2026-08-21\n\nNotes.\n', { title: 'v0.1.0' });
    expect(h1s(tree)).toBe(0);
    expect(headings(tree)).toEqual(['h2: v0.1.0 — 2026-08-21']);
  });

  it('demotes a body H1 that is not the first block, even when it repeats the title', () => {
    const tree = render('Intro.\n\n# Title\n\nMore.\n\n# Second\n', { title: 'Title' });
    expect(h1s(tree)).toBe(0);
    expect(headings(tree)).toEqual(['h2: Title', 'h2: Second']);
  });

  it('leaves every other heading level alone', () => {
    const tree = render('## Two\n\n### Three\n', { title: 'Page' });
    expect(headings(tree)).toEqual(['h2: Two', 'h3: Three']);
  });

  it('leaves a kind: Presentation deck untouched', () => {
    const tree = render('# Deck\n\n# Slide\n', { title: 'Deck', kind: 'Presentation' });
    expect(h1s(tree)).toBe(2);
  });

  it('is a no-op on a file with no Astro frontmatter', () => {
    expect(h1s(render('# Title\n', undefined))).toBe(1);
  });
});
