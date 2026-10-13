/**
 * Sidebar and table-of-contents shaping — the pure core (FR-011, FR-019..FR-023,
 * NFR-006, C-004; research R5/R6/R7).
 *
 * ## Why this exists
 * Starlight 0.32 autogenerates one sidebar subgroup per directory and labels it
 * with the DIRECTORY NAME, sorted by slug. On the example site that produced
 * `book-one, book-three, book-two`, section index pages in the middle of their
 * group, and a rail reserved for a table of contents holding one link. Starlight
 * offers no per-directory label, so the toolkit post-processes the resolved
 * route data instead.
 *
 * ## Mechanism (T018 spike outcome)
 * Route-data middleware. The spike registered a middleware through the package
 * export `@spec-kitty/doc-toolkit/route-middleware`, renamed one group and
 * dropped one page's `toc`, and built the example: the label changed on all 59
 * Starlight-framed pages (the 8 others are out-of-frame decks and redirect
 * stubs), `aria-current` stayed on the right entry, and the page without a `toc`
 * had neither `.right-sidebar` nor `data-has-toc`. The config-time fallback of
 * research R5 was therefore NOT needed. Two things the spike showed that this
 * module answers:
 *   - Starlight computes prev/next BEFORE middleware runs, so a reordered
 *     sidebar needs its pagination re-derived ({@link shapePagination});
 *   - a consumer's `starlight.routeMiddleware` replaces the toolkit's unless the
 *     integration merges the two arrays (done in `config.ts`, toolkit first).
 *
 * ## Shape
 * Everything here is a pure function of its arguments: no filesystem, no
 * `astro:content`, no module state. `config.ts` reads the docs tree and hands
 * the directory metadata to `route-middleware.ts` through a virtual module; the
 * middleware calls these functions. Purity is what makes every page's sidebar
 * agree (the tree is shaped the same way on each page) and what makes two builds
 * byte-identical (NFR-006).
 */
import type { StarlightRouteData } from '@astrojs/starlight/route-data';
import { compareCodeUnit } from './vocabulary-core.mjs';

/** One resolved Starlight sidebar entry (a link or a group). */
export type SidebarEntry = StarlightRouteData['sidebar'][number];
type SidebarLink = Extract<SidebarEntry, { type: 'link' }>;
type SidebarGroup = Extract<SidebarEntry, { type: 'group' }>;
/** Starlight's table-of-contents route data (`undefined` = no rail). */
export type RouteToc = StarlightRouteData['toc'];
/** Starlight's prev/next route data. */
export type RoutePagination = StarlightRouteData['pagination'];

/** The slice of a docs page the directory metadata is derived from. */
export interface DirectoryMetaInput {
  /** Route slug, no leading or trailing slash (`rhetoric/book-one`). */
  slug: string;
  /** The page's front-matter `title`. */
  title: string;
  /** True when the file is a directory index under the configured index basename. */
  isIndex: boolean;
  /** The page's Starlight `sidebar` front-matter block, when present. */
  sidebar?: { label?: string; order?: number };
}

/** What a directory's index page says about its sidebar group. */
export interface DirectoryMeta {
  /** The index page's `sidebar.label`, else its `title`. */
  label?: string;
  /** The index page's `sidebar.order`, when declared. */
  order?: number;
  /** Base-free route of the index page (`/rhetoric/book-one/`). */
  indexHref?: string;
}

/** Directory path (`rhetoric/book-one`) → metadata. A directory with no index page has no entry. */
export type DirectoryMetaMap = ReadonlyMap<string, DirectoryMeta>;

/**
 * Build the directory metadata map from the docs entries (T019).
 *
 * Only index pages contribute. The docs root's own index (slug `''`) is skipped:
 * it has no sidebar group. Entries are visited in code-unit slug order so the
 * map's iteration order — and anything serialised from it — does not depend on
 * the order the caller collected them in (NFR-006).
 */
export function buildDirectoryMeta(entries: readonly DirectoryMetaInput[]): Map<string, DirectoryMeta> {
  const meta = new Map<string, DirectoryMeta>();
  const indexes = entries
    .filter((entry) => entry.isIndex && entry.slug !== '')
    .sort((a, b) => compareCodeUnit(a.slug, b.slug));
  for (const { slug, title, sidebar } of indexes) {
    // First writer wins on a duplicate slug (two index basenames in one
    // directory); the sort above makes "first" deterministic.
    if (meta.has(slug)) continue;
    const label = sidebar?.label ?? title;
    meta.set(slug, {
      ...(label ? { label } : {}),
      ...(typeof sidebar?.order === 'number' ? { order: sidebar.order } : {}),
      indexHref: `/${slug}/`,
    });
  }
  return meta;
}

/** Options for {@link shapeSidebar}. */
export interface ShapeSidebarOptions {
  /** The site `base` (`/doc-kitty`), stripped from hrefs before matching. Default: none. */
  base?: string;
  /**
   * Directories whose index page exists but is not published (a draft index
   * filtered out of the build). Their group still falls back to the humanised
   * directory name, but no warning is raised: the author did supply a title.
   * When any are given, a group left with no entries is dropped.
   */
  unpublishedDirs?: Iterable<string>;
}

/** The result of {@link shapeSidebar}. */
export interface ShapedSidebar {
  sidebar: SidebarEntry[];
  /** One message per group labelled by fallback, in tree order. */
  warnings: string[];
}

/**
 * Turn a sidebar href into a base-free route slug, or `undefined` for an
 * external link. `'/doc-kitty/rhetoric/book-one/'` with base `/doc-kitty` →
 * `'rhetoric/book-one'`.
 */
function slugOfHref(href: string, base: string): string | undefined {
  if (/^[a-z][a-z0-9+.-]*:|^\/\//i.test(href)) return undefined;
  let pathname = href.replace(/[?#].*$/, '');
  if (base && (pathname === base || pathname.startsWith(`${base}/`))) {
    pathname = pathname.slice(base.length);
  }
  return pathname.replace(/^\/+|\/+$/g, '');
}

/** `'a/b/c'` → `'a/b'`; a single segment → `''` (the docs root). */
function parentDir(dir: string): string {
  const cut = dir.lastIndexOf('/');
  return cut === -1 ? '' : dir.slice(0, cut);
}

/** Longest common path-segment prefix of the given directory paths. */
function commonDir(dirs: readonly string[]): string | undefined {
  if (dirs.length === 0) return undefined;
  let prefix = dirs[0]!.split('/');
  for (const dir of dirs.slice(1)) {
    const parts = dir.split('/');
    let i = 0;
    while (i < prefix.length && i < parts.length && prefix[i] === parts[i]) i += 1;
    prefix = prefix.slice(0, i);
  }
  return prefix.join('/');
}

/** `book-one` → `Book one`: a readable form of a directory name (FR-023). */
export function humaniseDirectoryName(name: string): string {
  const words = name.split(/[-_\s]+/).filter(Boolean).join(' ');
  return words.charAt(0).toUpperCase() + words.slice(1);
}

/** Normalise an Astro `base` to `''` or `/prefix` (no trailing slash). */
function normaliseBase(base: string | undefined): string {
  return `/${base ?? ''}/`.replace(/\/{2,}/g, '/').replace(/\/$/, '');
}

/**
 * Shape a resolved sidebar tree (T020).
 *
 * For every group that corresponds to a directory:
 *   - **label** (nested groups only): the index page's label; else the humanised
 *     directory name plus a warning. Top-level labels come from `sections.yaml`
 *     and are left alone, as is the top-level order.
 *   - **index first**: the directory's own index link moves to position 0 (FR-021).
 *   - **children order**: links first, in the order Starlight gave them (it has
 *     already applied each page's `sidebar.order`), then subgroups — those with a
 *     declared order ascending, then the rest by label with the shared code-unit
 *     comparator (FR-020). Pages before subsections is the one deliberate
 *     difference from Starlight, which interleaves the two by slug.
 *
 * A group's directory is read from its DIRECT children's hrefs, never from its
 * label: a non-index link lives in the group's directory, an index link IS the
 * group's directory, and a subgroup's directory is one level below it. The
 * longest common segment prefix of those answers is the group's directory. A
 * group with no internal link anywhere beneath it is not a directory and is
 * passed through.
 *
 * The input is not mutated; every other field (`collapsed`, `badge`, `attrs`,
 * `isCurrent`) is carried over. Shaping a shaped tree returns an equal tree.
 */
export function shapeSidebar(
  entries: readonly SidebarEntry[],
  meta: DirectoryMetaMap,
  options: ShapeSidebarOptions = {},
): ShapedSidebar {
  const base = normaliseBase(options.base);
  const unpublished = new Set(options.unpublishedDirs ?? []);
  const warnings: string[] = [];

  interface Shaped {
    entry: SidebarEntry;
    /** The directory this entry sits in (link) or represents (group). */
    dir: string | undefined;
  }

  // Draft publication (FR-015): with drafts unpublished, a group whose pages
  // were all drafts arrives here with no entries. An empty group is a label
  // that opens onto nothing, so it is dropped, and so is a parent it leaves
  // empty. Only done when some page is unpublished, so a build that publishes
  // everything is shaped exactly as before.
  const keep = ({ entry }: Shaped): boolean =>
    unpublished.size === 0 || entry.type !== 'group' || entry.entries.length > 0;

  const shapeEntry = (entry: SidebarEntry, depth: number): Shaped => {
    if (entry.type === 'link') {
      const slug = slugOfHref(entry.href, base);
      const dir = slug === undefined ? undefined : meta.has(slug) ? slug : parentDir(slug);
      return { entry: { ...entry }, dir };
    }

    const children = entry.entries.map((child) => shapeEntry(child, depth + 1)).filter(keep);
    const candidates = children.flatMap(({ entry: child, dir }) =>
      dir === undefined ? [] : [child.type === 'group' ? parentDir(dir) : dir],
    );
    const dir = commonDir(candidates);
    if (dir === undefined || dir === '') {
      // Not a directory (or the docs root itself): keep the author's order.
      return { entry: { ...entry, entries: children.map((c) => c.entry) }, dir: undefined };
    }

    const dirMeta = meta.get(dir);
    const indexSlug = dirMeta?.indexHref === undefined ? undefined : slugOfHref(dirMeta.indexHref, '');
    const isLink = (c: Shaped): c is Shaped & { entry: SidebarLink } => c.entry.type === 'link';
    const isIndex = (c: Shaped): boolean =>
      isLink(c) && indexSlug !== undefined && slugOfHref(c.entry.href, base) === indexSlug;

    const links = children.filter(isLink);
    const groups = children
      .filter((c): c is Shaped & { entry: SidebarGroup } => c.entry.type === 'group')
      .sort((a, b) => {
        const [orderA, orderB] = [meta.get(a.dir ?? '')?.order, meta.get(b.dir ?? '')?.order];
        if (orderA !== orderB) {
          if (orderA === undefined) return 1;
          if (orderB === undefined) return -1;
          return orderA < orderB ? -1 : 1;
        }
        // Label, then directory: a TOTAL order, so equal labels cannot fall back
        // to input order and two builds cannot disagree.
        return (
          compareCodeUnit(a.entry.label, b.entry.label) || compareCodeUnit(a.dir ?? '', b.dir ?? '')
        );
      });
    const ordered = [...links.filter(isIndex), ...links.filter((c) => !isIndex(c)), ...groups];

    let label = entry.label;
    if (depth > 0) {
      if (dirMeta?.label) {
        label = dirMeta.label;
      } else {
        label = humaniseDirectoryName(dir.slice(dir.lastIndexOf('/') + 1));
        if (!unpublished.has(dir)) {
          warnings.push(
            `sidebar group "${dir}" has no index page with a title; it is labelled ` +
              `"${label}" from the directory name. Add an index page to "${dir}/" to title it.`,
          );
        }
      }
    }

    return { entry: { ...entry, label, entries: ordered.map((c) => c.entry) }, dir };
  };

  return {
    sidebar: entries
      .map((entry) => shapeEntry(entry, 0))
      .filter(keep)
      .map(({ entry }) => entry),
    warnings,
  };
}

/**
 * Drop a near-empty table of contents (T021, FR-011). Starlight's first item is
 * always the page-title "Overview" link to `#_top`; when that is the only item
 * and it has no children the rail would hold a single link, so the page renders
 * without one. Anything else is returned unchanged (same reference).
 */
export function shapeToc(toc: RouteToc): RouteToc {
  if (!toc) return undefined;
  const { items } = toc;
  if (items.length === 0) return undefined;
  if (items.length === 1 && items[0]!.children.length === 0) return undefined;
  return toc;
}

/** Every link of a sidebar tree in reading order. */
function flattenLinks(entries: readonly SidebarEntry[]): SidebarLink[] {
  return entries.flatMap((entry) => (entry.type === 'group' ? flattenLinks(entry.entries) : [entry]));
}

/**
 * Re-derive prev/next after the sidebar has been reordered.
 *
 * Starlight resolves pagination from the sidebar before route middleware runs,
 * so without this the "Next" link would follow the old order while the sidebar
 * shows the new one. A side is re-derived only when it still follows the
 * sidebar: either it points at the page's neighbour in the ORIGINAL order (a
 * custom label from `prev: "…"` front matter is kept), or it is empty because
 * the page was first/last there and `followsSidebar` says the author did not
 * switch it off. A side the author pointed elsewhere (`prev: { link }`) or
 * disabled (`prev: false`, or site-wide `pagination: false`) is left alone.
 */
export function shapePagination(
  original: readonly SidebarEntry[],
  shaped: readonly SidebarEntry[],
  pagination: RoutePagination,
  followsSidebar: { prev: boolean; next: boolean },
): RoutePagination {
  const before = flattenLinks(original);
  const after = flattenLinks(shaped);
  const at = before.findIndex((link) => link.isCurrent);
  const to = after.findIndex((link) => link.isCurrent);
  if (at === -1 || to === -1) return pagination;

  const side = (
    current: SidebarLink | undefined,
    was: SidebarLink | undefined,
    now: SidebarLink | undefined,
    follows: boolean,
  ): SidebarLink | undefined => {
    if (current === undefined) return follows && was === undefined ? now : current;
    if (was === undefined || current.href !== was.href) return current;
    if (now === undefined) return undefined;
    return current.label === was.label ? now : { ...now, label: current.label };
  };

  return {
    prev: side(pagination.prev, before[at - 1], after[to - 1], followsSidebar.prev),
    next: side(pagination.next, before[at + 1], after[to + 1], followsSidebar.next),
  };
}

/**
 * Key under which shaping warnings are collected on `globalThis` during a build.
 * The middleware runs in Astro's bundled prerender module and the integration's
 * build hook in the config module — two module instances in one process — so a
 * process-global set is the hand-off. A `Set` de-duplicates: every page shapes
 * the same tree and would otherwise repeat each warning once per page.
 */
const WARNING_SINK = Symbol.for('doc-kitty.route-shaping.warnings');

/** The per-process set of shaping warnings (created on first use). */
export function shapingWarningSink(): Set<string> {
  const store = globalThis as unknown as Record<symbol, Set<string> | undefined>;
  return (store[WARNING_SINK] ??= new Set<string>());
}

/**
 * Inline script that brings the current sidebar entry into view (T023, FR-022).
 *
 * Measured on the example site: on a deep page the `aria-current` entry sat at
 * y=1621 with the sidebar at scroll position 0. Starlight restores sidebar
 * scroll from `sessionStorage` on in-session navigation, from an inline script
 * placed right after the sidebar markup; on a first visit there is nothing to
 * restore. This runs on `DOMContentLoaded` — after that restore — and acts only
 * when the entry is outside the visible part of the pane, so it never fights a
 * restored position.
 *
 * It sets the pane's own `scrollTop` rather than calling `scrollIntoView`, which
 * would also scroll the document. Only the fixed sidebar pane scrolls, so the
 * reading column does not move (NFR-005). Below Starlight's desktop breakpoint
 * the same pane is the mobile menu. It is not `display: none` there: measured
 * at 390px it has a box and scrolls, so the script can act at that width too.
 *
 * A raw string for the same reason as `toc-rail/pre-paint`: it ships as a
 * classic inline `<head>` script and tests execute it against a stub document.
 */
export const REVEAL_CURRENT_SCRIPT: string =
  "(function(){function r(){try{var p=document.getElementById('starlight__sidebar');" +
  "var c=p&&p.querySelector('[aria-current=\"page\"]');if(!c)return;" +
  'var a=p.getBoundingClientRect(),b=c.getBoundingClientRect();' +
  'if(b.top>=a.top&&b.bottom<=a.bottom)return;' +
  'p.scrollTop+=b.top-a.top-(a.height-b.height)/2;}catch(e){}}' +
  "if(document.readyState==='loading'){document.addEventListener('DOMContentLoaded',r);}else{r();}})();";
