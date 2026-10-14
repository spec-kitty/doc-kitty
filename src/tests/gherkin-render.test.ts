/**
 * Gherkin → Markdown body renderer (ADR-0046, mapping contract §4/§5; WP04).
 *
 * Five guarantees:
 *
 *  1. GOLDEN: every `fixtures/gherkin/render/<name>.feature` renders to its
 *     sibling `<name>.md` byte-for-byte. `book-consignment.md` is the body of the
 *     plan's worked example (`examples/expected/behaviour/shipping/…`), copied
 *     verbatim minus the frontmatter.
 *  2. ROUND-TRIP: each golden output is parsed with the build's remark stack
 *     (Astro's `remark-gfm` + `remark-smartypants`, then doc-kitty's single
 *     `remark-directive` owner, then — with `markua: true` — the Markua remark
 *     passes, in `config.ts` order). Every step's text, heading, table cell and
 *     DocString survives as the SOURCE text (modulo smartypants, which is applied
 *     to the expectation too), and no `html`, directive or unexpected `link` node
 *     appears.
 *  3. PROPERTY: 500 seeded random printable strings (punctuation-heavy) as step
 *     text, scenario/feature names and table cells, through the same round-trip.
 *  4. LINT: `markdownlint-cli2` with the repo `.markdownlint.jsonc` reports 0
 *     issues on every golden output.
 *  5. PURITY: `render.mjs` imports only `./text.mjs` and `./view.mjs` (it must
 *     load in the bare-Node `--check` gate as well as in the Astro build; the
 *     import-scan table lives in `gherkin-feature-core.test.ts`).
 */
import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Parser, AstBuilder, GherkinClassicTokenMatcher } from '@cucumber/gherkin';
import { IdGenerator, type GherkinDocument, type Step, type TableRow } from '@cucumber/messages';
import { unified } from 'unified';
import remarkParse from 'remark-parse';
import remarkGfm from 'remark-gfm';
import remarkSmartypants from 'remark-smartypants';
import remarkDirective from 'remark-directive';
import markuaNormalise from '../lib/remark/markua-normalise.js';
import markuaFootnotes from '../lib/remark/markua-footnotes.js';
import markuaAttributes from '../lib/remark/markua-attributes.js';
import markuaCallouts from '../lib/remark/markua-callouts.js';
import {
  renderFeatureBody,
  escapeInline,
  escapeCell,
  escapeHeading,
  fenceFor,
} from '../lib/gherkin/render.mjs';

const SRC_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const REPO_ROOT = path.resolve(SRC_ROOT, '..');
const FIXTURES = path.join(SRC_ROOT, 'tests/fixtures/gherkin/render');

// ---------------------------------------------------------------------------
// Parsing helpers
// ---------------------------------------------------------------------------

function parseGherkin(source: string): GherkinDocument {
  const parser = new Parser(
    new AstBuilder(IdGenerator.incrementing()),
    new GherkinClassicTokenMatcher(),
  );
  return parser.parse(source);
}

function render(source: string, file = 'test.feature'): { body: string; warnings: string[] } {
  const warnings: string[] = [];
  const body = renderFeatureBody(parseGherkin(source), { file, warn: (m) => warnings.push(m) });
  return { body, warnings };
}

const goldenNames = readdirSync(FIXTURES)
  .filter((f) => f.endsWith('.feature'))
  .map((f) => f.slice(0, -'.feature'.length))
  .sort();

// ---------------------------------------------------------------------------
// mdast helpers
// ---------------------------------------------------------------------------

interface Node {
  type: string;
  value?: string;
  url?: string;
  lang?: string | null;
  depth?: number;
  children?: Node[];
}

function toText(node: Node): string {
  if (node.type === 'text' || node.type === 'inlineCode') return node.value ?? '';
  if (node.type === 'break') return '\n';
  return (node.children ?? []).map(toText).join('');
}

function walk(node: Node, visit: (n: Node) => void): void {
  visit(node);
  for (const child of node.children ?? []) walk(child, visit);
}

/**
 * The build's remark stack. Astro runs `remark-gfm` then `remark-smartypants`
 * before user plugins; `config.ts` then appends the single `remark-directive`
 * owner and (markua) `normalise → footnotes → attributes → callouts`. The
 * glossary passes need a term index and only ever ADD links inside text, which is
 * out of scope for escaping. (`guardDeck(markuaFootnotes)` is a no-op wrapper off
 * a deck, so the bare plugin is used.)
 */
function makeProcessor(markua: boolean) {
  const base = unified().use(remarkParse).use(remarkGfm).use(remarkSmartypants).use(remarkDirective);
  return markua
    ? base.use(markuaNormalise).use(markuaFootnotes).use(markuaAttributes).use(markuaCallouts)
    : base;
}

const PROCESSORS = { off: makeProcessor(false), on: makeProcessor(true) } as const;

function parseMarkdown(markdown: string, markua: boolean): Node {
  const proc = markua ? PROCESSORS.on : PROCESSORS.off;
  return proc.runSync(proc.parse(markdown)) as unknown as Node;
}

const smarty = unified().use(remarkSmartypants);

/**
 * Fold curly quotes back to straight ones before comparing. remark-smartypants
 * picks a quote's DIRECTION from the whole document's concatenated text, so an
 * unbalanced quote elsewhere on the page (a Feature name like `X'"`) can flip a
 * quote inside a table cell; the per-node expectation built by {@link smartText}
 * cannot see that context. The contract's round trip is "modulo smart quotes",
 * so the direction is not part of it (dashes/ellipses still are).
 */
function foldQuotes(text: string): string {
  return text.replace(/[‘’]/g, "'").replace(/[“”]/g, '"');
}

/**
 * What smartypants makes of `children` in the same inline context (the
 * "modulo smart quotes" half of the round-trip): the expectation is built as an
 * mdast tree and run through the very same plugin.
 */
function smartText(wrapper: 'paragraph' | 'heading' | 'tableCell', children: Node[]): string {
  const inner: Node = { type: wrapper, children };
  const tree = smarty.runSync({ type: 'root', children: [inner] } as never) as unknown as Node;
  return toText(tree.children?.[0] ?? { type: 'root' });
}

const PLACEHOLDER = /<[^<>\n]+>/g;

/** Source step text as the mdast children the renderer should produce. */
function stepChildren(keyword: string, text: string, outline: boolean): Node[] {
  const kids: Node[] = [{ type: 'strong', children: [{ type: 'text', value: keyword.trim() }] }];
  const parts: Node[] = [];
  let last = 0;
  if (outline) {
    for (const m of text.matchAll(PLACEHOLDER)) {
      parts.push({ type: 'text', value: text.slice(last, m.index) });
      parts.push({ type: 'inlineCode', value: m[0] });
      last = (m.index ?? 0) + m[0].length;
    }
  }
  parts.push({ type: 'text', value: text.slice(last) });
  parts[0] = { type: 'text', value: ` ${parts[0].value ?? ''}` };
  return [...kids, ...parts];
}

/**
 * The inert empty HTML comment the escaper splits a GFM autolink literal with
 * (`www<!---->.x.y`, `https<!---->://…`, `a<!---->@b.c`): the ONLY raw HTML a
 * literal-text escape may emit. It splits the mdast text node, so neither
 * micromark nor `mdast-util-gfm-autolink-literal`'s text-node transform sees a
 * URL; a backslash escape does NOT work (the transform runs on the decoded text).
 */
const AUTOLINK_BREAK = '<!---->';

interface ExpectedSection {
  heading: string;
  steps: { keyword: string; text: string; outline: boolean; step: Step }[];
  tables: TableRow[][];
}

/** The renderer's document-order expectations, read straight off the AST. */
function expectations(doc: GherkinDocument): {
  headings: string[];
  steps: ExpectedSection['steps'];
  tables: TableRow[][];
} {
  const feature = doc.feature;
  if (!feature) throw new Error('fixture has no Feature');
  const headings = [feature.name.trim() || feature.keyword.trim()];
  const steps: ExpectedSection['steps'] = [];
  const tables: TableRow[][] = [];
  const title = (k: string, n: string) => (n.trim() ? `${k.trim()}: ${n.trim()}` : k.trim());
  const section = (node: {
    keyword: string;
    name: string;
    steps: readonly Step[];
    examples?: readonly { tableHeader?: TableRow; tableBody: readonly TableRow[] }[];
  }) => {
    headings.push(title(node.keyword, node.name));
    const outline = (node.examples ?? []).length > 0;
    for (const step of node.steps) {
      steps.push({ keyword: step.keyword, text: step.text, outline, step });
      if (step.dataTable) tables.push([...step.dataTable.rows]);
    }
    for (const ex of node.examples ?? []) {
      if (ex.tableHeader) tables.push([ex.tableHeader, ...ex.tableBody]);
    }
  };
  for (const child of feature.children) {
    if (child.background) section(child.background);
    if (child.scenario) section(child.scenario);
    if (child.rule) {
      headings.push(title(child.rule.keyword, child.rule.name));
      for (const rc of child.rule.children) {
        if (rc.background) section(rc.background);
        if (rc.scenario) section(rc.scenario);
      }
    }
  }
  return { headings, steps, tables };
}

/**
 * Parse `body` with the build stack and assert every step / heading / cell /
 * DocString reads back as the source. Returns the problems found (empty = pass).
 */
function roundTripProblems(doc: GherkinDocument, body: string, markua: boolean): string[] {
  const problems: string[] = [];
  const tree = parseMarkdown(body, markua);
  const exp = expectations(doc);

  // No raw HTML (bar the autolink breaker), no directives, no links at all —
  // GFM literal autolinks included: step text, names and cells are literal text.
  walk(tree, (n) => {
    if (n.type === 'html' && n.value !== AUTOLINK_BREAK) problems.push(`html node: ${n.value}`);
    if (/Directive$/.test(n.type)) problems.push(`${n.type} node`);
    if (n.type === 'link') problems.push(`link node → ${n.url}`);
    if (n.type === 'footnoteReference') problems.push('footnoteReference node');
  });

  // Headings (Feature, Background, Rule, Scenario), in document order.
  const headings: Node[] = [];
  walk(tree, (n) => {
    if (n.type === 'heading') headings.push(n);
  });
  const gotHeadings = headings.map((h) => foldQuotes(toText(h)));
  const wantHeadings = exp.headings.map((h) =>
    foldQuotes(smartText('heading', [{ type: 'text', value: h }])),
  );
  if (JSON.stringify(gotHeadings) !== JSON.stringify(wantHeadings)) {
    problems.push(`headings ${JSON.stringify(gotHeadings)} ≠ ${JSON.stringify(wantHeadings)}`);
  }

  // Steps: every list item that opens with a `strong` keyword.
  const items: Node[] = [];
  walk(tree, (n) => {
    if (n.type !== 'listItem') return;
    const para = n.children?.[0];
    if (para?.type === 'paragraph' && para.children?.[0]?.type === 'strong') items.push(n);
  });
  if (items.length !== exp.steps.length) {
    problems.push(`step count ${items.length} ≠ ${exp.steps.length}`);
  }
  exp.steps.forEach((s, i) => {
    const item = items[i];
    if (!item) return;
    const para = item.children?.[0] as Node;
    const got = foldQuotes(toText(para));
    const want = foldQuotes(smartText('paragraph', stepChildren(s.keyword, s.text, s.outline)));
    if (got !== want) problems.push(`step ${i}: ${JSON.stringify(got)} ≠ ${JSON.stringify(want)}`);
    if (s.step.docString) {
      const code = item.children?.find((c) => c.type === 'code');
      const lang = (s.step.docString.mediaType ?? '').replace(/[^A-Za-z0-9+.#-]/g, '') || 'text';
      if (!code || code.value !== s.step.docString.content || (code.lang ?? null) !== lang) {
        problems.push(`step ${i}: DocString did not round-trip (${JSON.stringify(code)})`);
      }
    }
    if (s.step.dataTable && !item.children?.some((c) => c.type === 'table')) {
      problems.push(`step ${i}: DataTable is not nested in its list item`);
    }
  });

  // Table cells (DataTables + Examples), in document order.
  const tables: Node[] = [];
  walk(tree, (n) => {
    if (n.type === 'table') tables.push(n);
  });
  if (tables.length !== exp.tables.length) {
    problems.push(`table count ${tables.length} ≠ ${exp.tables.length}`);
  }
  exp.tables.forEach((rows, t) => {
    const got = (tables[t]?.children ?? []).map((r) => (r.children ?? []).map((c) => foldQuotes(toText(c))));
    const want = rows.map((r) =>
      r.cells.map((c) => foldQuotes(smartText('tableCell', [{ type: 'text', value: c.value }]))),
    );
    if (JSON.stringify(got) !== JSON.stringify(want)) {
      problems.push(`table ${t}: ${JSON.stringify(got)} ≠ ${JSON.stringify(want)}`);
    }
  });
  return problems;
}

// ===========================================================================
// 1. Golden fixtures
// ===========================================================================

describe('renderFeatureBody — golden fixtures', () => {
  it('has the expected fixture set (one per construct)', () => {
    expect(goldenNames).toEqual([
      'background',
      'book-consignment',
      'datatable',
      'docstring',
      'i18n-nl',
      'no-scenarios',
      'outline-examples',
      'rule-background',
      'scenarios-before-rule',
    ]);
  });

  it.each(goldenNames)('%s renders byte-for-byte', (name) => {
    const source = readFileSync(path.join(FIXTURES, `${name}.feature`), 'utf8');
    const expected = readFileSync(path.join(FIXTURES, `${name}.md`), 'utf8');
    const { body, warnings } = render(source, `${name}.feature`);
    expect(body).toBe(expected);
    expect(warnings).toEqual([]);
  });

  it('the worked example fixture is the plan example body (sanity: starts at the H1, one trailing newline)', () => {
    const body = readFileSync(path.join(FIXTURES, 'book-consignment.md'), 'utf8');
    expect(body.startsWith('# Book a consignment\n\n')).toBe(true);
    expect(body.endsWith('\n')).toBe(true);
    expect(body.endsWith('\n\n')).toBe(false);
    expect(body).toContain('*2 rules · 4 scenarios · 2 example rows*');
  });

  it('every golden output ends with exactly one newline and has no double blank line', () => {
    for (const name of goldenNames) {
      const body = readFileSync(path.join(FIXTURES, `${name}.md`), 'utf8');
      expect(body, name).toMatch(/[^\n]\n$/);
      expect(body, name).not.toMatch(/\n\n\n/);
    }
  });
});

// ===========================================================================
// 2. Structure details not pinned by a golden
// ===========================================================================

describe('renderFeatureBody — structure', () => {
  it('returns "" for a document without a Feature', () => {
    expect(render('# just a comment\n').body).toBe('');
  });

  it('summary line: singular forms, zero parts omitted (scenarios always shown)', () => {
    const { body } = render(
      [
        'Feature: F',
        '  Rule: R',
        '    Scenario Outline: O',
        '      Given <x>',
        '      Examples:',
        '        | x |',
        '        | 1 |',
      ].join('\n'),
    );
    expect(body).toContain('\n*1 rule · 1 scenario · 1 example row*\n');
    expect(render('Feature: F\n  Scenario: A\n    Given a\n').body).toContain('\n*1 scenario*\n');
  });

  it('an unnamed Feature/Scenario falls back to the bare keyword', () => {
    const { body } = render('Feature:\n  Scenario:\n    Given a\n');
    expect(body.split('\n')[0]).toBe('# Feature');
    expect(body).toContain('\n## Scenario\n');
  });

  it('scenario tags are de-duplicated and code-unit sorted', () => {
    const { body } = render('Feature: F\n  @smoke @FR-003 @smoke @a\n  Scenario: S\n    Given a\n');
    expect(body).toContain('\n`@FR-003` `@a` `@smoke`\n');
  });

  it('collapses runs of blank lines in descriptions (MD012)', () => {
    const { body } = render('Feature: F\n  One.\n\n\n\n  Two.\n  Scenario: S\n    Given a\n');
    expect(body).toContain('One.\n\nTwo.');
    expect(body).not.toMatch(/\n\n\n/);
  });

  it('a step argument on the last step of a section is followed by one blank line only', () => {
    const { body } = render('Feature: F\n  Scenario: S\n    Given a\n      | x |\n  Scenario: T\n    Given b\n');
    expect(body).toContain('- **Given** a\n\n  | x |\n  | --- |\n\n## Scenario: T\n');
  });

  it('placeholders are inline code only in an outline; elsewhere they are escaped prose', () => {
    expect(render('Feature: F\n  Scenario: S\n    Given a <b> c\n').body).toContain(
      '- **Given** a &lt;b&gt; c\n',
    );
  });

  it('a Gherkin cell newline (\\n escape) becomes <br>', () => {
    expect(render('Feature: F\n  Scenario: S\n    Given a\n      | x\\ny |\n').body).toContain(
      '  | x<br>y |\n',
    );
  });
});

// ===========================================================================
// 3. Duplicate scenario names (03 §5)
// ===========================================================================

describe('renderFeatureBody — duplicate scenario warnings', () => {
  it('warns on a duplicate sibling scenario, naming both lines', () => {
    const { warnings } = render(
      ['Feature: F', '  Scenario: Same', '    Given a', '  Scenario: Same', '    Given b'].join('\n'),
      'features/f.feature',
    );
    expect(warnings).toEqual([
      '[dk-gherkin] features/f.feature:4 duplicate scenario name "Same" (also at line 2) — markdownlint MD024 will reject the duplicate heading',
    ]);
  });

  it('warns within a Rule, but not for the same name under different Rules', () => {
    const { warnings } = render(
      [
        'Feature: F',
        '  Rule: A',
        '    Scenario: Same',
        '      Given a',
        '  Rule: B',
        '    Scenario: Same',
        '      Given a',
        '    Scenario: Same',
        '      Given a',
      ].join('\n'),
      'f.feature',
    );
    expect(warnings).toHaveLength(1);
    expect(warnings[0]).toContain('f.feature:8 duplicate scenario name "Same" (also at line 6)');
  });

  it('defaults: no warn sink is fine', () => {
    const doc = parseGherkin('Feature: F\n  Scenario: S\n    Given a\n  Scenario: S\n    Given a\n');
    expect(() => renderFeatureBody(doc)).not.toThrow();
  });
});

// ===========================================================================
// 4. Escapers (per character class)
// ===========================================================================

describe('escapers', () => {
  it('escapeInline backslashes emphasis/code/link/strikethrough/attribute syntax', () => {
    expect(escapeInline('\\ ` * _ [ ] { } ~')).toBe('\\\\ \\` \\* \\_ \\[ \\] \\{ \\} \\~');
  });

  it('escapeInline entity-encodes < > &', () => {
    expect(escapeInline('<b> & </b>')).toBe('&lt;b&gt; &amp; &lt;/b&gt;');
    expect(escapeInline('&amp;')).toBe('&amp;amp;');
  });

  it('escapeInline breaks text directives (":name" fires even without a label)', () => {
    expect(escapeInline('Note:term[x] 10:30 :é a: b https://x :-) x:')).toBe(
      `Note\\:term\\[x\\] 10\\:30 \\:é a: b https${AUTOLINK_BREAK}://x :-) x:`,
    );
  });

  it('escapeInline leaves pipes, quotes and plain punctuation alone', () => {
    expect(escapeInline('a | "b" \'c\' -- d... #e !f')).toBe('a | "b" \'c\' -- d... #e !f');
  });

  it('escapeCell also escapes pipes', () => {
    expect(escapeCell('a | b')).toBe('a \\| b');
    expect(escapeCell('a\\|b')).toBe('a\\\\\\|b');
  });

  it('escapeHeading backslashes a leading block marker and a closing # run', () => {
    expect(escapeHeading('# a')).toBe('\\# a');
    expect(escapeHeading('> a')).toBe('&gt; a'); // already inert as an entity
    expect(escapeHeading('- a')).toBe('\\- a');
    expect(escapeHeading('+ a')).toBe('\\+ a');
    expect(escapeHeading('1. a')).toBe('1\\. a');
    expect(escapeHeading('12) a')).toBe('12\\) a');
    expect(escapeHeading('a #')).toBe('a \\#');
    expect(escapeHeading('a ##')).toBe('a \\##');
    expect(escapeHeading('C#')).toBe('C#');
    expect(escapeHeading('plain')).toBe('plain');
  });

  it('fenceFor is max(3, longest backtick run + 1)', () => {
    expect(fenceFor('')).toBe('```');
    expect(fenceFor('a `b` c')).toBe('```');
    expect(fenceFor('``')).toBe('```');
    expect(fenceFor('```')).toBe('````');
    expect(fenceFor('x ````` y ``')).toBe('``````');
  });
});

// ===========================================================================
// 5. Round-trip through the build's remark stack
// ===========================================================================

describe.each([
  ['markua off', false],
  ['markua on', true],
] as const)('round-trip through the build remark stack (%s)', (_label, markua) => {
  it.each(goldenNames)('%s', (name) => {
    const source = readFileSync(path.join(FIXTURES, `${name}.feature`), 'utf8');
    const doc = parseGherkin(source);
    const body = renderFeatureBody(doc, { file: name });
    expect(roundTripProblems(doc, body, markua)).toEqual([]);
  });

  it('golden outputs contain no link nodes at all', () => {
    for (const name of goldenNames) {
      const tree = parseMarkdown(readFileSync(path.join(FIXTURES, `${name}.md`), 'utf8'), markua);
      const links: Node[] = [];
      walk(tree, (n) => {
        if (n.type === 'link') links.push(n);
      });
      expect(links, name).toEqual([]);
    }
  });

  it('the round-trip check is not vacuous: an unescaped render is caught', () => {
    const doc = parseGherkin('Feature: F\n  Scenario: S\n    Given *a* <b> Note:x\n');
    const bad = '# F\n\n## Scenario: S\n\n- **Given** *a* <b> Note:x\n';
    const problems = roundTripProblems(doc, bad, markua);
    expect(problems.some((p) => p.startsWith('html node'))).toBe(true);
    expect(problems.some((p) => p.startsWith('textDirective'))).toBe(true);
    expect(problems.some((p) => p.startsWith('step 0'))).toBe(true);
  });
});

// ===========================================================================
// 6. Property test: random printable strings
// ===========================================================================

/** mulberry32 — a tiny seeded PRNG, so the property run is deterministic. */
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const PUNCT = '!"#$%&\'()*+,-./:;<=>?@[\\]^_`{|}~';
const ALNUM = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
/** Multi-char tokens that assemble GFM autolink literals (`www.x.y`, `https://…`, `a@b.cd`). */
const AUTOLINK_TOKENS = ['www.', 'WwW.', 'http://', 'HTTPS://', 'x.y', '.com', 'a@', '@b.cd', 'mailto:', 'a.b@c.de'];
const PROPERTY_RUNS = 500;

function randomPrintable(rand: () => number): string {
  const len = 1 + Math.floor(rand() * 24);
  let s = '';
  for (let i = 0; i < len; i += 1) {
    const r = rand();
    // ~47% ASCII punctuation, ~8% autolink-literal tokens, ~25% alphanumerics,
    // ~15% space, ~5% non-ASCII.
    if (r < 0.08) s += AUTOLINK_TOKENS[Math.floor(rand() * AUTOLINK_TOKENS.length)];
    else if (r < 0.55) s += PUNCT[Math.floor(rand() * PUNCT.length)];
    else if (r < 0.8) s += ALNUM[Math.floor(rand() * ALNUM.length)];
    else if (r < 0.95) s += ' ';
    else s += 'éß€✓'[Math.floor(rand() * 4)];
  }
  const trimmed = s.trim();
  return trimmed === '' ? 'x' : trimmed;
}

/** A Gherkin table-cell source token for a literal value (`\\`, `\|` escapes). */
function cellSource(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/\|/g, '\\|');
}

describe('property: random printable strings round-trip', () => {
  const rand = mulberry32(0x5eed_0044);
  const cases = Array.from({ length: PROPERTY_RUNS }, (_, i) => ({
    i,
    featureName: randomPrintable(rand),
    scenarioName: randomPrintable(rand),
    step: randomPrintable(rand),
    cell: randomPrintable(rand),
    outline: i % 2 === 1,
  }));

  it.each([false, true])(`%s markua: ${PROPERTY_RUNS} random strings survive render → parse`, (markua) => {
    const failures: string[] = [];
    for (const c of cases) {
      const source = [
        `Feature: ${c.featureName}`,
        `  Scenario${c.outline ? ' Outline' : ''}: ${c.scenarioName}`,
        `    Given ${c.step}`,
        `      | ${cellSource(c.cell)} |`,
        `      | ${cellSource(c.step)} |`,
        ...(c.outline ? ['    Examples:', '      | x |', `      | ${cellSource(c.cell)} |`] : []),
        '',
      ].join('\n');
      const doc = parseGherkin(source);
      // The fixture itself must have kept the strings literally.
      const scenario = doc.feature?.children[0]?.scenario;
      if (scenario?.steps[0]?.text !== c.step || doc.feature?.name !== c.featureName) {
        failures.push(`case ${c.i}: Gherkin fixture did not preserve the strings`);
        continue;
      }
      const body = renderFeatureBody(doc, { file: `case-${c.i}` });
      for (const p of roundTripProblems(doc, body, markua)) {
        failures.push(`case ${c.i} ${JSON.stringify(c)}: ${p}`);
      }
    }
    expect(failures.slice(0, 10)).toEqual([]);
  });
});

// ===========================================================================
// 7. markdownlint on the golden outputs
// ===========================================================================

describe('markdownlint (repo .markdownlint.jsonc) on golden outputs', () => {
  it('reports 0 issues', () => {
    const bin = path.join(REPO_ROOT, 'node_modules/.bin/markdownlint-cli2');
    const files = goldenNames.map((n) =>
      path.relative(REPO_ROOT, path.join(FIXTURES, `${n}.md`)).split(path.sep).join('/'),
    );
    const run = spawnSync(
      bin,
      [...files.map((f) => `:${f}`), '--config', '.markdownlint.jsonc'],
      { cwd: REPO_ROOT, encoding: 'utf8' },
    );
    const output = `${run.stdout ?? ''}${run.stderr ?? ''}`;
    const status = run.status;
    // Non-vacuity: every golden output was actually linted.
    expect(output).toMatch(new RegExp(`Linting: ${files.length} files?\\b`));
    expect(status, output).toBe(0);
    expect(output).toMatch(/Summary: 0 issues?\b/);
  }, 60_000);
});

// ===========================================================================
// 9. GFM autolink literals stay literal text (review #9)
// ===========================================================================

describe('GFM autolink literals are neutralised', () => {
  const SAMPLES = [
    'see https://x.y/z for details',
    'HTTP://EXAMPLE.COM',
    'visit www.foo.com today',
    'WWW.FOO.COM',
    'mail a@b.com or first.last+tag@sub.example.org',
    'mailto:x@y.zz',
    '(www.a.bc)',
  ];

  it.each(SAMPLES)('%j: no link node, text content round-trips (both stacks)', (sample) => {
    for (const markua of [false, true]) {
      for (const [wrap, unwrap] of [
        [(t: string) => t, 'paragraph'],
        [(t: string) => `| ${t} |\n| --- |`, 'tableCell'],
        [(t: string) => `## ${t}`, 'heading'],
      ] as const) {
        const escaped = unwrap === 'tableCell' ? escapeCell(sample) : unwrap === 'heading' ? escapeHeading(sample) : escapeInline(sample);
        const tree = parseMarkdown(wrap(escaped), markua);
        const found: string[] = [];
        let target: Node | undefined;
        walk(tree, (n) => {
          if (n.type === 'link') found.push(`link ${n.url}`);
          if (n.type === 'html' && n.value !== AUTOLINK_BREAK) found.push(`html ${n.value}`);
          if (!target && n.type === unwrap) target = n;
        });
        expect(found, `${unwrap} ${markua}`).toEqual([]);
        expect(toText(target as Node), `${unwrap} ${markua}`).toBe(
          smartText(unwrap, [{ type: 'text', value: sample }]),
        );
      }
    }
  });

  it('a rendered step with a URL, a www host and an email produces no link node', () => {
    const doc = parseGherkin(
      'Feature: Links at https://f.example\n  Scenario: Mail a@b.co\n    Given I open www.foo.com\n      | https://x.y |\n',
    );
    const body = renderFeatureBody(doc);
    expect(roundTripProblems(doc, body, false)).toEqual([]);
    expect(roundTripProblems(doc, body, true)).toEqual([]);
  });
});
