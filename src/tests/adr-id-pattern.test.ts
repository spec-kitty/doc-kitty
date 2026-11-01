import { describe, it, expect } from 'vitest';
import { execFileSync } from 'node:child_process';
import { cpSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import matter from 'gray-matter';
import {
  ADR_ID_PRESETS,
  buildAdrTable,
  check,
  computeReadme,
  discoverAdrs,
  extractAdrMeta,
  loadAdrIdRule,
  resolveAdrIdRule,
} from '../scripts/generate-adr-index.mjs';
import { selectAdrHubCards } from '../lib/hub-children.mjs';
import { compareAdrIds, matchAdrId } from '../lib/adr-id.mjs';
import { walkMarkdownPaths } from '../lib/docs-walk.mjs';
import { isPublished } from '../lib/metadata.js';
import { docKittyFields } from '../lib/schema.ts';
import { z } from 'zod';

/**
 * #248 — date-named ADRs (`YYYY-MM-DD-N-slug.md`) in era folders, with the
 * decision status in frontmatter only (the spec-kitty corpus, spec-kitty#6100).
 *
 * The fixture under `fixtures/adr-date-named/docs` declares the `date-seq`
 * preset in its `_meta/charter.yaml` and carries the traps that a wrong
 * implementation would fall into:
 *   - `2026-03-09-10` must sort AFTER `2026-03-09-2` (sequence is numeric; a
 *     code-unit sort gets this wrong);
 *   - era folders do not follow date order across files;
 *   - one ADR has a body `## Status` that disagrees with its frontmatter (the
 *     body wins);
 *   - one ADR has both `updated` and `date` (`updated` wins);
 *   - every era folder has a number-less `README.md` (excluded).
 */

const ROOT = fileURLToPath(new URL('./fixtures/adr-date-named/docs', import.meta.url));
const ADR_DIR = path.join(ROOT, 'adr');
const SCRIPT = fileURLToPath(new URL('../scripts/generate-adr-index.mjs', import.meta.url));
const OWN_DOCS = fileURLToPath(new URL('../../docs', import.meta.url));

/** The order, status and date the fixture must produce, ADR by ADR. */
const EXPECTED = [
  { number: '2025-11-02-1', status: 'Accepted', date: '2025-11-02' },
  { number: '2025-11-02-2', status: 'Superseded', date: '2025-11-02' },
  { number: '2026-01-15-1', status: 'Accepted', date: '2026-01-15' }, // body beats frontmatter Proposed
  { number: '2026-02-20-1', status: 'Accepted', date: '2026-04-01' }, // `updated` beats `date`
  { number: '2026-03-09-2', status: 'Proposed', date: '2026-03-09' },
  { number: '2026-03-09-10', status: 'Accepted', date: '2026-03-09' },
];

/**
 * The fixture as `Hub.astro` sees it: one child per ADR file, with a route slug
 * (Starlight slugifies the `1.x` folder to `1x`), frontmatter `data`, and the
 * entry body — given in REVERSE path order so a passing order assertion cannot be
 * an accident of insertion order. `eraSlug` keeps only one era's children.
 */
function hubChildren(eraSlug?: string) {
  return walkMarkdownPaths(ADR_DIR)
    .sort()
    .reverse()
    .map((rel: string) => {
      const parsed = matter(readFileSync(path.join(ADR_DIR, rel), 'utf8'));
      const slug = `adr/${rel.replace(/\.mdx?$/i, '').replace(/\./g, '').toLowerCase()}`;
      return { slug, data: parsed.data as Record<string, unknown>, body: parsed.content };
    })
    .filter((c: { slug: string }) => eraSlug === undefined || c.slug.startsWith(`adr/${eraSlug}/`))
    .filter((c: { data: Record<string, unknown> }) => isPublished(c.data as never));
}

const pick = (rows: { number: string; status: string; date: string }[]) =>
  rows.map(({ number, status, date }) => ({ number, status, date }));

describe('the `adr.id` charter axis — parsing (fail-closed)', () => {
  it('no axis resolves to the `nnnn` default, whose pattern is still /^(\\d{4})-/', () => {
    expect(resolveAdrIdRule(undefined).preset).toBe('nnnn');
    expect(resolveAdrIdRule(null).pattern.source).toBe(String.raw`^(\d{4})-`);
    expect(resolveAdrIdRule({}).pattern).toBe(ADR_ID_PRESETS.nnnn);
  });

  it('`preset: date-seq` selects the date-then-sequence pattern', () => {
    const rule = resolveAdrIdRule({ id: { preset: 'date-seq' } });
    expect(rule.preset).toBe('date-seq');
    expect(rule.pattern).toBe(ADR_ID_PRESETS['date-seq']);
  });

  it('`pattern` compiles a custom regex with a named `id` group', () => {
    const rule = resolveAdrIdRule({ id: { pattern: '^adr-(?<id>\\d+)-' } });
    expect(rule.preset).toBeUndefined();
    expect(extractAdrMeta('', { slug: 'adr/adr-12-x', idRule: rule })?.number).toBe('12');
  });

  it('matches the lowercased name, so a file name and its (lowercased) route slug agree', () => {
    // Starlight lowercases route slugs: the generator sees `ADR-12-x.md`, the hub
    // sees `adr/adr-12-x`. Both must read the same id.
    const rule = resolveAdrIdRule({ id: { pattern: '^(?<id>adr-\\d+)-' } });
    const fromFile = extractAdrMeta('', { slug: 'ADR-12-Use-X.md', idRule: rule });
    const fromRoute = extractAdrMeta('', { slug: 'adr/adr-12-use-x', idRule: rule });
    expect(fromFile?.number).toBe('adr-12');
    expect(fromRoute?.number).toBe(fromFile?.number);
  });

  it.each([
    [{ id: { preset: 'calendar' } }, /unknown preset "calendar"/],
    [{ id: { pattern: '^(\\d+)-' } }, /named group "id"/],
    [{ id: { pattern: '^(?<id>[' } }, /not a valid regular expression/],
    [{ id: { preset: 'date-seq', pattern: '^(?<id>\\d+)-' } }, /exactly one of/],
    [{ id: {} }, /exactly one of/],
    [{ id: 'date-seq' }, /"adr\.id" must be a mapping/],
    [{ id: { preset: 'nnnn', order: 'date' } }, /unknown key "order"/],
    [{ ids: {} }, /unknown key "ids"/],
    [['date-seq'], /"adr" must be a mapping/],
  ])('rejects %j', (raw, message) => {
    expect(() => resolveAdrIdRule(raw, 'charter.yaml')).toThrow(message);
  });

  // The rule runs against the LOWERCASED leaf, so an upper-case literal can never
  // match. Such a pattern used to load fine and then silently match nothing.
  it.each([
    ['^(?<id>ADR-\\d+)-', 'A'],
    ['^adr-(?<id>\\d+)-RFC', 'R'],
    ['^(?<id>[A-Z]+-\\d+)-', 'A'],
    ['^(?<id>\\d+)-\\x41', 'A'],
    ['^(?<id>\\d+)-\\u00C9', 'É'],
    ['^(?<id>\\d+)-É', 'É'],
    ['^(?<id>\\d+)-\\A', 'A'],
  ])('rejects the upper-case pattern %j, naming the letter and the fix', (pattern, letter) => {
    const run = () => resolveAdrIdRule({ id: { pattern } }, 'docs/_meta/charter.yaml');
    expect(run).toThrow(/^docs\/_meta\/charter\.yaml: "adr\.id\.pattern" /);
    expect(run).toThrow(`upper-case "${letter}"`);
    expect(run).toThrow(/lowercased file name/);
    expect(run).toThrow(/write the pattern in lower case/);
  });

  it.each([
    // Upper-case escapes are classes, not literals.
    '^(?<id>\\d+)\\D',
    '^(?<id>\\w+)\\W\\S\\s\\B',
    // Group names and back-references may use any case.
    '^(?<ID>\\d+)-(?<id>\\d+)-\\k<ID>',
    // Lookbehind is not a group name.
    '^(?<id>\\d+)(?<=\\d)-',
    // A control escape and a lower-case hex escape.
    '^(?<id>\\d+)\\cJ?\\x61?-',
    '^(?<id>adr-\\d+)-',
  ])('accepts %j, which has no upper-case literal', (pattern) => {
    expect(() => resolveAdrIdRule({ id: { pattern } }, 'charter.yaml')).not.toThrow();
  });

  it('a rejected upper-case pattern fails the charter loader, so every gate and the build reject it', () => {
    const root = mkdtempSync(path.join(tmpdir(), 'adr-upper-'));
    try {
      mkdirSync(path.join(root, '_meta'));
      writeFileSync(path.join(root, '_meta', 'charter.yaml'), "adr:\n  id:\n    pattern: '^(?<id>ADR-\\d+)-'\n");
      expect(() => loadAdrIdRule(root)).toThrow(/charter\.yaml: "adr\.id\.pattern" .*upper-case "A"/);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('the error names the source file', () => {
    expect(() => resolveAdrIdRule({ id: { preset: 'x' } }, 'docs/_meta/charter.yaml')).toThrow(
      /^docs\/_meta\/charter\.yaml: /,
    );
  });

  it('loadAdrIdRule reads the axis from `<docsRoot>/_meta/charter.yaml`', () => {
    expect(loadAdrIdRule(ROOT).preset).toBe('date-seq');
    expect(loadAdrIdRule(OWN_DOCS).preset).toBe('nnnn'); // own charter has no `adr` axis
    expect(loadAdrIdRule(path.join(ROOT, 'no-such-dir')).preset).toBe('nnnn'); // no charter
  });
});

describe('date-named ADRs in era folders — hub cards (#248)', () => {
  const idRule = loadAdrIdRule(ROOT);

  it('a hub over all ADRs shows the right id, status and date, ordered by date then sequence', () => {
    expect(pick(selectAdrHubCards(hubChildren(), { idRule }))).toEqual(EXPECTED);
  });

  it('an era hub lists its own ADRs in the same order', () => {
    expect(pick(selectAdrHubCards(hubChildren('2x'), { idRule }))).toEqual(EXPECTED.slice(2));
    expect(pick(selectAdrHubCards(hubChildren('1x'), { idRule }))).toEqual(EXPECTED.slice(0, 2));
  });

  it('the status comes from frontmatter only when the body has no `## Status` section', () => {
    const children = hubChildren();
    const frontmatterOnly = children.find((c) => c.slug.endsWith('2026-03-09-2-store-missions-as-files'))!;
    expect(frontmatterOnly.body).not.toMatch(/## Status/);
    expect(frontmatterOnly.data.status).toBe('Proposed');
    const bodyWins = children.find((c) => c.slug.endsWith('2026-01-15-1-body-status-wins'))!;
    expect(bodyWins.data.status).toBe('Proposed');
    expect(bodyWins.body).toMatch(/## Status/);
  });

  it('a body `## Status` that is present but empty does NOT fall back to frontmatter', () => {
    const meta = extractAdrMeta('## Status\n\n## Context\n', {
      slug: 'adr/2026-01-01-1-x',
      frontmatter: { status: 'Accepted', date: '2026-01-01' },
      idRule,
    });
    expect(meta?.status).toBe('');
  });

  it('a frontmatter status is reduced to its leading token, like the body one', () => {
    const meta = extractAdrMeta('', {
      slug: 'adr/2026-01-01-1-x',
      frontmatter: { status: '**Superseded** by 2026-02-01-1' },
      idRule,
    });
    expect(meta?.status).toBe('Superseded');
    // A non-string status (YAML `status: 1`) is ignored rather than shown.
    expect(extractAdrMeta('', { slug: 'adr/2026-01-01-1-x', frontmatter: { status: 1 }, idRule })?.status).toBe('');
  });

  it('number-less pages (the era READMEs) and non-matching names stay out', () => {
    const cards = selectAdrHubCards(hubChildren(), { idRule });
    expect(cards.some((c) => /readme/i.test(c.slug))).toBe(false);
    expect(extractAdrMeta('', { slug: 'adr/0001-old-style', idRule })).toBeNull();
  });
});

describe('date-named ADRs — the generated index matches the hub one to one (#248)', () => {
  const idRule = loadAdrIdRule(ROOT);

  it('discoverAdrs yields the same ids, statuses, dates and order as the hub cards', () => {
    const generated = discoverAdrs(ADR_DIR, { idRule });
    const cards = selectAdrHubCards(hubChildren(), { idRule });
    expect(pick(generated)).toEqual(pick(cards));
    expect(pick(generated)).toEqual(EXPECTED);
    expect(generated.map((e) => e.relpath)).toEqual([
      '1.x/2025-11-02-1-start-with-a-cli.md',
      '1.x/2025-11-02-2-keep-prompts-small.md',
      '2.x/2026-01-15-1-body-status-wins.md',
      '2.x/2026-02-20-1-updated-wins-over-date.md',
      '2.x/2026-03-09-2-store-missions-as-files.md',
      '2.x/2026-03-09-10-prompts-do-not-discover-context.md',
    ]);
  });

  it('the generated table renders one row per hub card, in hub order', () => {
    const table = buildAdrTable(discoverAdrs(ADR_DIR, { idRule }));
    const rows = table.split('\n').slice(2);
    const cards = selectAdrHubCards(hubChildren(), { idRule });
    expect(rows).toHaveLength(cards.length);
    rows.forEach((row, i) => {
      expect(row).toMatch(new RegExp(`^\\| \\[${cards[i].number}\\]\\(\\./[^)]+\\) \\| ${cards[i].title} \\| ${cards[i].status} \\| ${cards[i].date} \\|$`));
    });
  });

  it('the CLI picks the rule up from the charter next to `--dir` (docs root = its parent)', () => {
    const tmp = mkdtempSync(path.join(tmpdir(), 'dk-adr-date-'));
    try {
      cpSync(ROOT, tmp, { recursive: true });
      const dir = path.join(tmp, 'adr');
      expect(check({ dir, readme: path.join(dir, 'README.md') }).clean).toBe(false);
      execFileSync('node', [SCRIPT, '--dir', dir], { encoding: 'utf8' });
      const readme = readFileSync(path.join(dir, 'README.md'), 'utf8');
      expect(readme).toContain('| [2026-03-09-10](./2.x/2026-03-09-10-prompts-do-not-discover-context.md) | Prompts do not discover context | Accepted | 2026-03-09 |');
      expect(readme.indexOf('[2026-03-09-2]')).toBeLessThan(readme.indexOf('[2026-03-09-10]'));
      expect(readme).toContain('Trailing prose.');
      execFileSync('node', [SCRIPT, '--dir', dir, '--check'], { encoding: 'utf8' }); // exits 0
    } finally {
      rmSync(tmp, { recursive: true, force: true });
    }
  });

  it('`--docs-root` names the charter location when it is not the parent of `--dir`', () => {
    const tmp = mkdtempSync(path.join(tmpdir(), 'dk-adr-date-'));
    try {
      const dir = path.join(tmp, 'decisions');
      cpSync(ADR_DIR, dir, { recursive: true });
      execFileSync('node', [SCRIPT, '--dir', dir, '--docs-root', ROOT], { encoding: 'utf8' });
      expect(readFileSync(path.join(dir, 'README.md'), 'utf8')).toContain('| [2025-11-02-1](');
    } finally {
      rmSync(tmp, { recursive: true, force: true });
    }
  });
});

describe('the `NNNN-` default is unchanged (#248 pin)', () => {
  it("the own tree's generated README is byte-identical with no rule, the default rule, and the loaded rule", () => {
    const dir = path.join(OWN_DOCS, 'adr');
    const readme = path.join(dir, 'README.md');
    const committed = readFileSync(readme, 'utf8');
    expect(computeReadme(dir, readme).next).toBe(committed);
    expect(computeReadme(dir, readme, { idRule: resolveAdrIdRule(undefined) }).next).toBe(committed);
    expect(computeReadme(dir, readme, { idRule: loadAdrIdRule(OWN_DOCS) }).next).toBe(committed);
  });

  it('the default still takes the leading four digits — a date-named file reads as its year', () => {
    // Pinned on purpose: this is what a date-named corpus gets WITHOUT the axis.
    expect(extractAdrMeta('', { slug: 'adr/2026-03-09-1-x' })?.number).toBe('2026');
    expect(extractAdrMeta('', { slug: 'adr/0032-adr-index-generation' })?.number).toBe('0032');
  });

  it('the default orders by code unit over the four digits (no numeric reinterpretation)', () => {
    const tmp = mkdtempSync(path.join(tmpdir(), 'dk-adr-default-'));
    try {
      for (const f of ['0010-b.md', '0002-a.md', '0100-c.md']) {
        writeFileSync(
          path.join(tmp, f),
          `---\ntitle: "${f}"\nupdated: 2026-01-01\n---\n\n## Status\n\nAccepted\n`,
          'utf8',
        );
      }
      expect(discoverAdrs(tmp).map((e) => e.number)).toEqual(['0002', '0010', '0100']);
    } finally {
      rmSync(tmp, { recursive: true, force: true });
    }
  });

  it('a page without `updated` falls back to `date`; with neither, the date stays blank', () => {
    expect(extractAdrMeta('', { slug: 'adr/0001-x', frontmatter: { date: '2026-05-06' } })?.date).toBe('2026-05-06');
    expect(extractAdrMeta('', { slug: 'adr/0001-x', frontmatter: {} })?.date).toBe('');
  });
});

describe('the build schema keeps the ADR fallback fields (#248)', () => {
  it('`status` and `date` survive the docs schema, so the hub can read them', () => {
    const schema = z.object(docKittyFields);
    const data = schema.parse({
      description: 'x',
      status: 'Accepted',
      date: new Date('2026-03-09T00:00:00Z'),
    }) as Record<string, unknown>;
    expect(data.status).toBe('Accepted');
    expect(data.date).toEqual(new Date('2026-03-09T00:00:00Z'));
  });

  it('they stay lenient: any value builds, as it did when the keys were dropped', () => {
    const schema = z.object(docKittyFields);
    expect(schema.safeParse({ description: 'x', status: 3, date: 'sometime' }).success).toBe(true);
  });
});

describe('ordering with an optional `seq` group stays consistent (#248)', () => {
  const rule = resolveAdrIdRule({ id: { pattern: '^(?<id>[a-z](?<seq>\\d+)?)-' } }, 'charter.yaml');
  const adr = (leaf: string) => {
    const m = matchAdrId(leaf, rule);
    if (!m) throw new Error(`no match: ${leaf}`);
    return { number: m.id, sortKey: { date: m.date, seq: m.seq } };
  };

  it('puts an ADR with no sequence before one with a sequence, in every input order', () => {
    const items = ['a10-x', 'b-x', 'c2-x'].map(adr);
    const orders = [
      [0, 1, 2], [0, 2, 1], [1, 0, 2], [1, 2, 0], [2, 0, 1], [2, 1, 0],
    ].map((ix) => ix.map((i) => items[i]).sort(compareAdrIds).map((a) => a.number));
    for (const order of orders) expect(order).toEqual(['b', 'c2', 'a10']);
  });

  it('reads a non-numeric `seq` capture as no sequence, never NaN', () => {
    const nonNumeric = resolveAdrIdRule({ id: { pattern: '^(?<id>(?<seq>[a-z]+))-' } }, 'charter.yaml');
    expect(matchAdrId('abc-x', nonNumeric)?.seq).toBeNull();
    const sorted = ['abd-x', 'abc-x']
      .map((leaf) => {
        const m = matchAdrId(leaf, nonNumeric)!;
        return { number: m.id, sortKey: { date: m.date, seq: m.seq } };
      })
      .sort(compareAdrIds)
      .map((a) => a.number);
    expect(sorted).toEqual(['abc', 'abd']);
  });
});
