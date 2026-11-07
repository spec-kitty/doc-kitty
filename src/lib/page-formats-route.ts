/**
 * The current page's links, for the carriers: {@link pageFormatLinks} and
 * {@link sourceLink} fed from the running build. Separate from `page-formats.ts`
 * because it imports `astro:content`.
 *
 * The entry comes from the collection, not from the route. Starlight gives a 404 or a
 * `StarlightPage` (OpenAPI) route a made-up entry whose `filePath` looks like a real
 * file, so the collection is the only way to tell them from a page.
 */
import path from 'node:path';
import process from 'node:process';
import { getEntry } from 'astro:content';
import { chromeOptions } from './chrome-options.js';
import { DK_DOCS_ROOT_ENV, DK_INDEX_BASENAME_ENV } from './internal-env.mjs';
import { ROOT_ENTRY_ID } from './metadata.js';
import { headAlternates, pageFormatLinks, sourceLink, type HeadAlternate, type PageEntry, type PageFormatLink } from './page-formats.js';
import { servedSurfaces } from './served-surfaces.js';
import { parsePublishedIndexBasenames } from './vocabulary-core.mjs';

export interface CurrentPageLinks {
  formats: PageFormatLink[];
  source: string | undefined;
  head: HeadAlternate[];
}

export async function currentPageLinks(routeEntry: { id: string }): Promise<CurrentPageLinks> {
  // A route's entry has `''` for the root, whose collection id is `index`.
  const entry = (await getEntry('docs', routeEntry.id || ROOT_ENTRY_ID)) as unknown as PageEntry | undefined;
  const surfaces = servedSurfaces();
  const options = chromeOptions();
  const base = import.meta.env.BASE_URL;
  const docsRoot = process.env[DK_DOCS_ROOT_ENV];
  const formats = pageFormatLinks({
    entry,
    surfaces,
    options,
    base,
    // Without the integration's docs root no source path can be mapped: no OKF link.
    docsDir: docsRoot === undefined ? '\0' : path.relative(process.cwd(), docsRoot).split(path.sep).join('/'),
    indexBasename: parsePublishedIndexBasenames(process.env[DK_INDEX_BASENAME_ENV]),
  });
  return { formats, source: sourceLink(entry, options.repository), head: headAlternates(surfaces, formats, base) };
}
