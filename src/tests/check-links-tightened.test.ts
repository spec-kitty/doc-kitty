/**
 * ATDD for the #62 fail-closed tightening of check-links.mjs (link-integrity
 * -01M1PSEH, WP02 T010 — FR-005/NFR-003/NFR-004).
 *
 * Scope: `classifyInlineLink`'s strict-mode behaviour, and `isSiteRoot`'s
 * root classification (only `example/docs`-shaped roots get tightened — the
 * top-level `docs/` Common Docs root's `.md`-relative convention must be
 * completely unaffected). The base pre-existing behaviour (external/site-
 * absolute skip, `.md`/route resolution) is covered by the existing
 * `check-links.mjs` consumers (`adr-referential-integrity.test.ts`,
 * `index-basename.test.ts`, `example-adopter.test.ts`) and is intentionally
 * NOT re-asserted here.
 *
 * Since generated-page-and-link-integrity-01M4VB0N a root is checked one of two
 * ways. A non-strict root is read as files (what 0.2.0 did): a target passes
 * when it exists. With `--strict` a relative `.md`/`.mdx` link passes exactly
 * when the build would rewrite it to a published page, and the other build-only
 * checks apply. The CLI cases at the end drive both through the real entry
 * point.
 */
import { describe, it, expect, afterEach } from 'vitest';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { classifyInlineLink, isSiteRoot, SITE_ROOTS } from '../scripts/check-links.mjs';

const GATE = path.resolve(import.meta.dirname, '../scripts/check-links.mjs');

describe('isSiteRoot', () => {
  it('is true for the site-built example/docs root', () => {
    expect(isSiteRoot('example/docs')).toBe(true);
  });

  it('is true for a differently-prefixed invocation ending in the same root', () => {
    expect(isSiteRoot('/repo/example/docs')).toBe(true);
  });

  it('is true regardless of a trailing slash', () => {
    expect(isSiteRoot('example/docs/')).toBe(true);
  });

  it('is false for the plain, unbuilt Common Docs root', () => {
    expect(isSiteRoot('docs')).toBe(false);
  });

  it('SITE_ROOTS names exactly the site-built tree', () => {
    expect(SITE_ROOTS).toEqual(['example/docs']);
  });
});

describe('classifyInlineLink — non-strict (docs/ convention, unchanged)', () => {
  it('accepts a .md-relative link for filesystem resolution', () => {
    expect(classifyInlineLink('../context/convention.md')).toEqual({
      kind: 'check',
      target: '../context/convention.md',
    });
  });

  it('accepts a bare extensionless relative link for filesystem resolution', () => {
    expect(classifyInlineLink('sibling-doc')).toEqual({ kind: 'check', target: 'sibling-doc' });
  });

  it('skips a root-absolute (site-absolute) link', () => {
    expect(classifyInlineLink('/context/convention/')).toEqual({ kind: 'skip' });
  });

  it('skips an external link', () => {
    expect(classifyInlineLink('https://example.com')).toEqual({ kind: 'skip' });
  });

  it('skips a non-Markdown asset link', () => {
    expect(classifyInlineLink('palm-trees.svg')).toEqual({ kind: 'skip' });
  });

  it('skips a pure-anchor link', () => {
    expect(classifyInlineLink('#section')).toEqual({ kind: 'skip' });
  });
});

describe('classifyInlineLink — strict (example/docs #62 tightening, bare links)', () => {
  it('hands a .md/.mdx-relative link to the shared page-route rule instead of rejecting it', () => {
    expect(classifyInlineLink('./blocks-demonstrator.md', { strict: true })).toEqual({
      kind: 'check',
      target: './blocks-demonstrator.md',
    });
    expect(classifyInlineLink('./blocks-demonstrator.mdx', { strict: true }).kind).toBe('check');
  });

  it('rejects a bare extensionless relative link (the class-A trailing-slash trap)', () => {
    const result = classifyInlineLink('blocks-demonstrator', { strict: true });
    expect(result).toMatchObject({ kind: 'invalid', reason: expect.stringMatching(/no extension/) });
  });

  it('rejects a "./bare" relative link with no trailing slash the same way', () => {
    const result = classifyInlineLink('./blocks-demonstrator', { strict: true });
    expect(result.kind).toBe('invalid');
  });

  it('still accepts a relative link naming a real subdirectory route (trailing slash)', () => {
    expect(classifyInlineLink('./missions/mission-alpha/', { strict: true })).toEqual({
      kind: 'check',
      target: './missions/mission-alpha/',
    });
  });

  it('still accepts the root-absolute authored-link convention (WP01) unchanged', () => {
    expect(classifyInlineLink('/architecture/blocks-demonstrator/', { strict: true })).toEqual({
      kind: 'skip',
    });
  });

  it('still skips external and pure-anchor links', () => {
    expect(classifyInlineLink('https://example.com', { strict: true })).toEqual({ kind: 'skip' });
    expect(classifyInlineLink('#section', { strict: true })).toEqual({ kind: 'skip' });
  });

  it('still skips a non-Markdown asset link', () => {
    expect(classifyInlineLink('palm-trees.svg', { strict: true })).toEqual({ kind: 'skip' });
  });
});

describe('check-links CLI — agrees with the build on relative Markdown links', () => {
  const dirs: string[] = [];
  afterEach(() => {
    for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true });
  });

  /** A docs tree at `<tmp>/<name>`; `name` decides whether it counts as a site root. */
  const tree = (pages: Record<string, string>, name = 'kb'): { root: string; parent: string } => {
    const parent = mkdtempSync(path.join(tmpdir(), 'dk-links-cli-'));
    dirs.push(parent);
    const root = path.join(parent, name);
    for (const [rel, text] of Object.entries(pages)) {
      mkdirSync(path.dirname(path.join(root, rel)), { recursive: true });
      writeFileSync(path.join(root, rel), text);
    }
    return { root, parent };
  };
  const page = (body: string, status = 'active'): string => `---\ntitle: T\ndoc_status: ${status}\n---\n\n${body}\n`;
  const run = (root: string, args: string[] = [], drafts?: string) => {
    const env = { ...process.env };
    delete env.DK_PUBLISH_DRAFTS;
    if (drafts) env.DK_PUBLISH_DRAFTS = drafts;
    return spawnSync('node', [GATE, root, ...args], { encoding: 'utf8', env });
  };

  it('accepts a .md link to a published page on a tree that is not example/docs, with no flag', () => {
    const { root } = tree({ 'a.md': page('[b](./sub/b.md#x)'), 'sub/b.md': page('B') });
    const res = run(root);
    expect(res.status, res.stderr).toBe(0);
  });

  // Each shape works on GitHub (the file or folder exists) but is not a page of
  // the built site: accepted on a non-strict root, reported with --strict.
  it.each([
    ['a link to log.md, which exists but is never built', { 'a.md': page('[l](./log.md)'), 'log.md': '# log\n' }, /a\.md: link target is not a published page.*→ \.\/log\.md/],
    ['a link that leaves the docs root and comes back', { 'n/a.md': page('[me](../../kb/n/a.md)') }, /goes up out of the docs root and back in.*\/n\/a\/.*→ \.\.\/\.\.\/kb\/n\/a\.md/],
    ['a link to a folder that has no section index', { 'a.md': page('[g](./guides/)'), 'guides/x.md': page('G') }, /a\.md: link names the folder "guides", which has no index page.* → \.\/guides\//],
    ['a malformed % escape that names an existing file', { 'a.md': page('[m](./b%ZZ.md)'), 'b%ZZ.md': page('B') }, /a\.md: link has a malformed % escape.*→ \.\/b%ZZ\.md/],
  ])('accepts %s on a non-strict root and reports it with --strict', (_what, pages, message) => {
    const { root } = tree(pages as Record<string, string>);
    const lax = run(root);
    expect(lax.status, lax.stderr).toBe(0);
    const strict = run(root, ['--strict']);
    expect(strict.status).toBe(1);
    expect(strict.stderr).toMatch(message);
  });

  it('still reports a target that does not exist on a non-strict root', () => {
    const { root } = tree({ 'a.md': page('[x](./gone.md) [y](./nowhere/) [z](gone)'), 'b.md': page('B') });
    const res = run(root);
    expect(res.status).toBe(1);
    for (const target of ['./gone.md', './nowhere/', 'gone']) {
      expect(res.stderr, target).toMatch(new RegExp(`a\\.md: dangling link → ${target.replace(/[./]/g, '\\$&')}`));
    }
  });

  it('still checks links written in log.md', () => {
    const { root } = tree({ 'log.md': '[gone](./gone.md)\n' });
    expect(run(root).stderr).toMatch(/log\.md: dangling link → \.\/gone\.md/);
  });

  it('reports a .md link to an unpublished draft with drafts off on a strict root only', () => {
    const { root } = tree({ 'a.md': page('[w](./wip.md)'), 'wip.md': page('W', 'draft') });
    // Non-strict: the tree is read as files (GitHub), so the link is accepted.
    expect(run(root, [], 'off').status).toBe(0);
    const strict = run(root, ['--strict'], 'off');
    expect(strict.status).toBe(1);
    expect(strict.stderr).toMatch(/a\.md: link points at a draft page.*→ \.\/wip\.md/);
    expect(run(root, ['--strict'], 'on').status).toBe(0);
  });

  it('reports a .md link to an unpublished draft on the example/docs site root without a flag', () => {
    const { root } = tree({ 'a.md': page('[w](./wip.md)'), 'wip.md': page('W', 'draft') }, 'example/docs');
    expect(run(root, [], 'off').stderr).toMatch(/a\.md: link points at a draft page/);
  });

  it('never treats the root page as a draft: a status-less root README is a valid link target', () => {
    const { root } = tree({
      'README.md': '---\ntitle: Home\n---\n\nHome.\n',
      'sub/a.md': page('[home](../README.md)'),
    });
    const res = run(root, ['--strict'], 'off');
    expect(res.status, res.stderr).toBe(0);
  });

  // One target, one answer, whatever the link form. With `--index-basename
  // README`, `x/index.md` is an ordinary page at /x/ and `y/readme.md` is the
  // index of /y/ (case-insensitive): both drafts, so with drafts off no form may
  // reach them, and with drafts on every form may.
  it.each([
    ['a folder link to a draft', '[l](./x/)', '', './x/'],
    ['a root-absolute link to a draft', '[l](/x/)', '', '/x/'],
    ['a folder link to a draft index in mixed case', '[l](./y/)', '', './y/'],
    ['a .md link to a draft index in mixed case', '[l](./y/readme.md)', '', './y/readme.md'],
    ['a related ref to a draft (the page id, not the route)', 'Text.', 'related: [x/index]', 'x/index'],
    ['a related ref to a draft index in mixed case', 'Text.', 'related: [y]', 'y'],
  ])('answers %s the same way: reported with drafts off, accepted with drafts on', (_what, body, related, shown) => {
    const { root } = tree({
      'README.md': '---\ntitle: Home\n---\n\nHome.\n',
      'x/index.md': page('X', 'draft'),
      'y/readme.md': page('Y', 'draft'),
      'a.md': `---\ntitle: T\ndoc_status: active\n${related}\n---\n\n${body}\n`,
    });
    const args = ['--strict', '--index-basename', 'README'];
    const off = run(root, args, 'off');
    expect(off.status, off.stderr).toBe(1);
    expect(off.stderr).toMatch(new RegExp(`a\\.md: .*draft page.* → ${shown.replace(/[./]/g, '\\$&')}\\n`));
    const on = run(root, args, 'on');
    expect(on.status, on.stderr).toBe(0);
  });

  // The build looks a `related:` ref up by page id (`resolveRelated`), not by
  // route. With `--index-basename README`, `idxonly/index.md` is an ordinary page
  // with the id `idxonly/index`, served at /idxonly/.
  it.each([
    ['the page id of an index.md that is not an index', 'idxonly/index', true],
    ['the route of that page, which is not an id', 'idxonly', false],
    ['an ordinary page id', 'guides/page', true],
    ['an id that names no page', 'guides/missing', false],
    ['a trailing slash, which the build does not strip', 'guides/page/', false],
  ])('answers a strict related ref by page id: %s', (_what, ref, accepted) => {
    const { root } = tree({
      'README.md': '---\ntitle: Home\n---\n\nHome.\n',
      'idxonly/index.md': page('I'),
      'guides/page.md': page('P'),
      'a.md': `---\ntitle: T\ndoc_status: active\nrelated: [${ref}]\n---\n\nText.\n`,
    });
    const res = run(root, ['--strict', '--index-basename', 'README'], 'on');
    if (accepted) expect(res.status, res.stderr).toBe(0);
    else {
      expect(res.status, res.stderr).toBe(1);
      expect(res.stderr).toMatch(/a\.md: dangling related ref/);
    }
  });

  // FR-004/FR-005: two files served at one address fail the strict check, drafts included.
  it.each([
    ['published', 'active', 'on'],
    ['draft, drafts published', 'draft', 'on'],
    ['draft, drafts withheld', 'draft', 'off'],
  ])('--strict fails a route collision and names both files: %s', (_n, status, drafts) => {
    const { root } = tree({ 'x/README.md': page('A', status), 'x/index.md': page('B') });
    const res = run(root, ['--strict'], drafts);
    expect(res.status, res.stdout).toBe(1);
    expect(res.stderr).toContain('x/README.md');
    expect(res.stderr).toContain('x/index.md');
    expect(res.stderr).toMatch(/^\s*\/x\/$/m); // the contested route
    // Not strict: files are read as on GitHub, nothing new is checked.
    expect(run(root, [], drafts).status).toBe(0);
    // Positive control: one file less passes the same strict run.
    const { root: ok } = tree({ 'x/README.md': page('A', status) });
    expect(run(ok, ['--strict'], drafts).status).toBe(0);
  });

  // FR-010: `_meta` holds the registry, not pages. --strict reads the docs tree through the
  // shared walk, so a broken link in `_meta/` is never reported; the same run still reports
  // the broken link outside it (positive control: the check ran on this fixture).
  it('--strict skips _meta folders and _meta.md, and still reports a broken link outside them', () => {
    const { root } = tree({
      '_meta/x.md': page('[gone](./nowhere.md)'),
      'guide/_meta/z.md': page('[gone](./nowhere.md)'),
      '_meta.md': page('[gone](./nowhere.md)'),
      'guide/y.md': page('[gone](./nowhere.md)'),
    });
    const res = run(root, ['--strict']);
    expect(res.status, res.stdout).toBe(1);
    expect(res.stderr).toContain('guide/y.md');
    expect(res.stderr).not.toContain('_meta');
  });

  it('lets a draft page link to another draft: neither is built', () => {
    const { root } = tree({ 'a.md': page('[w](./wip.md)', 'draft'), 'wip.md': page('W', 'draft') });
    expect(run(root, ['--strict'], 'off').status).toBe(0);
  });

  it('accepts an existing file outside the docs tree on a non-strict root, reports it with --strict', () => {
    const { root, parent } = tree({ 'a.md': page('[repo](../README.md)') });
    writeFileSync(path.join(parent, 'README.md'), '# repo\n');
    expect(run(root).status).toBe(0);
    const strict = run(root, ['--strict']);
    expect(strict.status).toBe(1);
    expect(strict.stderr).toMatch(/a\.md: link leaves the docs tree.*→ \.\.\/README\.md/);
  });

  it('reports a link outside the docs tree on a site root without any flag', () => {
    const { root, parent } = tree({ 'a.md': page('[repo](../README.md)') }, 'example/docs');
    writeFileSync(path.join(parent, 'example', 'README.md'), '# repo\n');
    expect(run(root).stderr).toMatch(/link leaves the docs tree/);
  });

  it('checks a reference definition by the same rules as an inline link', () => {
    const { root } = tree({
      'a.md': page('See [the log][l] and [gone][g].\n\n[l]: <./log.md> "Log"\n[g]: ./gone.md'),
      'log.md': '# log\n',
    });
    // Non-strict: only the missing target is reported; log.md exists.
    const lax = run(root);
    expect(lax.stderr).toMatch(/a\.md: dangling link → \.\/gone\.md/);
    expect(lax.stderr).not.toMatch(/log\.md/);
    expect(run(root, ['--strict']).stderr).toMatch(/a\.md: link target is not a published page.*→ \.\/log\.md/);
  });

  it('ignores a footnote definition and a definition inside a code fence', () => {
    const { root } = tree({
      'a.md': page('Claim.[^1]\n\n[^1]: Aristotle\n\n```\n[x]: ./gone.md\n```'),
    });
    const res = run(root);
    expect(res.status, res.stderr).toBe(0);
  });

  it('reports a bare extensionless link on a non-example tree only with --strict', () => {
    const { root } = tree({ 'a.md': page('[b](b)'), 'b.md': page('B') });
    expect(run(root).status).toBe(0);
    const strict = run(root, ['--strict']);
    expect(strict.status).toBe(1);
    expect(strict.stderr).toMatch(/a\.md: link has no extension.*→ b/);
  });

  it('accepts a directory link to a folder whose index is home.md only with --index-basename home', () => {
    const { root } = tree({ 'a.md': page('[g](./guides/)'), 'guides/home.md': page('G') });
    const without = run(root, ['--strict']);
    expect(without.status).toBe(1);
    expect(without.stderr).toMatch(/no index page/);
    const withFlag = run(root, ['--strict', '--index-basename', 'home']);
    expect(withFlag.status, withFlag.stderr).toBe(0);
  });

  it('finds the section index of a folder by the shared, case-insensitive rule', () => {
    const { root } = tree({ 'a.md': page('[g](./g/)'), 'g/Readme.md': page('G') });
    const res = run(root, ['--strict']);
    expect(res.status, res.stderr).toBe(0);
  });

  it('rejects an --index-basename that is not a plain file name (exit 2)', () => {
    const { root } = tree({ 'a.md': page('A') });
    for (const bad of ['../x', 'a/b', '.hidden']) {
      const res = run(root, ['--index-basename', bad]);
      expect(res.status, bad).toBe(2);
      expect(res.stderr).toMatch(/--index-basename must be plain file names.*got/);
    }
  });

  it('says how many link problems were found in how many files, and how many were scanned', () => {
    const { root } = tree({
      'a.md': page('[x](./gone.md) [y](./gone2.md)'),
      'b.md': page('[z](./gone3.md)'),
      'c.md': page('C'),
    });
    // The numbers, in order: problems, files with problems, files scanned,
    // references checked. The prose around them may change.
    expect(run(root).stderr).toMatch(/^\D*3\D+2\D+3\D+3\D*$/m);
  });

  it('hints once that a root with an Astro config beside it looks like a built site, without changing the exit code', () => {
    const { root, parent } = tree({ 'a.md': page('A') });
    writeFileSync(path.join(parent, 'astro.config.mjs'), 'export default {};\n');
    const lax = run(root);
    expect(lax.status, lax.stderr).toBe(0);
    expect(lax.stderr.match(/looks like a built site/g)).toHaveLength(1);
    expect(lax.stderr).toMatch(/pass --strict/);
    const strict = run(root, ['--strict']);
    expect(strict.status, strict.stderr).toBe(0);
    expect(strict.stderr).not.toMatch(/looks like a built site/);
    // No config beside the root, no hint.
    expect(run(tree({ 'a.md': page('A') }).root).stderr).not.toMatch(/looks like a built site/);
  });

  it('rejects an unknown option instead of reading it as a root', () => {
    const { root } = tree({ 'a.md': page('A') });
    for (const bad of ['--bogus', '--index-basename=home']) {
      const res = run(root, [bad]);
      expect(res.status, bad).toBe(2);
      expect(res.stderr).toMatch(/unknown option/);
    }
  });

  it('documents the flags in --help', () => {
    const res = run('--help');
    expect(res.status).toBe(0);
    expect(res.stdout).toMatch(/--strict/);
    expect(res.stdout).toMatch(/--index-basename/);
  });
});

/**
 * FR-007 / FR-008: the check reads the site's index names from its
 * `astro.config.*` instead of being told again, announces where it got them, and
 * stops when `--index-basename` disagrees. Each site is a real config evaluated by
 * the CLI. The sites live under `fixtures/` so `astro` resolves from the folder.
 */
describe('check-links CLI — index names come from the site config', () => {
  const FIXTURES = path.resolve(import.meta.dirname, 'fixtures');
  const CONFIG_TS = path.resolve(import.meta.dirname, '../lib/config.ts');
  const dirs: string[] = [];
  afterEach(() => {
    for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true });
  });

  const page = (body: string): string => `---\ntitle: T\ndoc_status: active\n---\n\n${body}\n`;
  /**
   * `y/` holds only README.md, `x/` only index.md; each is linked as a folder.
   * Under `['index']` the page at `/y/` does not exist (README.md is then an
   * ordinary page at `/y/README/`); under `['README']` both folders resolve.
   */
  const PAGES: Record<string, string> = {
    'a.md': page('[x](./x/) [y](./y/)'),
    'x/index.md': page('X'),
    'y/README.md': page('Y'),
  };

  /** A site folder with `docs/` and, unless `config` is null, an astro.config.mjs. */
  const site = (config: string | null): string => {
    const dir = mkdtempSync(path.join(FIXTURES, 'tmp-site-'));
    dirs.push(dir);
    for (const [rel, text] of Object.entries(PAGES)) {
      mkdirSync(path.dirname(path.join(dir, 'docs', rel)), { recursive: true });
      writeFileSync(path.join(dir, 'docs', rel), text);
    }
    if (config !== null) writeFileSync(path.join(dir, 'astro.config.mjs'), config);
    return dir;
  };
  const integration = (names: string): string =>
    `import { defineDocKittyIntegrations } from ${JSON.stringify(CONFIG_TS)};\n` +
    `defineDocKittyIntegrations({ title: 'T', indexBasename: ${names} });\nexport default {};\n`;
  const check = (roots: string[], args: string[] = []) => {
    const env = { ...process.env };
    delete env.DK_PUBLISH_DRAFTS;
    delete env.DK_INDEX_BASENAME;
    return spawnSync('node', [GATE, ...roots, '--strict', ...args], { encoding: 'utf8', env });
  };

  it('holds folder links to the names the site config sets, and says where it read them', () => {
    // Config `index`: x/ has an index page, y/ (README only) has none.
    const indexSite = site(integration(`['index']`));
    const res = check([path.join(indexSite, 'docs')]);
    expect(res.status, res.stdout).toBe(1);
    expect(res.stderr).toMatch(/a\.md: link names the folder "y"/);
    expect(res.stderr).not.toMatch(/folder "x"/);
    expect(res.stdout).toMatch(/index names: index \(from .*astro\.config\.mjs\)/);
    // Positive control, same tree: with README configured, y/ has its index page.
    const readmeSite = site(integration(`['README']`));
    const flipped = check([path.join(readmeSite, 'docs')]);
    expect(flipped.status, flipped.stderr).toBe(0);
  });

  it('reads the default as README, not README and index, when nothing sets it', () => {
    const bare = site(null);
    const res = check([path.join(bare, 'docs')]);
    expect(res.stdout).toMatch(/index names: README \(default; no astro\.config\.\* next to /);
    expect(res.status, res.stderr).toBe(0);
    const noCall = site(`export default {};\n`);
    expect(check([path.join(noCall, 'docs')]).stdout).toMatch(/index names: README \(default; .*does not call defineDocKittyIntegrations\)/);
  });

  it('resolves each root from its own config and prints one line per strict root', () => {
    const withConfig = site(integration(`['index']`));
    const without = site(null);
    const res = check([path.join(withConfig, 'docs'), path.join(without, 'docs')]);
    const lines = res.stdout.split('\n').filter((l) => l.startsWith('index names:'));
    expect(lines).toHaveLength(2);
    expect(lines[0]).toMatch(/^index names: index \(from /);
    expect(lines[1]).toMatch(/^index names: README \(default/);
  });

  it('stops with exit 2, naming both values, when --index-basename disagrees with the config', () => {
    const dir = site(integration(`['README']`));
    const root = path.join(dir, 'docs');
    const res = check([root], ['--index-basename', 'index']);
    expect(res.status, res.stdout).toBe(2);
    expect(res.stderr).toMatch(/--index-basename index does not match the site's index names README \(from .*astro\.config\.mjs\)/);
    // Positive control: the matching flag runs the check on the same site.
    const same = check([root], ['--index-basename', 'README']);
    expect(same.status, same.stderr).toBe(0);
    expect(same.stdout).toMatch(/internal reference\(s\) resolve/);
  });

  it('accepts the same names in another order or case, and uses the config order', () => {
    const dir = site(integration(`['README', 'index']`));
    const res = check([path.join(dir, 'docs')], ['--index-basename', 'INDEX,readme']);
    expect(res.status, res.stderr).toBe(0);
    expect(res.stdout).toMatch(/index names: README,index \(from /);
  });

  it('uses the flag when the site has no config', () => {
    const dir = site(null);
    const res = check([path.join(dir, 'docs')], ['--index-basename', 'index']);
    expect(res.stdout).toMatch(/index names: index \(from --index-basename\)/);
    expect(res.stderr).toMatch(/folder "y"/);
  });

  it('warns when no config sits next to the docs folder, and --astro-config points at one elsewhere', () => {
    // docs/ nested one level deeper than the site: the config is not in its parent.
    const dir = site(null);
    const configDir = path.join(dir, 'conf');
    mkdirSync(configDir);
    writeFileSync(path.join(configDir, 'astro.config.mjs'), integration(`['index']`));
    const root = path.join(dir, 'docs');
    const warned = check([root]);
    expect(warned.stderr).toMatch(/warning: no astro\.config\.\* found for .*; assuming index names README .*--astro-config <path>/);
    expect(warned.stdout).toMatch(/index names: README \(default/);
    const given = check([root], ['--astro-config', path.join(configDir, 'astro.config.mjs')]);
    expect(given.stdout).toMatch(/index names: index \(from .*conf.astro\.config\.mjs\)/);
    expect(given.stderr).not.toMatch(/no astro\.config/);
    // A given path that does not exist stops the run instead of falling back.
    const missing = check([root], ['--astro-config', path.join(dir, 'nope.mjs')]);
    expect(missing.status).toBe(2);
    expect(missing.stderr).toMatch(/--astro-config .*nope\.mjs: no such file/);
  });

  it('stops with exit 2 when the site config cannot be loaded, instead of falling back', () => {
    const dir = site(`throw new Error('boom from the site config');\n`);
    const res = check([path.join(dir, 'docs')]);
    expect(res.status, res.stdout).toBe(2);
    expect(res.stderr).toMatch(/could not load .*astro\.config\.mjs: .*boom from the site config/);
  });
});
