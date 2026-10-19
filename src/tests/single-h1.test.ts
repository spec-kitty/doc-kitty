/**
 * One `<h1>` per published page (#191). Starlight renders the frontmatter
 * `title` as the page's `<h1 id="_top">`, so a body `# Title` adds a second one.
 * `singleH1` drops the first body `<h1>` when it repeats the title (leaving an
 * anchor alias with its id), and demotes any other body `<h1>` to `<h2>`, so the title stays the page's only `<h1>`. A
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
  return renderWithFile(markdown, frontmatter).hast;
}

/** As `render`, also returning the VFile (`history[0]` is what `rehypeHeadingIds` reads). */
function renderWithFile(markdown: string, frontmatter: Record<string, unknown> | undefined) {
  const processor = unified().use(remarkParse).use(remarkSmartypants);
  const file = { history: ['page.md'], data: frontmatter ? { astro: { frontmatter } } : {} };
  const mdast = processor.runSync(processor.parse(markdown));
  const hast = toHast(mdast as Parameters<typeof toHast>[0], { allowDangerousHtml: true }) as unknown as Hast;
  singleH1()(hast, file);
  return { hast, file };
}

const textOf = (node: Hast): string => node.value ?? (node.children ?? []).map(textOf).join('');

/** `tag: text` for every heading, in document order. */
function headings(node: Hast, out: string[] = []): string[] {
  if (node.type === 'element' && /^h[1-6]$/.test(node.tagName ?? '')) out.push(`${node.tagName}: ${textOf(node)}`);
  for (const child of node.children ?? []) headings(child, out);
  return out;
}

/** Every element carrying `properties.id === id`, in document order. */
function elementsWithId(node: Hast, id: string, out: Hast[] = []): Hast[] {
  if ((node as { properties?: { id?: unknown } }).properties?.id === id) out.push(node);
  for (const child of node.children ?? []) elementsWithId(child, id, out);
  return out;
}

function hastWith(...children: Hast[]): Hast {
  const tree: Hast = { type: 'root', children };
  singleH1()(tree, { data: { astro: { frontmatter: { title: 'Title' } } } });
  return tree;
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

  const h1 = { type: 'element', tagName: 'h1', children: [{ type: 'text', value: 'Title' }] };
  it.each([
    ['an HTML comment', () => render('<!-- markdownlint-disable -->\n\n# Title\n\n## Next\n', { title: 'Title' })],
    ['an MDX comment expression', () => hastWith({ type: 'mdxFlowExpression', value: '/* note */' }, h1)],
    ['an MDX import', () => hastWith({ type: 'mdxjsEsm', value: "import X from './x';" }, h1)],
  ])('drops the title H1 after %s', (_name, build) => {
    const tree = build();
    expect(h1s(tree)).toBe(0);
    expect(headings(tree).filter((h) => h.startsWith('h2: Title'))).toEqual([]);
  });

  it('demotes a leading H1 that differs from the title to h2', () => {
    const tree = render('# v0.1.0 — 2026-08-21\n\nNotes.\n', { title: 'v0.1.0' });
    expect(h1s(tree)).toBe(0);
    expect(headings(tree)).toEqual(['h2: v0.1.0 — 2026-08-21']);
  });

  it('drops the first title H1 even when content precedes it, keeps its anchor unless a later heading takes the id, and demotes the other H1s', async () => {
    // A different later H1 is demoted; the dropped title leaves an alias span with its id.
    const { hast: tree } = renderWithFile('Intro.\n\n# Title\n\nMore.\n\n# Second\n', { title: 'Title' });
    expect(h1s(tree)).toBe(0);
    expect(headings(tree)).toEqual(['h2: Second']);
    const aliases = elementsWithId(tree, 'title');
    expect(aliases).toHaveLength(1);
    expect(aliases[0]?.tagName).toBe('span');
    expect(JSON.stringify(tree)).toContain('"properties":{"id":"title"}');

    // A later `## Title` takes the id itself, so no alias is emitted for the dropped heading.
    const { hast: tree2, file: file2 } = renderWithFile('Intro.\n\n# Title\n\nMore.\n\n## Title\n', { title: 'Title' });
    expect(headings(tree2)).toEqual(['h2: Title']);
    expect(elementsWithId(tree2, 'title')).toHaveLength(0);
    // Run the real, pinned rehypeHeadingIds: exactly one element holds the id, and it is the h2.
    const { rehypeHeadingIds } = await import('@astrojs/markdown-remark');
    (rehypeHeadingIds() as unknown as (tree: Hast, file: unknown) => void)(tree2, file2);
    const holders = elementsWithId(tree2, 'title');
    expect(holders).toHaveLength(1);
    expect(holders[0]?.tagName).toBe('h2');
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
