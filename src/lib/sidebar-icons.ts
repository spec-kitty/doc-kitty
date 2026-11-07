/**
 * Which icons a site authors (page-chrome WP07; FR-026, FR-027, NFR-007): the build's
 * side of the resolver in `sidebar-icons-core.mjs`, which the frontmatter gate shares.
 *
 * Authors set `sidebar.icon` on a page and `icon` on a section registry entry. A group
 * takes its section's icon, or else its index page's.
 */
import { readFileSync } from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import matter from 'gray-matter';
import { walkMarkdownPaths } from './docs-walk.mjs';
import { resolveIndexEntries, type IndexBasenameOption } from './metadata.js';
import { pageRouteSlug } from './route-shaping.js';
import { resolveSectionRegistry } from './sections.js';
import { resolveIcon, unknownIconMessage } from './sidebar-icons-core.mjs';

export { resolveIcon, unknownIconMessage };

/** One authored icon: a page's `sidebar.icon`. */
export interface AuthoredPageIcon {
  /** Docs-relative file. */
  rel: string;
  /** Route slug, as sidebar hrefs carry it. */
  slug: string;
  /** True when the page is its folder's index: its icon is then the group's. */
  isIndex: boolean;
  name: unknown;
}

/** One authored icon: a section registry entry's `icon`. */
export interface AuthoredSectionIcon {
  id: string;
  name: string;
}

export interface AuthoredIcons {
  pages: AuthoredPageIcon[];
  sections: AuthoredSectionIcon[];
}

/** What the sidebar needs of a resolved icon. */
export interface SidebarIcon {
  svg: string;
  /** A Font Awesome icon, so the page owes its licence comment (C-008). */
  fa: boolean;
}

/** The icons one site uses, as the route middleware reads them. */
export interface SidebarIconData {
  /** Page slug → icon, for a link. */
  links: Array<[string, SidebarIcon]>;
  /** Directory → icon, for a group. */
  groups: Array<[string, SidebarIcon]>;
}

/**
 * Read every authored icon from the sources: each page's raw frontmatter, through the
 * same walk and route rule as the sidebar's directory metadata, and the section registry.
 */
export function collectAuthoredIcons(
  docsDir: string,
  { indexBasename }: { indexBasename?: IndexBasenameOption } = {},
): AuthoredIcons {
  const root = path.resolve(process.cwd(), docsDir);
  const rels = walkMarkdownPaths(root);
  const { ids } = resolveIndexEntries(rels, { indexBasename });
  const pages = rels.flatMap((rel): AuthoredPageIcon[] => {
    const { sidebar } = matter(readFileSync(path.join(root, rel), 'utf8')).data as { sidebar?: { icon?: unknown } };
    if (sidebar?.icon === undefined) return [];
    return [{ rel, name: sidebar.icon, ...pageRouteSlug(rel, ids.get(rel) as string) }];
  });
  const sections = (resolveSectionRegistry(root, { warn: () => {} }) ?? []).flatMap(({ id, icon }) =>
    icon === undefined ? [] : [{ id, name: icon }],
  );
  return { pages, sections };
}

function resolved(where: string, name: unknown): SidebarIcon {
  const icon = resolveIcon(name);
  if (!icon) throw new Error(unknownIconMessage(where, name));
  return { svg: icon.svg, fa: icon.source === 'fa' };
}

/**
 * Resolve what was authored, throwing on the first unknown name, and keep what this
 * build can show: a withheld draft's name is checked, as the gate checks it, and left out.
 * A section's icon wins over its index page's.
 */
export function sidebarIconData(
  { pages, sections }: AuthoredIcons,
  unpublishedPaths: ReadonlySet<string> = new Set(),
): SidebarIconData {
  const links = new Map<string, SidebarIcon>();
  const groups = new Map<string, SidebarIcon>();
  for (const { rel, slug, isIndex, name } of pages) {
    const icon = resolved(rel, name);
    if (unpublishedPaths.has(rel)) continue;
    links.set(slug, icon);
    if (isIndex) groups.set(slug, icon);
  }
  for (const { id, name } of sections) groups.set(id, resolved(`section "${id}"`, name));
  const sorted = (map: Map<string, SidebarIcon>) => [...map.entries()].sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
  return { links: sorted(links), groups: sorted(groups) };
}
