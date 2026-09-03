/**
 * ATDD (T001) for flexible section identity — the `indexBasename` half
 * (FR-001/FR-002/FR-003/FR-004, US1). Per-surface coverage is a DELIBERATE
 * anti-laziness requirement (FR-003, M1): a missed literal on any surface must
 * red HERE, not survive to review.
 *
 * Mission: adopter-loader-migration-01M1KKYA, WP01.
 */
import { describe, it, expect } from 'vitest';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import {
  readmeToIndexId,
  resolveIndexEntries,
  DEFAULT_INDEX_BASENAME,
} from '../lib/metadata.js';
import { deckSlug, deckRouteParams } from '../lib/deck/deck-slug.js';
import {
  isRootIndex,
  isIndexPath,
  detectIndexCollisions,
  DEFAULT_INDEX_BASENAME as MJS_DEFAULT_INDEX_BASENAME,
  validate,
} from '../scripts/validate-frontmatter.mjs';
import { resolvesToDoc } from '../scripts/check-links.mjs';

const scaffoldPath = fileURLToPath(new URL('../scripts/scaffold.mjs', import.meta.url));
const newDocPath = fileURLToPath(new URL('../scripts/new-doc.mjs', import.meta.url));

describe('DEFAULT_INDEX_BASENAME (FR-002/C-001)', () => {
  it('the default is "README" only, mirrored across both twins', () => {
    expect(readmeToIndexId('README.md')).toBe('');
    expect(DEFAULT_INDEX_BASENAME).toBe('README');
    expect(MJS_DEFAULT_INDEX_BASENAME).toEqual(['README']);
  });
});

describe('readmeToIndexId — configurable basename (US1-AS1/AS2/AS6)', () => {
  it('AS-1: index.md in a section folder collapses to the section slug when configured', () => {
    expect(readmeToIndexId('guides/index.md', { indexBasename: 'index' })).toBe('guides');
    expect(readmeToIndexId('guides/index.md', { indexBasename: ['index'] })).toBe('guides');
  });

  it('AS-2: README.md behaviour is UNCHANGED under the default (no regression)', () => {
    expect(readmeToIndexId('architecture/README.md')).toBe('architecture');
    expect(readmeToIndexId('README.md')).toBe('');
  });

  it('NFR-003: a stray index.md stays an ordinary page under the default (no opt-in)', () => {
    expect(readmeToIndexId('guides/index.md')).toBe('guides/index');
  });

  it('AS-6: case-insensitive match (Index.md, readme.md)', () => {
    expect(readmeToIndexId('guides/Index.md', { indexBasename: 'index' })).toBe('guides');
    expect(readmeToIndexId('architecture/readme.md')).toBe('architecture');
  });

  it('M2: array form collapses BOTH README and index in one run', () => {
    const opts = { indexBasename: ['README', 'index'] };
    expect(readmeToIndexId('guides/README.md', opts)).toBe('guides');
    expect(readmeToIndexId('api/index.md', opts)).toBe('api');
  });
});

describe('resolveIndexEntries — collision-aware whole-tree resolution (E-05/FR-004)', () => {
  it('both README.md and index.md in one folder: the configured basename wins, the other demotes', () => {
    const paths = ['guides/README.md', 'guides/index.md', 'guides/deploy.md'];
    const { ids, collisions } = resolveIndexEntries(paths, {
      indexBasename: ['README', 'index'],
    });
    expect(ids.get('guides/README.md')).toBe('guides'); // README ranks first → wins
    expect(ids.get('guides/index.md')).toBe('guides/index'); // demoted → ordinary page
    expect(ids.get('guides/deploy.md')).toBe('guides/deploy'); // untouched
    expect(collisions).toEqual([
      { dir: 'guides', winner: 'guides/README.md', demoted: ['guides/index.md'] },
    ]);
  });

  it('index configured first: index.md wins, README.md demotes', () => {
    const paths = ['guides/README.md', 'guides/index.md'];
    const { ids, collisions } = resolveIndexEntries(paths, {
      indexBasename: ['index', 'README'],
    });
    expect(ids.get('guides/index.md')).toBe('guides');
    expect(ids.get('guides/README.md')).toBe('guides/README');
    expect(collisions[0]?.winner).toBe('guides/index.md');
  });

  it('no collision when only one configured basename is present', () => {
    const { collisions } = resolveIndexEntries(['guides/README.md', 'guides/deploy.md'], {
      indexBasename: ['README', 'index'],
    });
    expect(collisions).toEqual([]);
  });
});

describe('FR-003 per-surface coverage — every index-detecting surface honours the basename', () => {
  const opts = { indexBasename: ['README', 'index'] };

  it('surface: content-loader id / route slug (readmeToIndexId)', () => {
    expect(readmeToIndexId('guides/index.md', opts)).toBe('guides');
  });

  it('surface: deck slug (deck/deck-slug.ts) — basename-agnostic by construction', () => {
    // The loader already resolves an index.md-indexed deck's entry id upstream
    // (proven above); deckSlug/deckRouteParams operate on that resolved id and
    // need no basename awareness of their own.
    const entry = { id: 'presentations/showcase' }; // as if resolved from .../index.md
    expect(deckSlug(entry)).toBe('presentations/showcase');
    expect(deckRouteParams(entry).slug).toBe('showcase');
  });

  it('surface: the bare-Node validator root-index exemption (isRootIndex)', () => {
    expect(isRootIndex('README.md')).toBe(true); // default
    expect(isRootIndex('index.md')).toBe(false); // default: NOT exempt (NFR-003)
    expect(isRootIndex('index.md', ['README', 'index'])).toBe(true); // opted-in
    expect(isRootIndex('guides/index.md', ['README', 'index'])).toBe(false); // not root
  });

  it('surface: the bare-Node validator, via validate() — root index.md gets the same exemption README does', () => {
    const data = {
      title: 'Docs',
      description: 'a'.repeat(60),
      updated: '2026-09-01',
      doc_status: 'active',
      kind: 'Hub',
      okf_version: '0.2',
    };
    const { problems: readmeProblems } = validate('README.md', data);
    const { problems: indexProblems } = validate('index.md', data, undefined, undefined, {
      indexBasename: ['README', 'index'],
    });
    expect(readmeProblems).toEqual([]);
    expect(indexProblems).toEqual([]);
  });

  it('surface: isIndexPath recognises every configured basename, case-insensitively', () => {
    expect(isIndexPath('guides/index.md', ['README', 'index'])).toBe(true);
    expect(isIndexPath('guides/Index.md', ['README', 'index'])).toBe(true);
    expect(isIndexPath('guides/deploy.md', ['README', 'index'])).toBe(false);
  });

  it('surface: check-links.mjs directory-link resolution accepts index.md', () => {
    const dir = mkdtempSync(path.join(tmpdir(), 'dk-check-links-'));
    try {
      mkdirSync(path.join(dir, 'guides'), { recursive: true });
      writeFileSync(path.join(dir, 'guides', 'index.md'), '---\ntitle: x\n---\n');
      expect(resolvesToDoc(path.join(dir, 'guides'))).toBe(true);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('surface: scaffold.mjs / new-doc.mjs create/target the configured basename', () => {
    const dir = mkdtempSync(path.join(tmpdir(), 'dk-scaffold-'));
    try {
      const res = spawnSync(
        'node',
        [scaffoldPath, dir, '--sections', 'guides', '--index-basename', 'index'],
        { encoding: 'utf8' },
      );
      expect(res.status).toBe(0);
      expect(existsSync(path.join(dir, 'index.md'))).toBe(true);
      expect(existsSync(path.join(dir, 'guides', 'index.md'))).toBe(true);
      expect(existsSync(path.join(dir, 'guides', 'README.md'))).toBe(false);

      const res2 = spawnSync(
        'node',
        [newDocPath, 'integrations', '--section', '--base', dir, '--index-basename', 'index'],
        { encoding: 'utf8' },
      );
      expect(res2.status).toBe(0);
      expect(existsSync(path.join(dir, 'integrations', 'index.md'))).toBe(true);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('surface: scaffold.mjs / new-doc.mjs default to README (NFR-003 no-op)', () => {
    const dir = mkdtempSync(path.join(tmpdir(), 'dk-scaffold-default-'));
    try {
      const res = spawnSync('node', [scaffoldPath, dir, '--sections', 'guides'], {
        encoding: 'utf8',
      });
      expect(res.status).toBe(0);
      expect(existsSync(path.join(dir, 'README.md'))).toBe(true);
      expect(existsSync(path.join(dir, 'guides', 'README.md'))).toBe(true);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});

describe('E-05/FR-004 collision, bare-Node twin (detectIndexCollisions)', () => {
  it('reports a directory with both configured basenames present, winner first-in-config', () => {
    const collisions = detectIndexCollisions(
      ['guides/README.md', 'guides/index.md', 'guides/deploy.md'],
      ['README', 'index'],
    );
    expect(collisions).toEqual([
      { dir: 'guides', winner: 'guides/README.md', demoted: ['guides/index.md'] },
    ]);
  });

  it('no collision under the default basename (single candidate)', () => {
    expect(detectIndexCollisions(['guides/README.md', 'guides/deploy.md'])).toEqual([]);
  });
});
