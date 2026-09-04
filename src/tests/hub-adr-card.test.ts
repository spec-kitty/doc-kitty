import { describe, it, expect } from 'vitest';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, readdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import matter from 'gray-matter';
import {
  extractAdrMeta,
  discoverAdrs,
  buildAdrTable,
  buildAdrHubCards,
} from '../scripts/generate-adr-index.mjs';
import { isPublished } from '../lib/metadata.js';

/**
 * #50 / IC-05 / FR-006, FR-007, NFR-004 — the ADR Hub card orders by ADR number
 * and badges lifecycle status + date, matching the GENERATED own-tree table 1:1
 * over the published+numbered set. The point of this WP is single-sourcing: the
 * SAME extractor (`extractAdrMeta`) and the SAME inclusion rule drive both the
 * generator (`discoverAdrs`/`buildAdrTable`) and the hub (`buildAdrHubCards`,
 * the exact pipeline `Hub.astro` calls).
 *
 * F5 anti-tautology: these tests exercise Hub's REAL pipeline output
 * (`hubAdrCards`, below, is Hub.astro's composition verbatim) and compare it to
 * the generator's derivation over the SAME on-disk corpus — never `extractAdrMeta`
 * against itself.
 */

const HUB = fileURLToPath(new URL('../layouts/Hub.astro', import.meta.url));
const GENERATOR = fileURLToPath(new URL('../scripts/generate-adr-index.mjs', import.meta.url));

interface AdrSpec {
  file: string;
  title: string;
  description: string;
  updated: string;
  doc_status: 'active' | 'draft';
  type: 'ADR' | 'Template';
  kind: string;
  /** Body `## Status` content; `null` ⇒ no Status section; `''` ⇒ empty section. */
  statusBody: string | null;
}

function bodyOf(s: AdrSpec): string {
  const status = s.statusBody === null ? '' : `## Status\n\n${s.statusBody}\n\n`;
  return `# ${s.title}\n\n${status}## Context\n\nFixture body long enough to look real.\n`;
}

function fileContent(s: AdrSpec): string {
  return (
    `---\n` +
    `title: "${s.title}"\n` +
    `description: "${s.description}"\n` +
    `doc_status: ${s.doc_status}\n` +
    `updated: ${s.updated}\n` +
    `type: ${s.type}\n` +
    `kind: ${s.kind}\n` +
    `---\n\n` +
    bodyOf(s)
  );
}

/** A Hub child as `Hub.astro` sees it: route slug, frontmatter data, entry body. */
interface HubChild {
  slug: string;
  data: Record<string, unknown>;
  body: string;
}

/**
 * Hub.astro's ACTUAL ADR-child pipeline, verbatim (Hub composes exactly these
 * calls): published-filter → ADR-kind gate → `buildAdrHubCards`. Reproducing the
 * wiring (not the parsing) is what "render Hub's real output" means at the unit
 * layer — the vitest harness is node-only and never renders `.astro` (the DOM is
 * covered by the example build in CI).
 */
function hubAdrCards(children: HubChild[]) {
  return buildAdrHubCards(
    children
      .filter((c) => isPublished(c.data as never))
      .filter((c) => c.data.kind === 'ADR')
      .map((c) => ({ slug: c.slug, data: c.data, body: c.body })),
  );
}

/** Write a corpus to a temp dir and return the dir + README path. */
function writeCorpus(specs: AdrSpec[]): { dir: string; readme: string } {
  const dir = mkdtempSync(path.join(tmpdir(), 'dk-hub-adr-'));
  for (const s of specs) {
    const full = path.join(dir, s.file);
    mkdirSync(path.dirname(full), { recursive: true });
    writeFileSync(full, fileContent(s), 'utf8');
  }
  const readme = path.join(dir, 'README.md');
  writeFileSync(
    readme,
    `---\ntitle: Decision Records\ndoc_status: active\nupdated: 2026-01-01\ntype: ADR\nkind: Hub\n---\n\n# Decision Records\n\nIntro.\n\n| ID | Title | Status | Date |\n|----|-------|--------|------|\n| stale | stale | stale | 1999-01-01 |\n`,
    'utf8',
  );
  return { dir, readme };
}

/**
 * Build the Hub's children from the SAME on-disk files the generator reads, in a
 * DELIBERATELY SHUFFLED order (reverse filename) so a passing number-order
 * assertion cannot be an accident of insertion order. Slug carries the `NNNN-`
 * prefix under `adr/`, exactly like a real route slug.
 */
function hubChildrenFrom(dir: string): HubChild[] {
  const files = readdirSync(dir)
    .filter((f) => /\.mdx?$/i.test(f) && f.toLowerCase() !== 'readme.md')
    .sort()
    .reverse();
  return files.map((f) => {
    const parsed = matter(readFileSync(path.join(dir, f), 'utf8'));
    return {
      slug: `adr/${f.replace(/\.mdx?$/i, '')}`,
      data: parsed.data as Record<string, unknown>,
      body: parsed.content,
    };
  });
}

const CORPUS: AdrSpec[] = [
  {
    file: '0001-first.md',
    title: 'ADR-0001: First',
    description: 'First decision.',
    updated: '2026-01-05',
    doc_status: 'active',
    type: 'ADR',
    kind: 'ADR',
    statusBody: 'Accepted',
  },
  {
    file: '0002-superseded.md',
    title: 'ADR-0002: Superseded one',
    description: 'A superseded decision.',
    updated: '2026-02-10',
    doc_status: 'active',
    type: 'ADR',
    kind: 'ADR',
    statusBody: 'Superseded by [ADR-0001](./0001-first.md).',
  },
  {
    file: '0003-empty-status.md',
    title: 'ADR-0003: Empty status',
    description: 'Status section is empty.',
    updated: '2026-03-15',
    doc_status: 'active',
    type: 'ADR',
    kind: 'ADR',
    statusBody: '', // reached but empty ⇒ unbadged
  },
  {
    file: '0004-draft.md',
    title: 'ADR-0004: Draft numbered',
    description: 'A numbered but still-draft ADR.',
    updated: '2026-04-20',
    doc_status: 'draft', // in the generated table, NOT the (isPublished) hub
    type: 'ADR',
    kind: 'ADR',
    statusBody: 'Accepted',
  },
  {
    file: 'template.md',
    title: 'ADR-NNNN: Title',
    description: 'Copy-me template.',
    updated: '2026-01-01',
    doc_status: 'draft',
    type: 'Template', // excluded on both sides regardless of doc_status
    kind: 'ADR',
    statusBody: 'Proposed | Accepted | Deprecated',
  },
  {
    file: 'overview.md',
    title: 'ADR overview',
    description: 'A number-less ADR-kind page.',
    updated: '2026-01-02',
    doc_status: 'active',
    type: 'ADR',
    kind: 'ADR',
    statusBody: 'Accepted', // number-less ⇒ excluded from the ADR group
  },
];

describe('ADR Hub card — number order, status+date badge, single-sourced (T017–T022)', () => {
  it('(a) orders ADR cards by number ascending — despite shuffled child order', () => {
    const { dir } = writeCorpus(CORPUS);
    try {
      const cards = hubAdrCards(hubChildrenFrom(dir));
      expect(cards.map((c) => c.number)).toEqual(['0001', '0002', '0003']);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('(b) status+date match the generated table 1:1 over the published+numbered set', () => {
    const { dir } = writeCorpus(CORPUS);
    try {
      const cards = hubAdrCards(hubChildrenFrom(dir));
      const genEntries = discoverAdrs(dir); // includes the draft (generator ignores doc_status)
      const genByNumber = new Map(genEntries.map((e) => [e.number, e]));
      const table = buildAdrTable(genEntries);

      for (const card of cards) {
        const gen = genByNumber.get(card.number);
        expect(gen, `generator entry for ${card.number}`).toBeTruthy();
        // Hub's derivation equals the generator's — same extractor, same input.
        expect({ status: card.status, date: card.date }).toEqual({
          status: gen!.status,
          date: gen!.date,
        });
        // ...and equals the row actually rendered into the generated table.
        expect(table).toContain(`| ${card.status} | ${card.date} |`);
      }
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('(c) reads the body-only `## Status` (frontmatter carries no status field)', () => {
    const { dir } = writeCorpus(CORPUS);
    try {
      const children = hubChildrenFrom(dir);
      const first = children.find((c) => c.slug === 'adr/0001-first')!;
      // Proof the value cannot have come from frontmatter — there is no status key.
      expect('status' in first.data).toBe(false);
      const cards = hubAdrCards(children);
      expect(cards.find((c) => c.number === '0001')!.status).toBe('Accepted');
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('(d) renders a Superseded badge (non-empty status ⇒ badged)', () => {
    const { dir } = writeCorpus(CORPUS);
    try {
      const cards = hubAdrCards(hubChildrenFrom(dir));
      const superseded = cards.find((c) => c.number === '0002')!;
      expect(superseded.status).toBe('Superseded');
      expect(Boolean(superseded.status)).toBe(true); // template renders the badge
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('(e) leaves an empty/unparseable status unbadged (never breaks the hub)', () => {
    const { dir } = writeCorpus(CORPUS);
    try {
      const cards = hubAdrCards(hubChildrenFrom(dir));
      const empty = cards.find((c) => c.number === '0003')!;
      expect(empty.status).toBe(''); // falsy ⇒ template omits the badge
      expect(empty.date).toBe('2026-03-15'); // date still shown
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('(f) excludes a `type:Template` ADR from BOTH the hub and the generated table', () => {
    const { dir } = writeCorpus(CORPUS);
    try {
      const cards = hubAdrCards(hubChildrenFrom(dir));
      const genEntries = discoverAdrs(dir);
      expect(cards.some((c) => /template/i.test(c.slug))).toBe(false);
      expect(genEntries.some((e) => /template/i.test(e.relpath))).toBe(false);
      // Extractor itself is the single gate: Template ⇒ null.
      const tmpl = matter(readFileSync(path.join(dir, 'template.md'), 'utf8'));
      expect(
        extractAdrMeta(tmpl.content, { slug: 'adr/template', frontmatter: tmpl.data }),
      ).toBeNull();
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('(f2) excludes a number-less ADR-kind page (inclusion matches discoverAdrs)', () => {
    const { dir } = writeCorpus(CORPUS);
    try {
      const cards = hubAdrCards(hubChildrenFrom(dir));
      expect(cards.some((c) => c.slug === 'adr/overview')).toBe(false);
      expect(discoverAdrs(dir).some((e) => /overview/.test(e.relpath))).toBe(false);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('(g) a DRAFT numbered ADR is in the generated table but NOT the hub (scoped 1:1, F5)', () => {
    const { dir } = writeCorpus(CORPUS);
    try {
      const cards = hubAdrCards(hubChildrenFrom(dir));
      const genEntries = discoverAdrs(dir);
      // Generator includes it (doc_status-agnostic)...
      expect(genEntries.some((e) => e.number === '0004')).toBe(true);
      // ...the hub does not (isPublished pre-filter). The invariant is scoped to
      // the published+numbered set, not asserted across this gap.
      expect(cards.some((c) => c.number === '0004')).toBe(false);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('(h) a non-ADR hub is unaffected — non-ADR children never get ADR treatment', () => {
    // A Guide-kind child, even one whose slug looks numbered, is gated out of the
    // ADR pipeline by the `kind === 'ADR'` filter (C-005).
    const nonAdr: HubChild[] = [
      {
        slug: 'guides/0001-getting-started',
        data: { title: 'Getting started', kind: 'Guide', doc_status: 'active' },
        body: '# Getting started\n\n## Status\n\nAccepted\n',
      },
      {
        slug: 'guides/setup',
        data: { title: 'Setup', kind: 'Guide', doc_status: 'active' },
        body: '# Setup\n',
      },
    ];
    expect(hubAdrCards(nonAdr)).toEqual([]); // no badges, no reordering injected
  });

  it('(i) the single-ADR demo still renders correctly (one badged, number-ordered card)', () => {
    const demo: AdrSpec[] = [
      {
        file: '0001-use-astro-starlight.md',
        title: 'ADR-0001: Build on Astro + Starlight',
        description: 'Why the toolkit renders with Astro and Starlight.',
        updated: '2026-08-21',
        doc_status: 'active',
        type: 'ADR',
        kind: 'ADR',
        statusBody: 'Accepted',
      },
    ];
    const { dir } = writeCorpus(demo);
    try {
      const cards = hubAdrCards(hubChildrenFrom(dir));
      const gen = discoverAdrs(dir);
      expect(cards).toHaveLength(1);
      expect(cards[0]).toMatchObject({ number: '0001', status: 'Accepted', date: '2026-08-21' });
      expect(gen).toHaveLength(1); // 1:1 with the generated table
      expect(cards[0].status).toBe(gen[0].status);
      expect(cards[0].date).toBe(gen[0].date);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});

describe('single-source enforcement gate (T023, NFR-001 for #50)', () => {
  const hubSrc = readFileSync(HUB, 'utf8');
  const genSrc = readFileSync(GENERATOR, 'utf8');

  /** Strip block, line, and JSX comments so prose that mentions ADR shapes
   *  (e.g. a comment saying the extractor reads `## Status`) is not mistaken for
   *  parsing code. */
  const hubCode = hubSrc
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/^\s*\/\/.*$/gm, '');

  it('Hub.astro sources ADR meta from the shared extractor module', () => {
    expect(hubSrc).toMatch(
      /import\s*\{[^}]*\bbuildAdrHubCards\b[^}]*\}\s*from\s*['"]\.\.\/scripts\/generate-adr-index\.mjs['"]/,
    );
  });

  it('Hub.astro contains NO independent status/number parsing (a re-parse reds this)', () => {
    expect(hubCode).not.toContain('extractStatusToken');
    expect(hubCode).not.toMatch(/\\d\{4\}/); // no `\d{4}` ADR-number regex
    expect(hubCode).not.toMatch(/\/\^?#{1,6}\\s\+?\s*Status/i); // no `## Status` regex literal
  });

  it('BOTH generator callers (table + hub) route number+status+date through extractAdrMeta (F6)', () => {
    // The Hub's pipeline is defined solely in terms of the one extractor...
    const buildFn = genSrc.slice(genSrc.indexOf('export function buildAdrHubCards'));
    expect(buildFn).toContain('extractAdrMeta(');
    // ...and so is the generator's own-tree table.
    const discoverFn = genSrc.slice(
      genSrc.indexOf('export function discoverAdrs'),
      genSrc.indexOf('export function buildAdrHubCards'),
    );
    expect(discoverFn).toContain('extractAdrMeta(');
    // Neither caller re-derives status/date itself (single source of truth).
    expect(discoverFn).not.toContain('extractStatusToken(');
    expect(buildFn).not.toContain('extractStatusToken(');
    // Exactly one extractor definition; one ADR-number regex.
    expect(genSrc.match(/export function extractAdrMeta/g)).toHaveLength(1);
    expect(genSrc.match(/const ADR_NUMBER =/g)).toHaveLength(1);
  });
});
