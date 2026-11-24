/**
 * The paged hub listing on the agent surfaces (#342, WP05; FR-013, FR-015,
 * research R5). Every listing page from 2 on is one `kind: "Listing"` record in
 * `/api/index.json`, appended after the docs records and before the OpenAPI
 * records, and one per-page JSON that lists its children; no child is listed
 * twice; the build id folds the listing in; a site without a paged hub serves
 * byte-identical artifacts. The hub data reaches the routes through the
 * `DK_HUB_DATA` handoff (as the OpenAPI publication does through `DK_OPENAPI`).
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { restoreInternalEnv } from './helpers/restore-internal-env';
import { spawnSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';
import { DK_DOCS_ROOT_ENV, DK_HUB_DATA_ENV, DK_OPENAPI_ENV, deleteInternalEnv, setInternalEnv } from '../lib/internal-env.mjs';
import type { HubCap } from '../lib/child-cap.js';
import { publicationFile } from './helpers/openapi-publication.js';

const pad = (n: number) => String(n).padStart(3, '0');
const { entries } = vi.hoisted(() => ({ entries: [] as Array<{ id: string; body: string; data: Record<string, unknown> }> }));

vi.mock('astro:content', () => ({ getCollection: async () => entries }));

const { agentIndexRoute } = await import('../lib/routes/agent-index.js');
const { agentPageRoute } = await import('../lib/routes/agent-page.js');
const { llmsTxtRoute } = await import('../lib/routes/llms-txt.js');

restoreInternalEnv();

const SITE = new URL('https://docs.example.test/');
const doc = (id: string, title: string, kind = 'Guide', description = `About ${title}.`) => ({
  id,
  body: `${title} body.`,
  data: { title, description, doc_status: 'active', updated: '2026-11-24', kind },
});

/** A `missions` hub with 120 children (titles in slug order) and a `guides` section. */
function corpus(): void {
  entries.length = 0;
  entries.push(doc('index', 'Home'), doc('guides', 'Guides', 'Hub'), doc('guides/one', 'One'), doc('missions', 'Missions', 'Hub', 'Every mission.'));
  for (let i = 1; i <= 120; i += 1) entries.push(doc(`missions/m-${pad(i)}`, `Mission ${pad(i)}`));
}

const hub = (count: number, pageSize: number, capped = true): HubCap => ({
  cap: 50,
  count,
  capped,
  pageSize,
  children: Array.from({ length: count }, (_, i) => ({ slug: `missions/m-${pad(i + 1)}`, label: `Mission ${pad(i + 1)}` })),
});
const { writeHubData, readHubData, openApiStampConfig } = await import('../lib/routes/shared.js');
const handoffDir = mkdtempSync(path.join(tmpdir(), 'dk-hub-data-'));
/** Publish hub data as the integration does: a file, its path in `DK_HUB_DATA`. */
const publish = (data: Array<[string, HubCap]> | undefined) =>
  data === undefined ? deleteInternalEnv(DK_HUB_DATA_ENV) : setInternalEnv(DK_HUB_DATA_ENV, writeHubData(handoffDir, data));

type Index = { count: number; buildId: string; pages: Array<Record<string, unknown> & { slug: string; kind: string }> };
const index = async (): Promise<Index> =>
  JSON.parse(await (await agentIndexRoute({ title: 'Docs' })({ site: SITE } as never)).text()) as Index;
const llms = async (): Promise<string> => (await llmsTxtRoute({ title: 'Docs' })({ site: SITE } as never)).text();

const roots: string[] = [];
afterEach(() => {
  publish(undefined);
  deleteInternalEnv(DK_DOCS_ROOT_ENV);
  deleteInternalEnv(DK_OPENAPI_ENV);
  for (const r of roots.splice(0)) rmSync(r, { recursive: true, force: true });
});

describe('listing records in /api/index.json (T022)', () => {
  it('appends one Listing record per page from 2 on, after the docs records', async () => {
    corpus();
    publish([['guides', { cap: 50, count: 1, capped: false, pageSize: 50, children: [{ slug: 'guides/one', label: 'One' }] }], ['missions', hub(120, 50)]]);
    const { pages, count } = await index();
    const listing = pages.filter((p) => p.kind === 'Listing');
    expect(listing.map((p) => p.slug)).toEqual(['missions/page/2', 'missions/page/3']);
    expect(pages.slice(-2)).toEqual(listing);
    expect(listing[0]).toMatchObject({
      slug: 'missions/page/2',
      route: '/missions/page/2/',
      section: 'missions',
      title: 'Missions, page 2',
      description: 'Children 51–100 of 120 of the Missions hub.',
      doc_status: 'active',
      kind: 'Listing',
      listing_of: 'missions',
      page: 2,
      of: 3,
      related: [],
      audience: [],
      url: 'https://docs.example.test/missions/page/2/',
      source: 'https://docs.example.test/api/pages/missions/page/2.json',
      _links: { self: { href: 'https://docs.example.test/api/pages/missions/page/2.json' }, html: { href: 'https://docs.example.test/missions/page/2/' }, related: [] },
    });
    expect(count).toBe(pages.length);
    // No child is listed twice because of paging.
    const slugs = pages.map((p) => p.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
    expect(slugs.filter((s) => s.startsWith('missions/m-'))).toHaveLength(120);
  });

  it('adds nothing, byte for byte, without a paged hub', async () => {
    corpus();
    publish(undefined);
    const none = JSON.stringify(await index());
    publish([['missions', hub(120, 500)]]);
    expect(JSON.stringify(await index())).toBe(none);
    publish([['missions', hub(120, 50, false)]]);
    expect(JSON.stringify(await index())).toBe(none);
  });

  it('folds the listing into the build id: a page-size change changes it, the same input does not', async () => {
    corpus();
    publish([['missions', hub(120, 50)]]);
    const a = (await index()).buildId;
    expect((await index()).buildId).toBe(a);
    publish([['missions', hub(120, 40)]]);
    expect((await index()).buildId).not.toBe(a);
    publish(undefined);
    expect((await index()).buildId).not.toBe(a);
  });

  it('gives a hub whose section does not feed the agent API no listing records', async () => {
    corpus();
    const root = mkdtempSync(path.join(tmpdir(), 'dk-listing-feeds-'));
    roots.push(root);
    mkdirSync(path.join(root, '_meta'), { recursive: true });
    writeFileSync(
      path.join(root, '_meta', 'sections.yaml'),
      'version: 1\nsections:\n  - id: guides\n    label: Guides\n    order: 10\n  - id: missions\n    label: Missions\n    order: 20\n    feeds: [sitemap]\n',
    );
    setInternalEnv(DK_DOCS_ROOT_ENV, root);
    publish([['missions', hub(120, 50)]]);
    const { pages } = await index();
    expect(pages.filter((p) => p.kind === 'Listing')).toEqual([]);
    expect(await llms()).not.toContain('page/2');
  });
});

describe('per-listing-page JSON (T023)', () => {
  it('builds a path per listing page, and its payload lists that page\'s children with the index stamp', async () => {
    corpus();
    publish([['missions', hub(120, 50)]]);
    const route = agentPageRoute();
    const paths = (await route.getStaticPaths({} as never)) as Array<{ params: { slug: string }; props: Record<string, unknown> }>;
    const listing = paths.filter((p) => p.params.slug.startsWith('missions/page/'));
    expect(listing.map((p) => p.params.slug)).toEqual(['missions/page/2', 'missions/page/3']);
    const response = await route.GET({ props: listing[0]!.props, site: SITE } as never);
    const payload = JSON.parse(await response.text());
    expect(payload).toMatchObject({ slug: 'missions/page/2', kind: 'Listing', listing_of: 'missions', page: 2, of: 3, doc_status: 'active' });
    expect(payload.children).toHaveLength(50);
    expect(payload.children[0]).toEqual({ slug: 'missions/m-051', title: 'Mission 051', url: 'https://docs.example.test/missions/m-051/' });
    expect(payload.children.at(-1).slug).toBe('missions/m-100');
    expect(payload.markdown).toContain('- [Mission 051](https://docs.example.test/missions/m-051/)');
    expect(payload.buildId).toBe((await index()).buildId);
    expect(payload._links.self.href).toBe('https://docs.example.test/api/pages/missions/page/2.json');
  });

  it('builds no listing path without a paged hub', async () => {
    corpus();
    publish(undefined);
    const paths = (await agentPageRoute().getStaticPaths({} as never)) as Array<{ params: { slug: string } }>;
    expect(paths.some((p) => p.params.slug.includes('/page/'))).toBe(false);
  });
});

describe('the DK_HUB_DATA handoff (route-shaping integration, astro:config:setup)', () => {
  it('publishes the same hub data the virtual module serves', async () => {
    const { routeShapingIntegration, routeShapingSource } = await import('../lib/integrations/route-shaping.js');
    const root = mkdtempSync(path.join(tmpdir(), 'dk-hub-handoff-'));
    roots.push(root);
    const page = (title: string, extra = '', kind = 'Guide') =>
      `---\ntitle: ${JSON.stringify(title)}\ndescription: d\ndoc_status: active\nupdated: 2026-11-24T00:00:00Z\nkind: ${kind}\n${extra}---\n\nBody.\n`;
    mkdirSync(path.join(root, 'docs', 'missions'), { recursive: true });
    writeFileSync(path.join(root, 'docs', 'missions', 'README.md'), page('Missions', 'sidebar_child_cap: 1\nhub_page_size: 1\n', 'Hub'));
    for (const n of ['a', 'b', 'c']) writeFileSync(path.join(root, 'docs', 'missions', `${n}.md`), page(`Mission ${n}`));
    const cwd = vi.spyOn(process, 'cwd').mockReturnValue(root);
    try {
      const options = { docsDir: 'docs', base: '/', shapeSidebar: false, pagination: true };
      const state = { unpublishedDirs: [], unpublishedPaths: [] } as never;
      publish(undefined);
      const hooks = routeShapingIntegration(options, state).hooks as Record<string, (arg: unknown) => void>;
      // Since consolidation the setup hook writes the handoff (one computation).
      hooks['astro:config:setup']!({ updateConfig: () => {}, injectRoute: () => {}, config: { cacheDir: pathToFileURL(path.join(root, '.astro') + '/') } });
      const text = routeShapingSource(options, state);
      const served = JSON.parse(text.slice(text.indexOf('{'), text.lastIndexOf('}') + 1)).hubCaps;
      // The handoff is a file path, never the data itself (review cycle 1: E2BIG).
      expect(process.env[DK_HUB_DATA_ENV]).toMatch(/\.hubs\.json$/);
      expect(readHubData()).toEqual(served);
      expect(served[0][1]).toMatchObject({ count: 3, capped: true, pageSize: 1 });
    } finally {
      cwd.mockRestore();
    }
  });
});

describe('review cycle 1 (WP05)', () => {
  it('hands off more than 128 KiB of hub data, and a child process still spawns (issue 1)', () => {
    const big: Array<[string, HubCap]> = Array.from({ length: 40 }, (_, h) => [
      `hub-${h}`,
      { cap: 1, count: 100, capped: true, pageSize: 10, children: Array.from({ length: 100 }, (_, i) => ({ slug: `hub-${h}/a-rather-long-child-slug-${i}`, label: `A rather long child label number ${i}` })) },
    ]);
    expect(JSON.stringify(big).length).toBeGreaterThan(128 * 1024);
    publish(big);
    expect(process.env[DK_HUB_DATA_ENV]!.length).toBeLessThan(1024);
    const child = spawnSync(process.execPath, ['-e', ''], { env: process.env });
    expect(child.error).toBeUndefined();
    expect(child.status).toBe(0);
    expect(readHubData()).toHaveLength(40);
  });

  it('reads and parses the handoff once per file (issue 1)', () => {
    publish([['missions', hub(120, 50)]]);
    expect(readHubData()).toBe(readHubData());
  });

  it('lists no listing record for a hub the agent index leaves out (issue 2)', async () => {
    corpus();
    const hubDoc = entries.find((e) => e.id === 'missions')!;
    hubDoc.data = { ...hubDoc.data, agent: { discoverable: false } };
    publish([['missions', hub(120, 50)]]);
    const { pages } = await index();
    expect(pages.some((p) => p.slug === 'missions')).toBe(false);
    expect(pages.filter((p) => p.kind === 'Listing')).toEqual([]);
  });

  it('folds the children\'s order into the build id (item 4, M5)', async () => {
    corpus();
    publish([['missions', hub(120, 50)]]);
    const a = (await index()).buildId;
    const reordered = hub(120, 50);
    reordered.children = [...reordered.children].reverse();
    publish([['missions', reordered]]);
    expect((await index()).buildId).not.toBe(a);
  });

  it('gives a nested hub\'s listing record the top-level section (item 4, M15)', async () => {
    entries.length = 0;
    entries.push(doc('index', 'Home'), doc('plans', 'Plans', 'Hub'), doc('plans/missions', 'Missions', 'Hub'));
    const nested = hub(120, 50);
    nested.children = nested.children.map((c) => ({ ...c, slug: `plans/${c.slug}` }));
    for (const c of nested.children) entries.push(doc(c.slug, c.label));
    publish([['plans/missions', nested]]);
    const listing = (await index()).pages.filter((p) => p.kind === 'Listing');
    expect(listing.map((p) => [p.slug, p.section, p.listing_of])).toEqual([
      ['plans/missions/page/2', 'plans', 'plans/missions'],
      ['plans/missions/page/3', 'plans', 'plans/missions'],
    ]);
  });

  it('orders the index: docs, then Listing, then OpenAPI (item 5)', async () => {
    corpus();
    publish([['missions', hub(120, 50)]]);
    setInternalEnv(
      DK_OPENAPI_ENV,
      publicationFile({
        section: 'api',
        llmsOperations: false,
        versions: [{ label: 'v1', title: 'Pets', apiVersion: '1.0.0', released: true, rawRoute: '/api/openapi/v1.yaml', sha256: 'a'.repeat(64), operations: [] }],
      }),
    );
    const kinds = (await index()).pages.map((p) => (p.kind === 'Listing' ? 'L' : p.kind === 'Reference' && String(p.slug).startsWith('api/') ? 'O' : 'D'));
    const firstL = kinds.indexOf('L');
    const firstO = kinds.indexOf('O');
    expect(firstL).toBeGreaterThan(0);
    expect(firstO).toBeGreaterThan(firstL);
    expect(kinds.slice(0, firstL).every((k) => k === 'D')).toBe(true);
    expect(kinds.slice(firstL, firstO).every((k) => k === 'L')).toBe(true);
    expect(kinds.slice(firstO).every((k) => k === 'O')).toBe(true);
  });

  it('stamps nothing without a handoff (item 3: an unpaged site keeps its build id)', () => {
    publish(undefined);
    expect(openApiStampConfig()).toBeUndefined();
  });
});
