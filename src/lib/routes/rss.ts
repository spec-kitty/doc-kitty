/**
 * `rssRoute` — RSS 2.0 feed of published documentation, newest change first.
 *
 * Mount in a site as `src/pages/rss.xml.ts`:
 *
 *   import { rssRoute } from '@commondocs-kitty/toolkit/routes';
 *   export const GET = rssRoute({ title: 'My Docs', description: '…' });
 */
import type { APIRoute } from 'astro';
import { rankForFeed, sectionOf, updatedMillis, sectionLabel, includedInRssFeed } from '../metadata.js';
import { loadSectionRegistry, sectionLabels } from '../sections.js';
import { absolute, collectDocEntries, docsRoot, xmlEscape } from './shared.js';

export interface RssRouteOptions {
  title: string;
  description?: string;
}

export function rssRoute(options: RssRouteOptions): APIRoute {
  return async ({ site }) => {
    // FR-011 (T013): exclude `kind: Presentation` decks from RSS *here* in the
    // route body — `rankForFeed` stays untouched so sitemap/llms/agent keep the
    // deck (RT-07). The exclusion predicate is a pure metadata helper so it is
    // unit-testable without pulling in Astro; it keys on frontmatter `kind`,
    // never the section path, so a deck filed anywhere is still excluded (A-05).
    const entries = rankForFeed(await collectDocEntries()).filter(includedInRssFeed);
    // Registry-driven section labels for the item <category> fallback; a
    // registry-free root falls back to SECTION_LABEL inside sectionLabel (#18).
    // Resolved from the content layer so a custom docs directory is honored (#22).
    const registry = loadSectionRegistry(await docsRoot());
    const labels = registry ? sectionLabels(registry) : undefined;
    const self = absolute(site, '/rss.xml');
    const home = absolute(site, '/');

    const items = entries
      .map((entry) => {
        const link = absolute(site, entry.slug === '' ? '/' : `/${entry.slug}/`);
        const millis = updatedMillis(entry.data);
        const pubDate = millis ? new Date(millis).toUTCString() : undefined;
        const section = sectionOf(entry.slug);
        const category = entry.data.type ?? sectionLabel(section, labels) ?? 'Doc';
        return [
          '    <item>',
          `      <title>${xmlEscape(entry.data.title)}</title>`,
          `      <link>${xmlEscape(link)}</link>`,
          `      <guid>${xmlEscape(link)}</guid>`,
          entry.data.description
            ? `      <description>${xmlEscape(entry.data.description)}</description>`
            : '',
          pubDate ? `      <pubDate>${pubDate}</pubDate>` : '',
          `      <category>${xmlEscape(category)}</category>`,
          '    </item>',
        ]
          .filter(Boolean)
          .join('\n');
      })
      .join('\n');

    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>${xmlEscape(options.title)}</title>
    <link>${xmlEscape(home)}</link>
    <atom:link href="${xmlEscape(self)}" rel="self" type="application/rss+xml" />
    ${options.description ? `<description>${xmlEscape(options.description)}</description>` : '<description>Documentation updates</description>'}
${items}
  </channel>
</rss>
`;

    return new Response(xml, {
      headers: { 'Content-Type': 'application/rss+xml; charset=utf-8' },
    });
  };
}
