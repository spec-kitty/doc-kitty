/**
 * The exact bytes of the two sub-processor outputs (ADR-0086 decision 5):
 * `api/subprocessors.json` and the `subprocessors.xml` change feed.
 *
 * Pure: the injected routes call these and add nothing, so byte stability is
 * tested here without a build. Neither function may read the clock or the
 * environment beyond the site base that `absolute` applies (C-005): every date in
 * the output comes from a record's `since` or `until`.
 */
import { absolute, xmlEscape } from './routes/shared.js';
import type { ChangeEntry, ResolvedSubprocessor } from './subprocessors-core.mjs';

/** What both renderers read: a checked catalog with no problems. */
export interface SubprocessorsRenderInput {
  records: readonly ResolvedSubprocessor[];
  changes: readonly ChangeEntry[];
}

/** The catalog's path inside a docs root, as the API document names it. */
export const SUBPROCESSORS_SOURCE = '_meta/subprocessors.yaml';

/** Where the two outputs are served, before the site base. */
export const SUBPROCESSORS_API_PATH = '/api/subprocessors.json';
export const SUBPROCESSORS_FEED_PATH = '/subprocessors.xml';

const NOTICE = "Structure only, not legal advice. The site owner's contract governs.";
const FEED_DESCRIPTION = 'Additions and removals of sub-processors, including announced future changes.';

export interface SubprocessorsApiOptions {
  site: URL | undefined;
  /** The document's title; defaults to "Sub-processors". */
  title?: string;
}

/**
 * `api/subprocessors.json`: every record in file order, the dated changes, and
 * links to itself and the feed. Serialised like the other `api/*.json` routes.
 */
export function renderSubprocessorsApi(input: SubprocessorsRenderInput, options: SubprocessorsApiOptions): string {
  const body = {
    title: options.title ?? 'Sub-processors',
    source: SUBPROCESSORS_SOURCE,
    notice: NOTICE,
    count: input.records.length,
    records: input.records,
    changes: input.changes,
    _links: {
      self: { href: absolute(options.site, SUBPROCESSORS_API_PATH) },
      feed: { href: absolute(options.site, SUBPROCESSORS_FEED_PATH) },
    },
  };
  return JSON.stringify(body, null, 2);
}

export interface SubprocessorsFeedOptions {
  site: URL | undefined;
  /** The site's title; the channel is "<siteTitle>: sub-processor changes". */
  siteTitle: string;
  /**
   * The in-site path every item links to. Defaults to the API document; the
   * generated list page (ADR-0086 decision 6) passes its own route.
   */
  itemLink?: string;
}

/** A change date as an RFC 822 date at midnight UTC: no clock, no time zone. */
function pubDateOf(date: string): string {
  return new Date(`${date}T00:00:00Z`).toUTCString();
}

/**
 * `subprocessors.xml`: an RSS 2.0 channel with one item per change, in change
 * order (newest first). It carries no `lastBuildDate`, so the same catalog
 * renders the same bytes on any day.
 */
export function renderSubprocessorsFeed(input: SubprocessorsRenderInput, options: SubprocessorsFeedOptions): string {
  const self = absolute(options.site, SUBPROCESSORS_FEED_PATH);
  const home = absolute(options.site, '/');
  const link = absolute(options.site, options.itemLink ?? SUBPROCESSORS_API_PATH);
  const byId = new Map(input.records.map((record) => [record.id, record]));

  const items = input.changes
    .map((change) => {
      const record = byId.get(change.id);
      const verb = change.kind === 'added' ? 'Added' : 'Removed';
      const when = change.kind === 'added' ? 'from' : 'until';
      const description = record
        ? `${change.name} (${change.id}), ${when} ${change.date}. Processing: ${record.processing} Location: ${record.location.join(', ')}.`
        : `${change.name} (${change.id}), ${when} ${change.date}.`;
      return [
        '    <item>',
        `      <title>${xmlEscape(`${verb}: ${change.name}`)}</title>`,
        `      <link>${xmlEscape(link)}</link>`,
        `      <guid isPermaLink="false">${xmlEscape(`${self}#${change.id}-${change.kind}-${change.date}`)}</guid>`,
        `      <pubDate>${pubDateOf(change.date)}</pubDate>`,
        `      <category>${change.kind}</category>`,
        `      <description>${xmlEscape(description)}</description>`,
        '    </item>',
      ].join('\n');
    })
    .join('\n');

  return `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>${xmlEscape(`${options.siteTitle}: sub-processor changes`)}</title>
    <link>${xmlEscape(home)}</link>
    <atom:link href="${xmlEscape(self)}" rel="self" type="application/rss+xml" />
    <description>${FEED_DESCRIPTION}</description>
${items ? `${items}\n` : ''}  </channel>
</rss>
`;
}
