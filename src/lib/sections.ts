/**
 * Section-registry loader for the Common Docs — Kitty Variation.
 *
 * `docs/_meta/sections.yaml` decouples a section's **display and order** from its
 * on-disk folder layout (ADR-0004; `docs/architecture/section-registry.md`). This
 * module is the loader that arch doc always described: it parses the registry once
 * and hands the ordered, validated section list to the discovery surfaces
 * (`llms.txt`, RSS, the agent-API index) and the Starlight sidebar.
 *
 * SCOPE (this op — issue #18): the registry drives **nav / order / label** only.
 * The `type` axis (a section's canonical `type` as a validation authority,
 * ADR-0004/FR-003) and the `feeds` per-surface filter are still authored in the
 * YAML but NOT yet consumed — see the DEFERRED note at the foot of this file.
 *
 * Unlike `./metadata.ts` (deliberately Astro-free AND fs-free, isolation-tested),
 * this module MAY read the filesystem. `metadata.ts` must never import it; the
 * helpers there parameterize on the resolved order/label instead, so the purity
 * boundary is preserved. `gray-matter` parses the YAML — the same engine, and the
 * same wrap-in-fences trick, `validate-catalog.mjs` uses for its registry files.
 */
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import matter from 'gray-matter';

/** One authored section: its slug, display label, and integer sort key. */
export interface SectionRegistryEntry {
  /** Section slug — maps 1:1 to a top-level folder under the docs root. */
  id: string;
  /** Display name in the sidebar, section heading, and llms.txt group. */
  label: string;
  /** Integer sort key; lower first. Gaps allowed so a section can be inserted. */
  order: number;
  /**
   * The canonical frontmatter `type` for pages in this section. Carried, but NOT
   * consumed as a validation authority yet (DEFERRED — see foot of file).
   */
  type?: string;
  /** One-line description; carried, not yet consumed as a section blurb. */
  purpose?: string;
  /** Surfaces this section feeds; carried, NOT yet consumed as a filter (DEFERRED). */
  feeds?: string[];
}

/** The resolved registry: entries sorted by `order`, tie-broken by `id`. */
export type SectionRegistry = SectionRegistryEntry[];

/** The registry file, relative to a docs root (`<docsRoot>/_meta/sections.yaml`). */
export const SECTIONS_REGISTRY_RELPATH = path.join('_meta', 'sections.yaml');

export interface ParseSectionsOptions {
  /** Sink for non-fatal problems (duplicate `order`). Defaults to `console.warn`. */
  warn?: (message: string) => void;
  /** Label used in error/warn messages (e.g. the file path). */
  source?: string;
}

/** Stable sort: `order` ascending, ties broken by `id` alphabetically. */
function byOrderThenId(a: SectionRegistryEntry, b: SectionRegistryEntry): number {
  return a.order - b.order || a.id.localeCompare(b.id);
}

/**
 * Parse a `sections.yaml` body (the raw file text) into an ordered registry.
 *
 * Contract (`section-registry.md` "Failure and edge cases"):
 *   - a duplicate `id` is a build ERROR (ambiguous section) → throws;
 *   - a duplicate `order` is a WARNING, broken by `id` alphabetically;
 *   - a missing `id`/`label`/`order` on an entry is a build ERROR → throws.
 * The result is sorted by `order` (ties by `id`), so callers can `indexOf` for rank.
 */
export function parseSectionRegistry(
  raw: string,
  options: ParseSectionsOptions = {},
): SectionRegistry {
  const warn = options.warn ?? ((m: string) => console.warn(`[dk-sections] ${m}`));
  const src = options.source ?? 'sections.yaml';

  // Wrap the top-level YAML mapping as a frontmatter block so gray-matter's YAML
  // engine parses it (the validate-catalog.mjs trick), avoiding an ad-hoc parser.
  const data = matter(['---', raw, '---', ''].join('\n')).data as
    | { sections?: unknown }
    | null;
  if (data == null || typeof data !== 'object') {
    throw new Error(`${src}: registry must be a YAML mapping with a "sections" list`);
  }
  const rawSections = data.sections;
  if (!Array.isArray(rawSections)) {
    throw new Error(`${src}: "sections" must be a YAML list of section entries`);
  }

  const entries: SectionRegistry = [];
  const seenIds = new Set<string>();
  const seenOrders = new Map<number, string>();

  for (const rec of rawSections) {
    if (rec == null || typeof rec !== 'object') {
      throw new Error(`${src}: a section entry is not a mapping (${JSON.stringify(rec)})`);
    }
    const { id, label, order, type, purpose, feeds } = rec as Record<string, unknown>;

    if (typeof id !== 'string' || id === '') {
      throw new Error(`${src}: a section entry is missing a string "id"`);
    }
    if (typeof label !== 'string' || label === '') {
      throw new Error(`${src}: section "${id}" is missing a string "label"`);
    }
    if (typeof order !== 'number' || !Number.isFinite(order)) {
      throw new Error(`${src}: section "${id}" is missing a numeric "order"`);
    }
    if (seenIds.has(id)) {
      throw new Error(`${src}: duplicate section id "${id}" (section ids must be unique)`);
    }
    seenIds.add(id);

    const firstWithOrder = seenOrders.get(order);
    if (firstWithOrder !== undefined) {
      warn(
        `${src}: duplicate order ${order} on "${id}" and "${firstWithOrder}" — tie broken by id`,
      );
    } else {
      seenOrders.set(order, id);
    }

    const entry: SectionRegistryEntry = { id, label, order };
    if (typeof type === 'string') entry.type = type;
    if (typeof purpose === 'string') entry.purpose = purpose;
    if (Array.isArray(feeds)) {
      entry.feeds = feeds.filter((f): f is string => typeof f === 'string');
    }
    entries.push(entry);
  }

  entries.sort(byOrderThenId);
  return entries;
}

/**
 * Load and parse `<docsRoot>/_meta/sections.yaml`.
 *
 * A MISSING registry file is graceful: returns `null` (the sentinel) so a docs
 * root with no `sections.yaml` still builds — its callers fall back to the frozen
 * `SECTION_ORDER`/`SECTION_LABEL` defaults in `metadata.ts`. A present-but-invalid
 * registry throws (it is authored, and a silent skip would hide the mistake).
 */
export function loadSectionRegistry(
  docsRoot: string,
  options: ParseSectionsOptions = {},
): SectionRegistry | null {
  const file = path.join(docsRoot, SECTIONS_REGISTRY_RELPATH);
  if (!existsSync(file)) return null;
  const raw = readFileSync(file, 'utf8');
  return parseSectionRegistry(raw, {
    warn: options.warn,
    source: options.source ?? path.relative(process.cwd(), file),
  });
}

/** The section ids in registry order — the `order?` argument `sectionRank` takes. */
export function sectionOrder(registry: SectionRegistry): string[] {
  return [...registry].sort(byOrderThenId).map((e) => e.id);
}

/** The `id → label` map — the `labels?` argument `sectionLabel` takes. */
export function sectionLabels(registry: SectionRegistry): Record<string, string> {
  const labels: Record<string, string> = {};
  for (const entry of registry) labels[entry.id] = entry.label;
  return labels;
}

/** Humanize a bare folder name for a leftover (unregistered) section group. */
function humanizeSection(slug: string): string {
  return slug
    .split(/[-_/\s]+/)
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

/**
 * A Starlight autogenerated sidebar group. Kept as a local minimal shape so this
 * module stays framework-light (no Starlight import); `config.ts` casts the array
 * to `StarlightUserConfig['sidebar']` where it is consumed.
 */
export interface SidebarAutogenGroup {
  label: string;
  autogenerate: { directory: string };
}

/**
 * Build the Starlight `sidebar` from the registry — one named, ordered group per
 * section, each `autogenerate`-ing from that section's folder. This replaces bare
 * tree-autogen (folder-name group labels, source-order) with named, ordered,
 * RELOCATABLE groups: reordering or relabelling a section — e.g. the glossary
 * shipping under a "Reference" label — is a `sections.yaml` edit alone (FR-013).
 *
 * `presentDirs` is the set of top-level content folders that actually exist on
 * disk. A registry section with no folder is SKIPPED (Starlight's `autogenerate`
 * throws on a missing directory). A folder with no registry entry is APPENDED
 * after the registry groups with a humanized label (the graceful coverage-warning
 * posture of ADR-0004: unregistered folders are tolerated, not dropped).
 */
export function registryToSidebar(
  registry: SectionRegistry,
  presentDirs: readonly string[],
): SidebarAutogenGroup[] {
  const present = new Set(presentDirs);
  const claimed = new Set<string>();
  const groups: SidebarAutogenGroup[] = [];

  for (const entry of [...registry].sort(byOrderThenId)) {
    if (!present.has(entry.id)) continue;
    groups.push({ label: entry.label, autogenerate: { directory: entry.id } });
    claimed.add(entry.id);
  }

  for (const dir of [...present].filter((d) => !claimed.has(d)).sort()) {
    groups.push({ label: humanizeSection(dir), autogenerate: { directory: dir } });
  }

  return groups;
}

// ---------------------------------------------------------------------------
// DEFERRED (stated here so the code does not deepen the arch-doc myth):
//   • `type`-from-registry as a validation authority (ADR-0004/FR-003 envisioned
//     the registry as a THIRD consumer, deriving each page's expected `type`).
//     Out of scope for issue #18 — kept to nav/order/label. The `type` field is
//     parsed and carried, but nothing validates against it yet.
//   • `feeds` as a per-surface filter (section-registry.md "`feeds` semantics").
//     Parsed and carried, but no surface yet drops a section by its `feeds` set.
//   • MDX / remark-mdx — unrelated, tracked as issue #16.
// ---------------------------------------------------------------------------
