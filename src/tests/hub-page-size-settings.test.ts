/**
 * The paged hub listing's page size where a hub or a section sets it (#342, WP01;
 * FR-003, FR-004). The site option is threaded in WP02. Each refused value is
 * paired with an accepted value of the same setting.
 */
import { describe, expect, it } from 'vitest';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { z } from 'zod';
import { parseSectionRegistry, resolveSectionRegistry } from '../lib/sections.js';
import { docKittyFields } from '../lib/schema.js';
import { validate } from '../scripts/validate-frontmatter.mjs';

describe('hub frontmatter hub_page_size (FR-003, FR-004)', () => {
  const build = z.object(docKittyFields).pick({ hub_page_size: true } as never);
  const page = (extra: Record<string, unknown>) => ({
    title: 'Missions',
    description: 'All missions.',
    doc_status: 'active',
    updated: '2026-11-24T00:00:00Z',
    kind: 'Hub',
    ...extra,
  });

  it('is kept by the site schema when valid, and refused when not', () => {
    expect(build.safeParse({ hub_page_size: 2 })).toMatchObject({ success: true, data: { hub_page_size: 2 } });
    expect(build.safeParse({})).toMatchObject({ success: true });
    for (const bad of [0, -1, 1.5, '10']) expect(build.safeParse({ hub_page_size: bad }).success).toBe(false);
  });

  it('is checked by the standalone frontmatter gate, naming the key', () => {
    expect(validate('missions/README.md', page({ hub_page_size: 2 })).problems).toEqual([]);
    for (const bad of [0, 1.5, '10']) {
      expect(validate('missions/README.md', page({ hub_page_size: bad })).problems.join('\n')).toMatch(/hub_page_size/);
    }
  });
});

describe('section hub.pageSize in sections.yaml (FR-003, FR-004)', () => {
  const registry = (hub: string) =>
    parseSectionRegistry(
      `version: 1\nsections:\n  - id: missions\n    label: Missions\n    order: 30\n${hub}`,
      { source: 'sections.yaml', warn: () => {} },
    );

  it('carries a valid page size on the entry, and no key when unset', () => {
    expect(registry('    hub:\n      pageSize: 10\n')[0]!.hub).toEqual({ pageSize: 10 });
    // toStrictEqual: an empty mapping gives `{}`, not `{ pageSize: undefined }` (WP01 review fold 3).
    expect(registry('    hub: {}\n')[0]!.hub).toStrictEqual({});
    expect(registry('')[0]).not.toHaveProperty('hub');
  });

  it('refuses an invalid page size, a non-mapping and an unknown key, naming the section', () => {
    for (const bad of ['0', '-2', '1.5', '"10"']) {
      expect(() => registry(`    hub:\n      pageSize: ${bad}\n`)).toThrow(
        'sections.yaml: section "missions" hub.pageSize must be a positive whole number',
      );
    }
    expect(() => registry('    hub: 5\n')).toThrow('sections.yaml: section "missions" "hub" must be a mapping');
    expect(() => registry('    hub: []\n')).toThrow('sections.yaml: section "missions" "hub" must be a mapping');
    expect(() => registry('    hub:\n      page_size: 10\n')).toThrow(
      'sections.yaml: section "missions" hub has unknown key "page_size"; known keys: pageSize',
    );
  });
});

describe("section hub.pageSize in the charter's sections.entries (FR-003, FR-004)", () => {
  const charter = (hub: string) => {
    const dir = mkdtempSync(path.join(tmpdir(), 'dk-hub-page-size-'));
    mkdirSync(path.join(dir, '_meta'), { recursive: true });
    writeFileSync(
      path.join(dir, '_meta', 'charter.yaml'),
      `version: 1\nsections:\n  entries:\n    - id: missions\n      label: Missions\n      order: 10\n${hub}`,
    );
    try {
      return resolveSectionRegistry(dir, { warn: () => {} });
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  };

  it('carries a valid page size, and refuses an invalid one, through the same validator', () => {
    expect(charter('      hub:\n        pageSize: 25\n')![0]!.hub).toEqual({ pageSize: 25 });
    expect(() => charter('      hub:\n        pageSize: 0\n')).toThrow('section "missions" hub.pageSize must be a positive whole number');
  });
});
