/**
 * GitHub alert blockquotes → Starlight asides (#250, ADR-0068).
 *
 * The plugin turns a top-level blockquote whose first line is exactly one of
 * GitHub's five alert markers into the `containerDirective` that Starlight's own
 * `remarkAsides` turns into a native aside (the same path the Markua mapped
 * callouts ride). These tests run the plugin on the real parse (remark-parse +
 * remark-gfm, as Astro does) and assert the directive it leaves behind. The
 * rendered aside, in both colour modes and under axe, is asserted by the
 * Playwright lane (tests/a11y/github-alerts.spec.ts, tests/a11y/axe.spec.ts).
 */
import { describe, it, expect } from 'vitest';
import { unified } from 'unified';
import remarkParse from 'remark-parse';
import remarkGfm from 'remark-gfm';
import githubAlerts from '../lib/remark/github-alerts.js';
import { ALERT_TO_ASIDE, parseAlertMarker } from '../lib/remark/github-alerts.internal.js';
import type { MdastLike } from '../lib/remark/markua-callouts.internal.js';

type Frontmatter = { kind?: string };

/** Parse `md` as Astro does, then run the plugin over it. */
function run(md: string, frontmatter: Frontmatter = { kind: 'Reference' }): MdastLike {
  const tree = unified().use(remarkParse).use(remarkGfm).parse(md) as unknown as MdastLike;
  githubAlerts()(tree, { data: { astro: { frontmatter } } });
  return tree;
}

/** Strip positions so trees compare on structure. */
function bare(node: unknown): unknown {
  return JSON.parse(JSON.stringify(node, (k, v) => (k === 'position' ? undefined : v)));
}

/** The directive label paragraph Starlight reads as the aside title, if any. */
function labelOf(node: MdastLike): string | undefined {
  const first = node.children?.[0] as MdastLike & { data?: { directiveLabel?: boolean } };
  if (first?.type !== 'paragraph' || first.data?.directiveLabel !== true) return undefined;
  return (first.children ?? []).map((c) => c.value ?? '').join('');
}

describe('parseAlertMarker', () => {
  it('recognises the five markers, case-insensitively, alone on the first line', () => {
    expect(parseAlertMarker('[!NOTE]')).toEqual({ type: 'NOTE', rest: '' });
    expect(parseAlertMarker('[!tip]\nbody')).toEqual({ type: 'TIP', rest: 'body' });
    expect(parseAlertMarker('[!Important]  ')).toEqual({ type: 'IMPORTANT', rest: '' });
    expect(parseAlertMarker('[!WARNING]\t\nx')).toEqual({ type: 'WARNING', rest: 'x' });
    expect(parseAlertMarker('[!CAUTION]')).toEqual({ type: 'CAUTION', rest: '' });
  });

  it('rejects unknown markers, text after the marker, and non-leading markers', () => {
    expect(parseAlertMarker('[!DANGER]')).toBeUndefined();
    expect(parseAlertMarker('[!NOTE] inline text')).toBeUndefined();
    expect(parseAlertMarker('Hello [!NOTE]')).toBeUndefined();
    expect(parseAlertMarker(' [!NOTE]')).toBeUndefined();
    expect(parseAlertMarker('[NOTE]')).toBeUndefined();
  });
});

describe('the alert → aside table', () => {
  it('maps the five GitHub types onto the four Starlight variants', () => {
    expect(ALERT_TO_ASIDE).toEqual({
      NOTE: { variant: 'note' },
      TIP: { variant: 'tip' },
      IMPORTANT: { variant: 'note', title: 'Important' },
      WARNING: { variant: 'caution', title: 'Warning' },
      CAUTION: { variant: 'danger', title: 'Caution' },
    });
  });
});

describe('githubAlerts — the five types', () => {
  const cases = [
    ['NOTE', 'note', undefined],
    ['TIP', 'tip', undefined],
    ['IMPORTANT', 'note', 'Important'],
    ['WARNING', 'caution', 'Warning'],
    ['CAUTION', 'danger', 'Caution'],
  ] as const;

  for (const [type, variant, title] of cases) {
    it(`[!${type}] becomes a "${variant}" container directive${title ? ` titled "${title}"` : ''}`, () => {
      const tree = run(`> [!${type}]\n> Body *text*.\n`);
      const node = tree.children![0] as MdastLike & { name?: string; attributes?: unknown };
      expect(node.type).toBe('containerDirective');
      expect(node.name).toBe(variant);
      expect(node.attributes).toEqual({});
      expect(labelOf(node)).toBe(title);
      const body = node.children!.at(-1)!;
      expect(bare(body)).toEqual({
        type: 'paragraph',
        children: [
          { type: 'text', value: 'Body ' },
          { type: 'emphasis', children: [{ type: 'text', value: 'text' }] },
          { type: 'text', value: '.' },
        ],
      });
      // The marker text is gone from the body.
      expect(JSON.stringify(node)).not.toContain(`[!${type}]`);
    });
  }

  it('drops a marker that sits in its own paragraph, keeping every later block', () => {
    const tree = run('> [!TIP]\n>\n> First.\n>\n> - a\n> - b\n');
    const node = tree.children![0] as MdastLike & { name?: string };
    expect(node.name).toBe('tip');
    expect(node.children!.map((c) => c.type)).toEqual(['paragraph', 'list']);
  });

  it('drops the hard break that follows a marker with trailing spaces', () => {
    const tree = run('> [!NOTE]  \n> Second line.\n');
    const node = tree.children![0] as MdastLike;
    expect(bare(node.children)).toEqual([{ type: 'paragraph', children: [{ type: 'text', value: 'Second line.' }] }]);
  });

  it('accepts a lower-case marker, as GitHub does', () => {
    const tree = run('> [!warning]\n> Careful.\n');
    expect((tree.children![0] as MdastLike & { name?: string }).name).toBe('caution');
  });
});

describe('githubAlerts — left untouched', () => {
  const untouched: Array<[string, string]> = [
    ['a plain blockquote', '> Just a quote.\n'],
    ['an unknown [!X] marker', '> [!DANGER]\n> Not a GitHub type.\n'],
    ['a marker followed by text on the same line', '> [!NOTE] inline\n'],
    ['a marker with no body', '> [!NOTE]\n'],
    ['a marker that is not the first line', '> Intro\n> [!NOTE]\n> Body\n'],
    ['an alert nested in a list', '- item\n\n  > [!NOTE]\n  > Body\n'],
    ['an alert nested in a blockquote', '> > [!NOTE]\n> > Body\n'],
  ];

  for (const [label, md] of untouched) {
    it(label, () => {
      const before = bare(unified().use(remarkParse).use(remarkGfm).parse(md));
      expect(bare(run(md))).toEqual(before);
    });
  }

  it('is a no-op on a kind: Presentation page (decks link no Starlight aside CSS)', () => {
    const md = '> [!NOTE]\n> Body\n';
    const before = bare(unified().use(remarkParse).use(remarkGfm).parse(md));
    expect(bare(run(md, { kind: 'Presentation' }))).toEqual(before);
  });

  it('runs with no file at all (a bare unified pipeline)', () => {
    const tree = unified().use(remarkParse).use(remarkGfm).parse('> [!TIP]\n> x\n') as unknown as MdastLike;
    githubAlerts()(tree);
    expect((tree.children![0] as MdastLike & { name?: string }).name).toBe('tip');
  });
});
