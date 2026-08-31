import { describe, it, expect } from 'vitest';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  discoverAdrs,
  extractStatusToken,
  formatUpdated,
  buildAdrTable,
  regenerateReadme,
  generate,
} from '../scripts/generate-adr-index.mjs';

/**
 * #44 / FR-007b / SC-003a — the own-tree ADR index (`docs/adr/README.md`) is a
 * GENERATED artifact kept honest by a lockfile-style regeneration-clean check,
 * NOT a hand-maintained table (C-004). doc-kitty's own `docs/` tree is validated
 * but never Astro-rendered, so the index cannot come from a Hub layout; it comes
 * from this generator.
 *
 * The fixtures below DELIBERATELY VARY so the assertions cannot be satisfied by a
 * generator that hardcodes "accepted"/blank, ignores the body `## Status`, or
 * ignores the frontmatter `updated` date:
 *   - distinct statuses (>=1 `Accepted`, >=1 `Superseded`, plus `Deprecated`);
 *   - distinct `updated` dates;
 *   - the three real-corpus Status-prose shapes: bare `Accepted`,
 *     `Accepted. Supersedes …`, and the markdown-emphasis form
 *     `**Accepted** — 2026-08-29. Ratifies …` (ADR-0030);
 *   - an era-partitioned `adr/<era>/NNNN-*.md` (recursive discovery);
 *   - a `template.md` (must be excluded).
 */

const SCRIPT = fileURLToPath(new URL('../scripts/generate-adr-index.mjs', import.meta.url));

function adr(title: string, updated: string, status: string): string {
  return `---
title: "${title}"
description: A fixture ADR long enough to look real.
doc_status: active
updated: ${updated}
type: ADR
kind: ADR
---

# ${title}

## Status

${status}

## Context

Fixture context.
`;
}

/** Build a self-contained ADR tree + README with intro + trailing prose. */
function fixtureTree(): { dir: string; readme: string } {
  const dir = mkdtempSync(path.join(tmpdir(), 'dk-adr-'));
  const eraDir = path.join(dir, 'legacy');
  mkdirSync(eraDir, { recursive: true });

  writeFileSync(
    path.join(dir, '0001-first-decision.md'),
    adr('ADR-0001: First decision', '2026-01-05', 'Accepted'),
    'utf8',
  );
  writeFileSync(
    path.join(dir, '0002-second-decision.md'),
    adr(
      'ADR-0002: Second decision',
      '2026-02-10',
      'Accepted. Supersedes [ADR-0001](./0001-first-decision.md).',
    ),
    'utf8',
  );
  writeFileSync(
    path.join(dir, '0003-third-decision.md'),
    adr(
      'ADR-0003: Third decision',
      '2026-03-15',
      'Superseded by [ADR-0005](./legacy/0005-era-decision.md).',
    ),
    'utf8',
  );
  writeFileSync(
    path.join(dir, '0004-markua-shape.md'),
    adr(
      'ADR-0004: Markua status shape',
      '2026-04-20',
      '**Accepted** — 2026-08-29. Ratifies the option below.',
    ),
    'utf8',
  );
  // Era-partitioned (recursive) ADR.
  writeFileSync(
    path.join(eraDir, '0005-era-decision.md'),
    adr('ADR-0005: Era decision', '2026-05-25', 'Deprecated'),
    'utf8',
  );
  // Excluded: the copy-me template.
  writeFileSync(
    path.join(dir, 'template.md'),
    `---
title: "ADR-NNNN: Title"
description: Blank ADR to copy.
doc_status: draft
updated: 2026-01-01
type: Template
kind: ADR
---

# ADR-NNNN: Title

## Status

Proposed | Accepted | Deprecated
`,
    'utf8',
  );

  const readme = path.join(dir, 'README.md');
  writeFileSync(
    readme,
    `---
title: Decision Records
description: The immutable log.
doc_status: active
updated: 2026-01-01
type: ADR
kind: Hub
---

# Decision Records

Intro prose that must be preserved above the table.

| ID | Title | Status | Date |
|----|-------|--------|------|
| stale | stale row that must be overwritten | stale | 1999-01-01 |

New ADRs copy [\`template.md\`](./template.md).
`,
    'utf8',
  );
  return { dir, readme };
}

describe('extractStatusToken — body `## Status`, first token, emphasis-stripped', () => {
  it('reads a bare Accepted', () => {
    expect(extractStatusToken('## Status\n\nAccepted\n\n## Context\n')).toBe('Accepted');
  });
  it('takes the leading token up to the first `.`', () => {
    expect(
      extractStatusToken('## Status\n\nAccepted. Supersedes [ADR-0001](x).\n'),
    ).toBe('Accepted');
  });
  it('strips `**` emphasis and stops at the em-dash (ADR-0030 shape)', () => {
    expect(
      extractStatusToken('## Status\n\n**Accepted** — 2026-08-29. Ratifies option (b).\n'),
    ).toBe('Accepted');
  });
  it('takes the leading token up to whitespace (Superseded by …)', () => {
    expect(
      extractStatusToken('## Status\n\nSuperseded by [ADR-0005](x).\n'),
    ).toBe('Superseded');
  });
});

describe('formatUpdated — UTC YYYY-MM-DD slice (byte-idempotent)', () => {
  it('slices a plain date string', () => {
    expect(formatUpdated('2026-08-21')).toBe('2026-08-21');
  });
  it('slices a Date object via UTC (no local-tz drift)', () => {
    expect(formatUpdated(new Date('2026-08-21T00:00:00.000Z'))).toBe('2026-08-21');
  });
});

describe('discoverAdrs — recursive, template excluded, number-ordered', () => {
  it('parses every ADR with exact Title/Status/Date and excludes template.md', () => {
    const { dir } = fixtureTree();
    try {
      const entries = discoverAdrs(dir);
      expect(entries.map((e) => e.number)).toEqual(['0001', '0002', '0003', '0004', '0005']);
      // Template excluded.
      expect(entries.some((e) => /template/i.test(e.relpath))).toBe(false);
      // Era ADR discovered recursively, with an era-relative link.
      const era = entries.find((e) => e.number === '0005')!;
      expect(era.relpath).toContain('legacy/');
      // Exact per-row values (Status from body, Date from frontmatter).
      expect(entries).toEqual([
        expect.objectContaining({
          number: '0001',
          title: 'ADR-0001: First decision',
          status: 'Accepted',
          date: '2026-01-05',
        }),
        expect.objectContaining({
          number: '0002',
          title: 'ADR-0002: Second decision',
          status: 'Accepted',
          date: '2026-02-10',
        }),
        expect.objectContaining({
          number: '0003',
          title: 'ADR-0003: Third decision',
          status: 'Superseded',
          date: '2026-03-15',
        }),
        expect.objectContaining({
          number: '0004',
          title: 'ADR-0004: Markua status shape',
          status: 'Accepted',
          date: '2026-04-20',
        }),
        expect.objectContaining({
          number: '0005',
          title: 'ADR-0005: Era decision',
          status: 'Deprecated',
          date: '2026-05-25',
        }),
      ]);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});

describe('regenerateReadme — replaces ONLY the table region', () => {
  it('preserves the H1 + intro above and the trailing prose below', () => {
    const { dir, readme } = fixtureTree();
    try {
      const table = buildAdrTable(discoverAdrs(dir));
      const before = readFileSync(readme, 'utf8');
      const after = regenerateReadme(before, table);
      expect(after).toContain('# Decision Records');
      expect(after).toContain('Intro prose that must be preserved above the table.');
      expect(after).toContain('New ADRs copy [`template.md`](./template.md).');
      // The stale row is gone; the generated rows are present, number-ordered.
      expect(after).not.toContain('stale row that must be overwritten');
      const idx1 = after.indexOf('| [0001]');
      const idx5 = after.indexOf('| [0005]');
      expect(idx1).toBeGreaterThan(-1);
      expect(idx5).toBeGreaterThan(idx1);
      // Era link rendered relative to the adr root.
      expect(after).toMatch(/\[0005\]\(\.\/legacy\/0005-era-decision\.md\)/);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});

describe('generate — idempotent (run twice → byte-identical)', () => {
  it('writes in place and a second run is a no-op', () => {
    const { dir, readme } = fixtureTree();
    try {
      const first = generate({ dir, readme });
      const afterFirst = readFileSync(readme, 'utf8');
      expect(first.changed).toBe(true);
      const second = generate({ dir, readme });
      const afterSecond = readFileSync(readme, 'utf8');
      expect(second.changed).toBe(false);
      expect(afterSecond).toBe(afterFirst);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});

describe('--check sync-check — BOTH polarities (SC-003a lockfile)', () => {
  it('exits 0 on a regeneration-clean README', () => {
    const { dir, readme } = fixtureTree();
    try {
      generate({ dir, readme }); // make it clean
      const code = runCheck(dir, readme);
      expect(code).toBe(0);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('exits NON-ZERO when the committed table is mutated (a row dropped)', () => {
    const { dir, readme } = fixtureTree();
    try {
      generate({ dir, readme });
      // Mutate: drop the last generated row (a stale index).
      const mutated = readFileSync(readme, 'utf8').replace(/\n\| \[0005\][^\n]*\n/, '\n');
      writeFileSync(readme, mutated, 'utf8');
      const code = runCheck(dir, readme);
      expect(code).not.toBe(0);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('exits NON-ZERO when a status is stale (drift)', () => {
    const { dir, readme } = fixtureTree();
    try {
      generate({ dir, readme });
      const mutated = readFileSync(readme, 'utf8').replace(
        '| Superseded |',
        '| Accepted |',
      );
      writeFileSync(readme, mutated, 'utf8');
      const code = runCheck(dir, readme);
      expect(code).not.toBe(0);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});

/** Run the generator CLI in `--check` mode; return its exit code. */
function runCheck(dir: string, readme: string): number {
  try {
    execFileSync('node', [SCRIPT, '--check', '--dir', dir, '--readme', readme], {
      stdio: 'pipe',
    });
    return 0;
  } catch (err: unknown) {
    const status = (err as { status?: number }).status;
    return typeof status === 'number' ? status : 1;
  }
}
