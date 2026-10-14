/**
 * The in-page mdast emitter (`mdast.mjs`, ADR-0051; rendering contract 03 §4).
 *
 * Each case parses Gherkin with `@cucumber/gherkin`, builds the shared view and
 * emits the subtree. The "snapshots" are explicit outlines ({@link sketch}): one
 * line per node with its type, heading level, classes, role and value, so a
 * shape change shows up as a readable diff and the expectation documents the
 * contract. Covered (WP03 acceptance): a full feature with `#` comments (absent
 * from the output), a Rule with a Background, an outline with tagged Examples,
 * a data table, doc strings with and without a media type, synthetic levels
 * rendering no heading, container mode, `baseLevel` 2/4/6 (capped), header
 * modes, the include source line, and the hast the container becomes through
 * the real `mdast-util-to-hast`.
 */
import { describe, it, expect } from 'vitest';
import { Parser, AstBuilder, GherkinClassicTokenMatcher } from '@cucumber/gherkin';
import { IdGenerator } from '@cucumber/messages';
import { unified } from 'unified';
import remarkParse from 'remark-parse';
import remarkGfm from 'remark-gfm';
import { toHast } from 'mdast-util-to-hast';
import { featureView, type FeatureView } from '../lib/gherkin/view.mjs';
import { featureMdast, type MdNode, type MdastOptions } from '../lib/gherkin/mdast.mjs';

function view(source: string, synthetic?: { feature?: boolean; scenario?: boolean }): FeatureView {
  const parser = new Parser(new AstBuilder(IdGenerator.incrementing()), new GherkinClassicTokenMatcher());
  const v = featureView(parser.parse(source), { synthetic });
  if (!v) throw new Error('no feature');
  return v;
}

/** Description Markdown → block nodes, as the stage injects it (GFM on). */
const md = unified().use(remarkParse).use(remarkGfm);
const parseMarkdown = (markdown: string) => (md.parse(markdown) as unknown as { children: MdNode[] }).children;

function emit(source: string, opts: MdastOptions = {}, synthetic?: { feature?: boolean; scenario?: boolean }) {
  return featureMdast(view(source, synthetic), { parseMarkdown, ...opts });
}

type AnyNode = MdNode & Record<string, unknown>;

/** One line per node: `type[depth].class{role=…} "value"`, children indented. */
function sketch(node: MdNode, depth = 0): string[] {
  const n = node as AnyNode;
  const hp = (n.data?.hProperties ?? {}) as { className?: string[]; role?: string; ariaLevel?: number };
  let label = n.type;
  if (n.type === 'heading') label += `[${String(n.depth)}]`;
  if (n.type === 'list') label += n.ordered ? '(ordered)' : '(unordered)';
  if (n.data?.hName && n.type !== 'dkGherkin') label += `<${String(n.data.hName)}>`;
  if (hp.className) label += `.${hp.className.join('.')}`;
  if (hp.role) label += `{role=${hp.role} level=${String(hp.ariaLevel)}}`;
  if (n.type === 'code') label += ` lang=${String(n.lang)}${n.data?.dkGherkin ? ` mark=${String(n.data.dkGherkin)}` : ''}`;
  if (n.type === 'link') label += ` ${String(n.url)}`;
  if (typeof n.value === 'string') label += ` ${JSON.stringify(n.value)}`;
  return [`${'  '.repeat(depth)}${label}`, ...(n.children ?? []).flatMap((c) => sketch(c, depth + 1))];
}

/** Every node in the tree. */
function all(node: MdNode): AnyNode[] {
  return [node as AnyNode, ...(node.children ?? []).flatMap(all)];
}

const lines = (...ls: string[]) => `${ls.join('\n')}\n`;

describe('featureMdast: the dkGherkin subtree (03 §4)', () => {
  it('a full feature: header, tags without @dk:*, narrative breaks, description, summary; no comments', () => {
    const tree = emit(
      lines(
        '# language: en',
        '# A file comment that must never render',
        '@smoke @shipping @smoke @dk:context=shipping',
        'Feature: Book a consignment',
        '  As a shipper',
        '  I want to book space',
        '',
        '  Bookings are **confirmed** by the carrier.',
        '',
        '  # A comment between blocks',
        '  Background:',
        '    Given a sailing "NLRTM → GBFXT"',
        '',
        '  @happy',
        '  Scenario: Book space',
        '    # A step comment',
        '    Given free capacity',
        '    Then the booking is confirmed',
      ),
    );
    expect(sketch(tree)).toEqual([
      'dkGherkin.dk-gherkin',
      '  heading[2]',
      '    text "Book a consignment"',
      '  paragraph.dk-gherkin__tags',
      '    inlineCode "@shipping"',
      '    text " "',
      '    inlineCode "@smoke"',
      '  paragraph',
      '    text "As a shipper"',
      '    break',
      '    text "I want to book space"',
      '  paragraph',
      '    text "Bookings are "',
      '    strong',
      '      text "confirmed"',
      '    text " by the carrier."',
      '  paragraph',
      '    emphasis',
      '      text "1 scenario"',
      '  heading[3]',
      '    text "Background"',
      '  list(unordered).dk-gherkin__steps',
      '    listItem',
      '      paragraph',
      '        strong.dk-gherkin__kw',
      '          text "Given"',
      '        text " a sailing "',
      '        inlineCode "\\"NLRTM → GBFXT\\""',
      '  heading[3]',
      '    text "Scenario: Book space"',
      '  paragraph.dk-gherkin__tags',
      '    inlineCode "@happy"',
      '  list(unordered).dk-gherkin__steps',
      '    listItem',
      '      paragraph',
      '        strong.dk-gherkin__kw',
      '          text "Given"',
      '        text " free capacity"',
      '    listItem',
      '      paragraph',
      '        strong.dk-gherkin__kw',
      '          text "Then"',
      '        text " the booking is confirmed"',
    ]);
    expect(tree.data).toEqual({ hName: 'div', hProperties: { className: ['dk-gherkin'] } });
    const json = JSON.stringify(tree);
    expect(json).not.toContain('comment');
    expect(json).not.toContain('language');
    expect(json).not.toContain('@dk:');
  });

  it('the narrative is Markdown, as on a generated page: inline code in a user story is code', () => {
    // render.mjs writes the narrative lines through verbatim, so a generated page
    // renders `spec-kitty init` as code; the embed must not show the backticks
    // (the motivating init.feature has exactly this line).
    const tree = emit(
      lines(
        'Feature: Set up a project',
        '  As a developer',
        '  I want `spec-kitty init` to set up my project',
        '  So that I can start',
        '',
        '  Scenario: Init',
        '    Given an empty repository',
      ),
    );
    expect(sketch(tree).slice(0, 12)).toEqual([
      'dkGherkin.dk-gherkin',
      '  heading[2]',
      '    text "Set up a project"',
      '  paragraph',
      '    text "As a developer"',
      '    break',
      '    text "I want "',
      '    inlineCode "spec-kitty init"',
      '    text " to set up my project"',
      '    break',
      '    text "So that I can start"',
      '  paragraph',
    ]);
    // Without a parser (bare emit) the lines stay literal.
    const bare = featureMdast(view(lines('Feature: F', '  I want `x`', '', '  Scenario: S', '    Given g')), {});
    expect(sketch(bare).slice(3, 5)).toEqual(['  paragraph', '    text "I want `x`"']);
  });

  it('a Rule with a Background: the Rule one below the title, its children one below the Rule', () => {
    const tree = emit(
      lines(
        'Feature: Capacity',
        '  Rule: Capacity is finite',
        '    Rules are checked per sailing.',
        '    Background: Sailing',
        '      Given a sailing',
        '    Scenario: Over-book',
        '      Then it fails',
      ),
      { header: 'title' },
    );
    expect(sketch(tree)).toEqual([
      'dkGherkin.dk-gherkin',
      '  heading[2]',
      '    text "Capacity"',
      '  heading[3]',
      '    text "Rule: Capacity is finite"',
      '  paragraph',
      '    text "Rules are checked per sailing."',
      '  heading[4]',
      '    text "Background: Sailing"',
      '  list(unordered).dk-gherkin__steps',
      '    listItem',
      '      paragraph',
      '        strong.dk-gherkin__kw',
      '          text "Given"',
      '        text " a sailing"',
      '  heading[4]',
      '    text "Scenario: Over-book"',
      '  list(unordered).dk-gherkin__steps',
      '    listItem',
      '      paragraph',
      '        strong.dk-gherkin__kw',
      '          text "Then"',
      '        text " it fails"',
    ]);
  });

  it('Rule tags render after the Rule heading, before its description', () => {
    const tree = emit(lines('Feature: F', '  @r', '  Rule: R', '    Why.', '    Scenario: S', '      Given x'), {
      header: 'none',
    });
    expect(sketch(tree).slice(0, 7)).toEqual([
      'dkGherkin.dk-gherkin',
      '  heading[2]',
      '    text "Rule: R"',
      '  paragraph.dk-gherkin__tags',
      '    inlineCode "@r"',
      '  paragraph',
      '    text "Why."',
    ]);
  });

  it('an outline with tagged Examples: placeholders as inlineCode, label, tags, description, table', () => {
    const tree = emit(
      lines(
        'Feature: Price',
        '  Scenario Outline: Price by band',
        '    Given a parcel of <weight> kg',
        '',
        '    @domestic @dk:status=draft',
        '    Examples: Domestic',
        '      Prices *exclude* VAT.',
        '',
        '      | weight | price |',
        '      | 1      | 4.50  |',
        '',
        '    Examples:',
        '      | weight | price |',
      ),
      { header: 'none' },
    );
    expect(sketch(tree)).toEqual([
      'dkGherkin.dk-gherkin',
      '  heading[2]',
      '    text "Scenario Outline: Price by band"',
      '  list(unordered).dk-gherkin__steps',
      '    listItem',
      '      paragraph',
      '        strong.dk-gherkin__kw',
      '          text "Given"',
      '        text " a parcel of "',
      '        inlineCode "<weight>"',
      '        text " kg"',
      '  paragraph',
      '    strong',
      '      text "Examples:"',
      '    text " Domestic"',
      '  paragraph.dk-gherkin__tags',
      '    inlineCode "@domestic"',
      '  paragraph',
      '    text "Prices "',
      '    emphasis',
      '      text "exclude"',
      '    text " VAT."',
      '  table',
      '    tableRow',
      '      tableCell',
      '        text "weight"',
      '      tableCell',
      '        text "price"',
      '    tableRow',
      '      tableCell',
      '        text "1"',
      '      tableCell',
      '        text "4.50"',
      '  paragraph',
      '    strong',
      '      text "Examples:"',
      '  table',
      '    tableRow',
      '      tableCell',
      '        text "weight"',
      '      tableCell',
      '        text "price"',
    ]);
  });

  it('a data table: a GFM table inside the step item, header first, `\\n` cells broken, empty cells empty', () => {
    const tree = emit(lines('Feature: F', '  Scenario: S', '    Given rows', '      | a | b\\nc |', '      | 1 |      |'), {
      header: 'none',
    });
    const item = all(tree).find((n) => n.type === 'listItem') as AnyNode;
    expect(sketch(item)).toEqual([
      'listItem',
      '  paragraph',
      '    strong.dk-gherkin__kw',
      '      text "Given"',
      '    text " rows"',
      '  table',
      '    tableRow',
      '      tableCell',
      '        text "a"',
      '      tableCell',
      '        text "b"',
      '        break',
      '        text "c"',
      '    tableRow',
      '      tableCell',
      '        text "1"',
      '      tableCell',
    ]);
    const table = (item.children ?? [])[1] as AnyNode;
    expect(table.align).toEqual([null, null]);
  });

  it('doc strings: `code` nodes marked as doc strings, lang from the media type or `text`', () => {
    const tree = emit(
      lines(
        'Feature: F',
        '  Scenario: S',
        '    Given a typed one',
        '      """json',
        '      {"a": 1}',
        '      """',
        '    And a bare one',
        '      """',
        '      Feature: not a heading',
        '        # not a comment either',
        '      """',
      ),
      { header: 'none' },
    );
    const codes = all(tree).filter((n) => n.type === 'code');
    expect(codes.map((c) => sketch(c)[0])).toEqual([
      'code lang=json mark=docstring "{\\"a\\": 1}"',
      'code lang=text mark=docstring "Feature: not a heading\\n  # not a comment either"',
    ]);
    // Each sits inside its step's list item, after the step line.
    const items = all(tree).filter((n) => n.type === 'listItem');
    expect(items.map((i) => (i.children ?? []).map((c) => c.type))).toEqual([
      ['paragraph', 'code'],
      ['paragraph', 'code'],
    ]);
    expect(codes[0].meta).toBeNull();
  });

  it('a synthetic Feature and Scenario render no heading at all', () => {
    const tree = emit('Feature:\n  Scenario:\n    Given x\n    Then y\n', {}, { feature: true, scenario: true });
    expect(sketch(tree)).toEqual([
      'dkGherkin.dk-gherkin',
      '  list(unordered).dk-gherkin__steps',
      '    listItem',
      '      paragraph',
      '        strong.dk-gherkin__kw',
      '          text "Given"',
      '        text " x"',
      '    listItem',
      '      paragraph',
      '        strong.dk-gherkin__kw',
      '          text "Then"',
      '        text " y"',
    ]);
  });

  it('a synthetic Feature alone: no header, its scenarios at the base level', () => {
    const tree = emit('Feature:\n  Scenario: S\n    Given x\n', { baseLevel: 3 }, { feature: true });
    expect(all(tree).filter((n) => n.type === 'heading').map((h) => `${String(h.depth)} ${sketch(h)[1].trim()}`)).toEqual([
      '3 text "Scenario: S"',
    ]);
    expect(all(tree).some((n) => n.type === 'emphasis')).toBe(false);
  });

  it('container mode: every heading is a p[role=heading] carrying its level; no mdast heading remains', () => {
    const tree = emit(lines('Feature: F', '  Rule: R', '    Scenario: S', '      Given x'), { inContainer: true });
    expect(all(tree).some((n) => n.type === 'heading')).toBe(false);
    const headings = all(tree).filter((n) => (n.data?.hProperties as { role?: string } | undefined)?.role === 'heading');
    expect(headings.map((h) => sketch(h).join(' | '))).toEqual([
      'paragraph<p>{role=heading level=2} |   text "F"',
      'paragraph<p>{role=heading level=3} |   text "Rule: R"',
      'paragraph<p>{role=heading level=4} |   text "Scenario: S"',
    ]);
  });

  it.each([
    [2, [2, 3, 4]],
    [4, [4, 5, 6]],
    [6, [6, 6, 6]],
  ])('baseLevel %i: Feature, Rule, scenario-in-Rule levels %j (capped at 6)', (baseLevel, expected) => {
    const src = lines('Feature: F', '  Rule: R', '    Scenario: S', '      Given x');
    const top = emit(src, { baseLevel });
    expect(all(top).filter((n) => n.type === 'heading').map((h) => h.depth)).toEqual(expected);
    const nested = emit(src, { baseLevel, inContainer: true });
    expect(
      all(nested)
        .map((n) => (n.data?.hProperties as { ariaLevel?: number } | undefined)?.ariaLevel)
        .filter((l) => l !== undefined),
    ).toEqual(expected);
  });

  it('header `none` drops title, tags, narrative, description and summary; sections take the base level', () => {
    const src = lines('@t', 'Feature: F', '  As a user', '', '  More.', '', '  Scenario: S', '    Given x');
    const tree = emit(src, { header: 'none', baseLevel: 2 });
    expect(sketch(tree).slice(0, 3)).toEqual(['dkGherkin.dk-gherkin', '  heading[2]', '    text "Scenario: S"']);
    const json = JSON.stringify(tree);
    for (const gone of ['"F"', '@t', 'As a user', 'More.', '1 scenario']) expect(json).not.toContain(gone);
    // `title` keeps only the title.
    const titled = emit(src, { header: 'title', baseLevel: 2 });
    expect(sketch(titled).slice(0, 5)).toEqual([
      'dkGherkin.dk-gherkin',
      '  heading[2]',
      '    text "F"',
      '  heading[3]',
      '    text "Scenario: S"',
    ]);
  });

  it('a tags paragraph holding only @dk:* tags is omitted', () => {
    const tree = emit(lines('@dk:status=draft', 'Feature: F', '  Scenario: S', '    Given x'));
    const classes = all(tree).flatMap((n) => (n.data?.hProperties as { className?: string[] } | undefined)?.className ?? []);
    expect(classes).not.toContain('dk-gherkin__tags');
  });

  it('without parseMarkdown a description is one literal paragraph', () => {
    const tree = featureMdast(view(lines('Feature: F', '  Some *text*.')), {});
    expect(sketch(tree)).toEqual([
      'dkGherkin.dk-gherkin',
      '  heading[2]',
      '    text "F"',
      '  paragraph',
      '    text "Some *text*."',
    ]);
  });

  describe('source line (03 §4.6)', () => {
    const src = lines('Feature: Book a consignment', '  Scenario: S', '    Given x');
    const last = (tree: MdNode) => sketch((tree.children ?? []).at(-1) as MdNode);

    it('whole file: `Source: <path>`, linked when href is given', () => {
      expect(last(emit(src, { source: { path: 'features/a.feature' } }))).toEqual([
        'paragraph.dk-gherkin__source',
        '  text "Source: "',
        '  inlineCode "features/a.feature"',
      ]);
      expect(last(emit(src, { source: { path: 'features/a.feature', href: 'https://x.test/a.feature' } }))).toEqual([
        'paragraph.dk-gherkin__source',
        '  text "Source: "',
        '  link https://x.test/a.feature',
        '    inlineCode "features/a.feature"',
      ]);
    });

    it('selection: `From <Feature title>, <path>` (title from the view unless given)', () => {
      expect(last(emit(src, { header: 'none', source: { path: 'f/a.feature', selected: true } }))).toEqual([
        'paragraph.dk-gherkin__source',
        '  text "From Book a consignment, "',
        '  inlineCode "f/a.feature"',
      ]);
      expect(last(emit(src, { source: { path: 'f/a.feature', selected: true, featureTitle: 'Other' } }))[1]).toBe(
        '  text "From Other, "',
      );
    });

    it('no source option, no source line (fences)', () => {
      expect(JSON.stringify(emit(src))).not.toContain('dk-gherkin__source');
    });
  });

  it('never presets a heading id (the slugger must see every heading)', () => {
    const tree = emit(lines('Feature: F', '  Scenario: S', '    Given x', '  Scenario: S', '    Given x'));
    for (const n of all(tree)) {
      expect((n.data?.hProperties as { id?: unknown } | undefined)?.id).toBeUndefined();
      expect((n.data as { id?: unknown } | undefined)?.id).toBeUndefined();
    }
  });
});

describe('featureMdast through the real mdast-util-to-hast', () => {
  interface Hast {
    type: string;
    tagName?: string;
    properties?: Record<string, unknown>;
    children?: Hast[];
    value?: string;
  }
  const elements = (n: Hast): Hast[] => [
    ...(n.type === 'element' ? [n] : []),
    ...(n.children ?? []).flatMap(elements),
  ];
  const hast = (tree: MdNode) => toHast({ type: 'root', children: [tree] } as never) as unknown as Hast;

  it('becomes div.dk-gherkin > h2, ul.dk-gherkin__steps > li > strong.dk-gherkin__kw, table, pre>code', () => {
    const root = hast(
      emit(
        lines(
          'Feature: F',
          '  Scenario: S',
          '    Given rows',
          '      | a |',
          '      | 1 |',
          '    And a doc',
          '      """json',
          '      {}',
          '      """',
        ),
      ),
    );
    const div = elements(root)[0];
    expect(div.tagName).toBe('div');
    expect(div.properties).toEqual({ className: ['dk-gherkin'] });
    const tags = elements(div).map((e) => {
      const className = e.properties?.className as string[] | undefined;
      return `${String(e.tagName)}${className ? `.${className.join('.')}` : ''}`;
    });
    expect(tags).toEqual(
      expect.arrayContaining([
        'h2',
        'h3',
        'ul.dk-gherkin__steps',
        'li',
        'strong.dk-gherkin__kw',
        'table',
        'thead',
        'th',
        'tbody',
        'td',
        'pre',
        'code.language-json',
      ]),
    );
    expect(tags.filter((t) => t === 'pre')).toHaveLength(1);
  });

  it('container mode becomes p[role=heading][aria-level], not h*', () => {
    const root = hast(emit(lines('Feature: F', '  Scenario: S', '    Given x'), { inContainer: true, baseLevel: 3 }));
    const els = elements(root);
    expect(els.some((e) => /^h[1-6]$/.test(String(e.tagName)))).toBe(false);
    const roleHeadings = els.filter((e) => e.properties?.role === 'heading');
    expect(roleHeadings.map((e) => [e.tagName, e.properties?.ariaLevel])).toEqual([
      ['p', 3],
      ['p', 4],
    ]);
  });
});
