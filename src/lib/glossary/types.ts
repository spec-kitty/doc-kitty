/**
 * Shared glossary types — the framework-agnostic vocabulary of the M4 glossary
 * seam (ADR-0026 / ADR-0027, data-model.md). These are the types every glossary
 * WP imports: the loader (this WP) produces {@link SharedTermIndex}; the resolver
 * (WP02) returns {@link Resolution}; the generator (WP03), `:term` (WP05), and the
 * "On this page" block (WP07) consume {@link Term}/{@link Context} and publish
 * {@link GlossaryLinkUsed}. Defined once here so there is no cross-WP drift (D6).
 */

/**
 * A single glossary term as it appears in `.contextive/definitions.yaml`.
 * `definition`/`meta` are markdown, rendered through the real pipeline (FR-003/004).
 */
export interface Term {
  name: string;
  definition: string;
  aliases?: string[];
  examples?: string[];
  meta?: Record<string, string>;
}

/**
 * A bounded context — the disambiguation unit. Each maps to one generated page
 * (`/glossary/<slug(name)>/`) and one nav node (ADR-0026).
 */
export interface Context {
  name: string;
  domainVisionStatement?: string;
  terms: Term[];
}

/**
 * The one shared matcher's data (ADR-0026, INV-G1): parsed and built **once** by
 * the loader, then imported by every consumer.
 *
 * - `bySurface` — keyed by the **lowercased** surface (a term `name` OR any of its
 *   `aliases`; FR-012). The value is every candidate that surface could link to
 *   (more than one ⇒ a cross-context collision the resolver disambiguates). Each
 *   entry carries the AUTHORITATIVE, de-collided `anchor` and the context's
 *   de-collided page-`contextSlug`, both computed ONCE in `buildIndex` (INV-G1):
 *   every downstream site READS these instead of recomputing `slug(...)`.
 * - `contexts` — per-context data for page generation, keyed by the context's
 *   original-case `name`. `slug` is the de-collided page slug; `anchors` maps each
 *   term `name` (unique per context — a duplicate is build-fatal) to its
 *   de-collided anchor, so the generator reads the stored value.
 */
export interface SharedTermIndex {
  bySurface: Map<
    string,
    Array<{ context: string; contextSlug: string; anchor: string; termName: string }>
  >;
  contexts: Map<
    string,
    { slug: string; terms: Term[]; anchors: Map<string, string>; domainVisionStatement?: string }
  >;
}

/**
 * Resolver output (WP02, ADR-0027) — a discriminated union over
 * `(surface, pageContext, index)`. Defined here so WP02 imports it rather than
 * redefining it.
 *
 * - `link` — a single candidate, or a multi-candidate surface disambiguated by the
 *   page's own `glossary_context` (FR-007).
 * - `unresolved` — multiple candidates with no disambiguating page context;
 *   `competing` is the deterministically-sorted list of contending context names
 *   for the greppable warning (NFR-007). Left plain, never auto-linked (INV-G3).
 * - `none` — not a term/alias, or ignore-listed (FR-008).
 */
export type Resolution =
  | { kind: 'link'; context: string; contextSlug: string; anchor: string; termName: string }
  | { kind: 'unresolved'; surface: string; competing: string[] }
  | { kind: 'none' };

/**
 * The FR-010 datum for each distinct glossary link a page used, consumed by the
 * "On this page" block (ADR-0025). The block **re-derives** this list at render
 * (`OnThisPage.linksForBody` runs the same directive+term+`computePageLinks` pass
 * over `entry.body`) — the `remarkPluginFrontmatter` channel was retired (post-squad
 * A-1: the schema strips undeclared keys and `entry.data` freezes at load). Distinct
 * per term.
 */
export interface GlossaryLinkUsed {
  surface: string;
  context: string;
  contextSlug: string;
  anchor: string;
  termName: string;
}
