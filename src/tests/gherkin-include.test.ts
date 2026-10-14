/**
 * The `::gherkin{src scenario tags}` include directive (ADR-0051; rendering
 * contract 03 §2, §3, §4.6, §5; 05 mutation checks 3, 7, 8, 10).
 *
 *  - `resolveInclude` (`gherkin/include.mjs`): path syntax, realpath containment
 *    (a symlink out of a root and `../` traversal are refused even when the
 *    target exists), missing roots, and the `(realpath, mtimeMs, size)` memo.
 *  - The stage (`remark/gherkin-fence.ts`) on a unified run with the host's
 *    syntax (`remark-gfm`, `remark-directive`): ONE test per row of the 03 §5
 *    table, asserting the exact message; whole-file vs `scenario` vs `tags`
 *    rendering (header mode, source line, Background and Rule kept); decks;
 *    no recursion into `gherkin` doc strings.
 *  - Through `defineDocKittyIntegrations`: the normalised options reach the
 *    plugin, and with the preset off (or `fences: false`) a directive reaches
 *    Starlight's REAL `remarkDirectivesRestoration` untouched and comes back as
 *    its literal text, as before ADR-0051.
 *
 * The fixture project root is `fixtures/gherkin/include/`: `features/` is the
 * include root, `outside/` holds a file no include may read. Symlinks and the
 * memo's files are made in a temp dir at test time (a checked-in symlink would
 * not survive every checkout).
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createRequire } from 'node:module';
import { mkdirSync, mkdtempSync, rmSync, symlinkSync, utimesSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { unified } from 'unified';
import remarkParse from 'remark-parse';
import remarkGfm from 'remark-gfm';
import remarkDirective from 'remark-directive';
import gherkinFence, { type GherkinFenceOptions } from '../lib/remark/gherkin-fence.js';
import { clearIncludeMemo, resolveInclude } from '../lib/gherkin/include.mjs';
import { MAX_INCLUDE_BYTES } from '../lib/gherkin/include-path.mjs';
import { listFatal, resetFatal } from '../lib/gherkin/errors.mjs';
import { docKittyIntegrations, runSetup } from './helpers/remark-stack.js';

// Keep the glossary seam out (no `.contextive` probe of the runner's cwd) and
// stub Starlight's factory, as the other config-level suites do. Starlight's
// restoration plugin is imported from its own file below, unmocked.
vi.mock('@astrojs/starlight', () => ({
  default: (config: Record<string, unknown>) => ({ name: '@astrojs/starlight', __starlightConfig: config, hooks: {} }),
}));
vi.mock('../lib/glossary/load.js', () => ({
  isGlossaryActive: vi.fn(() => false),
  loadGlossary: vi.fn(() => ({ present: false })),
}));

const { defineDocKittyIntegrations } = await import('../lib/config.js');

const ROOT = fileURLToPath(new URL('./fixtures/gherkin/include/', import.meta.url)).replace(/[\\/]$/, '');
const ROOTS = ['features'];
const OPTS: GherkinFenceOptions = { root: ROOT, includeRoots: ROOTS };
const PAGE = 'docs/page.md';

// ---------------------------------------------------------------------------
// A unified run with the host page's syntax
// ---------------------------------------------------------------------------

interface Node {
  type: string;
  depth?: number;
  value?: string;
  url?: string;
  lang?: string | null;
  name?: string;
  children?: Node[];
  data?: Record<string, unknown>;
}

/**
 * Run the stage over `markdown` as page `PAGE` under the project root (no file
 * on disk: body line = file line), so messages name it `PAGE`.
 */
function run(markdown: string, options: GherkinFenceOptions = OPTS, frontmatter: Record<string, unknown> = {}): Node {
  const processor = unified()
    .use(remarkParse)
    .use(remarkGfm)
    .use(remarkDirective)
    .use(gherkinFence as never, { warn: () => {}, ...options });
  const tree = processor.parse(markdown);
  return processor.runSync(tree, {
    path: path.resolve(options.root ?? process.cwd(), PAGE),
    value: markdown,
    data: { astro: { frontmatter } },
  } as never) as unknown as Node;
}

/** The stage's thrown message lines (the fatal messages of the page, in order). */
function errorsOf(markdown: string, options: GherkinFenceOptions = OPTS, frontmatter = {}): string[] {
  try {
    run(markdown, options, frontmatter);
  } catch (err) {
    return (err as Error).message.split('\n');
  }
  throw new Error('expected the stage to throw');
}

const textOf = (n: Node): string => (n.type === 'text' || n.type === 'inlineCode' ? (n.value ?? '') : (n.children ?? []).map(textOf).join(''));
function findAll(n: Node, match: (n: Node) => boolean, out: Node[] = []): Node[] {
  if (match(n)) out.push(n);
  for (const c of n.children ?? []) findAll(c, match, out);
  return out;
}
const containers = (tree: Node) => findAll(tree, (n) => n.type === 'dkGherkin');
const headings = (n: Node) => findAll(n, (x) => x.type === 'heading').map((h) => `h${h.depth} ${textOf(h)}`);
const classOf = (n: Node) => (n.data?.hProperties as { className?: string[] } | undefined)?.className ?? [];
const sourceLine = (n: Node) => {
  const last = n.children?.at(-1);
  expect(last && classOf(last)).toEqual(['dk-gherkin__source']);
  return last as Node;
};

/** The page `# Guide` then the directive (line 3). */
const page = (directive: string) => ['# Guide', '', directive, ''].join('\n');
const at = `[dk-gherkin] ${PAGE}:3`;

beforeEach(() => {
  resetFatal();
  clearIncludeMemo();
});
afterEach(() => resetFatal());

// ===========================================================================
// resolveInclude
// ===========================================================================

describe('resolveInclude: syntax and containment (03 §2.2–§2.3)', () => {
  it('reads a file inside a root: absolute and POSIX root-relative path, bytes', () => {
    const r = resolveInclude('features/shipping.feature', { root: ROOT, includeRoots: ROOTS });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.relPath).toBe('features/shipping.feature');
    expect(r.absPath).toBe(path.join(ROOT, 'features', 'shipping.feature'));
    expect(r.bytes).toMatch(/^@shipping\nFeature: Book a consignment/);
  });

  it.each([
    ['a text file', 'features/nested/keep.txt'],
    ['a dotfile', '.env'],
    ['no extension', 'features/shipping'],
    ['another case', 'features/shipping.Feature'],
  ])('refuses %s (not a .feature file) before touching the filesystem', (_label, src) => {
    // A root of `.` holds every file of the project: still only Gherkin is read.
    expect(resolveInclude(src, { root: ROOT, includeRoots: ['.'] })).toEqual({ ok: false, reason: 'notFeature' });
  });

  it.each([
    ['empty', ''],
    ['blank', '   '],
    ['absolute', path.join(ROOT, 'features', 'shipping.feature')],
    ['a drive letter', 'C:/features/shipping.feature'],
    ['a URL scheme', 'file:///features/shipping.feature'],
    ['an https URL', 'https://example.com/x.feature'],
    ['backslash separators', 'features\\shipping.feature'],
    ['a NUL byte', 'features/shipping.feature\0.txt'],
  ])('refuses %s before touching the filesystem', (_label, src) => {
    expect(resolveInclude(src, { root: ROOT, includeRoots: ROOTS })).toEqual({ ok: false, reason: 'invalid' });
  });

  it('refuses `../` traversal even when the target exists', () => {
    // `outside/secret.feature` exists; the lexical path starts inside the root.
    for (const src of ['features/../outside/secret.feature', 'outside/secret.feature', '../include/outside/secret.feature']) {
      expect(resolveInclude(src, { root: ROOT, includeRoots: ROOTS }), src).toEqual({ ok: false, reason: 'outside' });
    }
  });

  it('checks the prefix at a separator boundary (features-old is not inside features)', () => {
    const dir = mkdtempSync(path.join(tmpdir(), 'dk-include-'));
    try {
      mkdirSync(path.join(dir, 'features'));
      mkdirSync(path.join(dir, 'features-old'));
      writeFileSync(path.join(dir, 'features-old', 'x.feature'), 'Feature: X\n');
      expect(resolveInclude('features-old/x.feature', { root: dir, includeRoots: ['features'] })).toEqual({
        ok: false,
        reason: 'outside',
      });
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('a missing file is notFound inside a root and outside beyond every root', () => {
    expect(resolveInclude('features/nope.feature', { root: ROOT, includeRoots: ROOTS })).toEqual({
      ok: false,
      reason: 'notFound',
    });
    // Never says whether a path outside the roots exists.
    expect(resolveInclude('outside/nope.feature', { root: ROOT, includeRoots: ROOTS })).toEqual({
      ok: false,
      reason: 'outside',
    });
  });

  it('a file over MAX_INCLUDE_BYTES is tooLarge; one at the limit is read', () => {
    const dir = mkdtempSync(path.join(tmpdir(), 'dk-include-'));
    try {
      mkdirSync(path.join(dir, 'features'));
      const at = 'Feature: X\n'.padEnd(MAX_INCLUDE_BYTES, '#');
      writeFileSync(path.join(dir, 'features', 'at.feature'), at);
      writeFileSync(path.join(dir, 'features', 'over.feature'), `${at}#`);
      const opts = { root: dir, includeRoots: ['features'] };
      expect(resolveInclude('features/over.feature', opts)).toEqual({ ok: false, reason: 'tooLarge' });
      expect(resolveInclude('features/at.feature', opts)).toMatchObject({ ok: true, bytes: at });
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('a directory is notFile', () => {
    expect(resolveInclude('features/folder.feature', { root: ROOT, includeRoots: ROOTS })).toEqual({
      ok: false,
      reason: 'notFile',
    });
  });

  it('a missing include root is rootMissing for a target under it, naming it as configured', () => {
    expect(resolveInclude('specs/a.feature', { root: ROOT, includeRoots: ['features', 'specs'] })).toEqual({
      ok: false,
      reason: 'rootMissing',
      includeRoot: 'specs',
    });
  });

  it('a missing include root is skipped for a target outside it (ADR-0051)', () => {
    const roots = { root: ROOT, includeRoots: ['specs', 'features'] };
    expect(resolveInclude('features/shipping.feature', roots)).toMatchObject({ ok: true });
    expect(resolveInclude('features/nope.feature', roots)).toEqual({ ok: false, reason: 'notFound' });
    expect(resolveInclude('outside/secret.feature', roots)).toEqual({ ok: false, reason: 'outside' });
  });
});

describe('resolveInclude: symlinks are resolved before containment (05 mutation check 3)', () => {
  let dir: string;
  beforeEach(() => {
    dir = mkdtempSync(path.join(tmpdir(), 'dk-include-'));
    mkdirSync(path.join(dir, 'features'));
    mkdirSync(path.join(dir, 'secrets'));
    writeFileSync(path.join(dir, 'secrets', 'x.feature'), 'Feature: Secret\n');
    writeFileSync(path.join(dir, 'features', 'real.feature'), 'Feature: Real\n');
  });
  afterEach(() => rmSync(dir, { recursive: true, force: true }));

  it('refuses a symlink inside a root that points outside it', () => {
    symlinkSync(path.join(dir, 'secrets', 'x.feature'), path.join(dir, 'features', 'escape.feature'));
    expect(resolveInclude('features/escape.feature', { root: dir, includeRoots: ['features'] })).toEqual({
      ok: false,
      reason: 'outside',
    });
  });

  it('refuses a symlinked directory inside a root that points outside it', () => {
    symlinkSync(path.join(dir, 'secrets'), path.join(dir, 'features', 'linked'), 'dir');
    expect(resolveInclude('features/linked/x.feature', { root: dir, includeRoots: ['features'] })).toEqual({
      ok: false,
      reason: 'outside',
    });
  });

  it('a dangling symlink out of a root is outside, as one to an existing file is (no existence oracle)', () => {
    const roots = { root: dir, includeRoots: ['features'] };
    // A file link and a directory link, each to a path outside the root that does not exist.
    symlinkSync(path.join(dir, 'secrets', 'nope.feature'), path.join(dir, 'features', 'gone.feature'));
    symlinkSync(path.join(dir, 'secrets', 'nope'), path.join(dir, 'features', 'gonedir'), 'dir');
    // A relative link, and one in a directory link that itself points outside.
    symlinkSync('../secrets/nope.feature', path.join(dir, 'features', 'rel.feature'));
    symlinkSync(path.join(dir, 'secrets'), path.join(dir, 'features', 'linked'), 'dir');
    for (const src of ['features/gone.feature', 'features/gonedir/x.feature', 'features/rel.feature', 'features/linked/nope.feature']) {
      expect(resolveInclude(src, roots), src).toEqual({ ok: false, reason: 'outside' });
    }
    // A dangling link that stays inside the root, and a plain missing file, are notFound.
    symlinkSync(path.join(dir, 'features', 'nope.feature'), path.join(dir, 'features', 'stale.feature'));
    for (const src of ['features/stale.feature', 'features/missing.feature']) {
      expect(resolveInclude(src, roots), src).toEqual({ ok: false, reason: 'notFound' });
    }
  });

  it('accepts a symlink that stays inside a root, and names the file as written', () => {
    symlinkSync(path.join(dir, 'features', 'real.feature'), path.join(dir, 'features', 'alias.feature'));
    const r = resolveInclude('features/alias.feature', { root: dir, includeRoots: ['features'] });
    expect(r.ok && r.relPath).toBe('features/alias.feature');
    expect(r.ok && r.bytes).toBe('Feature: Real\n');
  });
});

describe('resolveInclude: the dev memo is keyed on (realpath, mtimeMs, size) (05 mutation check 10)', () => {
  let dir: string;
  let file: string;
  const read = () => {
    const r = resolveInclude('features/x.feature', { root: dir, includeRoots: ['features'] });
    if (!r.ok) throw new Error(r.reason);
    return r;
  };
  beforeEach(() => {
    dir = mkdtempSync(path.join(tmpdir(), 'dk-include-'));
    mkdirSync(path.join(dir, 'features'));
    file = path.join(dir, 'features', 'x.feature');
    writeFileSync(file, 'Feature: One\n');
    utimesSync(file, 1_000, 1_000);
  });
  afterEach(() => rmSync(dir, { recursive: true, force: true }));

  it('re-reads an edited file once its mtime moves, even at the same size', () => {
    const first = read();
    expect(first.bytes).toBe('Feature: One\n');
    writeFileSync(file, 'Feature: Two\n'); // same size
    utimesSync(file, 2_000, 2_000);
    const r = read();
    expect(r.bytes).toBe('Feature: Two\n');
    expect(r.bytes).not.toBe(first.bytes);
  });

  it('serves the memo while (mtime, size) are unchanged (it is a memo)', () => {
    const first = read();
    writeFileSync(file, 'Feature: Two\n'); // same size…
    utimesSync(file, 1_000, 1_000); // …and the old mtime: indistinguishable by stat
    expect(read()).toEqual(first);
  });
});

// ===========================================================================
// The 03 §5 error table, one test per row
// ===========================================================================

describe('include errors: every 03 §5 row is fatal with its message', () => {
  it('`src` missing or empty', () => {
    expect(errorsOf(page('::gherkin{scenario="x"}'))).toEqual([`${at} ::gherkin needs src="…"`]);
    expect(errorsOf(page('::gherkin{src=""}'))).toEqual([`${at} ::gherkin needs src="…"`]);
    expect(errorsOf(page('::gherkin'))).toEqual([`${at} ::gherkin needs src="…"`]);
  });

  it('`src` not found', () => {
    expect(errorsOf(page('::gherkin{src="features/nope.feature"}'))).toEqual([
      `${at} ::gherkin src="features/nope.feature" — file not found`,
    ]);
  });

  it('`src` outside includeRoots (../ traversal to an existing file)', () => {
    expect(
      errorsOf(page('::gherkin{src="features/../outside/secret.feature"}'), { ...OPTS, includeRoots: ['features', 'features/nested'] }),
    ).toEqual([`${at} ::gherkin src="features/../outside/secret.feature" — outside gherkin.includeRoots (features, features/nested)`]);
  });

  it('`src` not a relative POSIX path', () => {
    expect(errorsOf(page('::gherkin{src="https://example.com/x.feature"}'))).toEqual([
      `${at} ::gherkin src="https://example.com/x.feature" — src must be a project-relative path with / separators ` +
        '(no leading /, drive letter, URL scheme or \\)',
    ]);
  });

  it('`src` over the include size limit', () => {
    const dir = mkdtempSync(path.join(tmpdir(), 'dk-include-'));
    try {
      mkdirSync(path.join(dir, 'features'));
      writeFileSync(path.join(dir, 'features', 'huge.feature'), 'Feature: X\n'.padEnd(MAX_INCLUDE_BYTES + 1, '#'));
      expect(errorsOf(page('::gherkin{src="features/huge.feature"}'), { root: dir, includeRoots: ['features'] })).toEqual([
        `${at} ::gherkin src="features/huge.feature" — larger than 1 MiB, the include limit`,
      ]);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('`src` not a .feature file: refused before it is read, so its contents never reach the log', () => {
    // `.` as a root holds `features/nested/keep.txt`; the parser would quote its first line.
    expect(errorsOf(page('::gherkin{src="features/nested/keep.txt"}'), { ...OPTS, includeRoots: ['.'] })).toEqual([
      `${at} ::gherkin src="features/nested/keep.txt" — src must name a .feature file`,
    ]);
  });

  it('`src` a directory', () => {
    expect(errorsOf(page('::gherkin{src="features/folder.feature"}'))).toEqual([
      `${at} ::gherkin src="features/folder.feature" — not a file`,
    ]);
  });

  it('a configured include root that does not exist: named as configured, for an include under it only', () => {
    expect(errorsOf(page('::gherkin{src="specs/a.feature"}'), { ...OPTS, includeRoots: ['features', 'specs'] })).toEqual([
      `${at} ::gherkin src="specs/a.feature" — include root not found: specs`,
    ]);
    // Another include on a site with the same stale root renders.
    const tree = run(page('::gherkin{src="features/shipping.feature"}'), { ...OPTS, includeRoots: ['specs', 'features'] });
    expect(containers(tree)).toHaveLength(1);
  });

  it('no includeRoots configured', () => {
    const want = [`${at} ::gherkin src="features/shipping.feature" — includes need gherkin.includeRoots (or gherkin.sources) — \`gherkin: true\` turns on fences only`];
    expect(errorsOf(page('::gherkin{src="features/shipping.feature"}'), { root: ROOT })).toEqual(want);
    expect(errorsOf(page('::gherkin{src="features/shipping.feature"}'), { root: ROOT, includeRoots: [] })).toEqual(want);
  });

  it('the included file fails to parse: its own path, line and column', () => {
    expect(errorsOf(page('::gherkin{src="features/broken.feature"}'))).toEqual([
      `${at} ::gherkin src="features/broken.feature" — features/broken.feature:5:7 inconsistent cell count within the table`,
    ]);
  });

  it('the included file has no Feature', () => {
    expect(errorsOf(page('::gherkin{src="features/empty.feature"}'))).toEqual([
      `${at} ::gherkin src="features/empty.feature" — features/empty.feature has no Feature`,
    ]);
  });

  it('`scenario` matches nothing — the match is exact and case-sensitive (05 mutation check 7)', () => {
    expect(errorsOf(page('::gherkin{src="features/shipping.feature" scenario="book space on a sailing"}'))).toEqual([
      `${at} ::gherkin src="features/shipping.feature" — no scenario named "book space on a sailing" in ` +
        'features/shipping.feature (scenarios: "Book space on a sailing", "Book <n> boxes", "Refund in full")',
    ]);
  });

  it('`scenario` matches several', () => {
    expect(errorsOf(page('::gherkin{src="features/dupes.feature" scenario="Same"}'))).toEqual([
      `${at} ::gherkin src="features/dupes.feature" — 2 scenarios named "Same" in features/dupes.feature (lines 2, 6)`,
    ]);
  });

  it('`tags` matches nothing', () => {
    expect(errorsOf(page('::gherkin{src="features/shipping.feature" tags="@a b"}'))).toEqual([
      `${at} ::gherkin src="features/shipping.feature" — no scenario tagged @a or @b in features/shipping.feature`,
    ]);
    expect(errorsOf(page('::gherkin{src="features/shipping.feature" tags=""}'))).toEqual([
      `${at} ::gherkin src="features/shipping.feature" — no scenario tagged (no tags given) in features/shipping.feature`,
    ]);
  });

  it('`tags` matches only an outline whose Examples have no rows: the hint says how to select it', () => {
    expect(errorsOf(page('::gherkin{src="features/outlines.feature" tags="@later"}'))).toEqual([
      `${at} ::gherkin src="features/outlines.feature" — no scenario tagged @later in features/outlines.feature; ` +
        'outline "Rowless <x>" (line 5) is tagged but its Examples have no rows, so only scenario="Rowless <x>" can select it',
    ]);
  });

  it.each([
    ['and', '@smoke and @fast'],
    ['or', '@smoke or @fast'],
    ['not', 'not @wip'],
    ['an operator word in any case', '@smoke AND @fast'],
    ['parentheses', '(@smoke)'],
  ])('`tags` with %s is a tag expression, refused before any file is read', (_label, tags) => {
    expect(errorsOf(page(`::gherkin{src="features/nope.feature" tags="${tags}"}`))).toEqual([
      `${at} ::gherkin src="features/nope.feature" — tags is a space-separated any-of list; tag expressions are not supported`,
    ]);
  });

  it('`tags` may name a tag that merely contains an operator word', () => {
    expect(errorsOf(page('::gherkin{src="features/shipping.feature" tags="@android @notify"}'))).toEqual([
      `${at} ::gherkin src="features/shipping.feature" — no scenario tagged @android or @notify in features/shipping.feature`,
    ]);
  });

  it('`scenario` and `tags` both set', () => {
    expect(errorsOf(page('::gherkin{src="features/shipping.feature" scenario="x" tags="@smoke"}'))).toEqual([
      `${at} ::gherkin src="features/shipping.feature" — use scenario="…" or tags="…", not both (allowed: src, scenario, tags)`,
    ]);
  });

  it('an unknown attribute names the allowed set', () => {
    expect(errorsOf(page('::gherkin{src="features/shipping.feature" scenarios="x" .wide}'))).toEqual([
      `${at} ::gherkin src="features/shipping.feature" — unknown attributes scenarios, class; allowed: src, scenario, tags`,
    ]);
    expect(errorsOf(page('::gherkin{src="features/shipping.feature" title="x"}'))).toEqual([
      `${at} ::gherkin src="features/shipping.feature" — unknown attribute title; allowed: src, scenario, tags`,
    ]);
  });

  it('the container form and an attempted text-form include (attributes or label) name the leaf form', () => {
    expect(errorsOf(['# Guide', '', 'See :gherkin{src="features/shipping.feature"} here.', ''].join('\n'))).toEqual([
      `${at} :gherkin is a text directive; write ::gherkin{src="…"} on a line of its own`,
    ]);
    expect(errorsOf(['# Guide', '', 'See :gherkin[the shipping feature] here.', ''].join('\n'))).toEqual([
      `${at} :gherkin is a text directive; write ::gherkin{src="…"} on a line of its own`,
    ]);
    expect(errorsOf(['# Guide', '', ':::gherkin{src="features/shipping.feature"}', 'x', ':::', ''].join('\n'))).toEqual([
      `${at} :::gherkin is a container directive; write ::gherkin{src="…"} on a line of its own`,
    ]);
  });

  it('a directive on a deck page', () => {
    expect(errorsOf(page('::gherkin{src="features/shipping.feature"}'), OPTS, { kind: 'Presentation' })).toEqual([
      `${at} ::gherkin src="features/shipping.feature" — ::gherkin is not supported in decks`,
    ]);
  });

  it('reports every broken include on the page, in source order, and records them in the sink', () => {
    const md = [
      '# Guide',
      '',
      '::gherkin{src="features/nope.feature"}',
      '',
      '```gherkin',
      'Feature: Fine',
      '  Scenario: S',
      '    Given a step',
      '```',
      '',
      '- ::gherkin{src="features/shipping.feature" scenario="Missing"}',
      '',
    ].join('\n');
    const want = [
      `${at} ::gherkin src="features/nope.feature" — file not found`,
      `[dk-gherkin] ${PAGE}:11 ::gherkin src="features/shipping.feature" — no scenario named "Missing" in ` +
        'features/shipping.feature (scenarios: "Book space on a sailing", "Book <n> boxes", "Refund in full")',
    ];
    expect(errorsOf(md)).toEqual(want);
    expect(listFatal()).toEqual([{ page: PAGE, messages: want }]);
  });

  it('a `::gherkin` inside a code fence is text: never expanded or reported', () => {
    const tree = run(['# Guide', '', '```md', '::gherkin{src="nope"}', '```', ''].join('\n'));
    expect(containers(tree)).toHaveLength(0);
    expect(findAll(tree, (n) => n.type === 'code')[0].value).toBe('::gherkin{src="nope"}');
  });
});

// ===========================================================================
// Rendering (03 §2.4–§2.6, §4.6)
// ===========================================================================

describe('include rendering', () => {
  it('a whole file: full header (title, tags, narrative, description, summary) and `Source: <path>`', () => {
    const tree = run(page('::gherkin{src="features/shipping.feature"}'));
    const [block] = containers(tree);
    expect(tree.children?.[1]).toBe(block); // replaced in place
    expect(headings(block)).toEqual([
      'h2 Book a consignment',
      'h3 Background',
      'h3 Scenario: Book space on a sailing',
      'h3 Scenario Outline: Book <n> boxes',
      'h3 Rule: Refunds',
      'h4 Background',
      'h4 Scenario: Refund in full',
    ]);
    const text = textOf(block);
    expect(text).toContain('@shipping');
    expect(text).toContain('As a shipper');
    expect(text).toContain('Bookings are confirmed against free capacity.');
    expect(text).toContain('1 rule · 3 scenarios · 3 example rows');
    const source = sourceLine(block);
    expect(source.children?.map((c) => c.type)).toEqual(['text', 'inlineCode']);
    expect(textOf(source)).toBe('Source: features/shipping.feature');
  });

  it('`scenario`: no header, the Feature Background kept, `From <title>, <path>`', () => {
    const [block] = containers(run(page('::gherkin{src="features/shipping.feature" scenario="Book space on a sailing"}')));
    expect(headings(block)).toEqual(['h2 Background', 'h2 Scenario: Book space on a sailing']);
    expect(textOf(block)).not.toContain('As a shipper');
    expect(textOf(block)).not.toContain('example rows');
    expect(textOf(sourceLine(block))).toBe('From Book a consignment, features/shipping.feature');
  });

  it('`scenario` inside a Rule keeps the Rule heading and its Background', () => {
    const [block] = containers(run(page('::gherkin{src="features/shipping.feature" scenario="Refund in full"}')));
    expect(headings(block)).toEqual(['h2 Background', 'h2 Rule: Refunds', 'h3 Background', 'h3 Scenario: Refund in full']);
  });

  it('`tags` keeps only the matching Examples block of an outline (05 mutation check 8)', () => {
    const [block] = containers(run(page('::gherkin{src="features/shipping.feature" tags="@edge"}')));
    expect(headings(block)).toEqual(['h2 Background', 'h2 Scenario Outline: Book <n> boxes']);
    const text = textOf(block);
    expect(text).toContain('Examples: Large');
    expect(text).not.toContain('Examples: Small');
    expect(textOf(sourceLine(block))).toBe('From Book a consignment, features/shipping.feature');
  });

  it('`tags` is any-of and follows inheritance (a Rule tag selects its scenarios)', () => {
    const [block] = containers(run(page('::gherkin{src="features/shipping.feature" tags="@smoke refunds"}')));
    expect(headings(block)).toEqual([
      'h2 Background',
      'h2 Scenario: Book space on a sailing',
      'h2 Rule: Refunds',
      'h3 Background',
      'h3 Scenario: Refund in full',
    ]);
  });

  it('is not recursive: a `gherkin` doc string in the included file stays a code block', () => {
    const [block] = containers(run(page('::gherkin{src="features/shipping.feature" scenario="Refund in full"}')));
    const code = findAll(block, (n) => n.type === 'code');
    expect(code).toHaveLength(1);
    expect(code[0].lang).toBe('gherkin');
    expect(code[0].value).toContain('Feature: Not included');
    expect(containers(block)).toEqual([block]);
  });

  it('links the source path to sourceUrlPrefix + the path relative to sourceRoot', () => {
    const [block] = containers(
      run(page('::gherkin{src="features/shipping.feature"}'), {
        ...OPTS,
        sourceRoot: 'features',
        sourceUrlPrefix: 'https://example.com/blob/main/',
      }),
    );
    const link = sourceLine(block).children?.[1];
    expect(link?.type).toBe('link');
    expect(link?.url).toBe('https://example.com/blob/main/shipping.feature');
    expect(textOf(link as Node)).toBe('features/shipping.feature');
  });

  it('outlines under the nearest preceding root heading, and in a container uses p[role=heading]', () => {
    const md = [
      '## Examples',
      '',
      '::gherkin{src="features/shipping.feature" scenario="Book space on a sailing"}',
      '',
      '> ::gherkin{src="features/shipping.feature" scenario="Book space on a sailing"}',
      '',
    ].join('\n');
    const [top, quoted] = containers(run(md));
    expect(headings(top)).toEqual(['h3 Background', 'h3 Scenario: Book space on a sailing']);
    expect(headings(quoted)).toEqual([]);
    const roleHeadings = findAll(quoted, (n) => (n.data?.hProperties as { role?: string } | undefined)?.role === 'heading');
    expect(roleHeadings.map((n) => [(n.data?.hProperties as { ariaLevel?: number }).ariaLevel, textOf(n)])).toEqual([
      [3, 'Background'],
      [3, 'Scenario: Book space on a sailing'],
    ]);
  });

  it('keeps a quoted step argument verbatim as inline code, as the fence does', () => {
    const [block] = containers(run(page('::gherkin{src="features/shipping.feature" scenario="Book space on a sailing"}')));
    const [given] = findAll(block, (n) => n.type === 'listItem');
    const line = given.children?.[0].children ?? [];
    expect(line.map((n) => [n.type, textOf(n)])).toEqual([
      ['strong', 'Given'],
      ['text', ' a sailing '],
      ['inlineCode', '"NLRTM to GBFXT"'],
      ['text', ' with free capacity'],
    ]);
  });

  it('drops @dk:* metadata tags silently: an included file may also feed a generated page (03 §1.5)', () => {
    const dir = mkdtempSync(path.join(tmpdir(), 'dk-include-'));
    try {
      mkdirSync(path.join(dir, 'features'));
      writeFileSync(
        path.join(dir, 'features', 'x.feature'),
        '@dk:status=draft @shown\nFeature: X\n  @dk:x=y\n  Scenario: S\n    Given a\n',
      );
      const warnings: string[] = [];
      const [block] = containers(
        run(page('::gherkin{src="features/x.feature"}'), { root: dir, includeRoots: ['features'], warn: (m) => warnings.push(m) }),
      );
      expect(warnings).toEqual([]);
      const tags = findAll(block, (n) => classOf(n).includes('dk-gherkin__tags')).map(textOf);
      expect(tags).toEqual(['@shown']);
      expect(textOf(block)).not.toContain('@dk:');
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('on a deck page a fence stays code while a directive is fatal', () => {
    const md = ['## Slide', '', '```gherkin', 'Feature: F', '  Scenario: S', '    Given a', '```', ''].join('\n');
    const tree = run(md, OPTS, { kind: 'Presentation' });
    expect(containers(tree)).toHaveLength(0);
    expect(findAll(tree, (n) => n.type === 'code')).toHaveLength(1);
  });

  it('a generated feature page is left alone, directives included', () => {
    const md = page('::gherkin{src="features/nope.feature"}');
    const tree = run(md, OPTS, { generated: { by: 'doc-kitty/gherkin' } });
    expect(containers(tree)).toHaveLength(0);
    expect(findAll(tree, (n) => n.type === 'leafDirective')).toHaveLength(1);
  });
});

// ===========================================================================
// Through the integration: options reach the plugin; preset off passes through
// ===========================================================================

type DocKittyOptions = Parameters<typeof defineDocKittyIntegrations>[0];

/** Starlight's own `remarkDirectivesRestoration`, from its source file (not mocked). */
const req = createRequire(import.meta.url);
const asides = path.join(path.dirname(req.resolve('@astrojs/starlight')), 'integrations', 'asides.ts');
const { remarkDirectivesRestoration } = (await import(pathToFileURL(asides).href)) as {
  remarkDirectivesRestoration: () => (tree: Node) => void;
};

/**
 * The remark stack a docs page gets for `options`: Astro's parse + GFM, every
 * plugin the `doc-kitty:` integrations register, then what Starlight appends
 * after them (`remark-directive`, and last its directive restoration).
 */
function runSite(markdown: string, options: Partial<DocKittyOptions>): Node {
  const remark: unknown[] = [];
  for (const entry of docKittyIntegrations(defineDocKittyIntegrations({ title: 'Docs', ...options }))) {
    if (!entry.hooks?.['astro:config:setup']) continue;
    for (const cfg of runSetup(entry)) remark.push(...(cfg.markdown?.remarkPlugins ?? []));
  }
  let processor = unified().use(remarkParse).use(remarkGfm) as unknown as {
    use: (...a: unknown[]) => typeof processor;
    parse: (m: string) => unknown;
    runSync: (t: unknown, f: unknown) => unknown;
  };
  for (const plugin of [...remark, remarkDirective, remarkDirectivesRestoration]) {
    processor = Array.isArray(plugin) ? processor.use(...plugin) : processor.use(plugin);
  }
  return processor.runSync(processor.parse(markdown), {
    path: path.resolve(PAGE),
    value: markdown,
    data: { astro: { frontmatter: {} } },
  }) as Node;
}

describe('through defineDocKittyIntegrations', () => {
  // The fixture root as the site sees it: paths relative to the runner's cwd.
  const rel = path.relative(process.cwd(), ROOT).split(path.sep).join('/');
  const directive = `::gherkin{src="${rel}/features/shipping.feature" scenario="Book space on a sailing"}`;
  const md = page(directive);

  it('the normalised includeRoots / sourceRoot / sourceUrlPrefix reach the plugin', () => {
    const tree = runSite(md, {
      gherkin: { includeRoots: [`${rel}/features`], sourceRoot: rel, sourceUrlPrefix: 'https://x/blob/' },
    });
    const [block] = containers(tree);
    const link = sourceLine(block).children?.[1];
    expect(link?.url).toBe('https://x/blob/features/shipping.feature');
    expect(textOf(sourceLine(block))).toBe(`From Book a consignment, ${rel}/features/shipping.feature`);
  });

  it('`gherkin: true` has no include roots: the directive is fatal', () => {
    expect(() => runSite(md, { gherkin: true })).toThrow(`${at} ::gherkin src="${rel}/features/shipping.feature" — includes need gherkin.includeRoots (or gherkin.sources) — \`gherkin: true\` turns on fences only`);
  });

  it('a bare `:gherkin` in prose (lang:gherkin) is not an include: restored as literal text, no error', () => {
    const prose = ['# Guide', '', 'Set the fence info string to lang:gherkin to get a structured block.', ''].join('\n');
    const on = runSite(prose, { gherkin: { includeRoots: [`${rel}/features`] } });
    expect(on).toEqual(runSite(prose, {}));
    expect(textOf(on.children?.[1] as Node)).toBe('Set the fence info string to lang:gherkin to get a structured block.');
    expect(listFatal()).toEqual([]);
  });

  it('preset off or `fences: false`: Starlight restores the directive to its literal text, as before', () => {
    const absent = runSite(md, {});
    const fencesOff = runSite(md, { gherkin: { fences: false, includeRoots: [`${rel}/features`] } });
    expect(fencesOff).toEqual(absent);
    expect(containers(absent)).toHaveLength(0);
    expect(findAll(absent, (n) => n.type === 'leafDirective')).toHaveLength(0);
    const restored = absent.children?.[1];
    expect(restored?.type).toBe('paragraph');
    expect(textOf(restored as Node)).toBe(directive);
    expect(listFatal()).toEqual([]);
  });
});
