/**
 * Changelog fragments live under `docs/changelog/unreleased/` (ADR-0072). They
 * are entries, not pages: they carry only a `section:` key and repo-root-relative
 * links. So every docs gate leaves that folder out, and a fragment touches no
 * shared file. The frontmatter and link gates take `--exclude <path>`;
 * markdownlint and Vale are told on their CI command lines.
 */
import { describe, it, expect, afterEach } from 'vitest';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { resolveCliExcludes } from '../lib/docs-walk.mjs';

const REPO = fileURLToPath(new URL('../../', import.meta.url));
const VALIDATE = path.join(REPO, 'src/scripts/validate-frontmatter.mjs');
const CHECK_LINKS = path.join(REPO, 'src/scripts/check-links.mjs');
const FRAGMENTS = 'docs/changelog/unreleased';

const dirs: string[] = [];
afterEach(() => {
  while (dirs.length) rmSync(dirs.pop()!, { recursive: true, force: true });
});

/** A one-page docs tree plus a fragment that no docs gate would accept as a page. */
function tree() {
  const root = mkdtempSync(path.join(tmpdir(), 'fragments-excluded-'));
  dirs.push(root);
  mkdirSync(path.join(root, FRAGMENTS), { recursive: true });
  writeFileSync(
    path.join(root, 'docs/README.md'),
    [
      '---',
      'title: Docs',
      'description: The root page of a tiny docs tree used by the fragment exclusion test.',
      'doc_status: active',
      'updated: 2026-11-01T00:00:00Z',
      'kind: Hub',
      '---',
      '',
      '# Docs',
      '',
    ].join('\n'),
  );
  // No title, and a link that is relative to the repository root, not the file.
  writeFileSync(
    path.join(root, FRAGMENTS, '7-x.md'),
    '---\nsection: Added\n---\n\n- **New (#7).** See [ADR](docs/adr/0072-missing.md).\n',
  );
  return root;
}

function run(script: string, args: string[], cwd: string) {
  try {
    return { code: 0, out: execFileSync('node', [script, ...args], { cwd, encoding: 'utf8', stdio: 'pipe' }) };
  } catch (err) {
    const e = err as { status: number; stdout: string; stderr: string };
    return { code: e.status, out: `${e.stdout}${e.stderr}` };
  }
}

describe('resolveCliExcludes — `--exclude <path>` to root-relative folders', () => {
  it.each([
    ['the folder', FRAGMENTS, ['changelog/unreleased']],
    ['the folder with a trailing slash', `${FRAGMENTS}/`, ['changelog/unreleased']],
    ['a sibling that only shares the name prefix', 'docs/changelog/unreleased2', ['changelog/unreleased2']],
  ])('maps %s to the root that holds it, and only that folder', (_label, p, expected) => {
    const root = tree();
    mkdirSync(path.join(root, 'docs/changelog/unreleased2'));
    const map = resolveCliExcludes(['docs', 'other'], [p], root);
    expect(map.get('docs')).toEqual(expected);
    expect(map.get('other')).toEqual([]);
  });

  it.each([
    ['docs/no-such-folder', /does not exist/],
    ['docs/README.md', /not a folder/],
    ['elsewhere', /not inside any of the roots/],
    ['docs', /not inside any of the roots/],
  ])('refuses %j', (p, message) => {
    const root = tree();
    mkdirSync(path.join(root, 'elsewhere'));
    expect(() => resolveCliExcludes(['docs'], [p], root)).toThrow(message);
  });
});

describe('validate-frontmatter --exclude', () => {
  it('fails the fragment without the flag, and passes with it', () => {
    const root = tree();
    const without = run(VALIDATE, ['docs'], root);
    expect(without.code).toBe(1);
    expect(without.out).toMatch(/unreleased\/7-x\.md/);
    const withFlag = run(VALIDATE, ['docs', '--exclude', FRAGMENTS], root);
    expect(withFlag.out).not.toMatch(/7-x\.md/);
    expect(withFlag.code).toBe(0);
  });
});

describe('check-links --exclude', () => {
  it('fails the fragment link without the flag, and passes with it', () => {
    const root = tree();
    const without = run(CHECK_LINKS, ['docs'], root);
    expect(without.code).toBe(1);
    expect(without.out).toMatch(/7-x\.md/);
    const withFlag = run(CHECK_LINKS, ['docs', '--exclude', FRAGMENTS], root);
    expect(withFlag.out).not.toMatch(/7-x\.md/);
    expect(withFlag.code).toBe(0);
  });
});

describe('--exclude with a path that does not exist', () => {
  it.each([
    ['validate-frontmatter', VALIDATE],
    ['check-links', CHECK_LINKS],
  ])('%s exits 2', (_name, script) => {
    expect(run(script, ['docs', '--exclude', 'docs/nope'], tree()).code).toBe(2);
  });
});

describe("this repository's gates leave the fragments out", () => {
  it('the folder keeps a README, so the excluded path always exists', () => {
    expect(readFileSync(path.join(REPO, FRAGMENTS, 'README.md'), 'utf8')).toMatch(/section:/);
  });
});
