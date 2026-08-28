import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

/**
 * Route-level coverage for the section-level `feeds` filter (WIRED) and the
 * llms.txt `purpose`/README blurb — the last two registry consumers. The three
 * discovery routes statically import `astro:content`, which the framework-agnostic
 * vitest suite neutralizes with a factory (mirrors docs-root.test.ts). A mutable
 * `entries` list (via `vi.hoisted`) drives BOTH `collectDocEntries()` (reads
 * `entry.data`) and `docsRoot()` (derives the registry root from `entry.filePath`),
 * so the routes read the temp `_meta/sections.yaml` written below.
 *
 * The temp registry:
 *   - context — feeds ALL four; README HAS a description (blurb README-wins);
 *   - plans   — feeds [sitemap, llms, agent] (NOT rss); README has NO description
 *               so its blurb falls back to the registry `purpose`;
 *   - guides  — OMITS `feeds` entirely (absent = all) and has no purpose/README
 *               description (no blurb line);
 *   - secret  — feeds [sitemap] only (excluded from rss/llms/agent).
 */

const { entries } = vi.hoisted(() => ({
  entries: [] as Array<{ id: string; filePath: string; data: Record<string, unknown> }>,
}));

vi.mock('astro:content', () => ({
  getCollection: async () => entries,
}));

const REGISTRY_YAML = `version: 1
sections:
  - id: context
    label: Context
    order: 10
    purpose: Context registry purpose fallback.
    feeds: [sitemap, rss, llms, agent]
  - id: plans
    label: Plans
    order: 20
    purpose: Roadmap and feature designs.
    feeds: [sitemap, llms, agent]
  - id: guides
    label: Guides
    order: 30
  - id: secret
    label: Secret
    order: 40
    feeds: [sitemap]
`;

let root: string;

const { rssRoute } = await import('../lib/routes/rss.js');
const { llmsTxtRoute } = await import('../lib/routes/llms-txt.js');
const { agentIndexRoute } = await import('../lib/routes/agent-index.js');

const SITE = new URL('https://docs.example/');

/** Register one mock content entry (README-as-index: a README's id == its section). */
function addEntry(id: string, relPath: string, data: Record<string, unknown>): void {
  entries.push({ id, filePath: path.join(root, relPath), data });
}

async function renderText(route: ReturnType<typeof rssRoute>): Promise<string> {
  const res = await (route as (ctx: { site: URL }) => Promise<Response>)({ site: SITE });
  return res.text();
}

beforeAll(() => {
  root = mkdtempSync(path.join(tmpdir(), 'dk-route-feeds-'));
  mkdirSync(path.join(root, '_meta'), { recursive: true });
  writeFileSync(path.join(root, '_meta', 'sections.yaml'), REGISTRY_YAML, 'utf8');

  entries.length = 0;
  // context — README carries a description (blurb prefers it over `purpose`).
  addEntry('context', 'context/README.md', {
    title: 'Context',
    description: 'Context README description wins.',
    doc_status: 'active',
    kind: 'Hub',
  });
  addEntry('context/intro', 'context/intro.md', {
    title: 'Intro',
    description: 'The intro page.',
    doc_status: 'active',
  });
  // A published-but-agent-opted-out page: in RSS (published) yet absent from
  // llms/agent (rankForAgents drops non-discoverable) — proves per-page gating
  // still applies on top of the feeds filter.
  addEntry('context/nodisc', 'context/nodisc.md', {
    title: 'Not Discoverable',
    doc_status: 'active',
    agent: { discoverable: false },
  });
  // A draft: excluded from every surface by per-page publication gating.
  addEntry('context/draft', 'context/draft.md', {
    title: 'Draft Page',
    doc_status: 'draft',
  });
  // plans — README has NO description, so its llms blurb falls back to `purpose`.
  // Section OMITS rss, so plans pages must not appear in the feed.
  addEntry('plans', 'plans/README.md', { title: 'Plans', doc_status: 'active' });
  addEntry('plans/roadmap', 'plans/roadmap.md', {
    title: 'Roadmap',
    doc_status: 'active',
  });
  // guides — omits `feeds` (absent = all) and has neither README description nor
  // registry purpose (no blurb line at all).
  addEntry('guides', 'guides/README.md', { title: 'Guides', doc_status: 'active' });
  addEntry('guides/start', 'guides/start.md', {
    title: 'Getting Started',
    doc_status: 'active',
  });
  // secret — feeds sitemap ONLY (excluded from rss/llms/agent).
  addEntry('secret/hidden', 'secret/hidden.md', {
    title: 'Hidden',
    doc_status: 'active',
  });
});

afterAll(() => {
  rmSync(root, { recursive: true, force: true });
  entries.length = 0;
});

describe('rssRoute — section `feeds` filter (rss)', () => {
  it('drops a section that does not feed rss, keeps absent-feeds + fed sections, honors per-page publication', async () => {
    const xml = await renderText(rssRoute({ title: 'Docs' }));
    // context feeds rss → its pages present.
    expect(xml).toContain('https://docs.example/context/');
    expect(xml).toContain('https://docs.example/context/intro/');
    // context/nodisc is PUBLISHED, so it IS an RSS item (discoverable only gates
    // llms/agent) — proving feeds composes with, not replaces, per-page gating.
    expect(xml).toContain('https://docs.example/context/nodisc/');
    // guides omits `feeds` (absent = all) → present in rss.
    expect(xml).toContain('https://docs.example/guides/start/');
    // plans does NOT feed rss → dropped.
    expect(xml).not.toContain('https://docs.example/plans/roadmap/');
    // secret feeds sitemap only → dropped from rss.
    expect(xml).not.toContain('https://docs.example/secret/hidden/');
    // draft is unpublished → absent regardless of feeds.
    expect(xml).not.toContain('https://docs.example/context/draft/');
  });
});

describe('agentIndexRoute — section `feeds` filter (agent)', () => {
  it('drops a section not feeding agent, keeps fed + absent-feeds, honors discoverable gating', async () => {
    const json = JSON.parse(await renderText(agentIndexRoute({ title: 'Docs' })));
    const slugs: string[] = json.pages.map((p: { slug: string }) => p.slug);
    // plans feeds agent → present.
    expect(slugs).toContain('plans/roadmap');
    // guides omits feeds (absent = all) → present.
    expect(slugs).toContain('guides/start');
    expect(slugs).toContain('context/intro');
    // secret feeds sitemap only → dropped from agent index.
    expect(slugs).not.toContain('secret/hidden');
    // per-page gating still applies: non-discoverable and draft are absent.
    expect(slugs).not.toContain('context/nodisc');
    expect(slugs).not.toContain('context/draft');
    // count mirrors the emitted list.
    expect(json.count).toBe(json.pages.length);
  });
});

describe('llmsTxtRoute — section `feeds` filter (llms) + purpose/README blurb', () => {
  it('drops a non-llms section and keeps fed + absent-feeds sections', async () => {
    const txt = await renderText(llmsTxtRoute({ title: 'Docs' }));
    expect(txt).toContain('https://docs.example/context/intro/');
    expect(txt).toContain('https://docs.example/plans/roadmap/');
    expect(txt).toContain('https://docs.example/guides/start/');
    // secret feeds sitemap only → its heading and pages are absent from llms.txt.
    expect(txt).not.toContain('https://docs.example/secret/hidden/');
    expect(txt).not.toMatch(/^## Secret$/m);
    // non-discoverable + draft still excluded by per-page gating.
    expect(txt).not.toContain('https://docs.example/context/nodisc/');
    expect(txt).not.toContain('https://docs.example/context/draft/');
  });

  it('emits the section README description as the blurb (README wins over purpose)', async () => {
    const txt = await renderText(llmsTxtRoute({ title: 'Docs' }));
    // context README has a description → it is the blurb, NOT the registry purpose.
    expect(txt).toContain('Context README description wins.');
    expect(txt).not.toContain('Context registry purpose fallback.');
  });

  it('falls back to the registry purpose when the README has no description', async () => {
    const txt = await renderText(llmsTxtRoute({ title: 'Docs' }));
    // plans README has no description → the registry purpose is the blurb.
    expect(txt).toContain('Roadmap and feature designs.');
  });

  it('emits NO blurb line for a section with neither README description nor purpose', async () => {
    const txt = await renderText(llmsTxtRoute({ title: 'Docs' }));
    // The Guides group heads straight into its page list — no blurb paragraph,
    // and no empty blurb line, between the H2 and the first bullet.
    const guidesBlock = txt.slice(txt.indexOf('## Guides'));
    expect(guidesBlock).toMatch(/^## Guides\n\n- \[/);
  });
});
