/**
 * The Gherkin view model (`view.mjs`, ADR-0051; 02 §Module layout) and the
 * `render.mjs` options built on it.
 *
 * `featureView` is THE document walk both emitters share (`render.mjs` for
 * generated pages and agent Markdown, `mdast.mjs` for in-page embeds). These
 * tests pin what the walk decides once for both: titles, narrative, tag order,
 * summary counts, outline placeholders, table rows, doc-string languages,
 * synthetic levels, and the heading-level plan. Byte-identity of slice C's
 * default output is proven by the goldens in `gherkin-render.test.ts` and by
 * `pnpm validate:features`; the new `renderFeatureBody` options are pinned here.
 *
 * Documents are built with `@cucumber/gherkin` directly, as the parser's
 * output is the view's only input.
 */
import { describe, it, expect } from 'vitest';
import { Parser, AstBuilder, GherkinClassicTokenMatcher } from '@cucumber/gherkin';
import { IdGenerator, type GherkinDocument } from '@cucumber/messages';
import {
  featureView,
  resolveLevels,
  capLevel,
  childLevel,
  displayTags,
  hasMetadataTag,
  summaryText,
  titleOf,
  type FeatureView,
  type SectionView,
  type RuleView,
} from '../lib/gherkin/view.mjs';
import { renderFeatureBody, warnDuplicates } from '../lib/gherkin/render.mjs';

function parse(source: string): GherkinDocument {
  const parser = new Parser(new AstBuilder(IdGenerator.incrementing()), new GherkinClassicTokenMatcher());
  return parser.parse(source);
}

function view(source: string, synthetic?: { feature?: boolean; scenario?: boolean }): FeatureView {
  const v = featureView(parse(source), { synthetic });
  if (!v) throw new Error('no feature');
  return v;
}

const lines = (...ls: string[]) => `${ls.join('\n')}\n`;

const FULL = lines(
  '# language: en',
  '# A file comment that must never render',
  '@smoke @shipping @smoke @dk:context=shipping',
  'Feature: Book a consignment',
  '  As a shipper',
  '  I want to book space on a sailing',
  '  So that my cargo is carried',
  '',
  '  Bookings are **confirmed** by the carrier.',
  '',
  '',
  '',
  '  Second paragraph.',
  '',
  '  # A comment between blocks',
  '  Background:',
  '    Given a sailing "NLRTM → GBFXT"',
  '',
  '  @happy',
  '  Scenario: Book space',
  '    # A step comment',
  '    Given free capacity of <n> TEU',
  '    When I book 2 TEU',
  '    Then the booking is confirmed',
  '',
  '  Rule: Capacity is finite',
  '    @edge',
  '    Scenario Outline: Over-book',
  '      Given <free> TEU free',
  '      Then booking <want> TEU fails',
  '',
  '      Examples: Small',
  '        | free | want |',
  '        | 1    | 2    |',
  '        | 0    | 1    |',
);

describe('featureView: the shared document walk', () => {
  it('reads the Feature header: trimmed keyword/name, title, narrative, collapsed description', () => {
    const v = view(FULL);
    expect(v.keyword).toBe('Feature');
    expect(v.name).toBe('Book a consignment');
    expect(v.title).toBe('Book a consignment');
    expect(v.synthetic).toBe(false);
    expect(v.narrative).toEqual([
      'As a shipper',
      'I want to book space on a sailing',
      'So that my cargo is carried',
    ]);
    expect(v.description).toBe('Bookings are **confirmed** by the carrier.\n\nSecond paragraph.');
    expect(v.line).toBe(4);
  });

  it('sorts and de-duplicates tags by code unit, keeping `@dk:*` for the emitters to filter', () => {
    expect(view(FULL).tags).toEqual(['@dk:context=shipping', '@shipping', '@smoke']);
  });

  it('displayTags drops only the reserved @dk:* tags; hasMetadataTag finds one at any level', () => {
    expect(displayTags(view(FULL).tags)).toEqual(['@shipping', '@smoke']);
    expect(displayTags(['@dk-ish', '@dk:x=y', '@a'])).toEqual(['@dk-ish', '@a']);
    expect(hasMetadataTag(view(FULL))).toBe(true);
    expect(hasMetadataTag(view('Feature: F\n  Scenario: S\n    Given x\n'))).toBe(false);
    const deep = view(
      lines('Feature: F', '  Rule: R', '    Scenario Outline: O', '      Given <x>', '      @dk:x=y', '      Examples:', '        | x |', '        | 1 |'),
    );
    expect(hasMetadataTag(deep)).toBe(true);
  });

  it('never carries `#` comments, so no emitter can render them', () => {
    const json = JSON.stringify(view(FULL));
    expect(json).not.toContain('comment');
    expect(json).not.toContain('language');
  });

  it('lists Backgrounds, scenarios and Rules in document order, with their lines', () => {
    const v = view(FULL);
    expect(v.children.map((c) => `${c.kind}:${c.line}`)).toEqual(['background:16', 'scenario:20', 'rule:26']);
    const rule = v.children[2] as RuleView;
    expect(rule.name).toBe('Capacity is finite');
    expect(rule.children.map((c) => `${c.kind}:${c.name}`)).toEqual(['scenario:Over-book']);
    expect(rule.children[0].tags).toEqual(['@edge']);
  });

  it('counts rules, scenarios (top level and in Rules) and Examples body rows', () => {
    expect(view(FULL).counts).toEqual({ rules: 1, scenarios: 2, exampleRows: 2 });
    expect(summaryText(view(FULL).counts)).toBe('1 rule · 2 scenarios · 2 example rows');
    expect(summaryText({ rules: 0, scenarios: 1, exampleRows: 0 })).toBe('1 scenario');
    expect(summaryText({ rules: 0, scenarios: 0, exampleRows: 0 })).toBe('');
  });

  it('segments placeholders only in an outline; a plain scenario keeps `<n>` as prose', () => {
    const v = view(FULL);
    const plain = v.children[1] as SectionView;
    expect(plain.outline).toBe(false);
    expect(plain.steps[0].segments).toEqual([{ kind: 'text', value: 'free capacity of <n> TEU' }]);
    const outline = (v.children[2] as RuleView).children[0];
    expect(outline.outline).toBe(true);
    expect(outline.steps.map((s) => s.keyword)).toEqual(['Given', 'Then']);
    // The leading empty prose run before `<free>` is omitted.
    expect(outline.steps[0].segments).toEqual([
      { kind: 'placeholder', value: '<free>' },
      { kind: 'text', value: ' TEU free' },
    ]);
    expect(outline.steps[1].segments).toEqual([
      { kind: 'text', value: 'booking ' },
      { kind: 'placeholder', value: '<want>' },
      { kind: 'text', value: ' TEU fails' },
    ]);
    expect(outline.examples).toEqual([
      {
        keyword: 'Examples',
        name: 'Small',
        tags: [],
        description: '',
        rows: [
          ['free', 'want'],
          ['1', '2'],
          ['0', '1'],
        ],
        rowLines: [34, 35],
        line: 32,
      },
    ]);
  });

  it('segments a double-quoted argument, quotes included, in any step; a placeholder inside one stays in it', () => {
    const v = view(
      lines(
        'Feature: F',
        '  Scenario: S',
        '    When I run "spec-kitty init --force" and "" then "say \\"hi\\""',
        '    Then a lone " quote is prose',
        '  Scenario Outline: O',
        '    Given a file "<name>.txt" of <size> bytes',
        '    Examples:',
        '      | name | size |',
        '      | a    | 1    |',
      ),
    );
    const [plain, outline] = v.children as SectionView[];
    expect(plain.steps[0].segments).toEqual([
      { kind: 'text', value: 'I run ' },
      { kind: 'argument', value: '"spec-kitty init --force"' },
      { kind: 'text', value: ' and ' },
      { kind: 'argument', value: '""' },
      { kind: 'text', value: ' then ' },
      { kind: 'argument', value: '"say \\"hi\\""' },
    ]);
    expect(plain.steps[1].segments).toEqual([{ kind: 'text', value: 'a lone " quote is prose' }]);
    expect(outline.steps[0].segments).toEqual([
      { kind: 'text', value: 'a file ' },
      { kind: 'argument', value: '"<name>.txt"' },
      { kind: 'text', value: ' of ' },
      { kind: 'placeholder', value: '<size>' },
      { kind: 'text', value: ' bytes' },
    ]);
  });

  it('carries data-table cell values and doc strings with a shared code language', () => {
    const v = view(
      lines(
        'Feature: Args',
        '  Scenario: S',
        '    Given rows',
        '      | a | b\\nc |',
        '      | 1 |      |',
        '    And a typed doc string',
        '      """json',
        '      {"a": 1}',
        '      """',
        '    And a bare doc string',
        '      """',
        '      plain',
        '      """',
      ),
    );
    const steps = (v.children[0] as SectionView).steps;
    expect(steps[0].dataTable).toEqual([
      ['a', 'b\nc'],
      ['1', ''],
    ]);
    expect(steps[0].docString).toBeNull();
    expect(steps[1].docString).toEqual({ content: '{"a": 1}', mediaType: 'json', language: 'json' });
    expect(steps[2].docString).toEqual({ content: 'plain', mediaType: '', language: 'text' });
    expect(steps[2].dataTable).toBeNull();
  });

  it('falls back to the keyword as written for an unnamed Feature (`featureTitle`)', () => {
    expect(view('Feature:\n  Scenario: S\n    Given x\n').title).toBe('Feature');
    expect(view('# language: nl\nFunctionaliteit:\n').title).toBe('Functionaliteit');
  });

  it('returns null for a document without a Feature', () => {
    expect(featureView(parse('# only a comment\n'))).toBeNull();
  });

  it('flags synthetic levels: the Feature, and only the first top-level scenario', () => {
    const src = 'Feature:\n  Scenario:\n    Given x\n  Scenario: Real\n    Given y\n';
    const none = view(src);
    expect(none.synthetic).toBe(false);
    expect((none.children as SectionView[]).map((c) => c.synthetic)).toEqual([false, false]);
    const both = view(src, { feature: true, scenario: true });
    expect(both.synthetic).toBe(true);
    expect((both.children as SectionView[]).map((c) => c.synthetic)).toEqual([true, false]);
    expect(view(src, { feature: true }).children.map((c) => (c as SectionView).synthetic)).toEqual([false, false]);
  });

  it('titleOf: `Keyword: name`, or the bare keyword when unnamed', () => {
    expect(titleOf({ keyword: 'Scenario', name: 'S' })).toBe('Scenario: S');
    expect(titleOf({ keyword: 'Background', name: '' })).toBe('Background');
  });
});

describe('resolveLevels: the heading plan both emitters share (03 §4.2)', () => {
  const v = view(FULL);
  const synth = view('Feature:\n  Scenario:\n    Given x\n', { feature: true });

  it.each([
    [1, 'full', { header: 'full', feature: 1, section: 2 }],
    [2, 'full', { header: 'full', feature: 2, section: 3 }],
    [4, 'title', { header: 'title', feature: 4, section: 5 }],
    [6, 'full', { header: 'full', feature: 6, section: 6 }],
    [2, 'none', { header: 'none', feature: 2, section: 2 }],
    [9, 'none', { header: 'none', feature: 6, section: 6 }],
  ] as const)('baseLevel %i, header %s', (baseLevel, header, expected) => {
    expect(resolveLevels(v, { baseLevel, header })).toEqual(expected);
  });

  it('a synthetic Feature has no header, so its sections sit at the base level', () => {
    expect(resolveLevels(synth, { baseLevel: 3, header: 'full' })).toEqual({ header: 'none', feature: 3, section: 3 });
  });

  it('capLevel/childLevel cap at 6 and floor at 1', () => {
    expect([0, 1, 5, 6, 7].map(capLevel)).toEqual([1, 1, 5, 6, 6]);
    expect([1, 5, 6].map(childLevel)).toEqual([2, 6, 6]);
  });
});

describe('renderFeatureBody options on the view (default output is byte-identical: goldens)', () => {
  const SRC = lines(
    'Feature: Ship',
    '  As a shipper',
    '',
    '  Scenario: One',
    '    Given x',
    '',
    '  Rule: R',
    '    Background:',
    '      Given y',
    '    Scenario: Two',
    '      Then z',
  );

  it('defaults: Feature `#`, sections `##`, Rule children `###`, narrative and summary', () => {
    expect(renderFeatureBody(parse(SRC))).toBe(
      lines(
        '# Ship',
        '',
        'As a shipper',
        '',
        '*1 rule · 2 scenarios*',
        '',
        '## Scenario: One',
        '',
        '- **Given** x',
        '',
        '## Rule: R',
        '',
        '### Background',
        '',
        '- **Given** y',
        '',
        '### Scenario: Two',
        '',
        '- **Then** z',
      ),
    );
  });

  it('baseLevel shifts every heading; header `title` drops narrative and summary', () => {
    const body = renderFeatureBody(parse(SRC), { baseLevel: 4, header: 'title' });
    expect(body.split('\n').filter((l) => l.startsWith('#'))).toEqual([
      '#### Ship',
      '##### Scenario: One',
      '##### Rule: R',
      '###### Background',
      '###### Scenario: Two',
    ]);
    expect(body).not.toContain('As a shipper');
    expect(body).not.toContain('2 scenarios');
  });

  it('header `none` drops the Feature header and lifts sections to the base level; levels cap at 6', () => {
    const none = renderFeatureBody(parse(SRC), { baseLevel: 2, header: 'none' });
    expect(none.startsWith('## Scenario: One\n')).toBe(true);
    expect(none).not.toContain('Ship\n');
    const capped = renderFeatureBody(parse(SRC), { baseLevel: 6 });
    expect(capped.split('\n').filter((l) => l.startsWith('#'))).toEqual([
      '###### Ship',
      '###### Scenario: One',
      '###### Rule: R',
      '###### Background',
      '###### Scenario: Two',
    ]);
  });

  it('synthetic levels render no heading', () => {
    const body = renderFeatureBody(parse('Feature:\n  Scenario:\n    Given x\n    Then y\n'), {
      synthetic: { feature: true, scenario: true },
    });
    expect(body).toBe('- **Given** x\n- **Then** y\n');
  });

  it('`embed` lays tags out as the HTML does: Feature tags in the header, tags right after each heading, no @dk:*', () => {
    const doc = parse(
      lines(
        '@shipping @dk:context=x',
        'Feature: Ship',
        '  As a shipper',
        '',
        '  @smoke @dk:status=draft',
        '  Scenario: One',
        '    A description.',
        '    Given x',
        '',
        '  @refunds',
        '  Rule: R',
        '    Rule text.',
        '    Scenario: Two',
        '      Then z',
      ),
    );
    const page = renderFeatureBody(doc);
    expect(page).not.toContain('`@shipping`');
    expect(page).toContain('## Scenario: One\n\nA description.\n\n`@dk:status=draft` `@smoke`\n');
    expect(renderFeatureBody(doc, { baseLevel: 2, embed: true })).toBe(
      lines(
        '## Ship',
        '',
        '`@shipping`',
        '',
        'As a shipper',
        '',
        '*1 rule · 2 scenarios*',
        '',
        '### Scenario: One',
        '',
        '`@smoke`',
        '',
        'A description.',
        '',
        '- **Given** x',
        '',
        '### Rule: R',
        '',
        '`@refunds`',
        '',
        'Rule text.',
        '',
        '#### Scenario: Two',
        '',
        '- **Then** z',
      ),
    );
  });

  it('`inContainer` renders every heading as a bold line (the HTML uses p[role=heading] there)', () => {
    const body = renderFeatureBody(parse(SRC), { baseLevel: 3, header: 'none', embed: true, inContainer: true });
    expect(body.split('\n').filter((l) => l.startsWith('#'))).toEqual([]);
    expect(body.split('\n').filter((l) => l.startsWith('**'))).toEqual([
      '**Scenario: One**',
      '**Rule: R**',
      '**Background**',
      '**Scenario: Two**',
    ]);
  });

  it('renders a quoted argument as a code span, quotes kept, whatever backticks it holds', () => {
    const body = renderFeatureBody(parse('Feature: F\n  Scenario: S\n    When I run "a `b` --c"\n'));
    expect(body).toContain('- **When** I run ``"a `b` --c"``\n');
  });

  it('renders a quoted argument in a data-table or Examples cell as a code span, like step text', () => {
    const body = renderFeatureBody(
      parse(
        lines(
          'Feature: F',
          '  Scenario: S',
          '    When I run:',
          '      | flag        | note              |',
          '      | "--force"   | say "a\\|b" -- now |',
          '      | "x\\\\\\|y"    | "line\\none"    |',
          '  Scenario Outline: O',
          '    Given <f>',
          '    Examples:',
          '      | f         |',
          '      | "--dry-run" |',
        ),
      ),
    );
    // A `|` in a code span is escaped for the GFM row, which unescapes it again.
    expect(body).toContain('| `"--force"` | say `"a\\|b"` -- now |');
    // A `\|` cannot be written in a code span in a GFM cell: it stays escaped
    // text. A quoted argument never spans the `<br>` of a `\n` cell escape.
    expect(body).toContain('| "x\\\\\\|y" | "line<br>one" |');
    expect(body).toContain('| `"--dry-run"` |');
  });

  it('a prebuilt `view` is rendered as given (no second walk)', () => {
    const v = featureView(parse(SRC));
    if (!v) throw new Error('no feature');
    expect(renderFeatureBody(parse('Feature: Other\n'), { view: v })).toBe(renderFeatureBody(parse(SRC)));
  });

  it('warnDuplicates cites lines shifted by lineOffset, per sibling group', () => {
    const doc = parse(
      lines(
        'Feature: F',
        '  Scenario: A',
        '    Given x',
        '  Scenario: A',
        '    Given x',
        '  Rule: R',
        '    Scenario: A',
        '      Given x',
      ),
    );
    const warnings: string[] = [];
    const v = featureView(doc);
    if (!v) throw new Error('no feature');
    warnDuplicates(v, { file: 'page.md', warn: (m) => warnings.push(m), lineOffset: 40 });
    expect(warnings).toEqual([
      '[dk-gherkin] page.md:44 duplicate scenario name "A" (also at line 42) — markdownlint MD024 will reject the duplicate heading',
    ]);
    // renderFeatureBody threads its own options through (no offset by default).
    const viaRender: string[] = [];
    renderFeatureBody(doc, { file: 'f.feature', warn: (m) => viaRender.push(m) });
    expect(viaRender).toEqual([
      '[dk-gherkin] f.feature:4 duplicate scenario name "A" (also at line 2) — markdownlint MD024 will reject the duplicate heading',
    ]);
  });
});
