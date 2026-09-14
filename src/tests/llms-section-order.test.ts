/**
 * #88 / FR-002 — the llms.txt SECTION ordering must be intrinsically total.
 *
 * The route groups the ranked pages by section into a `Map`, then orders the
 * section keys by `sectionRank`. Two sections that tie on rank (e.g. both
 * unregistered, both falling to the same fallback rank) were previously left in
 * `Map`-insertion order — which is the order they first appeared in
 * `rankForAgents`' output, i.e. driven by per-page priority, not by the section
 * key. WP02 APPENDS `|| compareCodeUnit(aKey, bKey)` so the section order is a
 * function of the keys alone.
 *
 * This suite exercises the REAL route (not a replica of its sort): the route
 * module statically imports `astro:content`, neutralized with a `vi.hoisted`
 * factory (mirrors `absolute-url-base.test.ts`/`route-feeds.test.ts`). Removing
 * the appended tiebreak reverts the two tied sections to insertion order and
 * reddens the ordering assertions below.
 */
import { describe, it, expect, afterEach, vi } from 'vitest';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

const { entries } = vi.hoisted(() => ({
  entries: [] as Array<{ id: string; filePath?: string; data: Record<string, unknown>; body?: string }>,
}));

vi.mock('astro:content', () => ({
  getCollection: async () => entries,
}));

const { llmsTxtRoute } = await import('../lib/routes/llms-txt.js');

const SITE = new URL('https://docs.example/');

afterEach(() => {
  vi.unstubAllEnvs();
  entries.length = 0;
});

async function renderText(): Promise<string> {
  const route = llmsTxtRoute({ title: 'Docs' });
  const res = await (route as (ctx: { site: URL }) => Promise<Response>)({ site: SITE });
  return res.text();
}

/** The order in which the two section H2 headings appear in the rendered text. */
function headingOrder(txt: string, headings: string[]): string[] {
  return [...headings]
    .map((h) => ({ h, at: txt.indexOf(`## ${h}`) }))
    .filter((x) => x.at !== -1)
    .sort((a, b) => a.at - b.at)
    .map((x) => x.h);
}

describe('llms.txt section order (#88) — appended code-unit tiebreak on the section key', () => {
  // Two UNREGISTERED sections (absent from SECTION_ORDER) tie on sectionRank, so
  // only the appended compareCodeUnit(sectionKey) separates them. `zeta`'s page
  // carries the HIGHER agent priority, so rankForAgents emits it first and the
  // section `Map` inserts `zeta` before `alpha`; the section sort must still emit
  // `alpha` first (code-unit ascending), independent of that insertion order.
  const shuffled = [
    { id: 'zeta/high', data: { title: 'Zeta High', doc_status: 'active', agent: { priority: 0.9 } } },
    { id: 'alpha/low', data: { title: 'Alpha Low', doc_status: 'active', agent: { priority: 0.1 } } },
  ];

  it('orders tied (unregistered) sections by ascending section key, not by insertion order', async () => {
    entries.push(...shuffled);
    const txt = await renderText();
    expect(headingOrder(txt, ['alpha', 'zeta'])).toEqual(['alpha', 'zeta']);
  });

  it('is stable under a permuted input (order is a function of the keys alone)', async () => {
    entries.push(...[...shuffled].reverse());
    const txt = await renderText();
    expect(headingOrder(txt, ['alpha', 'zeta'])).toEqual(['alpha', 'zeta']);
  });
});

/**
 * #98 — the build routes must read the section registry through the CHARTER-AWARE
 * resolver (`resolveSectionRegistry`: charter → legacy `sections.yaml` → default),
 * not the legacy `loadSectionRegistry` (charter-blind). A consumer that declares
 * its sections ONLY in `_meta/charter.yaml` (no `sections.yaml`) must therefore
 * get that section ORDER into a build route — here, llms.txt.
 *
 * The distinguishing signal: the charter declares `guides` BEFORE `adr`, which is
 * the INVERSE of the frozen `SECTION_ORDER` default (`adr` precedes `guides`). So
 * if the route reached the charter registry, headings render `guides, adr`; if it
 * fell through to the defaults (the pre-#98 legacy reader saw no `sections.yaml`
 * and returned null), they render `adr, guides`. Reverting either the route's
 * `resolveSectionRegistry` back to `loadSectionRegistry` reddens this.
 *
 * `docsRoot()` prefers the published `DK_DOCS_ROOT` env, so pointing it at a
 * charter-only fixture dir drives the real route against that registry without an
 * on-disk `docs/` tree.
 */
describe('llms.txt honors a charter-ONLY section registry (#98)', () => {
  // `guides` first, `adr` second — the inverse of SECTION_ORDER (adr < guides).
  const CHARTER_ONLY = `version: 1
sections:
  entries:
    - id: guides
      label: Guides
      order: 10
      type: Guide
    - id: adr
      label: Decisions
      order: 20
      type: ADR
`;

  it('emits sections in the charter-declared order, overriding the frozen default', async () => {
    const dir = mkdtempSync(path.join(tmpdir(), 'dk-charter-only-llms-'));
    try {
      mkdirSync(path.join(dir, '_meta'), { recursive: true });
      // NOTE: only charter.yaml — deliberately NO _meta/sections.yaml.
      writeFileSync(path.join(dir, '_meta', 'charter.yaml'), CHARTER_ONLY, 'utf8');
      vi.stubEnv('DK_DOCS_ROOT', dir);
      // One published page per section, inserted adr-first so insertion order
      // alone would keep adr ahead — only the charter order flips it.
      entries.push(
        { id: 'adr/0001', data: { title: 'A Decision', doc_status: 'active' } },
        { id: 'guides/getting-started', data: { title: 'Getting Started', doc_status: 'active' } },
      );
      const txt = await renderText();
      // Headings render as the charter-declared LABELS in charter order. With the
      // charter-blind legacy reader (no sections.yaml → null registry) the labels
      // would be the frozen defaults (`Decision Records` for adr, absent here) and
      // the order the frozen SECTION_ORDER (adr before guides) — so both the
      // presence of `Decisions` and the `Guides`-first order prove #98.
      expect(headingOrder(txt, ['Guides', 'Decisions'])).toEqual(['Guides', 'Decisions']);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
