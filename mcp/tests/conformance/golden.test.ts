/**
 * T020 - Golden byte-derivation conformance suite (SC-003 minimum matrix).
 *
 * Matrix: all 5 tools over a >=10-page sample of the committed example build
 * (INCLUDING the empty-slug home page), run in BOTH input modes - https via a
 * local static server, and fs - plus a third fs run with --link-base to prove
 * the FR-007 carve-out (content byte-identity + documented link rewrite), a
 * pages-links-gated run, and the three SC-002 discriminating controls on the
 * search-controls fixture (own fixture terms).
 *
 * Every expected value is computed in-test by independently re-reading the
 * fixture artifacts through the documented projection (projection.ts) -
 * nothing is captured from server output, and no vitest snapshot is taken
 * (reviewer pin V4). Field-level byte equality per output field (compare.ts).
 *
 * Resources assertions run unconditionally (capabilities.resources is true
 * since WP04).
 */
import { readFile } from 'node:fs/promises';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { resultJson } from '../surface/helpers.js';
import { compareFields, formatComparisons } from './compare.js';
import type { FieldComparison } from './compare.js';
import {
  EXAMPLE_BAKED_ORIGIN,
  WP05_BAKED_ORIGIN,
  exampleFixtureDir,
  runFsServer,
  runHttpServer,
  samplePageIds,
  wp05Fixture,
} from './harness.js';
import type { RunningServer } from './harness.js';
import {
  expectedListPages,
  expectedResourceBody,
  expectedScenarios,
  expectedSearch,
  expectedSiteInfo,
  expectedSiteSlug,
  pageUriFor,
  projectCorpus,
} from './projection.js';
import type { LaunchView, ProjectedCorpus } from './projection.js';
import { conformanceSweep } from './sweep.js';

interface ModeContext {
  running: RunningServer;
  corpus: ProjectedCorpus;
  view: LaunchView;
  sampleIds: string[];
  searchQueries: string[];
}

const HOOK_TIMEOUT_MS = 60_000;
const MATRIX_TIMEOUT_MS = 60_000;
const ALL_FIELDS_BYTE_EQUAL = '(all fields byte-equal)';

/** Deterministic search probes for the example corpus (from its own fields). */
function probes(corpus: ProjectedCorpus, sampleIds: string[]): string[] {
  const queries = ['mission alpha', 'MISSION ALPHA'];
  const sample = corpus.pages.find((p) => p.id === sampleIds[3]);
  const word = String(sample?.record.title ?? '')
    .split(/\s+/)
    .find((w) => w.length > 3);
  if (word !== undefined) queries.push(word);
  return queries;
}

/**
 * Resources assertions (contract "Resources" section). The hybrid surface is
 * unconditional since WP04 + the operator's Q-P1 hybrid ruling; the earlier
 * skip-scaffolding was removed (pre-merge fold), so these assertions run in
 * every branch.
 */
async function assertResources(ctx: ModeContext, out: FieldComparison[]): Promise<void> {
  const info = resultJson(await ctx.running.client.callTool('get_site_info')) as {
    capabilities?: { resources?: unknown };
  };
  if (info.capabilities?.resources !== true) {
    out.push({ path: 'get_site_info.capabilities.resources', problem: 'expected resources:true' });
    return;
  }
  const slug = expectedSiteSlug(ctx.corpus, ctx.view);
  const listed = (await ctx.running.client.request('resources/list', {})) as {
    resources?: Array<{ uri?: unknown }>;
  };
  const listedUris = new Set((listed.resources ?? []).map((r) => String(r.uri)));
  for (const id of ctx.sampleIds) {
    const uri = pageUriFor(slug, id);
    if (!listedUris.has(uri)) {
      out.push({
        path: 'resources/list',
        problem: `resources announced but ${uri} not listed (page count at/under threshold)`,
      });
    }
    const read = (await ctx.running.client.request('resources/read', { uri })) as {
      contents?: Array<{ text?: unknown }>;
    };
    compareFields(expectedResourceBody(ctx.corpus, ctx.view, id), read.contents?.[0]?.text, `resources/read(${id})`, out);
  }
}

describe('T020 golden byte-derivation conformance (SC-003 minimum matrix)', () => {
  describe('input mode: https (local static server over the committed example build)', () => {
    let ctx: ModeContext;
    beforeAll(async () => {
      const dir = exampleFixtureDir();
      const running = await runHttpServer(dir, EXAMPLE_BAKED_ORIGIN);
      const corpus = await projectCorpus({ kind: 'http', base: running.served!.base });
      const view: LaunchView = { kind: 'https', url: running.served!.base };
      ctx = {
        running,
        corpus,
        view,
        sampleIds: samplePageIds(corpus),
        searchQueries: probes(corpus, samplePageIds(corpus)),
      };
    }, HOOK_TIMEOUT_MS);
    afterAll(async () => {
      await ctx.running.close();
    });

    it('matrix sample covers the floor: >=10 pages including the empty-slug home', () => {
      expect(ctx.sampleIds.length).toBeGreaterThanOrEqual(10);
      const homePromised = (ctx.corpus.index.pages as Array<{ slug?: unknown }>).some((r) => r.slug === '');
      expect(homePromised).toBe(true);
      expect(ctx.sampleIds).toContain('home');
    });

    it(
      'all 5 tools byte-equal the in-test projection, field by field',
      async () => {
        const mismatches = await conformanceSweep(ctx.running.client, ctx.corpus, ctx.view, {
          sampleIds: ctx.sampleIds,
          searchQueries: ctx.searchQueries,
          sectionFilters: ['', 'guides'],
        });
        expect(formatComparisons(mismatches)).toBe(ALL_FIELDS_BYTE_EQUAL);
      },
      MATRIX_TIMEOUT_MS,
    );

    it('search cap stays a registry-order prefix cut when expectation exceeds 25 hits', async () => {
      const probe = ['the', 'and', 'doc', 'with'].find(
        (candidate) => expectedSearch(ctx.corpus, ctx.view, candidate, Number.POSITIVE_INFINITY).length >= 26,
      );
      if (probe === undefined) return; // corpus property; documented no-op if the example shrinks
      const expected = expectedSearch(ctx.corpus, ctx.view, probe);
      expect(expected.length).toBe(25);
      const actual = resultJson(await ctx.running.client.callTool('search_pages', { query: probe }));
      const mismatches = compareFields(expected, actual, `search_pages(${JSON.stringify(probe)}) prefix cut`);
      expect(formatComparisons(mismatches)).toBe(ALL_FIELDS_BYTE_EQUAL);
    });

    it(
      'resources byte-conform (listed branch)',
      async () => {
        const out: FieldComparison[] = [];
        await assertResources(ctx, out);
        expect(formatComparisons(out)).toBe(ALL_FIELDS_BYTE_EQUAL);
      },
      MATRIX_TIMEOUT_MS,
    );

    it(
      'resources gated branch: above the listing threshold, list omits pages but read still serves bytes',
      async () => {
        const gated = await runHttpServer(exampleFixtureDir(), EXAMPLE_BAKED_ORIGIN, { resourceListingThreshold: 1 });
        try {
          const info = resultJson(await gated.client.callTool('get_site_info')) as {
            capabilities?: { resources?: unknown };
          };
          expect(info.capabilities?.resources).toBe(true);
          // Provenance pin (review cycle 2): serve-fixture rebases the baked
          // origin onto EACH static instance's own port, so the expectation
          // must be projected from THIS gated instance's served bytes. The
          // projection still re-reads the fixture artifacts itself, never a
          // tool output (V4) - but same-instance bytes make equal content
          // compare equal. No ctx.* value may leak into this branch.
          const gatedCorpus = await projectCorpus({ kind: 'http', base: gated.served!.base });
          const gatedView: LaunchView = { kind: 'https', url: gated.served!.base };
          const slug = expectedSiteSlug(gatedCorpus, gatedView);
          const listed = (await gated.client.request('resources/list', {})) as {
            resources?: Array<{ uri?: unknown }>;
          };
          for (const entry of listed.resources ?? []) {
            expect(String(entry.uri).startsWith(`docs://${slug}/pages/`)).toBe(false);
          }
          const sampleId = samplePageIds(gatedCorpus)[0]!;
          const uri = pageUriFor(slug, sampleId);
          const read = (await gated.client.request('resources/read', { uri })) as {
            contents?: Array<{ text?: unknown }>;
          };
          const mismatches = compareFields(
            expectedResourceBody(gatedCorpus, gatedView, sampleId),
            read.contents?.[0]?.text,
            `resources/read(${sampleId}) above-threshold`,
          );
          expect(formatComparisons(mismatches)).toBe(ALL_FIELDS_BYTE_EQUAL);
        } finally {
          await gated.close();
        }
      },
      MATRIX_TIMEOUT_MS,
    );
  });

  describe('input mode: fs (local build directory)', () => {
    let ctx: ModeContext;
    beforeAll(async () => {
      const dir = exampleFixtureDir();
      const running = await runFsServer(dir);
      const corpus = await projectCorpus({ kind: 'fs', dir });
      ctx = {
        running,
        corpus,
        view: running.view,
        sampleIds: samplePageIds(corpus),
        searchQueries: [],
      };
      ctx.searchQueries = probes(corpus, ctx.sampleIds);
    }, HOOK_TIMEOUT_MS);
    afterAll(async () => {
      await ctx.running.close();
    });

    it(
      'all 5 tools byte-equal the on-disk artifacts, field by field',
      async () => {
        const mismatches = await conformanceSweep(ctx.running.client, ctx.corpus, ctx.view, {
          sampleIds: ctx.sampleIds,
          searchQueries: ctx.searchQueries,
          sectionFilters: ['', 'guides'],
        });
        expect(formatComparisons(mismatches)).toBe(ALL_FIELDS_BYTE_EQUAL);
      },
      MATRIX_TIMEOUT_MS,
    );

    it('content byte-identity probe: home markdown equals the artifact file bytes', async () => {
      const raw = await readFile(`${exampleFixtureDir()}/api/pages/home.json`, 'utf8');
      const artifact = JSON.parse(raw) as { markdown: string };
      const page = resultJson(await ctx.running.client.callTool('get_page', { id: 'home' })) as { markdown: unknown };
      const mismatches = compareFields(artifact.markdown, page.markdown, 'get_page(home).markdown');
      expect(formatComparisons(mismatches)).toBe(ALL_FIELDS_BYTE_EQUAL);
    });

    it(
      'resources byte-conform (listed branch)',
      async () => {
        const out: FieldComparison[] = [];
        await assertResources(ctx, out);
        expect(formatComparisons(out)).toBe(ALL_FIELDS_BYTE_EQUAL);
      },
      MATRIX_TIMEOUT_MS,
    );
  });

  describe('input mode: fs with --link-base (FR-007 carve-out arms)', () => {
    const LINK_BASE = 'https://mirror.internal/reference';
    let ctx: ModeContext;
    beforeAll(async () => {
      const dir = exampleFixtureDir();
      const running = await runFsServer(dir, { linkBase: LINK_BASE });
      const corpus = await projectCorpus({ kind: 'fs', dir });
      const view: LaunchView = { kind: 'fs', dir, linkBase: LINK_BASE };
      ctx = {
        running,
        corpus,
        view,
        sampleIds: samplePageIds(corpus),
        searchQueries: [],
      };
      ctx.searchQueries = probes(corpus, ctx.sampleIds);
    }, HOOK_TIMEOUT_MS);
    afterAll(async () => {
      await ctx.running.close();
    });

    it(
      'all 5 tools equal the in-test projection incl. the documented link rewrite',
      async () => {
        const mismatches = await conformanceSweep(ctx.running.client, ctx.corpus, ctx.view, {
          sampleIds: ctx.sampleIds,
          searchQueries: ctx.searchQueries,
          sectionFilters: ['', 'guides'],
        });
        expect(formatComparisons(mismatches)).toBe(ALL_FIELDS_BYTE_EQUAL);
      },
      MATRIX_TIMEOUT_MS,
    );

    it('the rewrite arm genuinely engaged: link hrefs moved to the link base', async () => {
      const page = resultJson(await ctx.running.client.callTool('get_page', { id: ctx.sampleIds[0]! })) as {
        links: { self: { href: string } };
      };
      expect(page.links.self.href.startsWith(`${LINK_BASE}/`)).toBe(true);
    });

    it('content fields are NEVER rewritten under --link-base (carve-out bound)', async () => {
      const id = ctx.sampleIds[1]!;
      const raw = await readFile(`${exampleFixtureDir()}/api/pages/${id}.json`, 'utf8');
      const artifact = JSON.parse(raw) as { markdown: string };
      const page = resultJson(await ctx.running.client.callTool('get_page', { id })) as { markdown: unknown };
      const mismatches = compareFields(artifact.markdown, page.markdown, `get_page(${id}).markdown vs raw disk bytes`);
      expect(formatComparisons(mismatches)).toBe(ALL_FIELDS_BYTE_EQUAL);
    });
  });

  describe('run: pages-links-gated corpus (degrade announcements in the golden matrix)', () => {
    let ctx: ModeContext;
    beforeAll(async () => {
      const dir = wp05Fixture('failure-gated-pages');
      const running = await runFsServer(dir);
      const corpus = await projectCorpus({ kind: 'fs', dir });
      ctx = { running, corpus, view: running.view, sampleIds: [], searchQueries: [] };
    }, HOOK_TIMEOUT_MS);
    afterAll(async () => {
      await ctx.running.close();
    });

    it('gating announced via capabilities; index-level tools still byte-conform; page tools refuse loudly', async () => {
      // The degrade announcement: pages false, and byte-equal site identity.
      const info = resultJson(await ctx.running.client.callTool('get_site_info')) as {
        capabilities?: Record<string, unknown>;
      } & Record<string, unknown>;
      expect(info.capabilities?.pages).toBe(false);
      const announcedResources = info.capabilities?.resources;
      expect(typeof announcedResources).toBe('boolean');
      const expectedInfo = expectedSiteInfo(ctx.corpus, ctx.view);
      const expectedRest: Record<string, unknown> = { ...expectedInfo };
      delete expectedRest.capabilities;
      const actualRest: Record<string, unknown> = { ...info };
      delete actualRest.capabilities;
      const mismatches = compareFields(expectedRest, actualRest, 'get_site_info (gated)');
      expect(formatComparisons(mismatches)).toBe(ALL_FIELDS_BYTE_EQUAL);

      // list_pages: empty registry projection (no record promised an artifact).
      const listed = resultJson(await ctx.running.client.callTool('list_pages'));
      expect(formatComparisons(compareFields(expectedListPages(ctx.corpus, ctx.view), listed, 'list_pages (gated)'))).toBe(
        ALL_FIELDS_BYTE_EQUAL,
      );
      expect(listed).toEqual([]);

      // search_pages: zero hits, never fabricated answers.
      expect(resultJson(await ctx.running.client.callTool('search_pages', { query: 'gated' }))).toEqual([]);

      // list_scenarios: the surface stays live and byte-conform while gated.
      const scenarios = resultJson(await ctx.running.client.callTool('list_scenarios'));
      const scenarioMismatches = compareFields(
        expectedScenarios(ctx.corpus, ctx.view),
        scenarios,
        'list_scenarios (gated)',
      );
      expect(formatComparisons(scenarioMismatches)).toBe(ALL_FIELDS_BYTE_EQUAL);

      // get_page: the named degrade error, never synthesized content.
      const page = await ctx.running.client.callTool('get_page', { id: 'home' });
      expect(page.isError).toBe(true);
      expect(page.content?.[0]?.text?.startsWith('PAGES_LINKS_GATED: ')).toBe(true);
    });
  });

  describe('SC-002 discriminating controls (own fixture terms, both input modes)', () => {
    const cases = [
      { mode: 'fs' as const, label: 'fs' },
      { mode: 'https' as const, label: 'https (local static server)' },
    ];
    for (const { mode, label } of cases) {
      describe(`input mode: ${label}`, () => {
        let ctx: ModeContext;
        beforeAll(async () => {
          const dir = wp05Fixture('search-controls');
          if (mode === 'fs') {
            const running = await runFsServer(dir);
            const corpus = await projectCorpus({ kind: 'fs', dir });
            ctx = { running, corpus, view: running.view, sampleIds: [], searchQueries: [] };
          } else {
            const running = await runHttpServer(dir, WP05_BAKED_ORIGIN);
            const corpus = await projectCorpus({ kind: 'http', base: running.served!.base });
            const view: LaunchView = { kind: 'https', url: running.served!.base };
            ctx = { running, corpus, view, sampleIds: [], searchQueries: [] };
          }
        }, HOOK_TIMEOUT_MS);
        afterAll(async () => {
          await ctx.running.close();
        });

        it('keyword-only term produces exactly its one hit (zephyrquill)', async () => {
          const actual = resultJson(await ctx.running.client.callTool('search_pages', { query: 'zephyrquill' }));
          const expected = expectedSearch(ctx.corpus, ctx.view, 'zephyrquill');
          expect(expected.map((r) => r.id)).toEqual(['controls/alpha']);
          const mismatches = compareFields(expected, actual, 'search_pages(zephyrquill)');
          expect(formatComparisons(mismatches)).toBe(ALL_FIELDS_BYTE_EQUAL);
        });

        it('body-only term produces zero hits (morrowdust)', async () => {
          const actual = resultJson(await ctx.running.client.callTool('search_pages', { query: 'morrowdust' }));
          expect(expectedSearch(ctx.corpus, ctx.view, 'morrowdust')).toEqual([]);
          expect(actual).toEqual([]);
        });

        it('known-K term returns exactly those K pages in registry order, none missing (amberline, K=3)', async () => {
          const actual = resultJson(await ctx.running.client.callTool('search_pages', { query: 'amberline' }));
          const expected = expectedSearch(ctx.corpus, ctx.view, 'amberline');
          expect(expected.map((r) => r.id)).toEqual(['controls/gamma', 'controls/delta', 'controls/epsilon']);
          const mismatches = compareFields(expected, actual, 'search_pages(amberline)');
          expect(formatComparisons(mismatches)).toBe(ALL_FIELDS_BYTE_EQUAL);
        });

        it('case-insensitivity holds on the known-K term (AMBERLINE -> same K)', async () => {
          const actual = resultJson(await ctx.running.client.callTool('search_pages', { query: 'AMBERLINE' }));
          const expected = expectedSearch(ctx.corpus, ctx.view, 'AMBERLINE');
          expect(expected.map((r) => r.id)).toEqual(['controls/gamma', 'controls/delta', 'controls/epsilon']);
          const mismatches = compareFields(expected, actual, 'search_pages(AMBERLINE)');
          expect(formatComparisons(mismatches)).toBe(ALL_FIELDS_BYTE_EQUAL);
        });
      });
    }
  });
});
