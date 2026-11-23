/**
 * A producer's output scan (#330): every file under a generator's output
 * directory is OWNED by that producer (its stamp, or its retired stamp so a
 * regeneration can replace a legacy page) or AUTHORED (anything else, a symlink
 * included). The Gherkin generator's `scanOutputDir` delegates here.
 */
import { afterEach, describe, expect, it } from 'vitest';
import { mkdirSync, mkdtempSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { isProducerOwnedPage, scanProducerOutput } from '../lib/producer-output.mjs';

const page = (by: string) => `---\ntitle: T\ngenerated:\n  by: ${JSON.stringify(by)}\n  at: "2026-11-22T00:00:00Z"\n---\n\n# T\n`;

const dirs: string[] = [];
afterEach(() => {
  for (const d of dirs.splice(0)) rmSync(d, { recursive: true, force: true });
});

function fixture() {
  const root = mkdtempSync(path.join(tmpdir(), 'dk-producer-output-'));
  dirs.push(root);
  mkdirSync(path.join(root, 'sub'));
  writeFileSync(path.join(root, 'owned.md'), page('doc-kitty-gherkin/0.7.1'));
  writeFileSync(path.join(root, 'sub', 'legacy.md'), page('doc-kitty/gherkin'));
  writeFileSync(path.join(root, 'authored.md'), '---\ntitle: A\n---\n\n# A\n');
  writeFileSync(path.join(root, 'other.md'), page('doc-kitty-glossary/0.7.1'));
  writeFileSync(path.join(root, 'broken.md'), '---\ntitle: [unclosed\n---\n');
  writeFileSync(path.join(root, 'notes.txt'), 'plain');
  writeFileSync(path.join(root, '.hidden.md'), page('doc-kitty-gherkin/0.7.1'));
  symlinkSync(path.join(root, 'owned.md'), path.join(root, 'link.md'));
  return root;
}

describe('scanProducerOutput', () => {
  it('classifies owned and authored files for one producer', () => {
    const root = fixture();
    expect(scanProducerOutput(root, 'doc-kitty-gherkin')).toEqual({
      owned: ['owned.md', 'sub/legacy.md'],
      authored: ['authored.md', 'broken.md', 'link.md', 'notes.txt', 'other.md'],
    });
  });

  it('owns another producer’s pages only for that producer', () => {
    const root = fixture();
    expect(scanProducerOutput(root, 'doc-kitty-glossary').owned).toEqual(['other.md']);
  });

  it('a missing directory is empty, and a symlinked root is authored', () => {
    const root = fixture();
    expect(scanProducerOutput(path.join(root, 'absent'), 'doc-kitty-gherkin')).toEqual({ owned: [], authored: [] });
    const linked = path.join(root, 'linked-root');
    symlinkSync(path.join(root, 'sub'), linked);
    expect(scanProducerOutput(linked, 'doc-kitty-gherkin')).toEqual({ owned: [], authored: ['.'] });
  });
});

describe('isProducerOwnedPage', () => {
  it('reads the stamp from frontmatter and never owns an unparsable page', () => {
    expect(isProducerOwnedPage(page('doc-kitty-gherkin/1.0.0'), 'doc-kitty-gherkin')).toBe(true);
    expect(isProducerOwnedPage(page('doc-kitty-scaffold/1.0.0'), 'doc-kitty-gherkin')).toBe(false);
    expect(isProducerOwnedPage('---\ntitle: [x\n---\n', 'doc-kitty-gherkin')).toBe(false);
  });
});
