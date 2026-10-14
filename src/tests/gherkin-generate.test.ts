/**
 * WP05 — Gherkin feature-page generator: golden output, hubs, owned-output
 * pruning and single ownership (ADR-0046; mapping contract §1, §6, §7).
 *
 * Every run writes into a fresh `mkdtemp` directory; nothing here writes into
 * the repo tree. `example/docs` is only ever READ (ADR listing + section
 * registry) — the output directory is always a temp dir.
 *
 * The golden fixture under `fixtures/gherkin/generate/` is a verbatim copy of
 * the plan's worked example (`examples/features/**` → `examples/expected/**`).
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  renameSync,
  rmSync,
  statSync,
  symlinkSync,
  unlinkSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import matter from 'gray-matter';
import { unified } from 'unified';
import remarkParse from 'remark-parse';
import remarkGfm from 'remark-gfm';
import { loadFeatures } from '../lib/gherkin/load.mjs';
import {
  DEFAULT_GHERKIN_SECTION,
  diffFeaturePages,
  generateFeaturePages,
  hubBasename,
  planFeaturePages,
  scanOutputDir,
} from '../lib/gherkin/generate.mjs';

const FIXTURE = fileURLToPath(new URL('./fixtures/gherkin/generate/', import.meta.url));
/** Site root of the worked example: `features/shipping/book-consignment.feature`. */
const GOLDEN_SITE = path.join(FIXTURE, 'site');
/** The three expected output files, relative to `<docsRoot>/behaviour`. */
const GOLDEN_EXPECTED = path.join(FIXTURE, 'expected', 'behaviour');
/** The example docs root: READ-ONLY (ADR listing + section registry). */
const EXAMPLE_DOCS = fileURLToPath(new URL('../../example/docs/', import.meta.url));

// Temp dirs created per test; torn down afterEach.
const temps: string[] = [];
afterEach(() => {
  while (temps.length > 0) {
    const dir = temps.pop();
    if (dir) rmSync(dir, { recursive: true, force: true });
  }
});

function tmp(prefix = 'dk-gherkin-gen-'): string {
  const dir = mkdtempSync(path.join(tmpdir(), prefix));
  temps.push(dir);
  return dir;
}

/** Write `files` (POSIX rel path → contents) under `root`. */
function writeTree(root: string, files: Record<string, string>): void {
  for (const [rel, text] of Object.entries(files)) {
    const abs = path.join(root, ...rel.split('/'));
    mkdirSync(path.dirname(abs), { recursive: true });
    writeFileSync(abs, text, 'utf8');
  }
}

/** Every file under `dir` as `relPath → contents`, keys in code-unit order. */
function readTree(dir: string): Record<string, string> {
  const out: Record<string, string> = {};
  if (!existsSync(dir)) return out;
  const walk = (d: string, prefix: string): void => {
    for (const name of readdirSync(d).sort()) {
      const abs = path.join(d, name);
      const rel = prefix ? `${prefix}/${name}` : name;
      if (statSync(abs).isDirectory()) walk(abs, rel);
      else out[rel] = readFileSync(abs, 'utf8');
    }
  };
  walk(dir, '');
  return out;
}

/** Files AND directories under `dir` (so a created/pruned empty dir shows up too). */
function snapshot(dir: string): Record<string, string> {
  const out: Record<string, string> = {};
  if (!existsSync(dir)) return out;
  const walk = (d: string, prefix: string): void => {
    for (const name of readdirSync(d).sort()) {
      const abs = path.join(d, name);
      const rel = prefix ? `${prefix}/${name}` : name;
      if (statSync(abs).isDirectory()) {
        out[`${rel}/`] = '<dir>';
        walk(abs, rel);
      } else {
        out[rel] = readFileSync(abs, 'utf8');
      }
    }
  };
  walk(dir, '');
  return out;
}

/** A minimal valid feature: description gives a clean first sentence, no warnings. */
function feature(name: string, opts: { tags?: string; step?: string } = {}): string {
  return [
    ...(opts.tags ? [opts.tags] : []),
    `Feature: ${name}`,
    `  ${name} is specified here.`,
    '',
    '  Scenario: It works',
    `    Given ${opts.step ?? 'a precondition'}`,
    '    Then it works',
    '',
  ].join('\n');
}

interface Site {
  /** Site root: sources resolve against it, `sources[0].resource` is relative to it. */
  root: string;
  /** `<root>/docs` (empty: no registry, no ADRs) unless overridden per run. */
  docsRoot: string;
  /** `<docsRoot>/behaviour`. */
  outDir: string;
}

/** A temp site with `files` written under its root and an empty `docs/`. */
function makeSite(files: Record<string, string>): Site {
  const root = tmp();
  writeTree(root, files);
  const docsRoot = path.join(root, 'docs');
  mkdirSync(docsRoot, { recursive: true });
  return { root, docsRoot, outDir: path.join(docsRoot, DEFAULT_GHERKIN_SECTION) };
}

type GenOpts = Partial<Parameters<typeof generateFeaturePages>[1]> & { sources?: string[] };

/** Load + generate for `site`; collects every warning (loader AND generator). */
function gen(site: Site, opts: GenOpts = {}) {
  const warnings: string[] = [];
  const warn = (msg: string): void => {
    warnings.push(msg);
  };
  const { sources = ['features'], ...rest } = opts;
  const model = loadFeatures({ sources, root: site.root, warn });
  // Like config.ts and the CLI, the configured sources are passed through too.
  const result = generateFeaturePages(model, {
    sources,
    docsRoot: site.docsRoot,
    outDir: site.outDir,
    sourceRoot: site.root,
    warn,
    ...rest,
  });
  return { result, warnings, model };
}

/** Plan only (no fs writes) for `site`. */
function plan(site: Site, opts: GenOpts = {}) {
  const warnings: string[] = [];
  const warn = (msg: string): void => {
    warnings.push(msg);
  };
  const { sources = ['features'], ...rest } = opts;
  const model = loadFeatures({ sources, root: site.root, warn });
  const out = planFeaturePages(model, {
    docsRoot: site.docsRoot,
    sourceRoot: site.root,
    warn,
    ...rest,
  });
  return { plan: out, warnings };
}

/** Capture the error thrown by `fn` (fails the test if nothing throws). */
function thrown(fn: () => unknown): Error {
  try {
    fn();
  } catch (err) {
    return err as Error;
  }
  throw new Error('expected the call to throw');
}

/** The `(href)` of every `- [title](href) — …` list item in a hub body. */
function hubLinks(contents: string): string[] {
  return [...contents.matchAll(/^- \[[^\]]*\]\(([^)]*)\) — /gm)].map((m) => m[1] as string);
}

/** Parsed frontmatter of a generated page. */
function fm(contents: string): Record<string, unknown> {
  return matter(contents).data as Record<string, unknown>;
}

function generatedAt(contents: string): string {
  return (fm(contents).generated as { at: string }).at;
}

// ---------------------------------------------------------------------------

describe('golden: the worked example (contract §1/§3/§6)', () => {
  it('generates exactly the 3 expected files, byte-identical', () => {
    const outDir = path.join(tmp(), 'behaviour');
    const warnings: string[] = [];
    const model = loadFeatures({ sources: ['features'], root: GOLDEN_SITE });
    const result = generateFeaturePages(model, {
      docsRoot: EXAMPLE_DOCS,
      outDir,
      sourceRoot: GOLDEN_SITE,
      indexBasename: ['README', 'index'],
      warn: (m) => warnings.push(m),
    });

    const expected = readTree(GOLDEN_EXPECTED);
    expect(Object.keys(expected)).toEqual([
      'README.md',
      'shipping/README.md',
      'shipping/book-consignment.md',
    ]);
    expect(readTree(outDir)).toEqual(expected);
    expect(result).toEqual({
      written: ['README.md', 'shipping/README.md', 'shipping/book-consignment.md'],
      unchanged: [],
      removed: [],
    });
    expect(warnings).toEqual([]);
  });
});

describe('rename / delete: owned-output pruning (02 "Owned output and pruning")', () => {
  it('renaming a source removes the old page, writes the new one, updates hubs, prunes empty dirs', () => {
    const site = makeSite({
      'features/shipping/book.feature': feature('Book a slot'),
      'features/billing/invoice.feature': feature('Send an invoice'),
    });
    gen(site);
    expect(Object.keys(readTree(site.outDir))).toEqual([
      'README.md',
      'billing/README.md',
      'billing/invoice.md',
      'shipping/README.md',
      'shipping/book.md',
    ]);

    // A file rename inside a directory, and a directory rename that empties `billing/`.
    renameSync(
      path.join(site.root, 'features/shipping/book.feature'),
      path.join(site.root, 'features/shipping/book-slot.feature'),
    );
    mkdirSync(path.join(site.root, 'features/invoicing'));
    renameSync(
      path.join(site.root, 'features/billing/invoice.feature'),
      path.join(site.root, 'features/invoicing/invoice.feature'),
    );
    rmSync(path.join(site.root, 'features/billing'), { recursive: true });

    const { result } = gen(site);
    expect(result.removed).toEqual(['billing/README.md', 'billing/invoice.md', 'shipping/book.md']);
    expect(result.written).toEqual([
      'README.md',
      'invoicing/README.md',
      'invoicing/invoice.md',
      'shipping/README.md',
      'shipping/book-slot.md',
    ]);
    const tree = readTree(site.outDir);
    expect(Object.keys(tree)).toEqual([
      'README.md',
      'invoicing/README.md',
      'invoicing/invoice.md',
      'shipping/README.md',
      'shipping/book-slot.md',
    ]);
    // The now-empty `billing/` directory is pruned, not left behind.
    expect(existsSync(path.join(site.outDir, 'billing'))).toBe(false);
    // Hubs follow the rename.
    expect(hubLinks(tree['README.md'] as string)).toEqual(['./invoicing/', './shipping/']);
    expect(hubLinks(tree['shipping/README.md'] as string)).toEqual(['./book-slot/']);
  });

  /** A site whose generated section (6 pages) is then left with an empty source dir. */
  function siteWithOrphanedPages(): Site {
    const site = makeSite({
      'features/shipping/book.feature': feature('Book a slot'),
      'features/a/b/deep.feature': feature('Deep one'),
    });
    gen(site);
    rmSync(path.join(site.root, 'features'), { recursive: true });
    mkdirSync(path.join(site.root, 'features')); // the source dir exists, but is empty
    return site;
  }

  it('empty sources with generated pages: stops with an actionable error and removes nothing', () => {
    const site = siteWithOrphanedPages();
    const before = snapshot(site.outDir);
    expect(Object.keys(readTree(site.outDir))).toHaveLength(6);

    let message = '';
    try {
      gen(site);
    } catch (err) {
      message = (err as Error).message;
    }
    // Every part of the FR-002 contract, in one message an adopter reads in a CI log.
    expect(message).toMatch(/^\[dk-gherkin\] /);
    expect(message).toContain('features'); // the configured source directory
    expect(message).toContain('6 generated page(s)');
    expect(message).toContain('uninitialised git submodule');
    expect(message).toContain('gherkin.allowEmpty: true');
    expect(message).toContain('--allow-empty');
    expect(message).toContain('remove the `gherkin` option');
    // Byte-for-byte untouched, directories included.
    expect(snapshot(site.outDir)).toEqual(before);
  });

  it('empty sources with allowEmpty: owned leftovers are removed, exactly one warning, no stale files kept', () => {
    const site = siteWithOrphanedPages();
    const before = Object.keys(readTree(site.outDir));

    const { result, warnings } = gen(site, { allowEmpty: true });
    expect(warnings).toHaveLength(1);
    expect(warnings[0]).toContain('no .feature files found in features;');
    expect(warnings[0]).toMatch(/^\[dk-gherkin\] no \.feature files/);
    expect(warnings[0]).toContain('6 previously generated page(s) will be removed');
    expect(result.written).toEqual([]);
    expect(result.removed).toEqual(before);
    // No stale file survives (the emptied section dir itself is pruned).
    expect(readTree(site.outDir)).toEqual({});
  });

  it('one empty source among several is not an empty source set (C-004)', () => {
    const site = makeSite({
      'a/book.feature': feature('Book a slot'),
      'b/.keep': '',
    });
    gen(site, { sources: ['a', 'b'] });
    const { result, warnings } = gen(site, { sources: ['a', 'b'] });
    // Not fatal, but the empty source is named.
    expect(warnings).toHaveLength(1);
    expect(warnings[0]).toContain('no .feature files found in b,');
    expect(result.removed).toEqual([]);
    expect(Object.keys(readTree(site.outDir)).length).toBeGreaterThan(0);
  });

  it('empty sources with no prior output: one warning, nothing created', () => {
    const site = makeSite({ 'features/.keep': '' });
    const { result, warnings } = gen(site);
    expect(warnings).toHaveLength(1);
    expect(result).toEqual({ written: [], unchanged: [], removed: [] });
    expect(existsSync(site.outDir)).toBe(false);
  });

  it('a directory holding only a dotfile is kept when its pages are pruned', () => {
    const site = makeSite({
      'features/shipping/book.feature': feature('Book a slot'),
      'features/billing/invoice.feature': feature('Send an invoice'),
    });
    gen(site);
    writeFileSync(path.join(site.outDir, 'billing', '.gitkeep'), '');
    rmSync(path.join(site.root, 'features/billing'), { recursive: true });
    const { result } = gen(site);
    expect(result.removed).toEqual(['billing/README.md', 'billing/invoice.md']);
    expect(snapshot(path.join(site.outDir, 'billing'))).toEqual({ '.gitkeep': '' });
  });
});

describe('single ownership: authored content is never clobbered (contract §7)', () => {
  const intruders: Array<[string, string, string]> = [
    ['an authored .md at the section root', 'notes.md', '---\ntitle: Notes\n---\n\n# Notes\n'],
    ['an authored .md nested in a subdir', 'shipping/extra.md', '# No frontmatter at all\n'],
    ['a non-.md file', 'shipping/diagram.png', 'not really a png'],
    [
      'a .md generated by ANOTHER generator (doc-kitty/glossary)',
      'glossary-ish.md',
      '---\ntitle: "X"\ngenerated:\n  by: "doc-kitty/glossary"\n  at: "sha256:000000000000"\n---\n',
    ],
    ['a .md whose frontmatter does not parse', 'broken.md', '---\ngenerated: [unclosed\n---\n'],
  ];

  it.each(intruders)('%s → throws naming it; NOTHING is written or deleted', (_label, rel, body) => {
    const site = makeSite({
      'features/shipping/book.feature': feature('Book a slot'),
      'features/billing/invoice.feature': feature('Send an invoice'),
    });
    gen(site);
    writeTree(site.outDir, { [rel]: body });

    // Change the sources so a successful run WOULD write (new page + hubs) and
    // delete (the stale billing pages): the throw must happen before either.
    rmSync(path.join(site.root, 'features/billing'), { recursive: true });
    writeTree(site.root, { 'features/shipping/cancel.feature': feature('Cancel a booking') });
    const before = snapshot(site.outDir);

    const err = thrown(() => gen(site));
    expect(err.message).toMatch(/^\[dk-gherkin\] refusing to write into /);
    expect(err.message).toContain(site.outDir);
    expect(err.message).toContain(`${rel} is not generated by doc-kitty/gherkin`);
    expect(snapshot(site.outDir)).toEqual(before);
  });

  // FR-004 / ADR-0048: an authored page at the generated hub's own route raises ONE error, the
  // authored-file refusal, not also the route-collision message (the build never gets that far).
  it('an authored page at the hub route raises only the authored-file error; renamed, it generates', () => {
    const site = makeSite({ 'features/shipping/book.feature': feature('Book a slot') });
    gen(site);
    writeTree(site.outDir, { 'shipping/README.md': '---\ntitle: Mine\n---\n\nHand written.\n' });
    const err = thrown(() => gen(site));
    expect(err.message).toContain('is not generated by doc-kitty/gherkin');
    expect(err.message).not.toContain('Rename or remove');
    expect(err.message).not.toContain('[dk-routes]');
    // Positive control: the authored page renamed away from the hub route, the run succeeds.
    rmSync(path.join(site.outDir, 'shipping/README.md'));
    expect(() => gen(site)).not.toThrow();
  });

  it('names EVERY authored file, in code-unit order', () => {
    const site = makeSite({ 'features/shipping/book.feature': feature('Book a slot') });
    writeTree(site.outDir, { 'b.md': '# b\n', 'a/z.txt': 'z', 'B.md': '# B\n' });
    const err = thrown(() => gen(site));
    expect(err.message).toContain('B.md, a/z.txt, b.md are not generated by doc-kitty/gherkin');
    expect(Object.keys(readTree(site.outDir))).toEqual(['B.md', 'a/z.txt', 'b.md']);
  });

  it('an authored file blocks even the empty-sources cleanup', () => {
    const site = makeSite({ 'features/shipping/book.feature': feature('Book a slot') });
    gen(site);
    writeTree(site.outDir, { 'mine.md': '# mine\n' });
    rmSync(path.join(site.root, 'features/shipping'), { recursive: true });
    const before = snapshot(site.outDir);
    expect(() => gen(site)).toThrow(/mine\.md is not generated/);
    expect(snapshot(site.outDir)).toEqual(before);
  });

  it('scanOutputDir: owned by generated.by only; dotfiles ignored; missing dir is empty', () => {
    const site = makeSite({ 'features/shipping/book.feature': feature('Book a slot') });
    gen(site);
    writeTree(site.outDir, {
      '.gitkeep': '',
      'shipping/.hidden/x.md': '# hidden\n',
      'other.md': '---\ngenerated:\n  by: "doc-kitty/glossary"\n---\n',
    });
    expect(scanOutputDir(site.outDir)).toEqual({
      owned: ['README.md', 'shipping/README.md', 'shipping/book.md'],
      authored: ['other.md'],
    });
    expect(scanOutputDir(path.join(site.root, 'nope'))).toEqual({ owned: [], authored: [] });
  });
});

describe('hub basename follows indexBasename (contract §1)', () => {
  it('hubBasename: the first configured basename, README otherwise', () => {
    expect(hubBasename(undefined)).toBe('README');
    expect(hubBasename('')).toBe('README');
    expect(hubBasename([])).toBe('README');
    expect(hubBasename('README')).toBe('README');
    expect(hubBasename('index')).toBe('index');
    expect(hubBasename(['index', 'README'])).toBe('index');
    expect(hubBasename(['README', 'index'])).toBe('README');
  });

  it("index.md hubs when indexBasename is ['index', 'README']", () => {
    const site = makeSite({ 'features/shipping/book.feature': feature('Book a slot') });
    gen(site, { indexBasename: ['index', 'README'] });
    expect(Object.keys(readTree(site.outDir))).toEqual([
      'index.md',
      'shipping/book.md',
      'shipping/index.md',
    ]);
  });

  it('switching the basename replaces the old hubs (they are owned, so they are pruned)', () => {
    const site = makeSite({ 'features/shipping/book.feature': feature('Book a slot') });
    gen(site);
    const { result } = gen(site, { indexBasename: 'index' });
    expect(result.removed).toEqual(['README.md', 'shipping/README.md']);
    expect(Object.keys(readTree(site.outDir))).toEqual([
      'index.md',
      'shipping/book.md',
      'shipping/index.md',
    ]);
  });
});

describe('nested directories: one hub per directory, direct children only (contract §6)', () => {
  it('a/b/c.feature → hubs at root, a/ and a/b/, each linking only its direct children', () => {
    const site = makeSite({ 'features/a/b/c.feature': feature('Charlie') });
    gen(site);
    const tree = readTree(site.outDir);
    expect(Object.keys(tree)).toEqual(['README.md', 'a/README.md', 'a/b/README.md', 'a/b/c.md']);
    expect(hubLinks(tree['README.md'] as string)).toEqual(['./a/']);
    expect(hubLinks(tree['a/README.md'] as string)).toEqual(['./b/']);
    expect(hubLinks(tree['a/b/README.md'] as string)).toEqual(['./c/']);
    for (const hub of ['README.md', 'a/README.md', 'a/b/README.md']) {
      const data = fm(tree[hub] as string);
      expect(data.kind, hub).toBe('Hub');
      expect(data.doc_status, hub).toBe('active');
      expect(data.generated, hub).toEqual({ by: 'doc-kitty/gherkin', at: expect.stringMatching(/^sha256:[0-9a-f]{12}$/) });
    }
    expect(fm(tree['a/README.md'] as string).title).toBe('A');
    expect(fm(tree['a/b/README.md'] as string).description).toBe('Behaviour specifications for B, generated from Gherkin feature files.');
  });

  it('a directory hub lists both feature pages and sub-directory hubs, sorted', () => {
    const site = makeSite({
      'features/a/zulu.feature': feature('Zulu'),
      'features/a/b/c.feature': feature('Charlie'),
      'features/a/alpha.feature': feature('Alpha'),
    });
    gen(site);
    expect(hubLinks(readTree(site.outDir)['a/README.md'] as string)).toEqual([
      './alpha/',
      './b/',
      './zulu/',
    ]);
  });

  it('a draft feature is generated but never listed in its hub (INV-1 draft gating)', () => {
    const site = makeSite({
      'features/a/alpha.feature': feature('Alpha'),
      'features/a/wip.feature': feature('Work in progress', { tags: '@wip' }),
      'features/a/status.feature': feature('Status draft', { tags: '@dk:status=draft' }),
    });
    gen(site);
    const tree = readTree(site.outDir);
    expect(fm(tree['a/wip.md'] as string).doc_status).toBe('draft');
    expect(fm(tree['a/status.md'] as string).doc_status).toBe('draft');
    expect(hubLinks(tree['a/README.md'] as string)).toEqual(['./alpha/']);
    expect(tree['a/README.md']).not.toContain('Work in progress');
    expect(tree['a/README.md']).not.toContain('Status draft');
  });

  it('hub generated.at changes when a child is added, not when a child only changes content', () => {
    const site = makeSite({ 'features/a/b/c.feature': feature('Charlie') });
    gen(site);
    const t0 = readTree(site.outDir);

    // Content-only change: the page is rewritten, every hub is untouched.
    writeTree(site.root, { 'features/a/b/c.feature': feature('Charlie', { step: 'a different precondition' }) });
    const edit = gen(site);
    expect(edit.result.written).toEqual(['a/b/c.md']);
    const t1 = readTree(site.outDir);
    for (const hub of ['README.md', 'a/README.md', 'a/b/README.md']) {
      expect(t1[hub], hub).toBe(t0[hub]);
    }
    expect(generatedAt(t1['a/b/c.md'] as string)).not.toBe(generatedAt(t0['a/b/c.md'] as string));

    // Add a child to a/b: only that hub's child list (and so its generated.at) changes.
    writeTree(site.root, { 'features/a/b/d.feature': feature('Delta') });
    const add = gen(site);
    expect(add.result.written).toEqual(['a/b/README.md', 'a/b/d.md']);
    const t2 = readTree(site.outDir);
    expect(generatedAt(t2['a/b/README.md'] as string)).not.toBe(
      generatedAt(t1['a/b/README.md'] as string),
    );
    expect(t2['a/README.md']).toBe(t1['a/README.md']);
    expect(t2['README.md']).toBe(t1['README.md']);
    expect(hubLinks(t2['a/b/README.md'] as string)).toEqual(['./c/', './d/']);
  });
});

describe('output collisions are build-fatal (contract §1/§7)', () => {
  it('two sources with the same relative path → throws naming both, writes nothing', () => {
    const site = makeSite({
      'src-a/shipping/book-consignment.feature': feature('Book A'),
      'src-b/shipping/book-consignment.feature': feature('Book B'),
    });
    const err = thrown(() => gen(site, { sources: ['src-a', 'src-b'] }));
    expect(err.message).toContain('[dk-gherkin] output collision');
    expect(err.message).toContain('src-a/shipping/book-consignment.feature');
    expect(err.message).toContain('src-b/shipping/book-consignment.feature');
    expect(err.message).toContain('behaviour/shipping/book-consignment.md');
    expect(existsSync(site.outDir)).toBe(false);
  });

  it('two names in ONE source that slug to the same path → throws naming both', () => {
    const site = makeSite({
      'features/shipping/Book Consignment.feature': feature('Book A'),
      'features/shipping/book-consignment.feature': feature('Book B'),
    });
    const err = thrown(() => gen(site));
    expect(err.message).toContain('[dk-gherkin] output collision');
    expect(err.message).toContain('features/shipping/Book Consignment.feature');
    expect(err.message).toContain('features/shipping/book-consignment.feature');
    expect(existsSync(site.outDir)).toBe(false);
  });

  it('two DIRECTORY names that slug alike merge, and their files still collide', () => {
    const site = makeSite({
      'features/Ship Ping/x.feature': feature('X one'),
      'features/ship-ping/x.feature': feature('X two'),
    });
    expect(() => gen(site)).toThrow(/output collision.*Ship Ping\/x\.feature.*ship-ping\/x\.feature/);
  });

  // The loader matches index basenames CASE-INSENSITIVELY (metadata.ts
  // `indexBasenamePattern`), so `readme.md` / `index.md` next to the generated
  // hub would be a second index candidate (a route collision, FR-004) — and
  // on a case-insensitive filesystem `readme.md` IS `README.md`, so the page and
  // the hub would overwrite each other on every run.
  it.each([
    ['README.feature', undefined, 'shipping/README.md'],
    ['Readme.feature', ['README', 'index'], 'shipping/README.md'],
    ['index.feature', ['README', 'index'], 'shipping/README.md'],
    ['index.feature', 'index', 'shipping/index.md'],
  ] as Array<[string, string | string[] | undefined, string]>)(
    'a feature named like an index basename (%s, indexBasename %j) collides with the hub',
    (name, indexBasename, hub) => {
      const site = makeSite({ [`features/shipping/${name}`]: feature('Index-like') });
      const err = thrown(() => gen(site, { indexBasename }));
      expect(err.message).toContain('[dk-gherkin] output collision');
      expect(err.message).toContain(`features/shipping/${name}`);
      expect(err.message).toContain(`collides with the generated hub behaviour/${hub}`);
      expect(existsSync(site.outDir)).toBe(false);
    },
  );

  // FR-006: the former "ordinary page" pin moved. `shipping/index.md` is not an index NAME on a
  // README-only site, but Starlight serves it at its folder's address, the hub's route.
  it('index.feature is rejected even when index is NOT a configured basename; another leaf generates', () => {
    const site = makeSite({ 'features/shipping/index.feature': feature('Index-like') });
    const err = thrown(() => gen(site));
    expect(err.message).toContain('[dk-gherkin] reserved output name');
    expect(err.message).toContain('features/shipping/index.feature');
    expect(err.message).toContain('Rename the feature file');
    expect(existsSync(site.outDir)).toBe(false);
    // Positive control: the same tree with another leaf generates.
    const ok = makeSite({ 'features/shipping/other.feature': feature('Other') });
    gen(ok);
    expect(Object.keys(readTree(ok.outDir))).toContain('shipping/other.md');
  });

  it('a path segment with no slug-able characters is fatal', () => {
    const site = makeSite({ 'features/!!!/x.feature': feature('X') });
    expect(() => gen(site)).toThrow(/no slug-able characters/);
  });
});

describe('sources[0].resource: sourceRoot and sourceUrlPrefix (contract §3)', () => {
  const files = { 'features/shipping/book.feature': feature('Book a slot') };
  const resourceOf = (p: Map<string, string>): unknown =>
    (fm(p.get('shipping/book.md') as string).sources as Array<{ resource: string; title: string }>)[0];

  it('defaults to the path relative to sourceRoot', () => {
    const site = makeSite(files);
    expect(resourceOf(plan(site).plan)).toEqual({
      resource: 'features/shipping/book.feature',
      title: 'Gherkin source',
    });
  });

  it('a different sourceRoot changes the relative path', () => {
    const site = makeSite(files);
    const p = plan(site, { sourceRoot: path.join(site.root, 'features') }).plan;
    expect(resourceOf(p)).toEqual({ resource: 'shipping/book.feature', title: 'Gherkin source' });
  });

  it('sourceUrlPrefix is prepended verbatim', () => {
    const site = makeSite(files);
    const p = plan(site, { sourceUrlPrefix: 'https://github.com/o/r/blob/main/' }).plan;
    expect(resourceOf(p)).toEqual({
      resource: 'https://github.com/o/r/blob/main/features/shipping/book.feature',
      title: 'Gherkin source',
    });
  });
});

describe('@dk:mission prefix comes from the section registry (contract §2)', () => {
  const files = {
    'features/shipping/book.feature': feature('Book a slot', { tags: '@dk:mission=x' }),
  };

  it('example/docs registry (plans → missions subtype) → plans/missions/x, no warning', () => {
    const site = makeSite(files);
    const { plan: p, warnings } = plan(site, { docsRoot: EXAMPLE_DOCS });
    expect(fm(p.get('shipping/book.md') as string).related).toEqual(['plans/missions/x']);
    expect(warnings).toEqual([]);
  });

  it('a docs root without a registry → plans/x plus a warning', () => {
    const site = makeSite(files);
    const { plan: p, warnings } = plan(site);
    expect(fm(p.get('shipping/book.md') as string).related).toEqual(['plans/x']);
    expect(warnings).toHaveLength(1);
    expect(warnings[0]).toMatch(/^\[dk-gherkin\] .*no Mission subtype/);
  });

  it('no @dk:mission tag → no registry warning even without a registry', () => {
    const site = makeSite({ 'features/shipping/book.feature': feature('Book a slot') });
    expect(plan(site).warnings).toEqual([]);
  });
});

describe('diffFeaturePages (the --check comparison)', () => {
  it('clean / changed / stale / added / authored', () => {
    const site = makeSite({
      'features/shipping/book.feature': feature('Book a slot'),
      'features/shipping/cancel.feature': feature('Cancel a booking'),
    });
    gen(site);
    const diff = () => diffFeaturePages(plan(site).plan, site.outDir);

    expect(diff()).toEqual({ added: [], changed: [], stale: [], authored: [] });

    // Edit a source without regenerating → its page is `changed` (hubs unaffected).
    writeTree(site.root, {
      'features/shipping/book.feature': feature('Book a slot', { step: 'an edited step' }),
    });
    expect(diff()).toEqual({ added: [], changed: ['shipping/book.md'], stale: [], authored: [] });
    gen(site);

    // An owned page with no source → `stale`.
    const owned = readFileSync(path.join(site.outDir, 'shipping/book.md'), 'utf8');
    writeFileSync(path.join(site.outDir, 'shipping/ghost.md'), owned);
    expect(diff()).toEqual({ added: [], changed: [], stale: ['shipping/ghost.md'], authored: [] });
    unlinkSync(path.join(site.outDir, 'shipping/ghost.md'));

    // A planned page missing on disk → `added`.
    unlinkSync(path.join(site.outDir, 'shipping/cancel.md'));
    expect(diff()).toEqual({ added: ['shipping/cancel.md'], changed: [], stale: [], authored: [] });
    gen(site);

    // An authored file is reported, not classified as stale.
    writeFileSync(path.join(site.outDir, 'mine.md'), '# mine\n');
    expect(diff()).toEqual({ added: [], changed: [], stale: [], authored: ['mine.md'] });
  });

  it('a missing output dir → every planned page is added', () => {
    const site = makeSite({ 'features/shipping/book.feature': feature('Book a slot') });
    expect(diffFeaturePages(plan(site).plan, site.outDir)).toEqual({
      added: ['README.md', 'shipping/README.md', 'shipping/book.md'],
      changed: [],
      stale: [],
      authored: [],
    });
  });
});

describe('section label and section id (contract §6)', () => {
  it('the registry label titles the root hub', () => {
    const site = makeSite({
      'features/shipping/book.feature': feature('Book a slot'),
      'docs/_meta/sections.yaml': [
        'version: 1',
        'sections:',
        '  - id: behaviour',
        '    label: Behaviour specs',
        '    order: 70',
        '    type: Specification',
        '',
      ].join('\n'),
    });
    const root = plan(site).plan.get('README.md') as string;
    expect(fm(root).title).toBe('Behaviour specs');
    expect(root).toContain('\n# Behaviour specs\n');
  });

  it('without a registry entry the section id is humanised; a custom section id is honoured', () => {
    const site = makeSite({ 'features/shipping/book.feature': feature('Book a slot') });
    expect(fm(plan(site).plan.get('README.md') as string).title).toBe('Behaviour');
    const custom = plan(site, { section: 'shipping-ops' }).plan.get('README.md') as string;
    expect(fm(custom).title).toBe('Shipping Ops');
  });

  it('the collision message uses the configured section id', () => {
    const site = makeSite({
      'a/x.feature': feature('X one'),
      'b/x.feature': feature('X two'),
    });
    expect(() => plan(site, { sources: ['a', 'b'], section: 'specs' })).toThrow(/both map to specs\/x\.md/);
  });
});

// ---------------------------------------------------------------------------
// Review fixes (post-WP09)
// ---------------------------------------------------------------------------

interface MdNode {
  type: string;
  value?: string;
  url?: string;
  depth?: number;
  children?: MdNode[];
}
const mdParser = unified().use(remarkParse).use(remarkGfm);
function mdTree(markdown: string): MdNode {
  return mdParser.runSync(mdParser.parse(matter(markdown).content)) as unknown as MdNode;
}
function mdWalk(node: MdNode, visit: (n: MdNode) => void): void {
  visit(node);
  for (const child of node.children ?? []) mdWalk(child, visit);
}
function mdText(node: MdNode): string {
  if (node.type === 'text' || node.type === 'inlineCode') return node.value ?? '';
  return (node.children ?? []).map(mdText).join('');
}

describe('a page is never written that the next run would refuse to own (review #1)', () => {
  it.each(['!x', '[x]', 'foo:', '*a', 'null', 'true', '1e3'])(
    '@dk:status=%s: regenerating twice succeeds and the page reads back as owned',
    (value) => {
      const site = makeSite({ 'features/shipping/book.feature': feature('Book a slot', { tags: `@dk:status=${value}` }) });
      const first = gen(site);
      expect(first.warnings.some((w) => w.includes(`invalid @dk:status=${value}`))).toBe(true);
      const page = readFileSync(path.join(site.outDir, 'shipping/book.md'), 'utf8');
      expect(fm(page).doc_status).toBe('draft');
      // Second run: before the fix this threw "refusing to write … book.md is not generated".
      expect(() => gen(site)).not.toThrow();
      expect(scanOutputDir(site.outDir).authored).toEqual([]);
    },
  );

  it('planFeaturePages re-parses every planned page and throws an internal error on a bad block', async () => {
    vi.resetModules();
    vi.doMock('../lib/gherkin/feature-core.mjs', async (importOriginal) => {
      const orig = await importOriginal<typeof import('../lib/gherkin/feature-core.mjs')>();
      return { ...orig, serializeFrontmatter: () => '---\ntitle: [unclosed\n---' };
    });
    try {
      const mod = await import('../lib/gherkin/generate.mjs');
      const site = makeSite({ 'features/shipping/book.feature': feature('Book a slot') });
      const model = loadFeatures({ sources: ['features'], root: site.root });
      expect(() => mod.planFeaturePages(model, { docsRoot: site.docsRoot, sourceRoot: site.root })).toThrow(
        /^\[dk-gherkin\] internal error: the planned page shipping\/book\.md/,
      );
    } finally {
      vi.doUnmock('../lib/gherkin/feature-core.mjs');
      vi.resetModules();
    }
  });
});

describe('route collisions the loader would hide are fatal (review #2)', () => {
  it.each([
    ['leaf first', { 'features/shipping.feature': feature('Ship it'), 'features/shipping/b.feature': feature('Bee') }, ['features']],
    ['directory first (two sources)', { 'a/shipping/b.feature': feature('Bee'), 'b/shipping.feature': feature('Ship it') }, ['a', 'b']],
    ['slug-alike names', { 'features/Shipping.feature': feature('Ship it'), 'features/shipping/b.feature': feature('Bee') }, ['features']],
  ] as Array<[string, Record<string, string>, string[]]>)(
    'a feature page and a directory hub on the same route (%s) → throws naming both sources',
    (_label, files, sources) => {
      const site = makeSite(files);
      const err = thrown(() => gen(site, { sources }));
      expect(err.message).toMatch(/^\[dk-gherkin\] route collision/);
      const [leaf] = Object.keys(files).filter((f) => !f.includes('/b.feature'));
      const [nested] = Object.keys(files).filter((f) => f.includes('/b.feature'));
      expect(err.message).toContain(leaf);
      expect(err.message).toContain(nested);
      expect(err.message).toContain('behaviour/shipping');
      expect(existsSync(site.outDir)).toBe(false);
    },
  );

  it.each(['log.feature', 'Log.feature', 'deep/LOG.feature'])('a leaf that slugs to `log` (%s) is reserved → fatal', (name) => {
    const site = makeSite({ [`features/${name}`]: feature('Change log-ish') });
    const err = thrown(() => gen(site));
    expect(err.message).toMatch(/^\[dk-gherkin\] reserved output name/);
    expect(err.message).toContain(`features/${name}`);
    expect(err.message).toContain('log.md');
    expect(existsSync(site.outDir)).toBe(false);
  });

  it('a DIRECTORY named log is fine (only the log.md leaf is excluded by the loader)', () => {
    const site = makeSite({ 'features/log/x.feature': feature('X marks') });
    expect(Object.keys(plan(site).plan)).toBeDefined();
    expect([...plan(site).plan.keys()]).toEqual(['README.md', 'log/README.md', 'log/x.md']);
  });
});

describe('a charter-only docs root drives the mission prefix and the root hub title (review #4)', () => {
  const CHARTER = [
    'charter_version: 1',
    'sections:',
    '  entries:',
    '    - id: plans',
    '      label: Plans',
    '      order: 10',
    '      type: Plan',
    '      subtypes:',
    '        - match: missions',
    '          type: Mission',
    '    - id: behaviour',
    '      label: Behaviour specs',
    '      order: 70',
    '      type: Specification',
    '',
  ].join('\n');

  it('plans/missions/<slug> refs, no registry warning, and the charter label on the root hub', () => {
    const site = makeSite({
      'features/shipping/book.feature': feature('Book a slot', { tags: '@dk:mission=m1' }),
      'docs/_meta/charter.yaml': CHARTER,
    });
    const { plan: out, warnings } = plan(site);
    expect(fm(out.get('shipping/book.md') as string).related).toEqual(['plans/missions/m1']);
    expect(warnings.filter((w) => w.includes('Mission subtype'))).toEqual([]);
    const root = out.get('README.md') as string;
    expect(fm(root).title).toBe('Behaviour specs');
    expect(root).toContain('\n# Behaviour specs\n');
  });
});

describe('hub text is escaped and titles match the sidebar (review #7)', () => {
  it.each(['<b>x<i>', '[x](evil)', 'see *this*', 'www.example.com'])(
    'a directory named %j renders as literal text in its parent hub (no html/link/emphasis)',
    async (dir) => {
      const { humaniseDirectoryName } = await import('../lib/vocabulary-core.mjs');
      const site = makeSite({ [`features/${dir}/a.feature`]: feature('Alpha') });
      const out = plan(site).plan;
      const root = out.get('README.md') as string;
      const tree = mdTree(root);
      const bad: string[] = [];
      mdWalk(tree, (n) => {
        // The only raw HTML allowed is render.mjs's inert autolink breaker.
        if (n.type === 'html' && n.value !== '<!---->') bad.push(`html ${n.value}`);
        if (n.type === 'emphasis') bad.push('emphasis');
        if (n.type === 'link' && !(n.url ?? '').startsWith('./')) bad.push(`link ${n.url}`);
      });
      expect(bad).toEqual([]);
      const item = root.split('\n').find((l) => l.startsWith('- ['));
      expect(item).toBeDefined();
      // The visible list-item text carries the raw (humanised) name twice: title + description.
      const list = tree.children?.find((n) => n.type === 'list') as MdNode;
      const text = mdText(list);
      expect(text.split(humaniseDirectoryName(dir)).length - 1).toBe(2);
    },
  );

  it('a Feature with no description: its name, used as the hub entry text, renders as literal text', () => {
    const name = '<script>alert(1)</script> :x[y] www.evil.com a@b.cd';
    const site = makeSite({
      'features/x.feature': `Feature: ${name}\n\n  Scenario: S\n    Given g\n`,
    });
    const root = plan(site).plan.get('README.md') as string;
    const tree = mdTree(root);
    const bad: string[] = [];
    mdWalk(tree, (n) => {
      if (n.type === 'html' && n.value !== '<!---->') bad.push(`html ${n.value}`);
      if (n.type === 'link' && !(n.url ?? '').startsWith('./')) bad.push(`link ${n.url}`);
    });
    expect(bad).toEqual([]);
    expect(root).not.toContain('<script>');
    // `:x[` must not survive as a text directive.
    expect(root).not.toMatch(/(?<!\\):x\[/);
    const list = tree.children?.find((n) => n.type === 'list') as MdNode;
    expect(mdText(list)).toContain(`Behaviour specification for ${name}.`);
  });

  it('the hub H1 is heading-escaped (a trailing " #" is not eaten as a closing sequence)', () => {
    const site = makeSite({ 'features/a #/x.feature': feature('X marks') });
    const hub = [...plan(site).plan].find(([k]) => k.endsWith('/README.md'))?.[1] as string;
    const h1 = (mdTree(hub).children ?? []).find((n) => n.type === 'heading' && n.depth === 1) as MdNode;
    expect(mdText(h1)).toBe('A #');
  });

  it('nested directory titles use the sidebar rule (sentence case)', async () => {
    const { humaniseDirectoryName } = await import('../lib/route-shaping.js');
    const site = makeSite({ 'features/shipping-ops/x.feature': feature('X marks') });
    const hub = plan(site).plan.get('shipping-ops/README.md') as string;
    expect(fm(hub).title).toBe('Shipping ops');
    expect(fm(hub).title).toBe(humaniseDirectoryName('shipping-ops'));
  });
});

describe('gherkin.titles sets hub titles by source directory (#125)', () => {
  const files = {
    'features/hr/leave.feature': feature('Request leave'),
    'features/shipping/edi/messages.feature': feature('Send a message'),
    'features/shipping/book.feature': feature('Book a slot'),
  };

  it('a title replaces the directory name in the hub title, H1, description and parent list line', () => {
    const site = makeSite(files);
    const { plan: out, warnings } = plan(site, { titles: { hr: 'HR', 'shipping/edi': 'EDI messages' } });
    expect(warnings).toEqual([]);
    const hr = out.get('hr/README.md') as string;
    expect(fm(hr).title).toBe('HR');
    expect(fm(hr).description).toBe('Behaviour specifications for HR, generated from Gherkin feature files.');
    expect(hr).toMatch(/^# HR$/m);
    expect(out.get('README.md')).toContain('- [HR](./hr/) — Behaviour specifications for HR, generated');
    const edi = out.get('shipping/edi/README.md') as string;
    expect(fm(edi).title).toBe('EDI messages');
    expect(out.get('shipping/README.md')).toContain('- [EDI messages](./edi/)');
    // A directory without a title keeps the sidebar rule.
    expect(fm(out.get('shipping/README.md') as string).title).toBe('Shipping');
  });

  it('a key that names no directory holding a feature warns once and changes nothing', () => {
    const site = makeSite(files);
    const titled = plan(site, { titles: { hr: 'HR', 'shipping/edl': 'EDI', marketing: 'Marketing' } });
    expect(titled.warnings).toEqual([
      '[dk-gherkin] gherkin.titles key "marketing" matches no source directory with a feature; ignored',
      '[dk-gherkin] gherkin.titles key "shipping/edl" matches no source directory with a feature; ignored',
    ]);
    const untitled = plan(site);
    expect(titled.plan.get('shipping/README.md')).toBe(untitled.plan.get('shipping/README.md'));
  });

  it('keys are source-relative directories as written, not slugs', () => {
    const site = makeSite({ 'features/Shipping Ops/x.feature': feature('X marks') });
    const { plan: out, warnings } = plan(site, { titles: { 'Shipping Ops': 'Shipping operations' } });
    expect(warnings).toEqual([]);
    expect(fm(out.get('shipping-ops/README.md') as string).title).toBe('Shipping operations');
  });
});

describe('symlinks in the output directory are never written through (review #8)', () => {
  it('a symlinked .md (even one carrying the stamp) is classified authored → fatal before any write', () => {
    const site = makeSite({ 'features/shipping/book.feature': feature('Book a slot') });
    gen(site);
    const outside = path.join(site.root, 'outside.md');
    const stamped = '---\ntitle: "x"\ngenerated:\n  by: "doc-kitty/gherkin"\n  at: "sha256:000000000000"\n---\n';
    writeFileSync(outside, stamped);
    const target = path.join(site.outDir, 'shipping/book.md');
    unlinkSync(target);
    symlinkSync(outside, target);
    expect(scanOutputDir(site.outDir).authored).toEqual(['shipping/book.md']);
    expect(() => gen(site)).toThrow(/refusing to write.*shipping\/book\.md/);
    expect(readFileSync(outside, 'utf8')).toBe(stamped);
  });

  it('a symlinked directory is authored too', () => {
    const site = makeSite({ 'features/shipping/book.feature': feature('Book a slot') });
    gen(site);
    const elsewhere = path.join(site.root, 'elsewhere');
    mkdirSync(elsewhere);
    symlinkSync(elsewhere, path.join(site.outDir, 'linked'));
    expect(scanOutputDir(site.outDir).authored).toEqual(['linked']);
  });
});

describe('a symlinked section root is never written or pruned through', () => {
  it('is fatal before any write, and the target keeps its stamped page', () => {
    const site = makeSite({ 'features/shipping/book.feature': feature('Book a slot') });
    const elsewhere = path.join(site.root, 'elsewhere');
    mkdirSync(elsewhere);
    const stamped = '---\ntitle: "x"\ngenerated:\n  by: "doc-kitty/gherkin"\n  at: "sha256:000000000000"\n---\n';
    writeFileSync(path.join(elsewhere, 'old.md'), stamped);
    symlinkSync(elsewhere, site.outDir);
    expect(() => gen(site)).toThrow(/\[dk-gherkin\].*symlink/);
    expect(readdirSync(elsewhere)).toEqual(['old.md']);
  });
});

describe('an unnamed Feature: H1, title and hub entry agree (review #5)', () => {
  it('uses the keyword for the title, the H1 and the hub link, and warns once', () => {
    const site = makeSite({
      'features/x.feature': ['Feature:', '  Unnamed but described.', '', '  Scenario: S', '    Given g', ''].join('\n'),
    });
    const { plan: out, warnings } = plan(site);
    const page = out.get('x.md') as string;
    expect(fm(page).title).toBe('Feature');
    expect(page).toContain('\n# Feature\n');
    expect(out.get('README.md')).toContain('- [Feature](./x/) — Unnamed but described.');
    expect(warnings.filter((w) => w.includes('Feature has no name'))).toEqual([
      '[dk-gherkin] features/x.feature:1 Feature has no name; using "Feature"',
    ]);
  });
});

// ---------------------------------------------------------------------------
// Final review #2: draft-only directories and sections
// ---------------------------------------------------------------------------

const REPO_ROOT = fileURLToPath(new URL('../../', import.meta.url));

/** markdownlint-cli2 with the repo config over every `.md` under `dir`. */
function markdownlint(dir: string): { status: number | null; output: string; files: number } {
  const files = Object.keys(readTree(dir)).filter((f) => f.endsWith('.md'));
  const run = spawnSync(
    path.join(REPO_ROOT, 'node_modules/.bin/markdownlint-cli2'),
    [...files.map((f) => `:${path.join(dir, ...f.split('/'))}`), '--config', '.markdownlint.jsonc'],
    { cwd: REPO_ROOT, encoding: 'utf8' },
  );
  return { status: run.status, output: `${run.stdout ?? ''}${run.stderr ?? ''}`, files: files.length };
}

function expectLintClean(dir: string): void {
  const { status, output, files } = markdownlint(dir);
  // Non-vacuity: every generated page was actually linted.
  expect(output).toMatch(new RegExp(`Linting: ${files} files?\\b`));
  expect(status, output).toBe(0);
  expect(output).toMatch(/Summary: 0 issues?\b/);
}

describe('draft-only directories and sections (final review #2, #124)', () => {
  // #124: a draft-only directory gets a hub that is itself a draft, so the
  // sidebar finds an index for its draft pages and draft gating builds the hub
  // exactly when it builds them. No published hub links it, so its name never
  // reaches a published page.
  it('a directory whose subtree holds only drafts gets a draft hub, unlinked from its parent', () => {
    const site = makeSite({
      'features/a/alpha.feature': feature('Alpha'),
      'features/a/secret-plans/one.feature': feature('One', { tags: '@wip' }),
      'features/a/secret-plans/deeper/two.feature': feature('Two', { tags: '@dk:status=draft' }),
    });
    const { result } = gen(site);
    const tree = readTree(site.outDir);
    // The draft pages are still generated, under the section …
    expect(fm(tree['a/secret-plans/one.md'] as string).doc_status).toBe('draft');
    expect(fm(tree['a/secret-plans/deeper/two.md'] as string).doc_status).toBe('draft');
    // … each draft-only directory gets a DRAFT hub with the intro and no list …
    expect(Object.keys(tree)).toEqual([
      'README.md',
      'a/README.md',
      'a/alpha.md',
      'a/secret-plans/README.md',
      'a/secret-plans/deeper/README.md',
      'a/secret-plans/deeper/two.md',
      'a/secret-plans/one.md',
    ]);
    for (const hub of ['a/secret-plans/README.md', 'a/secret-plans/deeper/README.md']) {
      const text = tree[hub] as string;
      expect(fm(text).kind, hub).toBe('Hub');
      expect(fm(text).doc_status, hub).toBe('draft');
      expect(hubLinks(text), hub).toEqual([]);
      expect(text.endsWith("\n\nBehaviour specifications generated from the repository's Gherkin feature files.\n"), hub).toBe(true);
    }
    expect(fm(tree['a/secret-plans/README.md'] as string).title).toBe('Secret plans');
    // … and no published hub names them.
    expect(fm(tree['a/README.md'] as string).doc_status).toBe('active');
    expect(fm(tree['README.md'] as string).doc_status).toBe('active');
    expect(hubLinks(tree['a/README.md'] as string)).toEqual(['./alpha/']);
    expect(tree['a/README.md']).not.toMatch(/secret/i);
    expect(tree['README.md']).not.toMatch(/secret/i);
    // Owned, so the next identical run is a no-op and nothing is authored.
    expect(scanOutputDir(site.outDir)).toEqual({ owned: Object.keys(tree), authored: [] });
    expect(result.written).toEqual(Object.keys(tree));
    expect(gen(site).result.written).toEqual([]);
    expectLintClean(site.outDir);
  });

  it('publishing a draft publishes its hub; deleting the drafts prunes the directory', () => {
    const site = makeSite({
      'features/a/alpha.feature': feature('Alpha'),
      'features/a/sub/one.feature': feature('One', { tags: '@wip' }),
    });
    gen(site);
    expect(fm(readTree(site.outDir)['a/sub/README.md'] as string).doc_status).toBe('draft');

    writeTree(site.root, { 'features/a/sub/one.feature': feature('One') });
    const publish = gen(site);
    expect(publish.result.written).toEqual(['a/README.md', 'a/sub/README.md', 'a/sub/one.md']);
    expect(hubLinks(readTree(site.outDir)['a/README.md'] as string)).toEqual(['./alpha/', './sub/']);
    expect(fm(readTree(site.outDir)['a/sub/README.md'] as string).doc_status).toBe('active');

    writeTree(site.root, { 'features/a/sub/one.feature': feature('One', { tags: '@wip' }) });
    const unpublish = gen(site);
    expect(unpublish.result.removed).toEqual([]);
    expect(unpublish.result.written).toEqual(['a/README.md', 'a/sub/README.md', 'a/sub/one.md']);
    expect(fm(readTree(site.outDir)['a/sub/README.md'] as string).doc_status).toBe('draft');
    expect(hubLinks(readTree(site.outDir)['a/README.md'] as string)).toEqual(['./alpha/']);

    unlinkSync(path.join(site.root, 'features/a/sub/one.feature'));
    const remove = gen(site);
    expect(remove.result.removed).toEqual(['a/sub/README.md', 'a/sub/one.md']);
    expect(existsSync(path.join(site.outDir, 'a/sub'))).toBe(false);
  });

  it('a section whose features are ALL drafts gets a root hub with the intro and no list', () => {
    const site = makeSite({
      'features/top.feature': feature('Top', { tags: '@wip' }),
      'features/a/one.feature': feature('One', { tags: '@wip' }),
      'features/a/b/two.feature': feature('Two', { tags: '@dk:status=draft' }),
    });
    gen(site);
    const tree = readTree(site.outDir);
    expect(Object.keys(tree)).toEqual(['README.md', 'a/README.md', 'a/b/README.md', 'a/b/two.md', 'a/one.md', 'top.md']);
    const root = tree['README.md'] as string;
    // The section root is always published, so the section keeps its landing page.
    expect(fm(root).doc_status).toBe('active');
    expect(fm(tree['a/README.md'] as string).doc_status).toBe('draft');
    expect(fm(tree['a/b/README.md'] as string).doc_status).toBe('draft');
    expect(hubLinks(root)).toEqual([]);
    expect(root.endsWith("\n\nBehaviour specifications generated from the repository's Gherkin feature files.\n")).toBe(true);
    expectLintClean(site.outDir);
  });

  it('the plan does not depend on the draft-publication setting (FR-003, risk R3)', () => {
    // Generated pages are committed and drift-checked: if the plan read
    // DK_PUBLISH_DRAFTS, a drafts-off build would rewrite committed files and the
    // --check gate would disagree with half the builds.
    const site = makeSite({
      'features/a/alpha.feature': feature('Alpha'),
      'features/b/one.feature': feature('One', { tags: '@wip' }),
    });
    const model = loadFeatures({ sources: ['features'], root: site.root });
    const plan = () => [...planFeaturePages(model, { docsRoot: site.docsRoot, sourceRoot: site.root })];
    const saved = process.env.DK_PUBLISH_DRAFTS;
    try {
      process.env.DK_PUBLISH_DRAFTS = 'on';
      const on = plan();
      process.env.DK_PUBLISH_DRAFTS = 'off';
      const off = plan();
      expect(on.map(([rel]) => rel)).toContain('b/README.md');
      expect(off).toEqual(on);
    } finally {
      if (saved === undefined) delete process.env.DK_PUBLISH_DRAFTS;
      else process.env.DK_PUBLISH_DRAFTS = saved;
    }
  });

  it('no generated hub ever ends with a blank line', () => {
    const site = makeSite({
      'features/x/one.feature': feature('One', { tags: '@wip' }),
      'features/y/two.feature': feature('Two'),
    });
    gen(site);
    for (const [rel, text] of Object.entries(readTree(site.outDir))) {
      expect(text.endsWith('\n') && !text.endsWith('\n\n'), rel).toBe(true);
    }
    expectLintClean(site.outDir);
  });
});
