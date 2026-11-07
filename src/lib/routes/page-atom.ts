/**
 * `pageAtomRoute` — one Atom entry document per published, dated page, at
 * `/api/pages/<id>.atom.xml` (page-chrome FR-020). The `doc-kitty:page-atom`
 * integration injects it, so a site mounts nothing; `pageFormats: { atom: false }`
 * turns it off. The document shape is `contracts/page-atom.md`.
 *
 * Section `feeds` do not filter these entries, matching `/api/pages/<id>.json`.
 */
import type { APIRoute, GetStaticPaths } from 'astro';
import { getCollection } from 'astro:content';
import type { DocKittyFrontmatter } from '../metadata.js';
import { pageSourceId, slugFromEntryId } from '../metadata.js';
import { feedInstant } from '../generator-stamp.mjs';
import { routeOfSlug } from '../vocabulary-core.mjs';
import { atomEligible } from './atom-eligible.js';
import { stripNonContent } from './strip-non-content.js';
import { absolute, xmlEscape } from './shared.js';

/** The response type; a static host sets its own header from the `.xml` extension. */
const PAGE_ATOM_CONTENT_TYPE = 'application/atom+xml;type=entry; charset=utf-8';

export interface AtomEntryInput {
  title: string;
  /** The absolute page URL, used as the entry `id`, `xml:base` and alternate link. */
  url: string;
  /** RFC 3339, from `feedInstant`. */
  updated: string;
  siteTitle: string;
  description?: string;
  /** The rendered page HTML, or undefined for a page with none (MDX), which gets no `<content>`. Minus scripts, styles, links and comments, escaped into `<content type="html">`. */
  html?: string;
}

export function buildAtomEntry({ title, url, updated, siteTitle, description, html }: AtomEntryInput): string {
  return [
    '<?xml version="1.0" encoding="utf-8"?>',
    `<entry xmlns="http://www.w3.org/2005/Atom" xml:base="${xmlEscape(url)}">`,
    `  <id>${xmlEscape(url)}</id>`,
    `  <title>${xmlEscape(title)}</title>`,
    `  <updated>${xmlEscape(updated)}</updated>`,
    `  <author><name>${xmlEscape(siteTitle)}</name></author>`,
    `  <link rel="alternate" type="text/html" href="${xmlEscape(url)}"/>`,
    ...(description ? [`  <summary>${xmlEscape(description)}</summary>`] : []),
    ...(html === undefined ? [] : [`  <content type="html">${xmlEscape(stripNonContent(html))}</content>`]),
    '</entry>',
    '',
  ].join('\n');
}

export interface PageAtomRouteOptions {
  /** The site title, the entry's `author`. */
  siteTitle: string;
}

export function pageAtomRoute(options: PageAtomRouteOptions) {
  const getStaticPaths: GetStaticPaths = async () => {
    const entries = await getCollection('docs');
    return entries
      .filter((entry) => atomEligible({ id: entry.id, data: entry.data as unknown as DocKittyFrontmatter }))
      .map((entry) => ({
        params: { slug: pageSourceId(slugFromEntryId(entry.id)) },
        props: { id: entry.id },
      }));
  };

  const GET: APIRoute = async ({ props, site }) => {
    const { id } = props as { id: string };
    const entry = (await getCollection('docs')).find((e) => e.id === id);
    if (!entry) return new Response('not found', { status: 404 });
    const data = entry.data as unknown as DocKittyFrontmatter;
    const instant = feedInstant(data);
    if (!instant) return new Response('not found', { status: 404 });
    const rendered = (entry as { rendered?: { html?: string } }).rendered;
    const xml = buildAtomEntry({
      title: data.title,
      url: absolute(site, routeOfSlug(slugFromEntryId(id))),
      updated: instant.toISOString(),
      siteTitle: options.siteTitle,
      ...(data.description ? { description: data.description } : {}),
      ...(rendered?.html === undefined ? {} : { html: rendered.html }),
    });
    return new Response(xml, { headers: { 'Content-Type': PAGE_ATOM_CONTENT_TYPE } });
  };

  return { getStaticPaths, GET };
}
