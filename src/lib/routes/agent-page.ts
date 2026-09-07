/**
 * `agentPageRoute` — per-page detail at `/api/pages/<id>.json` (the site root is
 * `home`). Gives an agent one page's metadata plus its raw Markdown body, so it
 * can fetch exactly what it needs without scraping HTML.
 *
 * Mount as `src/pages/api/pages/[...slug].json.ts`:
 *
 *   import { agentPageRoute } from '@commondocs-kitty/toolkit/routes';
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
      /** Raw Markdown source of the page (frontmatter stripped by Astro). */
      markdown: body,
    };

    return new Response(JSON.stringify(payload, null, 2), {
      headers: { 'Content-Type': 'application/json; charset=utf-8' },
    });
  };

  return { getStaticPaths, GET };
}
