/**
 * `slug(name)` — the **single** deterministic anchor function for the glossary
 * (D6, NFR-004). It is the shared contract used by the page generator (WP03), the
 * resolver (WP02), and the `:term` directive (WP05): every one of them turns a term
 * `name` into the same `#<anchor>` click target. Do **not** duplicate this rule
 * anywhere — a second slug function is a review finding (drift risk).
 *
 * Rule: lowercase, trim, collapse every run of non-alphanumerics to a single `-`,
 * then strip leading/trailing `-`. Pure and deterministic — no randomness, no date,
 * no locale — so the same `name` always yields the same anchor (INV-G2), and the
 * output is idempotent: `slug(slug(x)) === slug(x)` (its only characters are
 * `[a-z0-9]` and single interior `-`).
 */
export function slug(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}
