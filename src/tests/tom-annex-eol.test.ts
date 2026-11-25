/**
 * Line endings for the evidence index (operator ruling Q8 on #455): the
 * committed snapshot and hub page are compared byte for byte, and their
 * `source_digest` hashes the classified pages' bytes (ADR-0087 D2). So each is
 * pinned to LF in `.gitattributes`, and a CRLF checkout cannot read them as
 * stale. This test fails when a newly classified example page is not pinned.
 */
import { execFileSync } from 'node:child_process';
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { MEASURES_REGISTRY_RELPATH } from '../lib/measures-loader.mjs';

const REPO = fileURLToPath(new URL('../../', import.meta.url));

/** `git check-attr eol` for repository-relative paths. */
function eolOf(files: string[]): Record<string, string> {
  const out = execFileSync('git', ['check-attr', 'eol', '--', ...files], { cwd: REPO, encoding: 'utf8' });
  return Object.fromEntries(
    out
      .trim()
      .split('\n')
      .map((line) => {
        const [file, , value] = line.split(': ');
        return [file, value];
      }),
  );
}

/** Every Markdown page under example/docs that carries tom_classification. */
function classifiedExamplePages(): string[] {
  const found: string[] = [];
  const walk = (dir: string) => {
    for (const name of readdirSync(path.join(REPO, dir))) {
      const rel = `${dir}/${name}`;
      if (statSync(path.join(REPO, rel)).isDirectory()) walk(rel);
      else if (name.endsWith('.md') && /^tom_classification:/m.test(readFileSync(path.join(REPO, rel), 'utf8'))) found.push(rel);
    }
  };
  walk('example/docs');
  return found.sort();
}

describe('the evidence index files stay LF on every checkout (operator ruling Q8)', () => {
  it('pins the committed snapshot and hub page, at paths that exist', () => {
    const files = ['example/docs/_meta/tom-annex.snapshot.json', 'example/docs/context/evidence-index/index.md'];
    // `git check-attr` answers for paths that do not exist, so a moved file
    // would otherwise leave this test green and its new path unpinned (#455 F3).
    for (const f of files) expect(existsSync(path.join(REPO, f)), f).toBe(true);
    expect(eolOf(files)).toEqual(Object.fromEntries(files.map((f) => [f, 'lf'])));
  });

  it('pins the consumer catalog path pre-emptively, though the example uses the default catalog', () => {
    // The example has no `_meta/measures.yaml`; its catalog is the shipped
    // default, which enters the digest as parsed records. A consumer catalog,
    // once added, is a D2 file input, so its path is pinned in advance (#455 F2).
    const catalog = path.posix.join('example/docs', MEASURES_REGISTRY_RELPATH.split(path.sep).join('/'));
    expect(eolOf([catalog])).toEqual({ [catalog]: 'lf' });
  });

  it('pins every classified example page, the D2 inputs of the digest', () => {
    const pages = classifiedExamplePages();
    expect(pages.length).toBeGreaterThan(0);
    expect(eolOf(pages)).toEqual(Object.fromEntries(pages.map((f) => [f, 'lf'])));
  });

  it('does not pin an unrelated page (the rule is not repo-wide)', () => {
    expect(eolOf(['example/docs/guides/getting-started.md'])).toEqual({ 'example/docs/guides/getting-started.md': 'unspecified' });
  });
});
