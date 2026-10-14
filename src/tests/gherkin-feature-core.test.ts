/**
 * Gherkin feature pages — tag → frontmatter metadata core (ADR-0046, WP03).
 *
 * Pins the normative mapping contract §2 (metadata tags) and §3 (frontmatter)
 * against `lib/gherkin/feature-core.mjs`:
 *
 *   - one table row per §2 tag row, asserted through the serialised block;
 *   - status precedence (`@dk:status` > `@wip` > `@deprecated` > `active`);
 *   - description derivation rules 1–6, incl. the 180/181/200-char boundaries;
 *   - ADR resolution hit/miss and the registry-derived mission prefix;
 *   - the fixed §3 key order (the worked example's page and hub frontmatter
 *     are pinned byte-for-byte by the generator goldens in
 *     `gherkin-generate.test.ts`, which drive this core through the planner);
 *   - an import-scan purity guard (feature-core imports only the allow-list,
 *     text.mjs imports nothing), in the style of `vocabulary-single-source`.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import matter from 'gray-matter';
import {
  GENERATED_BY,
  DEFAULT_GUIDANCE_TEXT,
  buildFrontmatter,
  deriveDescription,
  extractNarrative,
  missionPrefix,
  parseMetadataTags,
  resolveAdrRef,
  serializeFrontmatter,
  truncateDescription,
} from '../lib/gherkin/feature-core.mjs';
import { loadSectionRegistry } from '../lib/vocabulary-loader.mjs';

const SRC_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const EXAMPLE_DOCS = path.resolve(SRC_ROOT, '..', 'example', 'docs');
const FILE = 'features/x.feature';
const HASH = '0123456789abcdef'.repeat(4);

/** Build AST-shaped tags (`@name` at line 1, increasing columns). */
function tagsOf(...names: string[]) {
  let column = 1;
  return names.map((name) => {
    const tag = { name, location: { line: 1, column } };
    column += name.length + 1;
    return tag;
  });
}

const NARRATIVE_DESCRIPTION = [
  '  As a shipper',
  '  I want to book cargo onto a sailing',
  '  So that my goods travel on a confirmed slot',
  '',
  '  A booking reserves space on one sailing. Bookings over capacity are refused.',
].join('\n');

function render(names: string[], extra: Partial<Parameters<typeof buildFrontmatter>[0]> = {}) {
  const { fields, warnings } = buildFrontmatter({
    featureName: 'Book a consignment',
    description: NARRATIVE_DESCRIPTION,
    tags: tagsOf(...names),
    file: FILE,
    sourceResource: 'features/x.feature',
    hash: HASH,
    missionPrefix: 'plans/missions',
    adrFileNames: ['0001-use-astro-starlight.md', 'README.md', 'template.md'],
    ...extra,
  });
  return { fields, warnings, yaml: serializeFrontmatter(fields) };
}

// ---------------------------------------------------------------------------
// §2 — one row per tag row of the contract table
// ---------------------------------------------------------------------------

describe('§2 metadata tags — one case per contract row', () => {
  const NARRATIVE = 'As a shipper, I want to book cargo onto a sailing, so that my goods travel on a confirmed slot.';
  const rows: Array<{ row: string; tags: string[]; present: string[]; absent?: string[] }> = [
    { row: '@dk:context', tags: ['@dk:context=shipping'], present: ['glossary_context: "shipping"'] },
    { row: '@dk:status', tags: ['@dk:status=review'], present: ['doc_status: review'] },
    {
      row: '@dk:status (non-canonical passes through)',
      tags: ['@dk:status=charter-custom'],
      present: ['doc_status: charter-custom'],
    },
    { row: '@wip', tags: ['@wip'], present: ['doc_status: draft'], absent: ['tags:'] },
    { row: '@deprecated', tags: ['@deprecated'], present: ['doc_status: deprecated'], absent: ['tags:'] },
    { row: '(none)', tags: [], present: ['doc_status: active'], absent: ['tags:', 'audience:', 'related:'] },
    {
      row: '@dk:persona (narrative → guidance_text)',
      tags: ['@dk:persona=example-persona', '@dk:persona=ops-lead'],
      present: [
        `audience:\n  - profile: "example-persona"\n    guidance_text: ${JSON.stringify(NARRATIVE)}\n` +
          `  - profile: "ops-lead"\n    guidance_text: ${JSON.stringify(NARRATIVE)}`,
      ],
    },
    {
      row: '@dk:mission',
      tags: ['@dk:mission=mission-alpha'],
      present: ['related:\n  - "plans/missions/mission-alpha"'],
    },
    {
      row: '@dk:adr (resolved)',
      tags: ['@dk:adr=0001'],
      present: ['related:\n  - "adr/0001-use-astro-starlight"'],
    },
    { row: '@dk:adr (unresolved)', tags: ['@dk:adr=42'], present: ['related:\n  - "adr/0042"'] },
    {
      row: '@dk:related',
      tags: ['@dk:related=guides/getting-started', '@dk:related=context/overview'],
      present: ['related:\n  - "context/overview"\n  - "guides/getting-started"'],
    },
    {
      row: '@dk:updated',
      tags: ['@dk:updated=2026-10-01'],
      present: ['doc_status: active\nupdated: 2026-10-01\n'],
    },
    { row: '@dk:autolink=false', tags: ['@dk:autolink=false'], present: ['glossary_autolink: false'] },
    { row: '@dk:autolink=true (no-op)', tags: ['@dk:autolink=true'], present: [], absent: ['glossary_autolink'] },
    { row: '@dk:priority', tags: ['@dk:priority=0.6'], present: ['agent:\n  priority: 0.6\n---'] },
    {
      row: 'other tags → tags (deduped, code-unit sorted)',
      tags: ['@smoke', '@FR-003', '@smoke', '@a'],
      present: ['tags: ["FR-003", "a", "smoke"]'],
    },
    {
      row: 'unknown @dk: key → nothing emitted',
      tags: ['@dk:contxt=shipping'],
      present: [],
      absent: ['glossary_context', 'contxt'],
    },
  ];

  it.each(rows)('$row', ({ tags, present, absent = [] }) => {
    const { yaml } = render(tags);
    for (const snippet of present) expect(yaml).toContain(snippet);
    for (const snippet of absent) expect(yaml).not.toContain(snippet);
  });

  it('persona without a narrative gets the fixed guidance text', () => {
    const { yaml } = render(['@dk:persona=p'], { description: '  Plain prose only.' });
    expect(yaml).toContain(`guidance_text: ${JSON.stringify(DEFAULT_GUIDANCE_TEXT)}`);
  });

  it('unknown @dk: key warns with file:line:col and a did-you-mean', () => {
    const { warnings } = parseMetadataTags(tagsOf('@smoke', '@dk:contxt=shipping'), { file: FILE });
    expect(warnings).toEqual([
      '[dk-gherkin] features/x.feature:1:8 unknown metadata tag @dk:contxt=shipping (did you mean context?)',
    ]);
    const far = parseMetadataTags(tagsOf('@dk:zzzzzzzz=1'), { file: FILE });
    expect(far.warnings[0]).toBe('[dk-gherkin] features/x.feature:1:1 unknown metadata tag @dk:zzzzzzzz=1');
  });

  it('splits on the FIRST "=" (values may contain = : / -)', () => {
    const { meta } = parseMetadataTags(tagsOf('@dk:related=a/b:c-d=e=f'), { file: FILE });
    expect(meta.related).toEqual(['a/b:c-d=e=f']);
  });

  it('multiple @dk:context warns and the first wins', () => {
    const { meta, warnings } = parseMetadataTags(tagsOf('@dk:context=shipping', '@dk:context=hr'), { file: FILE });
    expect(meta.context).toBe('shipping');
    expect(warnings).toHaveLength(1);
    expect(warnings[0]).toMatch(/^\[dk-gherkin\] features\/x\.feature:1:\d+ multiple @dk:context/);
  });

  it.each([
    ['@dk:updated=2026-13-01'],
    ['@dk:updated=2026-02-30'],
    ['@dk:updated=yesterday'],
    ['@dk:priority=1.5'],
    ['@dk:priority=-0.1'],
    ['@dk:priority=high'],
    ['@dk:autolink=maybe'],
  ])('invalid %s warns and is ignored', (tag) => {
    const { meta, warnings } = parseMetadataTags(tagsOf(tag), { file: FILE });
    expect(warnings).toHaveLength(1);
    expect(warnings[0]).toMatch(/^\[dk-gherkin\] features\/x\.feature:1:1 invalid /);
    expect(meta.updated).toBeUndefined();
    expect(meta.priority).toBeUndefined();
    expect(meta.autolink).toBeUndefined();
  });

  it('accepts priority bounds 0 and 1', () => {
    expect(parseMetadataTags(tagsOf('@dk:priority=0'), {}).meta.priority).toBe(0);
    expect(parseMetadataTags(tagsOf('@dk:priority=1'), {}).meta.priority).toBe(1);
  });

  it.each([['@dk:context'], ['@dk:persona='], ['@dk:adr']])('%s without a value warns', (tag) => {
    const { meta, warnings } = parseMetadataTags(tagsOf(tag), { file: FILE });
    expect(warnings).toHaveLength(1);
    expect(warnings[0]).toContain('has no value');
    expect(meta).toEqual({ status: 'active', personas: [], missions: [], adrs: [], related: [] });
  });

  it('never throws on junk input', () => {
    expect(() => parseMetadataTags(undefined, {})).not.toThrow();
    expect(() => parseMetadataTags([{ name: '@' }, { name: '@dk:' }, { name: '@dk:=x' }], {})).not.toThrow();
  });
});

describe('§2 status precedence', () => {
  it.each([
    [['@dk:status=review', '@wip'], 'review', false],
    [['@deprecated', '@dk:status=active'], 'active', false],
    [['@wip', '@deprecated'], 'draft', false],
    [['@deprecated', '@wip'], 'draft', false],
    [['@deprecated'], 'deprecated', false],
    [[], 'active', false],
    // Fail closed: a status tag that cannot be honoured never publishes the page.
    [['@dk:Status=draft'], 'draft', true],
    [['@dk:status='], 'draft', true],
    [['@dk:status=active', '@dk:status=draft'], 'draft', true],
    [['@dk:status=draft', '@dk:status=active'], 'draft', true],
    // An unknown but well-formed status is a custom status, not an error.
    [['@dk:status=drfat'], 'drfat', false],
  ])('%j → %s', (tags, status, treatedAsDraft) => {
    const { meta, warnings } = parseMetadataTags(tagsOf(...tags), {});
    expect(meta.status).toBe(status);
    expect(warnings.some((w) => /treated as a draft/.test(w))).toBe(treatedAsDraft);
  });

  it('@wip / @deprecated are consumed, not page tags', () => {
    expect(parseMetadataTags(tagsOf('@wip', '@deprecated', '@smoke'), {}).tags).toEqual(['smoke']);
  });

  // #123: the shorthands match exactly, as Cucumber tag filters do (a runner
  // filtering `not @wip` still runs a `@WIP` scenario). A tag that differs only
  // in letter case keeps its ordinary meaning, and the author is told.
  it.each([
    [['@WIP'], 'active', ['WIP'], '@wip'],
    [['@Wip'], 'active', ['Wip'], '@wip'],
    [['@Deprecated'], 'active', ['Deprecated'], '@deprecated'],
    [['@wip', '@WIP'], 'draft', ['WIP'], '@wip'],
  ])('%j → %s, kept as a page tag, with a "did you mean" warning', (tags, status, pageTags, shorthand) => {
    const { meta, tags: kept, warnings } = parseMetadataTags(tagsOf(...tags), { file: FILE });
    expect(meta.status).toBe(status);
    expect(kept).toEqual(pageTags);
    expect(warnings).toHaveLength(1);
    expect(warnings[0]).toContain(`${FILE}:1:`);
    expect(warnings[0]).toContain(`did you mean ${shorthand}?`);
    expect(warnings[0]).toContain('tags are case-sensitive');
  });

  it('the exact shorthands raise no warning', () => {
    expect(parseMetadataTags(tagsOf('@wip'), { file: FILE }).warnings).toEqual([]);
    expect(parseMetadataTags(tagsOf('@deprecated'), { file: FILE }).warnings).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// §3 — narrative + description
// ---------------------------------------------------------------------------

describe('extractNarrative', () => {
  it('joins with ", ", lower-cases continuation lines but keeps the pronoun I', () => {
    expect(extractNarrative(NARRATIVE_DESCRIPTION)).toBe(
      'As a shipper, I want to book cargo onto a sailing, so that my goods travel on a confirmed slot.',
    );
    expect(extractNarrative('In order to ship\nAs an operator\nI want X')).toBe(
      'In order to ship, as an operator, I want X.',
    );
  });

  it('does not double a trailing period', () => {
    expect(extractNarrative('As a user\nI want it.')).toBe('As a user, I want it.');
  });

  it('is undefined without a narrative', () => {
    expect(extractNarrative('Just prose.')).toBeUndefined();
    expect(extractNarrative(undefined)).toBeUndefined();
  });
});

describe('deriveDescription (§3 rules 1–6)', () => {
  it('drops the narrative and takes the first sentence of the rest, across line breaks', () => {
    const d = deriveDescription('F', '  As a user\n  I want x\n\n  First   sentence\n  wraps here. Second one.', {});
    expect(d).toEqual({ description: 'First sentence wraps here.', warnings: [] });
  });

  it('a "." not followed by whitespace does not end the sentence', () => {
    expect(deriveDescription('F', 'Version 1.2 ships v2.0 soon! More.', {}).description).toBe(
      'Version 1.2 ships v2.0 soon!',
    );
  });

  it('no terminator → the whole collapsed text', () => {
    expect(deriveDescription('F', '  no terminator\n  here', {}).description).toBe('no terminator here');
  });

  it('rule 5: narrative-only description uses the joined narrative', () => {
    const d = deriveDescription(
      'Init',
      '    As a developer adopting Spec Kitty\n    I want to initialise a project\n    So that I can start a mission',
      { file: FILE },
    );
    expect(d).toEqual({
      description: 'As a developer adopting Spec Kitty, I want to initialise a project, so that I can start a mission.',
      warnings: [],
    });
  });

  it.each([[''], ['   \n  '], [undefined]])('rule 6: empty description (%j) → fallback + warning', (desc) => {
    const d = deriveDescription('Book a consignment', desc, { file: FILE, location: { line: 3, column: 1 } });
    expect(d.description).toBe('Behaviour specification for Book a consignment.');
    expect(d.warnings).toHaveLength(1);
    expect(d.warnings[0]).toMatch(/^\[dk-gherkin\] features\/x\.feature:3:1 /);
  });

  it('exactly 180 chars is kept verbatim, no warning', () => {
    const text = `${'abcdefghi '.repeat(17)}abcdefghi.`;
    expect(text).toHaveLength(180);
    expect(deriveDescription('F', text, { file: FILE })).toEqual({ description: text, warnings: [] });
  });

  it('181 chars is cut at the word boundary at 179 with … and a warning', () => {
    const text = `${'abcdefghi '.repeat(18)}z`;
    expect(text).toHaveLength(181);
    const d = deriveDescription('F', text, { file: FILE });
    expect(d.description).toBe(`${'abcdefghi '.repeat(17)}abcdefghi…`);
    expect(d.description.length).toBeLessThanOrEqual(180);
    expect(d.warnings).toHaveLength(1);
    expect(d.warnings[0]).toMatch(/^\[dk-gherkin\] features\/x\.feature description is 181 chars; truncated/);
  });

  it('cuts at the LAST boundary ≤179, never mid-word', () => {
    const text = `${'a'.repeat(100)} ${'b'.repeat(100)}`;
    expect(truncateDescription(text)).toEqual({ text: `${'a'.repeat(100)}…`, truncated: true });
  });

  it('a single 200-char word is hard-cut at 179 + …', () => {
    const d = deriveDescription('F', 'w'.repeat(200), { file: FILE });
    expect(d.description).toBe(`${'w'.repeat(179)}…`);
    expect(d.description).toHaveLength(180);
    expect(d.warnings).toHaveLength(1);
  });

  it('a hard cut never splits a surrogate pair', () => {
    const { text } = truncateDescription(`${'x'.repeat(178)}${'😀'.repeat(20)}`);
    expect(text).toBe(`${'x'.repeat(178)}…`);
  });

  it('truncates the rule-5 narrative too', () => {
    const d = deriveDescription('F', `As a ${'very '.repeat(50)}user\nI want x`, { file: FILE });
    expect(d.description.endsWith('…')).toBe(true);
    expect(d.description.length).toBeLessThanOrEqual(180);
    expect(d.warnings).toHaveLength(1);
  });
});

// ---------------------------------------------------------------------------
// §2 — refs
// ---------------------------------------------------------------------------

describe('resolveAdrRef', () => {
  const files = readdirSync(path.join(EXAMPLE_DOCS, 'adr'));

  it('resolves a zero-padded number against the real example ADR listing', () => {
    expect(resolveAdrRef('0001', files)).toBe('adr/0001-use-astro-starlight');
    expect(resolveAdrRef('1', files)).toBe('adr/0001-use-astro-starlight');
    expect(resolveAdrRef(1, files)).toBe('adr/0001-use-astro-starlight');
  });

  it('miss → adr/<NNNN> unchanged (the dangling-ref gate reports it)', () => {
    expect(resolveAdrRef('42', files)).toBe('adr/0042');
    expect(resolveAdrRef('7', undefined)).toBe('adr/0007');
  });

  it('non-numeric input → adr/<input>', () => {
    expect(resolveAdrRef('0001-use-astro-starlight', files)).toBe('adr/0001-use-astro-starlight');
    expect(resolveAdrRef('foo', files)).toBe('adr/foo');
  });

  it('several matches → the code-unit-first file', () => {
    expect(resolveAdrRef('3', ['0003-b.md', '0003-a.md', '0030-x.md'])).toBe('adr/0003-a');
  });
});

describe('missionPrefix', () => {
  it('reads plans/missions from the real example registry (subtypes: missions → Mission)', () => {
    const registry = loadSectionRegistry(EXAMPLE_DOCS);
    expect(registry).not.toBeNull();
    expect(missionPrefix(registry)).toEqual({ prefix: 'plans/missions' });
    expect(missionPrefix({ sections: registry ?? [] })).toEqual({ prefix: 'plans/missions' });
  });

  it.each([[null], [undefined], [[]], [[{ id: 'plans', type: 'Plan' }]]])('none (%j) → plans + warning', (reg) => {
    const res = missionPrefix(reg);
    expect(res.prefix).toBe('plans');
    expect(res.warning).toMatch(/^\[dk-gherkin\] .*Mission/);
  });

  it('missing prefix warning surfaces only when a feature uses @dk:mission', () => {
    const none = missionPrefix(null);
    expect(render(['@dk:mission=m'], { missionPrefix: none }).warnings).toContain(none.warning);
    expect(render(['@dk:mission=m'], { missionPrefix: none }).yaml).toContain('  - "plans/m"');
    expect(render(['@smoke'], { missionPrefix: none }).warnings).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// Key order (the worked example's frontmatter and the hub frontmatter are pinned
// byte-for-byte by the generator goldens, gherkin-generate.test.ts)
// ---------------------------------------------------------------------------

describe('frontmatter key order', () => {
  it('a fully-populated page keeps the fixed §3 key order', () => {
    const { yaml } = render([
      '@dk:priority=0.6',
      '@dk:autolink=false',
      '@dk:updated=2026-10-01',
      '@dk:context=shipping',
      '@dk:related=z',
      '@dk:persona=p',
      '@FR-003',
    ]);
    const keys = yaml
      .split('\n')
      .filter((l) => /^[a-z_]+:/.test(l))
      .map((l) => l.slice(0, l.indexOf(':')));
    expect(keys).toEqual([
      'title',
      'description',
      'kind',
      'doc_status',
      'updated',
      'glossary_context',
      'glossary_autolink',
      'tags',
      'audience',
      'related',
      'sources',
      'generated',
      'agent',
    ]);
  });
});

// ---------------------------------------------------------------------------
// Purity — import-scan guard
// ---------------------------------------------------------------------------

/** Every module specifier a source file imports/re-exports/requires. */
function importSpecifiers(source: string): string[] {
  const specs: string[] = [];
  const patterns = [
    /^\s*import\s+(?:[^'"]*?\s+from\s+)?['"]([^'"]+)['"]/gm,
    /^\s*export\s+[^'"]*?\s+from\s+['"]([^'"]+)['"]/gm,
    /\bimport\(\s*['"]([^'"]+)['"]\s*\)/g,
    /\brequire\(\s*['"]([^'"]+)['"]\s*\)/g,
  ];
  for (const re of patterns) for (const m of source.matchAll(re)) specs.push(m[1]);
  return specs.sort();
}

describe('the pure gherkin modules import only their allow-list (import-scan)', () => {
  // Comments are stripped first: JSDoc `import('@cucumber/messages')` typedefs are type-only.
  const stripComments = (src: string) => src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');

  it.each([
    ['feature-core.mjs', ['../vocabulary-core.mjs', './text.mjs']],
    ['render.mjs', ['./text.mjs', './view.mjs']],
    ['view.mjs', ['../vocabulary-core.mjs', './text.mjs']],
    ['mdast.mjs', ['./view.mjs']],
    ['options.mjs', ['../vocabulary-core.mjs', './text.mjs']],
    ['parse.mjs', ['@cucumber/gherkin', '@cucumber/messages', './text.mjs']],
    ['fragment.mjs', ['@cucumber/gherkin', './parse.mjs', './text.mjs']],
    ['select.mjs', ['@cucumber/gherkin', '@cucumber/messages']],
    ['errors.mjs', ['../vocabulary-core.mjs', './text.mjs']],
    ['text.mjs', []],
  ])('%s', (file, allowed) => {
    const src = stripComments(readFileSync(path.join(SRC_ROOT, 'lib/gherkin', file), 'utf8'));
    const specs = importSpecifiers(src);
    if (allowed.length === 0) expect(specs).toEqual([]);
    else expect(specs.length).toBeGreaterThan(0);
    for (const spec of specs) expect(allowed).toContain(spec);
  });
});

// ---------------------------------------------------------------------------
// Review fixes (post-WP09)
// ---------------------------------------------------------------------------

describe('@dk:status values are validated and doc_status always serialises to a YAML string (review #1)', () => {
  // Each of these, emitted bare, is invalid YAML (`!x` tag, `[x]` flow seq,
  // `foo:` mapping, `*a` alias) or a NON-string scalar (`null`, `true`, `1e3`).
  // The next run could not read `generated.by` back, would classify the page as
  // authored and refuse to write — a permanent lockout.
  const BAD = ['!x', '[x]', 'foo:', '*a', 'null', 'true', '1e3', 'Active', '-x', 'a b'];

  it.each(BAD)('@dk:status=%s is rejected with a warning and the page is treated as a draft', (value) => {
    const plain = parseMetadataTags(tagsOf(`@dk:status=${value}`), { file: FILE });
    expect(plain.meta.status).toBe('draft');
    expect(plain.warnings).toHaveLength(1);
    expect(plain.warnings[0]).toMatch(/^\[dk-gherkin\] features\/x\.feature:1:1 invalid @dk:status=/);
    expect(plain.warnings[0]).toContain('treated as a draft');
    expect(parseMetadataTags(tagsOf(`@dk:status=${value}`, '@wip'), {}).meta.status).toBe('draft');
  });

  it.each([
    ['Draft', 'draft'],
    ['ACTIVE', 'active'],
    ['In-Review', 'in-review'],
  ])('@dk:status=%s rejected only for its case suggests @dk:status=%s', (value, lower) => {
    const { meta, warnings } = parseMetadataTags(tagsOf(`@dk:status=${value}`), { file: FILE });
    expect(meta.status).toBe('draft');
    expect(warnings).toHaveLength(1);
    expect(warnings[0]).toContain(`invalid @dk:status=${value}`);
    expect(warnings[0]).toContain(`did you mean @dk:status=${lower}?`);
  });

  it.each(['!x', 'foo:', 'TRUE', 'Null', 'a b'])(
    '@dk:status=%s (not just a case problem) gets no lower-case suggestion',
    (value) => {
      const { warnings } = parseMetadataTags(tagsOf(`@dk:status=${value}`), { file: FILE });
      expect(warnings).toHaveLength(1);
      expect(warnings[0]).not.toContain('did you mean');
    },
  );

  it.each(['review', 'charter-custom', 'in-review-2', 'durable'])('@dk:status=%s (well-formed) passes through', (value) => {
    const { meta, warnings } = parseMetadataTags(tagsOf(`@dk:status=${value}`), {});
    expect(meta.status).toBe(value);
    expect(warnings).toEqual([]);
  });

  it.each(BAD)('serializeFrontmatter quotes a non-slug doc_status (%s) so it reads back as that string', (value) => {
    const { fields } = render([]);
    const block = serializeFrontmatter({ ...fields, doc_status: value });
    const data = matter(`${block}\n`).data as Record<string, unknown>;
    expect(data.doc_status).toBe(value);
    expect((data.generated as { by: string }).by).toBe(GENERATED_BY);
  });

  it('a slug-shaped doc_status stays bare (goldens unchanged)', () => {
    const { fields } = render([]);
    expect(serializeFrontmatter({ ...fields, doc_status: 'charter-custom' })).toContain('\ndoc_status: charter-custom\n');
  });
});

describe('an unnamed Feature has ONE title fallback (review #5)', () => {
  it('title and description fall back to the trimmed keyword, with a warning naming file:line', () => {
    const { fields, warnings } = buildFrontmatter({
      featureName: '   ',
      featureKeyword: 'Functionaliteit ',
      description: undefined,
      tags: [],
      file: FILE,
      hash: HASH,
      location: { line: 3, column: 1 },
    });
    expect(fields.title).toBe('Functionaliteit');
    expect(fields.description).toBe('Behaviour specification for Functionaliteit.');
    expect(warnings).toContain('[dk-gherkin] features/x.feature:3 Feature has no name; using "Functionaliteit"');
  });

  it('defaults to "Feature" when no keyword is supplied', () => {
    const { fields } = buildFrontmatter({ featureName: '', description: 'Some text here.', tags: [], hash: HASH });
    expect(fields.title).toBe('Feature');
  });
});
