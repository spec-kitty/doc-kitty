/**
 * The links a page offers to machines (page-chrome FR-001, FR-019, FR-021 to FR-024):
 * the site's machine entry points, this page's formats and its source file. Pure, no
 * Astro imports: `page-formats-route.ts` feeds it from the running build, and the
 * footer and the head render from the same result, so they cannot disagree.
 */
import { isGeneratedStamp } from './generator-stamp.mjs';
import type { ChromeOptions, RepositorySettings } from './chrome-options.js';
import { normalizeBasePrefix } from './integrations/shared.js';
import type { DocKittyFrontmatter, IndexBasenameOption } from './metadata.js';
import { isDraftEntry, pageSourceId, slugFromEntryId } from './metadata.js';
import { bundlePathOf } from './okf-export/core.mjs';
import { atomEligible } from './routes/atom-eligible.js';
import type { ServedSurfaces } from './served-surfaces.js';

export interface MachineEntryPoint {
  label: string;
  /** Site-absolute, without the base. */
  path: string;
}

export interface PageFormatLink {
  label: 'JSON' | 'OKF' | 'Atom';
  href: string;
  type: string;
}

export interface HeadAlternate {
  type: string;
  title: string;
  href: string;
}

/** A docs collection entry. A page the collection does not hold, such as a 404, has none. */
export interface PageEntry {
  id: string;
  data: DocKittyFrontmatter;
  /** The source file, relative to the project root. */
  filePath?: string;
}

/** What the site serves, in footer order. `surfaces` is undefined when detection has not run. */
export function machineEntryPoints(surfaces: ServedSurfaces | undefined): MachineEntryPoint[] {
  if (!surfaces) return [];
  const all: Array<[boolean, string, string]> = [
    [surfaces.llms, 'LLM index', '/llms.txt'],
    [surfaces.agentIndex, 'Agent API', '/api/index.json'],
    [surfaces.contentGraph, 'Content graph', '/api/content-graph.json'],
    [surfaces.rss, 'RSS', '/rss.xml'],
    [surfaces.sitemap, 'Sitemap', '/sitemap-index.xml'],
    [surfaces.bibliography, 'Bibliography', '/api/bibliography.json'],
    [surfaces.scenarios, 'Scenarios', '/api/scenarios.json'],
    [surfaces.okf, 'OKF bundle', '/okf/index.md'],
  ];
  return all.filter(([served]) => served).map(([, label, path]) => ({ label, path }));
}

const encodePath = (rel: string): string => rel.split('/').map(encodeURIComponent).join('/');

/** The page's OKF node id: its source path below the docs folder, without the extension. */
function nodeIdOf(filePath: string | undefined, docsDir: string): string | undefined {
  if (filePath === undefined) return undefined;
  const prefix = docsDir === '' ? '' : `${docsDir}/`;
  return filePath.startsWith(prefix) ? filePath.slice(prefix.length).replace(/\.mdx?$/i, '') : undefined;
}

export interface PageFormatInput {
  entry: PageEntry | undefined;
  surfaces: ServedSurfaces | undefined;
  options: Pick<ChromeOptions, 'pageFormats'>;
  /** The Astro `base`. */
  base: string;
  /** The docs folder, relative to the project root as `entry.filePath` is. */
  docsDir: string;
  indexBasename?: IndexBasenameOption;
}

/**
 * This page's formats. None for a page outside the docs collection, or for a draft
 * even when `DK_PUBLISH_DRAFTS=on` renders it, and for a page with `agent.discoverable: false`
 * (its source link stays: that is for reading the file).
 */
export function pageFormatLinks({ entry, surfaces, options, base, docsDir, indexBasename }: PageFormatInput): PageFormatLink[] {
  if (!entry || !surfaces || isDraftEntry(entry)) return [];
  // An author who opted out of agent discovery does not want machine formats advertised.
  if (entry.data.agent?.discoverable === false) return [];
  const prefix = normalizeBasePrefix(base);
  const pageId = encodePath(pageSourceId(slugFromEntryId(entry.id)));
  const links: PageFormatLink[] = [];
  if (surfaces.agentPages) links.push({ label: 'JSON', href: `${prefix}/api/pages/${pageId}.json`, type: 'application/json' });
  const nodeId = nodeIdOf(entry.filePath, docsDir);
  if (surfaces.okf && nodeId !== undefined) {
    links.push({ label: 'OKF', href: `${prefix}/okf/${encodePath(bundlePathOf(nodeId, indexBasename))}`, type: 'text/markdown' });
  }
  if (options.pageFormats.atom && surfaces.pageAtom && atomEligible(entry)) {
    links.push({ label: 'Atom', href: `${prefix}/api/pages/${pageId}.atom.xml`, type: 'application/atom+xml;type=entry' });
  }
  return links;
}

/** The head's `<link rel="alternate">` tags: the served feeds, then one per format, in that fixed order. */
export function headAlternates(surfaces: ServedSurfaces | undefined, formats: readonly PageFormatLink[], base: string): HeadAlternate[] {
  const prefix = normalizeBasePrefix(base);
  return [
    ...(surfaces?.rss ? [{ type: 'application/rss+xml', title: 'RSS', href: `${prefix}/rss.xml` }] : []),
    ...(surfaces?.llms ? [{ type: 'text/plain', title: 'llms.txt', href: `${prefix}/llms.txt` }] : []),
    ...formats.map(({ label, href, type }) => ({ type, title: label, href })),
  ];
}

const SOURCE_VIEW: Record<RepositorySettings['provider'], (repo: string, branch: string) => string> = {
  github: (repo, branch) => `https://github.com/${repo}/blob/${branch}`,
  gitlab: (repo, branch) => `https://gitlab.com/${repo}/-/blob/${branch}`,
  bitbucket: (repo, branch) => `https://bitbucket.org/${repo}/src/${branch}`,
};

/**
 * The page's source file on its host. None without repository settings, for a
 * generated page (its file is not what an author edits), for a draft, or for a page
 * with no file. Hosted services only: a self-hosted instance has another origin.
 */
export function sourceLink(entry: PageEntry | undefined, repository: RepositorySettings | undefined): string | undefined {
  if (!entry || !repository || !entry.filePath || isDraftEntry(entry)) return undefined;
  if (isGeneratedStamp(entry.data.generated?.by)) return undefined;
  const siteDir = (repository.siteDir ?? '').replace(/^(?:\.?\/)+|\/+$/g, '').replace(/^\.$/, '');
  const file = siteDir === '' ? entry.filePath : `${siteDir}/${entry.filePath}`;
  return `${SOURCE_VIEW[repository.provider](repository.repo, encodePath(repository.branch))}/${encodePath(file)}`;
}
