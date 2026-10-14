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
} from '../lib/metadata.js';
import { deckSlug, deckRouteParams } from '../lib/deck/deck-slug.js';
import {
  isRootIndex,
  isIndexPath,
  detectIndexCollisions,
  validate,
} from '../scripts/validate-frontmatter.mjs';
import { resolvesToDoc } from '../scripts/check-links.mjs';

const scaffoldPath = fileURLToPath(new URL('../scripts/scaffold.mjs', import.meta.url));
const newDocPath = fileURLToPath(new URL('../scripts/new-doc.mjs', import.meta.url));

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
  // FR-004: collisions are fatal and route-keyed; no winner. Every path keeps its own id and
  // the group names every file, whichever name is configured first (the former
  // "index configured first" pin asserted the same thing in the other order: RETIRED).
  it.each([
    ['README first', ['README', 'index']],
    ['index first', ['index', 'README']],
  ])('both README.md and index.md in one folder collide, no winner: %s', (_n, indexBasename) => {
    const paths = ['guides/README.md', 'guides/index.md', 'guides/deploy.md'];
    const { ids, collisions } = resolveIndexEntries(paths, { indexBasename });
    expect(ids.get('guides/README.md')).toBe('guides');
    expect(ids.get('guides/index.md')).toBe('guides');
    expect(ids.get('guides/deploy.md')).toBe('guides/deploy'); // untouched
    expect(collisions).toEqual([{ route: '/guides/', paths: ['guides/README.md', 'guides/index.md'] }]);
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
  // FR-004: the twin reports the route-keyed shape. The collision case itself is pinned in
  // vocabulary-core.test.ts and section-type-parity.test.ts (this winner/demoted pin: RETIRED, duplicate).
  it('no collision under the default basename (single candidate)', () => {
    expect(detectIndexCollisions(['guides/README.md', 'guides/deploy.md'])).toEqual([]);
  });
});

describe('FR-004 route collision in the standalone validator', () => {
  const validatorPath = fileURLToPath(new URL('../scripts/validate-frontmatter.mjs', import.meta.url));
  const page = '---\ntitle: T\ndescription: D\nupdated: 2026-01-01\ndoc_status: active\ntype: Guide\n---\n\nBody.\n';
  const validate = (files: string[]) => {
    const dir = mkdtempSync(path.join(tmpdir(), 'dk-validator-collision-'));
    try {
      for (const rel of files) {
        mkdirSync(path.dirname(path.join(dir, 'docs', rel)), { recursive: true });
        writeFileSync(path.join(dir, 'docs', rel), page);
      }
      return spawnSync('node', [validatorPath, path.join(dir, 'docs')], { encoding: 'utf8' });
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  };

  it('exits non-zero naming both files; the tree minus one file passes', () => {
    const res = validate(['x/README.md', 'x/index.md']);
    expect(res.status, res.stdout).toBe(1);
    expect(res.stderr).toContain('x/README.md');
    expect(res.stderr).toContain('x/index.md');
    expect(res.stderr).toMatch(/^\s*\/x\/$/m); // the contested route
    const ok = validate(['x/README.md', 'x/other.md']);
    expect(ok.status, ok.stderr).toBe(0);
  });
});
