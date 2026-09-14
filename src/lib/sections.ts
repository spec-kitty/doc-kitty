/**
 * Section-registry loader for the Common Docs — Kitty Variation.
 *
 * `docs/_meta/sections.yaml` decouples a section's **display and order** from its
 * on-disk folder layout (ADR-0004; `docs/architecture/section-registry.md`). This
 * module is the loader that arch doc always described: it parses the registry once
 * and hands the ordered, validated section list to the discovery surfaces
 * (`llms.txt`, RSS, the agent-API index) and the Starlight sidebar.
 *
 * SCOPE: the registry drives **nav / order / label** (issue #18), the
 * section-default **`type`** authority (issue #24) — `sectionTypes` exposes the
 * `id → type` map that `metadata.ts`'s `expectedDocType` and the standalone gate
 * derive a page's expected `type` from (ADR-0004/FR-003) — and now the last two
 * consumers: the **`feeds`** per-surface filter (`sectionFeeds` + `feedsSurface`)
 * and the **`purpose`** section blurb (`sectionPurposes`, the llms.txt README
 * fallback). See the WIRED note at the foot of this file.
 *
 * Unlike `./metadata.ts` (deliberately Astro-free AND fs-free, isolation-tested),
 * this module MAY read the filesystem. `metadata.ts` must never import it; the
 * helpers there parameterize on the resolved order/label instead, so the purity
 * boundary is preserved. `gray-matter` parses the YAML — the same engine, and the
 * same wrap-in-fences trick, `validate-catalog.mjs` uses for its registry files.
 */
import { existsSync, readFileSync } from 'node:fs';
import { GLOSSARY_OUTPUT_DIRNAME } from './glossary/generate.js';
import path from 'node:path';
import process from 'node:process';
import matter from 'gray-matter';
import { compareCodeUnit } from './vocabulary-core.mjs';
import { resolveGovernance } from './vocabulary-loader.mjs';
import type { SectionSubtypeRule } from './metadata.js';

/** One authored section: its slug, display label, and integer sort key. */
export interface SectionRegistryEntry {
  /** Section slug — maps 1:1 to a top-level folder under the docs root. */
  id: string;
  /** Display name in the sidebar, section heading, and llms.txt group. */
  label: string;
  /** Integer sort key; lower first. Gaps allowed so a section can be inserted. */
  order: number;
  /**
   * The canonical frontmatter `type` for pages in this section — the
   * section-default `type` authority (issue #24). Consumed via `sectionTypes`
   * (this module) → `expectedDocType` (`./metadata.ts`); a section README takes
   * the section type, and a few sub-path subtypes are applied on top in code.
   */
  type?: string;
  /**
   * One-line description. Consumed as the section blurb in llms.txt — the
   * FALLBACK when the section `README` has no `description` (README wins). See
   * {@link sectionPurposes}.
   */
  purpose?: string;
  /**
   * Which generated surfaces this section's pages feed — a coarse, section-level
   * filter over `sitemap` / `rss` / `llms` / `agent` (WIRED). **Absent = ALL
   * FOUR** (a section that omits `feeds` feeds every surface). Consumed through
   * {@link sectionFeeds} + {@link feedsSurface}, composed with the finer per-page
   * publication / `agent.discoverable` gating at each surface.
   */
  feeds?: string[];
  /**
   * Optional sub-path → `type` rules (E-02, FR-005, D-03): a page under
   * `<id>/<seg>/…` whose `<seg>` matches a rule's `match` derives that rule's
   * `type`, ahead of the built-in sub-path table (`expectedDocType` in
   * `./metadata.ts`, E-06). Absent ⇒ the built-in table applies unchanged
   * (backward-compatible; doc-kitty's own tree is a no-op, NFR-003). This is
   * the mechanism that makes a sub-path rename (`plans/features` →
   * `plans/missions`) a data edit, not a derivation-code edit (SC-002).
   */
  subtypes?: SectionSubtypeRule[];
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
  return a.order - b.order || compareCodeUnit(a.id, b.id);
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
  return normalizeSectionEntries(rawSections, { warn, src });
}

/**
 * Normalize a raw list of section-entry mappings into an ordered, validated
 * {@link SectionRegistry}. The shared core of {@link parseSectionRegistry} (legacy
 * `sections.yaml`) and the charter-aware {@link resolveSectionRegistry} (the
 * charter's `sections.entries`), so BOTH paths validate identically — a single
 * source for the entry contract (id/label/order required, subtypes shape, unique
 * id, duplicate-order warning). Sorted by `order` ascending, ties broken by `id`.
 */
function normalizeSectionEntries(
  rawSections: unknown[],
  { warn, src }: { warn: (m: string) => void; src: string },
): SectionRegistry {
  const entries: SectionRegistry = [];
  const seenIds = new Set<string>();
  const seenOrders = new Map<number, string>();

  for (const rec of rawSections) {
    if (rec == null || typeof rec !== 'object') {
      throw new Error(`${src}: a section entry is not a mapping (${JSON.stringify(rec)})`);
    }
    const { id, label, order, type, purpose, feeds, subtypes } = rec as Record<string, unknown>;

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
    if (subtypes !== undefined) {
      if (!Array.isArray(subtypes)) {
        throw new Error(`${src}: section "${id}" "subtypes" must be a YAML list of {match, type}`);
      }
      entry.subtypes = subtypes.map((rule, i) => {
        if (rule == null || typeof rule !== 'object') {
          throw new Error(`${src}: section "${id}" subtypes[${i}] is not a mapping`);
        }
        const { match, type: ruleType } = rule as Record<string, unknown>;
        if (typeof match !== 'string' || match === '') {
          throw new Error(`${src}: section "${id}" subtypes[${i}] is missing a string "match"`);
        }
        if (typeof ruleType !== 'string' || ruleType === '') {
          throw new Error(`${src}: section "${id}" subtypes[${i}] is missing a string "type"`);
        }
        return { match, type: ruleType };
      });
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

/**
 * Resolve the section registry through the CHARTER-AWARE path (documentation-
 * charter WP03, IC-03): `charter.yaml` → legacy `sections.yaml` → default. This
 * mirrors the bare-Node gate's `resolveGovernance` precedence so the Astro-side
 * and the gate agree on which registry governs a docs root:
 *   - a charter that DECLARES `sections` wins (its `entries` are normalized
 *     through the SAME {@link normalizeSectionEntries} the legacy loader uses, so
 *     the entry contract is single-sourced and a malformed entry fails closed);
 *   - else the legacy `<docsRoot>/_meta/sections.yaml` (an already-normalized
 *     {@link SectionRegistry} array from the loader);
 *   - else `null` — no registry, so callers fall back to the frozen
 *     `SECTION_ORDER`/`SECTION_LABEL`/`SECTION_TYPE` defaults (a bare consumer
 *     still gets the canonical behavior, FR-007/NFR-002).
 *
 * A charter that carries only section METADATA (e.g. `index_basename`/`order`)
 * but no `entries` yields `null` here (there are no per-section records to build
 * a registry from) — the section defaults then apply, exactly as for a
 * registry-less tree. Fail-closed on a malformed charter propagates from
 * `resolveGovernance` (never silently swallowed).
 */
export function resolveSectionRegistry(
  docsRoot: string,
  options: ParseSectionsOptions = {},
): SectionRegistry | null {
  const warn = options.warn ?? ((m: string) => console.warn(`[dk-sections] ${m}`));
  const sections = resolveGovernance(docsRoot, { emitDeprecation: false }).sections;
  if (sections == null) return null;
  // Legacy `sections.yaml` (or a charter whose `sections` the loader already
  // normalized) arrives as an array — the normalized registry, use as-is.
  if (Array.isArray(sections)) return sections as SectionRegistry;
  // A charter mapping: build the registry from its `entries` list (if any),
  // reusing the shared entry validator so the contract stays single-sourced.
  const rawEntries = (sections as Record<string, unknown>).entries;
  if (!Array.isArray(rawEntries)) return null;
  const src = options.source ?? path.join(docsRoot, '_meta', 'charter.yaml');
  return normalizeSectionEntries(rawEntries, { warn, src });
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

/**
 * The `id → type` map — the section-default `type` authority (issue #24).
 *
 * The registry is now the single source of a section's canonical frontmatter
 * `type`: a page's expected `type` is its section entry's `type` (a section
 * README takes the section type), with a few sub-path subtypes applied on top in
 * code (`expectedDocType` in `./metadata.ts`). Only entries that declare a `type`
 * appear here; a section without one has no section-default expectation (the
 * check degrades to no-op, matching the open-vocabulary posture). Analogous to
 * {@link sectionLabels}; pass the result as the `typesBySection` argument of
 * `expectedDocType`.
 */
export function sectionTypes(registry: SectionRegistry): Record<string, string> {
  const types: Record<string, string> = {};
  for (const entry of registry) {
    if (typeof entry.type === 'string') types[entry.id] = entry.type;
  }
  return types;
}

/**
 * The `id → subtypes[]` map — the deferred seam wired (E-02, FR-005, D-03).
 * Only entries that declare `subtypes` appear; pass the result as the
 * `subtypesBySection` argument of `expectedDocType` (`./metadata.ts`), ahead of
 * the built-in sub-path table (E-06). A page whose section declares no
 * `subtypes` falls straight through to that built-in table, unaffected.
 */
export function sectionSubtypes(
  registry: SectionRegistry,
): Record<string, SectionSubtypeRule[]> {
  const subtypes: Record<string, SectionSubtypeRule[]> = {};
  for (const entry of registry) {
    if (Array.isArray(entry.subtypes)) subtypes[entry.id] = entry.subtypes;
  }
  return subtypes;
}

/**
 * The full set of registered section ids — the "is this id actually
 * registered?" signal US2-AS5's rename-with-no-registry-entry warning needs
 * (as opposed to `sectionTypes`/`sectionSubtypes`, which only carry entries
 * that declare a `type`/`subtypes` — a registered, deliberately typeless
 * section like `faq` must NOT warn).
 */
export function sectionIds(registry: SectionRegistry): Set<string> {
  return new Set(registry.map((entry) => entry.id));
}

/**
 * The `id → purpose` map — the section blurb source (analogous to
 * {@link sectionLabels}). Only entries that declare a `purpose` appear. It is the
 * llms.txt blurb FALLBACK: the emitted section blurb is the section `README`
 * description **??** this `purpose` (README wins). A section with neither gets no
 * blurb line. Pass the result alongside the README descriptions in `llms-txt.ts`.
 */
export function sectionPurposes(registry: SectionRegistry): Record<string, string> {
  const purposes: Record<string, string> = {};
  for (const entry of registry) {
    if (typeof entry.purpose === 'string') purposes[entry.id] = entry.purpose;
  }
  return purposes;
}

// ---------------------------------------------------------------------------
// Vocabulary override (#40) — `<docsRoot>/_meta/vocabulary.yaml`
//
// A declarative, on-disk override that aliases / neutralizes / forbids `type`
// and `kind` terms, resolved `default → consumer` and read WITHOUT an Astro
// build (contracts/vocabulary-override.md). It is applied to BOTH authored and
// section-DERIVED values by the standalone gate (FR-004/FR-005).
//
// SINGLE-SOURCED (#49 IC-02): the resolver (`makeAxisResolver`/`parseVocabulary`/
// `identityVocabulary`) now lives in the fs-free `vocabulary-core.mjs`, and the
// filesystem `loadVocabulary` in `vocabulary-loader.mjs`. `sections.ts` re-exports
// them so every prior `from './sections.js'` import (e.g.
// `vocabulary-resolver.test.ts`) still resolves — but there is exactly one
// implementation, so the pre-WP03 resolver-parity twin is retired by construction.
// ---------------------------------------------------------------------------

export {
  parseVocabulary,
  identityVocabulary,
  makeAxisResolver,
} from './vocabulary-core.mjs';
export type {
  VocabularyResolver,
  VocabularyResolution,
} from './vocabulary-core.mjs';
export {
  loadVocabulary,
  VOCABULARY_REGISTRY_RELPATH,
} from './vocabulary-loader.mjs';

/** The four generated surfaces the section-level `feeds` filter gates. */
export type FeedSurface = 'sitemap' | 'rss' | 'llms' | 'agent';

/**
 * The `id → feeds` map — ONLY sections that DECLARE a `feeds` list appear
 * (analogous to {@link sectionLabels}). A section ABSENT from this map feeds ALL
 * FOUR surfaces (absent = all); never treat a missing key as "feeds nothing".
 * Always consult it through {@link feedsSurface}, which enforces that default.
 */
export function sectionFeeds(registry: SectionRegistry): Record<string, string[]> {
  const feeds: Record<string, string[]> = {};
  for (const entry of registry) {
    if (Array.isArray(entry.feeds)) feeds[entry.id] = entry.feeds;
  }
  return feeds;
}

/**
 * Does `sectionId` feed `surface`? The section-level `feeds` filter, with the
 * CRITICAL DEFAULT that an ABSENT `feeds` entry feeds ALL FOUR surfaces:
 *   - `feeds` undefined (no registry, or a registry-free root) → TRUE — no
 *     filtering at all, so the surface stays byte-compatible with pre-feeds;
 *   - the section declares NO `feeds` list (`feeds[sectionId]` undefined) → TRUE
 *     (absent = all — the example corpus declares no `feeds`, so this keeps the
 *     filter INERT on it, dropping nothing);
 *   - the section declares a list → TRUE iff `surface` is in it.
 *
 * This is the COARSE half of the gate; each surface composes it with the finer
 * per-page publication / `agent.discoverable` gating (a page appears iff BOTH
 * allow it). Pass the map from {@link sectionFeeds} (or `undefined` when there is
 * no registry) and the page's section (`sectionOf(slug)` from `./metadata.ts`).
 */
export function feedsSurface(
  feeds: Record<string, string[]> | undefined,
  sectionId: string,
  surface: FeedSurface,
): boolean {
  if (!feeds) return true;
  const list = feeds[sectionId];
  if (list === undefined) return true;
  return list.includes(surface);
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
 *
 * The `autogenerate.directory` is the section's on-disk folder **prefixed with the
 * docsDir** (`docs/<id>`, via {@link RegistryToSidebarOptions.directoryPrefix}),
 * NOT the bare section id. WHY (BA-10 15c + FR-013 15d): Starlight matches an
 * `autogenerate` group's routes by a path computed relative to the collection root
 * (`utils/navigation.ts` → `groupFromAutogenerateConfig` →
 * `getRoutePathRelativeToCollectionRoot`), and that root is HARD-CODED to
 * `src/content/docs` (`getCollectionPathFromRoot`, whose own comment admits it
 * "relies on the content collection folder structure to be fixed"). doc-kitty's
 * content lives at the repo `docs/` via a custom glob loader, so each route's
 * `filePath` is `docs/<section>/…`; the `src/content/docs/` prefix never strips,
 * and the compared path stays `docs/<section>/…`. A bare `directory: '<section>'`
 * therefore matches NEITHER `=== '<section>'` NOR `startsWith('<section>/')` → the
 * group renders EMPTY (no hub link AND no child pages — the un-masked #18
 * regression). Prefixing the directory with the docsDir (`docs/<section>`) lines it
 * up with the un-stripped `filePath`, so the group resolves its hub `/<id>/` AND
 * all child pages. Hidden pages (a deck's `sidebar: { hidden: true }`) are still
 * filtered by `treeify`, so the deck node stays out (BA-10 deck-absent half). The
 * README-as-index hub is NOT swallowed here: under directory `docs/<id>` its path
 * `docs/<id>/README` keeps a `README` tail (`getBreadcrumbs` ≠ `[]`), so it renders
 * as the `/<id>/` link.
 *
 * COUPLING (see ADR-0029): the `docs/<id>` prefix is load-bearing and correct only
 * while (a) Starlight keeps the hard-coded `src/content/docs` content root — a
 * future version that honors the loader `base` would need the prefix dropped; and
 * (b) the content uses Astro's non-legacy content layer, so `filePath` is
 * project-root-relative (`docs/<id>/…`). Under `legacy.collections`,
 * `getRoutePathRelativeToCollectionRoot` returns the bare `route.id` and the prefix
 * would re-empty the group. Both hold under the pinned Starlight (peer range capped
 * `<0.33.0`) and doc-kitty's glob-loader design.
 */
export interface SidebarAutogenGroup {
  label: string;
  autogenerate: { directory: string };
}

/**
 * Section ids whose pages are GENERATED at build time rather than committed on
 * disk (issue #23).
 *
 * The sidebar is synthesized from a snapshot of on-disk top-level content dirs
 * taken when `defineDocKittyIntegrations()` is evaluated (`config.ts` →
 * `topLevelContentDirs`). But the glossary integration codegens its pages into
 * `<docsDir>/glossary/**` LATER, inside its `astro:config:setup` hook — after
 * that snapshot. A consumer who `.gitignore`s the generated glossary output
 * therefore has a `glossary` registry entry with no folder at snapshot time, and
 * the old skip-if-absent rule made the whole "Reference" group vanish silently.
 *
 * Seeding the build-generated ids here lets `registryToSidebar` emit their groups
 * even when the folder is not yet on disk. The id is the generator's own exported
 * `GLOSSARY_OUTPUT_DIRNAME` (the single source of the folder name — review F4), so
 * a rename of the generator's output folder updates this seed automatically.
 */
export const BUILD_GENERATED_SECTION_IDS: readonly string[] = [GLOSSARY_OUTPUT_DIRNAME];

/** Options for {@link registryToSidebar}. */
export interface RegistryToSidebarOptions {
  /**
   * Section ids whose pages are build-generated (absent from `presentDirs` at
   * snapshot time is expected, not an error). Defaults to
   * {@link BUILD_GENERATED_SECTION_IDS}.
   */
  generatedIds?: readonly string[];
  /**
   * Sink for the non-fatal "registered section folder is missing" warning.
   * Defaults to `console.warn` (a build-time signal a real typo/misconfig is
   * visible instead of a group silently disappearing).
   */
  warn?: (message: string) => void;
  /**
   * The docsDir path (relative to the Astro root) that each section folder sits
   * under — PREPENDED to every group's `autogenerate.directory` so it lines up with
   * Starlight's un-stripped `filePath` (`docs/<id>/…`; see {@link
   * SidebarAutogenGroup} for the full mechanism). `config.ts` passes the resolved
   * docsDir (default `docs`). Normalized here (leading `./`, surrounding slashes,
   * `\` → `/` stripped), so `'docs'`, `'./docs/'` and `'docs\\'` all yield the
   * `docs/<id>` directory. Empty/omitted → the bare `<id>` directory (the
   * pre-fix shape) — used by the unit fixtures that assert the un-prefixed form.
   */
  directoryPrefix?: string;
}

/**
 * Build the Starlight `sidebar` from the registry — one named, ordered group per
 * section, each `autogenerate`-ing from that section's folder. This replaces bare
 * tree-autogen (folder-name group labels, source-order) with named, ordered
 * groups that are RELABELABLE and REORDERABLE by a `sections.yaml` edit alone —
 * e.g. the glossary shipping under a "Reference" label (FR-013). (The section id
 * is bound to its on-disk folder name, so moving a section's folder still moves
 * its content; only its label and order are pure data edits.)
 *
 * `presentDirs` is the set of top-level content folders that actually exist on
 * disk. A registry section with no folder falls into two cases (issue #23):
 *   - a KNOWN build-generated section (e.g. the glossary, whose pages are codegen'd
 *     later in the glossary integration's `config:setup`, AFTER `config.ts`
 *     snapshots the on-disk dirs): its group is still emitted, so a consumer who
 *     `.gitignore`s the generated output does not lose the group silently; and
 *   - anything else (a typo or a not-yet-created folder): a build-time WARNING is
 *     emitted naming the id, and the group is skipped. (Starlight's `autogenerate`
 *     does not stat the folder — it filters already-loaded routes and would render
 *     the group EMPTY; we skip-and-warn instead so the misconfig is loud.)
 * A folder with no registry entry is APPENDED after the registry groups with a
 * humanized label (the graceful coverage-warning posture of ADR-0004:
 * unregistered folders are tolerated, not dropped).
 *
 * Every emitted group's `autogenerate.directory` is `${directoryPrefix}/${id}`
 * (the docsDir-prefixed folder), so the group resolves its hub `/<id>/` link AND
 * its child pages against Starlight's un-stripped `filePath` — see {@link
 * SidebarAutogenGroup} for the mechanism and why the bare `<id>` directory renders
 * empty under doc-kitty's `docs/` layout.
 */
export function registryToSidebar(
  registry: SectionRegistry,
  presentDirs: readonly string[],
  options: RegistryToSidebarOptions = {},
): SidebarAutogenGroup[] {
  const present = new Set(presentDirs);
  const generated = new Set(options.generatedIds ?? BUILD_GENERATED_SECTION_IDS);
  const warn =
    options.warn ?? ((message: string) => console.warn(`[dk-sections] ${message}`));
  const claimed = new Set<string>();
  const groups: SidebarAutogenGroup[] = [];

  // The docsDir prefix, normalized: `\` → `/`, a leading `./`, and surrounding
  // slashes stripped. `'docs'`, `'./docs/'`, `'docs\\'` → `'docs'`; empty → no
  // prefix (bare `<id>` directory).
  const prefix = (options.directoryPrefix ?? '')
    .replace(/\\/g, '/')
    .replace(/^\.?\/+/, '')
    .replace(/\/+$/, '');

  // One section id → its bare autogen group, with the directory prefixed by the
  // docsDir so Starlight's route match lines up with the un-stripped `filePath`.
  const makeGroup = (label: string, id: string): SidebarAutogenGroup => ({
    label,
    autogenerate: { directory: prefix ? `${prefix}/${id}` : id },
  });

  for (const entry of [...registry].sort(byOrderThenId)) {
    // Present on disk, or a build-generated section whose folder is legitimately
    // absent at snapshot time → emit the group either way.
    if (present.has(entry.id) || generated.has(entry.id)) {
      groups.push(makeGroup(entry.label, entry.id));
      claimed.add(entry.id);
      continue;
    }
    // Neither on disk nor build-generated → a real typo/misconfig. Warn loudly
    // (issue #23) instead of silently dropping the group.
    warn(
      `section "${entry.id}" is registered in sections.yaml but its folder is ` +
        `missing under the docs root and it is not a build-generated section — ` +
        `its sidebar group was skipped`,
    );
  }

  for (const dir of [...present].filter((d) => !claimed.has(d)).sort()) {
    groups.push(makeGroup(humanizeSection(dir), dir));
  }

  return groups;
}

// ---------------------------------------------------------------------------
// WIRED / DEFERRED (stated here so the code does not deepen the arch-doc myth):
//   • `type`-from-registry as the section-default `type` authority (ADR-0004/
//     FR-003) — WIRED (issue #24). `sectionTypes` exposes the `id → type` map;
//     `metadata.ts`'s `expectedDocType` derives a page's expected `type` from it
//     (a section README takes the section type), with the short sub-path subtype
//     table applied on top in code.
//   • per-section `subtypes` (E-02, FR-005, D-03) — WIRED (adopter-loader-
//     migration WP01). `sectionSubtypes` exposes the `id → subtypes[]` map;
//     `metadata.ts`'s `expectedDocType` consults it BEFORE the built-in sub-path
//     table (E-06), so a sub-path rename (`plans/features` → `plans/missions`)
//     is a registry data edit, not a derivation-code edit (SC-002). Absent
//     `subtypes` ⇒ the built-in table applies unchanged (NFR-003).
//   • `feeds` as a per-surface filter (section-registry.md "`feeds` semantics") —
//     WIRED. `sectionFeeds` exposes the `id → feeds` map and `feedsSurface`
//     applies the absent=all default; the sitemap draft filter (`config.ts`) and
//     the RSS / llms.txt / agent-index routes each compose it with their existing
//     per-page gating, so a section left out of a surface removes its pages there.
//   • `purpose` as the section blurb (section-registry.md / generators.md) —
//     WIRED. `sectionPurposes` exposes the `id → purpose` map; llms.txt emits a
//     blurb per section group = README description ?? registry purpose.
//   • MDX / remark-mdx — unrelated, tracked as issue #16.
// ---------------------------------------------------------------------------
