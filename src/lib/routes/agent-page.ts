/**
 * `agentPageRoute` — per-page detail at `/api/pages/<id>.json` (the site root is
 * `home`). Gives an agent one page's metadata plus its raw Markdown body, so it
 * can fetch exactly what it needs without scraping HTML.
 *
 * `::gherkin{…}` includes (ADR-0051) are EXPANDED in `markdown`: the fence
 * stage recorded each include's Markdown and body offsets in the entry's
 * rendered frontmatter (`gherkin/agent-includes.mjs`), and this route splices
 * them in and lists them under `includes`. It needs no filesystem, include
 * roots or parser: its module graph must not reach `@cucumber/gherkin`
 * (asserted in `agent-page-includes.test.ts`). A page with no include gets an
 * unchanged payload.
 *
 * Mount as `src/pages/api/pages/[...slug].json.ts`:
 *
 *   import { agentPageRoute } from '@spec-kitty/doc-toolkit/routes';
 *   const route = agentPageRoute();
 *   export const getStaticPaths = route.getStaticPaths;
 *   export const GET = route.GET;
 */
import type { APIRoute, GetStaticPaths } from 'astro';
import { getCollection } from 'astro:content';
import type { AudienceEntry, DocKittyFrontmatter, ResolvedRelated } from '../metadata.js';
import { pageSourceId, resolveRelated, slugFromEntryId, toAgentRecord } from '../metadata.js';
import { absolute } from './shared.js';
import { buildDocsIndex, collectDocEntries } from '../docs-index.js';
import { readAgentIncludes, spliceAgentIncludes } from '../gherkin/agent-includes.mjs';

export function agentPageRoute() {
  const getStaticPaths: GetStaticPaths = async () => {
    const entries = await getCollection('docs');
    return entries.map((entry) => ({
      params: { slug: pageSourceId(slugFromEntryId(entry.id)) },
      props: { id: entry.id, body: entry.body ?? '' },
    }));
  };

  const GET: APIRoute = async ({ props, site }) => {
    const { id, body } = props as { id: string; body: string };
    const entries = await getCollection('docs');
    const entry = entries.find((e) => e.id === id);
    if (!entry) {
      return new Response(JSON.stringify({ error: 'not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json; charset=utf-8' },
      });
    }

    const data = entry.data as unknown as DocKittyFrontmatter;
    const record = toAgentRecord({ slug: slugFromEntryId(id), data });
    // Resolve `related` against the full corpus and carry `audience` as
    // authored. Enrichment is route-local; toAgentRecord stays pure.
    const index = buildDocsIndex(await collectDocEntries());
    const related: ResolvedRelated[] = record.related.map((ref) => {
      const resolved = resolveRelated(ref, index);
      return {
        ref: resolved.ref,
        title: resolved.title,
        kind: resolved.kind,
        doc_status: resolved.doc_status,
      };
    });
    const audience: AudienceEntry[] = data.audience ?? [];
    // `rendered` is the content layer's stored render (glob-loaded Markdown);
    // its frontmatter is the remark-time copy, not the validated `entry.data`.
    const rendered = (entry as { rendered?: { metadata?: { frontmatter?: unknown } } }).rendered;
    const expanded = spliceAgentIncludes(body, readAgentIncludes(rendered?.metadata?.frontmatter));
    const payload = {
      ...record,
      related,
      audience,
      url: absolute(site, record.route),
      authors: data.authors ?? [],
      keywords: data.agent?.keywords ?? [],
      ...(data.generated ? { generated: data.generated } : {}),
      ...(data.verified ? { verified: data.verified } : {}),
      ...(data.sources ? { sources: data.sources } : {}),
      ...(expanded.includes.length > 0 ? { includes: expanded.includes } : {}),
      /**
       * Raw Markdown source of the page (frontmatter stripped by Astro), with
       * every `::gherkin` include replaced by the scenarios it renders.
       */
      markdown: expanded.markdown,
    };

    return new Response(JSON.stringify(payload, null, 2), {
      headers: { 'Content-Type': 'application/json; charset=utf-8' },
    });
  };

  return { getStaticPaths, GET };
}
