/**
 * `print/order` — which pages a print document holds, and in what order (ADR-0081,
 * #380). Pure: no `astro:content`, no filesystem, so the route and the tests share it.
 *
 * Print order is a depth-first walk of the slug tree. A folder's index page comes
 * first; its children follow by `sidebar.order` (when set; on a tie a page comes before
 * a folder), then title (`en`, numbers read as numbers), then slug, close to hub order (`selectHubChildren`), with the sidebar's explicit order
 * honoured. Draft pages follow the docs collection: the loader already drops them when
 * `DK_PUBLISH_DRAFTS` is off. Excluded folders (ADR-0070) never reach the collection.
 */
import { compareCodeUnit } from '../vocabulary-core.mjs';

/** The fields of a docs entry the print order reads. */
export interface PrintEntry {
  slug: string;
  data: { title: string; kind?: string; sidebar?: { order?: number } };
}

/** A section's pages: its index page (the cover body) and the pages after it. */
export interface SectionPages<T extends PrintEntry> {
  id: string;
  index: T | undefined;
  pages: T[];
}

const parentOf = (slug: string): string => {
  const at = slug.lastIndexOf('/');
  return at === -1 ? '' : slug.slice(0, at);
};

/** Title order with numbers read as numbers, so "Chapter 2" comes before "Chapter 10". */
const byTitle = (a: PrintEntry, b: PrintEntry): number =>
  a.data.title.localeCompare(b.data.title, 'en', { numeric: true }) || compareCodeUnit(a.slug, b.slug);

function compareSiblings(a: PrintEntry, b: PrintEntry): number {
  const ao = a.data.sidebar?.order;
  const bo = b.data.sidebar?.order;
  if (ao !== undefined || bo !== undefined) {
    if (ao === undefined) return 1;
    if (bo === undefined) return -1;
    if (ao !== bo) return ao - bo;
  }
  return byTitle(a, b);
}

/**
 * The pages of section `sectionId` in print order, minus excluded page kinds. The
 * section index page is returned apart, as the cover body; a folder below it with no
 * index page still has its pages walked, as if it had one.
 */
export function sectionPages<T extends PrintEntry>(
  entries: readonly T[],
  sectionId: string,
  excludeKinds: readonly string[],
): SectionPages<T> {
  const excluded = new Set(excludeKinds);
  const inSection = entries.filter(
    (entry) =>
      (entry.slug === sectionId || entry.slug.startsWith(`${sectionId}/`)) &&
      !excluded.has(entry.data.kind ?? ''),
  );
  const bySlug = new Map(inSection.map((entry) => [entry.slug, entry]));
  // Every folder that holds a page, including folders with no index page of their own.
  const children = new Map<string, Set<string>>();
  const link = (slug: string): void => {
    if (slug === sectionId) return;
    const parent = parentOf(slug);
    if (!children.has(parent)) children.set(parent, new Set());
    children.get(parent)!.add(slug);
    link(parent);
  };
  for (const entry of inSection) link(entry.slug);

  const pages: T[] = [];
  const walk = (folder: string): void => {
    const kids = [...(children.get(folder) ?? [])].map((slug) => ({
      slug,
      entry: bySlug.get(slug),
    }));
    kids.sort((a, b) => {
      // A folder without an index page sorts by its name, as its title.
      const as: PrintEntry = a.entry ?? { slug: a.slug, data: { title: a.slug.slice(a.slug.lastIndexOf('/') + 1) } };
      const bs: PrintEntry = b.entry ?? { slug: b.slug, data: { title: b.slug.slice(b.slug.lastIndexOf('/') + 1) } };
      // On a tie of `sidebar.order`, a page comes before a folder, as in the sidebar.
      const ao = as.data.sidebar?.order;
      const bo = bs.data.sidebar?.order;
      const aFolder = children.has(a.slug);
      const bFolder = children.has(b.slug);
      if (ao === bo && aFolder !== bFolder) return aFolder ? 1 : -1;
      return compareSiblings(as, bs);
    });
    for (const kid of kids) {
      if (kid.entry) pages.push(kid.entry);
      walk(kid.slug);
    }
  };
  walk(sectionId);
  return { id: sectionId, index: bySlug.get(sectionId), pages };
}

/** The whole-site document's sections, in order (ADR-0081 §5). */
export interface SiteSections {
  /** Registered sections in the main body, in registry order. */
  main: string[];
  /** Top-level folders with no registry entry, by name, after the main body. */
  unregistered: string[];
  /** Pages at the top level outside any folder (`docs/foo.md`), by slug: printed as pages after the cover. */
  loose: string[];
  /** Appendix sections, in registry order, last. */
  appendix: string[];
}

/**
 * Order the whole-site document: registered sections in registry order (minus the
 * excluded and omitted ones), then top-level folders that hold pages but have no
 * registry entry, then appendix sections.
 */
export function siteSections(
  registryOrder: readonly string[],
  slugs: readonly string[],
  options: { excludeSections: readonly string[]; omit: readonly string[]; appendix: readonly string[] },
): SiteSections {
  const out = new Set([...options.excludeSections, ...options.omit]);
  const appendix = new Set(options.appendix);
  const registered = new Set(registryOrder);
  // A section is a folder: a registered id, or the first segment of a nested slug.
  const folders = new Set(slugs.filter((slug) => slug.includes('/')).map((slug) => slug.split('/')[0]));
  const topLevel = new Set([...folders, ...slugs.filter((slug) => registered.has(slug))]);
  return {
    main: registryOrder.filter((id) => !out.has(id) && !appendix.has(id) && topLevel.has(id)),
    unregistered: [...folders].filter((id) => !registered.has(id) && !out.has(id)).sort(compareCodeUnit),
    loose: slugs.filter((slug) => slug !== '' && !slug.includes('/') && !topLevel.has(slug)).sort(compareCodeUnit),
    appendix: registryOrder.filter((id) => appendix.has(id) && !out.has(id) && topLevel.has(id)),
  };
}
