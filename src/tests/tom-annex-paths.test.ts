/**
 * The CLI's containment rule as a pure function (#455 review, finding 3): a path
 * relative to the project root leaves it when it is `..`, starts with `..` and a
 * separator, or is absolute (Windows: another drive or a UNC share).
 */
import { mkdirSync, mkdtempSync, realpathSync, symlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { leavesRoot, resolveInside } from '../lib/tom-annex/paths.mjs';

describe('leavesRoot', () => {
  it('POSIX: .. and ../x leave; ..x, x and the root itself stay', () => {
    expect(leavesRoot('..', path.posix)).toBe(true);
    expect(leavesRoot('../x', path.posix)).toBe(true);
    expect(leavesRoot('..x', path.posix)).toBe(false);
    expect(leavesRoot('a/..b', path.posix)).toBe(false);
    expect(leavesRoot('', path.posix)).toBe(false);
  });

  it('Windows: another drive or a UNC share is absolute and leaves; ..\\x leaves', () => {
    expect(leavesRoot(path.win32.relative('C:\\proj', 'D:\\x'), path.win32)).toBe(true);
    expect(leavesRoot(path.win32.relative('C:\\proj', '\\\\server\\share\\x'), path.win32)).toBe(true);
    expect(leavesRoot('..\\x', path.win32)).toBe(true);
    expect(leavesRoot('docs\\x', path.win32)).toBe(false);
  });
});

describe('resolveInside compares real paths', () => {
  const real = mkdtempSync(path.join(tmpdir(), 'dk-tom-real-'));
  mkdirSync(path.join(real, 'docs'));
  const alias = path.join(mkdtempSync(path.join(tmpdir(), 'dk-tom-link-')), 'proj');
  symlinkSync(real, alias, 'dir');

  it('a working directory given through a symlink still contains its own files', () => {
    expect(resolveInside(path.join(alias, 'docs', 'x.json'), alias).real).toBeDefined();
    expect(resolveInside(path.join(real, 'docs', 'x.json'), alias).real).toBeDefined();
  });

  it('returns the real path, and undefined for a path outside', () => {
    expect(resolveInside('docs/new/x.json', alias).real).toBe(path.join(realpathSync(real), 'docs', 'new', 'x.json'));
    expect(resolveInside(tmpdir(), alias).real).toBeUndefined();
  });
});
