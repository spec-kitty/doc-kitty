/**
 * `DEFAULT_IGNORE_LIST` — the shared surface ignore-list threaded into BOTH the
 * `:term` directive plugin and the auto-linker (FR-008, ADR-0027). A surface in
 * this set never auto-links and never resolves through `:term` (the resolver
 * short-circuits it to `{ kind: 'none' }`). It is the toolkit-wide default; the
 * per-page `glossary_autolink: false` opt-out is its page-local twin.
 *
 * ## The set is EMPTY by default — and that is the safe default (documented choice)
 * FR-008 requires the **mechanism** (a surface can be excluded from linking), not
 * a particular vocabulary. Any word we hardcode here would SILENTLY suppress a
 * legitimately-defined glossary term whose surface happens to match — a surprising,
 * hard-to-debug omission for a downstream site whose definitions we cannot see from
 * the toolkit. Shipping an empty set means:
 *   - the default build links exactly the terms the author defined (no hidden
 *     subtraction), and
 *   - a site that DOES want to suppress common-word false positives extends this
 *     set (or uses `:term[…]{link=false}` / `glossary_autolink: false`) deliberately.
 * The mechanism is fully wired and unit-covered; only the default *content* is empty.
 *
 * ## Contract
 * Entries MUST be **lowercased** — the resolver lowercases each surface before the
 * membership check (`ignoreList.has(surface.toLowerCase())`), so an upper/mixed-case
 * entry here would never match. `ReadonlySet` so no consumer mutates the shared set.
 */
export const DEFAULT_IGNORE_LIST: ReadonlySet<string> = new Set<string>();
