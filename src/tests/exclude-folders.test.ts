/**
 * Excluded folders (ADR-0068, #247): the unit-level contract. The real build,
 * the validators and the link gates on a fixture site are in
 * `exclude-folders-build.test.ts`.
 *
 *  - `exclude` is validated: folder paths relative to the docs root, no globs,
 *    no `..`, no dot or `_meta` segments, and each must exist with its exact case.
 *  - The shared walk drops everything under an excluded folder, whether the list
 *    is passed, published by `defineDocKittyIntegrations` or registered by a CLI,
 *    and for a walk of a folder inside the docs root (the ADR folder) as well.
 *  - Without the option nothing changes: no env value is published and the walk
 *    lists the same files.
 *  - The built-output gate names an excluded target instead of "no matching page".
 */
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import process from 'node:process';
import { restoreInternalEnv } from './helpers/restore-internal-env';
import {
  assertExcludedFoldersExist,
  clearRegisteredExclusions,
  excludedFoldersFor,
  excludedMarkdownPaths,
  isExcludedPath,
  normalizeExcludedFolders,
  parsePublishedExclude,
  registerExcludedFolders,
  walkMarkdownPaths,
} from '../lib/docs-walk.mjs';
import { DK_DOCS_ROOT_ENV, DK_EXCLUDE_ENV } from '../lib/internal-env.mjs';
import { excludedLinkReason, findBrokenLinks } from '../scripts/assert-no-broken-links.mjs';

const { defineDocKittyIntegrations } = await import('../lib/config.js');

restoreInternalEnv();

let root: string;
const write = (rel: string, text = '---\ntitle: T\n---\n') => {
  const abs = path.join(root, rel);
  mkdirSync(path.dirname(abs), { recursive: true });
  writeFileSync(abs, text);
};

beforeEach(() => {
  root = mkdtempSync(path.join(tmpdir(), 'dk-exclude-'));
  for (const rel of [
    'README.md',
    'guide.md',
    'archive/old.md',
    'archive/nested/deep.md',
    'archived/kept.md',
    'plans/roadmap.md',
    'plans/engineering-notes/note.md',
    'adr/README.md',
    'adr/0001-keep.md',
    'adr/archive/0002-old.md',
  ]) {
    write(rel);
  }
});
afterEach(() => {
  rmSync(root, { recursive: true, force: true });
  clearRegisteredExclusions();
});

describe('normalizeExcludedFolders', () => {
  it('absent is empty; trims ./ and trailing slashes; drops duplicates, keeps order', () => {
    expect(normalizeExcludedFolders(undefined)).toEqual([]);
    expect(normalizeExcludedFolders(['./archive/', 'plans/engineering-notes', 'archive'])).toEqual([
      'archive',
      'plans/engineering-notes',
    ]);
  });

  it.each([
    ['not an array', 'archive', 'must be an array'],
    ['a non-string', [3], 'is not a string'],
    ['an empty entry', [' '], 'is empty'],
    ['an absolute path', ['/archive'], 'is an absolute path'],
    ['a glob', ['archive/**'], 'holds glob syntax'],
    ['a negated glob', ['!archive'], 'holds glob syntax'],
    ['a parent segment', ['../outside'], '".." segment'],
    ['a dot folder', ['.github'], 'dot folder or _meta'],
    ['_meta', ['plans/_meta'], 'dot folder or _meta'],
  ])('rejects %s', (_label, value, message) => {
    expect(() => normalizeExcludedFolders(value)).toThrow(message);
  });
});

describe('assertExcludedFoldersExist', () => {
  it('accepts folders that exist with the exact letter case', () => {
    expect(() => assertExcludedFoldersExist(root, ['archive', 'plans/engineering-notes'])).not.toThrow();
  });

  it('names a missing folder, a file, and a case slip', () => {
    expect(() => assertExcludedFoldersExist(root, ['reports'], 'docs')).toThrow(
      '[dk-config] exclude: "reports" is not a folder under docs (letter case counts)',
    );
    expect(() => assertExcludedFoldersExist(root, ['guide.md'])).toThrow('"guide.md" is not a folder');
    expect(() => assertExcludedFoldersExist(root, ['Archive', 'plans/Engineering-Notes'])).toThrow(
      '"Archive", "plans/Engineering-Notes" are not a folder',
    );
  });
});

describe('the shared walk leaves excluded folders out', () => {
  const all = () => walkMarkdownPaths(root, { exclude: [] }).sort();

  it('with no exclusion it lists every page (the default is unchanged)', () => {
    expect(walkMarkdownPaths(root).sort()).toEqual(all());
    expect(all()).toContain('archive/old.md');
    expect(excludedFoldersFor(root)).toEqual([]);
  });

  it('drops everything under an excluded folder, and only that folder', () => {
    const paths = walkMarkdownPaths(root, { exclude: ['archive', 'plans/engineering-notes'] }).sort();
    expect(paths).toEqual([
      'README.md',
      'adr/0001-keep.md',
      'adr/README.md',
      'adr/archive/0002-old.md',
      'archived/kept.md',
      'guide.md',
      'plans/roadmap.md',
    ]);
    expect(isExcludedPath('archived/kept.md', ['archive'])).toBe(false);
    expect(excludedMarkdownPaths(root, ['archive', 'plans/engineering-notes']).sort()).toEqual([
      'archive/nested/deep.md',
      'archive/old.md',
      'plans/engineering-notes/note.md',
    ]);
  });

  it('reads the list defineDocKittyIntegrations published, for its docs root only', () => {
    process.env[DK_DOCS_ROOT_ENV] = root;
    process.env[DK_EXCLUDE_ENV] = JSON.stringify(['archive', 'adr/archive']);
    expect(walkMarkdownPaths(root)).not.toContain('archive/old.md');
    expect(walkMarkdownPaths(root)).not.toContain('adr/archive/0002-old.md');
    // A folder inside the docs root inherits the folders below it.
    expect(excludedFoldersFor(path.join(root, 'adr'))).toEqual(['archive']);
    expect(walkMarkdownPaths(path.join(root, 'adr')).sort()).toEqual(['0001-keep.md', 'README.md']);
    // A folder that is itself excluded walks to nothing.
    expect(walkMarkdownPaths(path.join(root, 'archive'))).toEqual([]);
    // Another tree is not affected.
    const other = mkdtempSync(path.join(tmpdir(), 'dk-exclude-other-'));
    try {
      mkdirSync(path.join(other, 'archive'));
      writeFileSync(path.join(other, 'archive', 'x.md'), '');
      expect(walkMarkdownPaths(other)).toEqual(['archive/x.md']);
    } finally {
      rmSync(other, { recursive: true, force: true });
    }
  });

  it('reads the list a CLI registered for a root', () => {
    registerExcludedFolders(root, ['plans/engineering-notes']);
    expect(walkMarkdownPaths(root)).not.toContain('plans/engineering-notes/note.md');
    expect(walkMarkdownPaths(path.join(root, 'plans'))).toEqual(['roadmap.md']);
  });

  it('rejects a hand-set env value', () => {
    expect(() => parsePublishedExclude('archive/**')).toThrow('must not be set by hand');
    expect(parsePublishedExclude(undefined)).toEqual([]);
  });
});

describe('defineDocKittyIntegrations({ exclude })', () => {
  it('publishes the normalised list next to the docs root', () => {
    defineDocKittyIntegrations({ title: 'T', docsDir: root, exclude: ['./archive/', 'plans/engineering-notes'] });
    expect(process.env[DK_DOCS_ROOT_ENV]).toBe(root);
    expect(JSON.parse(process.env[DK_EXCLUDE_ENV] ?? 'null')).toEqual(['archive', 'plans/engineering-notes']);
    expect(walkMarkdownPaths(root)).not.toContain('archive/old.md');
  });

  it('publishes nothing without the option, or with an empty list', () => {
    process.env[DK_EXCLUDE_ENV] = '["stale"]';
    defineDocKittyIntegrations({ title: 'T', docsDir: root });
    expect(process.env[DK_EXCLUDE_ENV]).toBeUndefined();
    defineDocKittyIntegrations({ title: 'T', docsDir: root, exclude: [] });
    expect(process.env[DK_EXCLUDE_ENV]).toBeUndefined();
  });

  it('fails at config time on a folder that is not there', () => {
    expect(() => defineDocKittyIntegrations({ title: 'T', docsDir: root, exclude: ['reports'] })).toThrow(
      '[dk-config] exclude: "reports" is not a folder',
    );
    expect(() => defineDocKittyIntegrations({ title: 'T', docsDir: root, exclude: ['archive/*'] })).toThrow(
      'holds glob syntax',
    );
  });
});

describe('assert-no-broken-links names an excluded target', () => {
  it('reports a missing route of an excluded page as excluded, and any other missing route as before', () => {
    const dist = mkdtempSync(path.join(tmpdir(), 'dk-exclude-dist-'));
    try {
      mkdirSync(path.join(dist, 'guide'), { recursive: true });
      writeFileSync(
        path.join(dist, 'guide', 'index.html'),
        '<a href="/docs/archive/old/">a</a><a href="../archive/old">b</a><a href="/docs/nowhere/">c</a>',
      );
      const excludedRoutes = new Map([['/archive/old/', 'archive']]);
      const failures = findBrokenLinks(dist, '/docs', { excludedRoutes });
      expect(failures.map((f) => [f.href, f.reason])).toEqual([
        ['/docs/archive/old/', excludedLinkReason('archive')],
        ['../archive/old', excludedLinkReason('archive')],
        ['/docs/nowhere/', 'no matching page or file in dist'],
      ]);
      expect(excludedLinkReason('archive')).toContain('target is excluded from the site');
      // Without the map (no --docs), the same links fail with the generic reason.
      expect(findBrokenLinks(dist, '/docs').map((f) => f.reason)).toEqual(Array(3).fill('no matching page or file in dist'));
    } finally {
      rmSync(dist, { recursive: true, force: true });
    }
  });
});
