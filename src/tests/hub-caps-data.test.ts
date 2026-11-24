/**
 * The sidebar child cap's build-time hub data (#341, WP02; FR-004, FR-009,
 * C-003, NFR-003). `routeShapingSource` reads the docs tree and serves, for each
 * hub over its cap, the resolved cap, the child count and the children in the
 * order the hub page lists them (`selectHubChildren`).
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { routeShapingSource, type RouteShapingOptions } from '../lib/integrations/route-shaping.js';
import type { HubCap } from '../lib/child-cap.js';

interface Served {
  hubCaps: Array<[string, HubCap]>;
  cappedLabel?: string;
}

const roots: string[] = [];
afterEach(() => {
  vi.restoreAllMocks();
  for (const r of roots.splice(0)) rmSync(r, { recursive: true, force: true });
});

const page = (title: string, extra = '', kind = 'Guide') =>
  `---\ntitle: ${JSON.stringify(title)}\ndescription: Fixture page.\ndoc_status: active\nupdated: 2026-11-23T00:00:00Z\nkind: ${kind}\n${extra}---\n\nBody.\n`;

/** Write `docs/<rel>` files under a fresh site root and make it the cwd. */
function site(files: Record<string, string>): void {
  const root = mkdtempSync(path.join(tmpdir(), 'dk-hub-caps-'));
  roots.push(root);
  for (const [rel, body] of Object.entries(files)) {
    const abs = path.join(root, 'docs', rel);
    mkdirSync(path.dirname(abs), { recursive: true });
    writeFileSync(abs, body);
  }
  vi.spyOn(process, 'cwd').mockReturnValue(root);
}

function served(options: Partial<RouteShapingOptions> = {}, unpublishedPaths: string[] = []): Served {
  const source = routeShapingSource(
    { docsDir: 'docs', base: '/', shapeSidebar: true, pagination: true, ...options },
    { unpublishedDirs: [], unpublishedPaths },
  );
  return JSON.parse(source.slice(source.indexOf('{'), source.lastIndexOf('}') + 1));
}

/** A `missions` hub with six children: five pages (titles out of slug order) and one sub-folder. */
const MISSIONS = (hubExtra = '') => ({
  'missions/README.md': page('Missions', hubExtra, 'Hub'),
  'missions/zeta.md': page('Alpha mission'),
  'missions/alpha.md': page('Bravo mission'),
  'missions/charlie.md': page('Charlie mission', 'sidebar:\n  label: Charlie (short)\n'),
  'missions/delta.md': page('Delta mission'),
  'missions/echo.md': page('Echo mission'),
  'missions/sub/README.md': page('Foxtrot folder'),
  'missions/sub/inner.md': page('Inner page'),
  'missions/draft.md': page('Draft mission').replace('doc_status: active', 'doc_status: draft'),
});

describe('hub data in the route-shaping module (FR-004)', () => {
  it('emits a hub over its cap with the count and the hub listing order', () => {
    site(MISSIONS('sidebar_child_cap: 5\n'));
    expect(served().hubCaps).toEqual([
      [
        'missions',
        {
          cap: 5,
          count: 6,
          children: [
            { slug: 'missions/zeta', label: 'Alpha mission' },
            { slug: 'missions/alpha', label: 'Bravo mission' },
            { slug: 'missions/charlie', label: 'Charlie (short)' },
            { slug: 'missions/delta', label: 'Delta mission' },
            { slug: 'missions/echo', label: 'Echo mission' },
            { slug: 'missions/sub', label: 'Foxtrot folder' },
          ],
        },
      ],
    ]);
  });

  it('does not emit a hub at its cap', () => {
    site(MISSIONS('sidebar_child_cap: 6\n'));
    expect(served().hubCaps).toEqual([]);
  });

  it('emits an empty list when no hub is over the default cap', () => {
    site(MISSIONS());
    expect(served().hubCaps).toEqual([]);
  });

  it('does not count a withheld draft', () => {
    site({ ...MISSIONS('sidebar_child_cap: 5\n'), 'missions/foxtrot.md': page('Golf mission') });
    expect(served().hubCaps[0]![1].count).toBe(7);
    expect(served({}, ['missions/foxtrot.md']).hubCaps[0]![1].count).toBe(6);
  });

  it('does not cap a folder whose index page is not kind: Hub (it lists no children)', () => {
    site({ ...MISSIONS('sidebar_child_cap: 5\n'), 'missions/README.md': page('Missions', 'sidebar_child_cap: 5\n', 'Explanation') });
    expect(served().hubCaps).toEqual([]);
  });

  it('does not treat a folder whose index is a draft as a hub', () => {
    site({ ...MISSIONS('sidebar_child_cap: 5\n'), 'missions/README.md': page('Missions', 'sidebar_child_cap: 5\n', 'Hub').replace('doc_status: active', 'doc_status: draft') });
    expect(served().hubCaps).toEqual([]);
  });
});

describe('cap levels (FR-001)', () => {
  const SECTIONS = (cap: number) =>
    `version: 1\nsections:\n  - id: missions\n    label: Missions\n    order: 10\n    sidebar:\n      childCap: ${cap}\n`;

  it('uses the section cap when the hub sets none, and the hub cap over it', () => {
    site({ ...MISSIONS(), '_meta/sections.yaml': SECTIONS(4) });
    expect(served({ childCap: 100 }).hubCaps[0]![1].cap).toBe(4);
    site({ ...MISSIONS('sidebar_child_cap: 5\n'), '_meta/sections.yaml': SECTIONS(4) });
    expect(served({ childCap: 100 }).hubCaps[0]![1].cap).toBe(5);
  });

  it('uses the site cap when neither the hub nor the section sets one', () => {
    site(MISSIONS());
    expect(served({ childCap: 3 }).hubCaps[0]![1].cap).toBe(3);
  });

  it('applies the section cap to a nested hub of the section', () => {
    const files: Record<string, string> = {
      'missions/README.md': page('Missions', '', 'Hub'),
      'missions/old/README.md': page('Old missions', '', 'Hub'),
      '_meta/sections.yaml': SECTIONS(2),
    };
    for (const n of ['a', 'b', 'c']) files[`missions/old/${n}.md`] = page(`Old ${n}`);
    site(files);
    expect(served().hubCaps.map(([dir, { cap, count }]) => [dir, cap, count])).toEqual([['missions/old', 2, 3]]);
  });
});

describe('an ADR hub (FR-004: the order and count the hub page shows)', () => {
  const adr = (title: string, status = 'Accepted') =>
    `---\ntitle: ${JSON.stringify(title)}\ndescription: Fixture ADR.\ndoc_status: active\nupdated: 2026-11-23T00:00:00Z\nkind: ADR\n---\n\n# ${title}\n\n## Status\n\n${status}\n`;

  it('lists ADRs by id, then the other pages, and does not count an ADR without an id', () => {
    site({
      'adr/README.md': page('Decisions', 'sidebar_child_cap: 2\n', 'Hub'),
      'adr/0002-alpha.md': adr('ADR-0002: Alpha'),
      'adr/0010-beta.md': adr('ADR-0010: Beta'),
      'adr/0001-zulu.md': adr('ADR-0001: Zulu'),
      'adr/notes.md': adr('Unnumbered note'),
      'adr/template.md': page('A template page'),
    });
    expect(served().hubCaps).toEqual([
      [
        'adr',
        {
          cap: 2,
          count: 4,
          children: [
            { slug: 'adr/0001-zulu', label: 'ADR-0001: Zulu' },
            { slug: 'adr/0002-alpha', label: 'ADR-0002: Alpha' },
            { slug: 'adr/0010-beta', label: 'ADR-0010: Beta' },
            { slug: 'adr/template', label: 'A template page' },
          ],
        },
      ],
    ]);
  });

  it('does not count a numbered ADR with type: Template, which the hub page does not list', () => {
    const template =
      '---\ntitle: "ADR-0099: Template"\ndescription: Fixture template.\ndoc_status: active\nupdated: 2026-11-23T00:00:00Z\ntype: Template\nkind: ADR\n---\n\n# ADR-0099: Template\n\n## Status\n\nProposed\n';
    site({
      'adr/README.md': page('Decisions', 'sidebar_child_cap: 3\n', 'Hub'),
      'adr/0001-alpha.md': adr('ADR-0001: Alpha'),
      'adr/0002-beta.md': adr('ADR-0002: Beta'),
      'adr/0003-gamma.md': adr('ADR-0003: Gamma'),
      'adr/0099-template.md': template,
    });
    // Three listed pages against a cap of 3: the hub is not capped.
    expect(served().hubCaps).toEqual([]);
  });
});

describe('module text (NFR-003, FR-006)', () => {
  it('serialises the cappedLabel option only when it is set', () => {
    site(MISSIONS());
    expect(served().cappedLabel).toBeUndefined();
    expect(served({ cappedLabel: 'All {count}' }).cappedLabel).toBe('All {count}');
  });

  it('emits no hub data for a consumer-written sidebar', () => {
    site(MISSIONS('sidebar_child_cap: 2\n'));
    expect(served({ shapeSidebar: false }).hubCaps).toEqual([]);
  });
});
