/**
 * `withBase` — the SINGLE component base-prefix helper (#61, C-002, NFR-002).
 *
 * Astro does NOT rewrite a raw root-absolute markdown/component href
 * (`/glossary/…`, a page route) to carry the site's configured `base` — only a
 * link naming a real collection source file (`./target.md`) gets that
 * treatment. Every component that builds an in-site href by hand (`metadata.ts`
 * `resolveProfile`, `Related.astro`, `OnThisPage.astro`'s section/glossary links) must
 * therefore route through this ONE helper instead of cloning base-prefix logic
 * at each call site (the exact clone-drift D1/DIRECTIVE_024 identifies as the
 * root cause of #61).
 *
 * Reads `import.meta.env.BASE_URL` — Astro's own resolved `base` (the same
 * value `config.ts`'s `normalizeBasePrefix` derives from the integration's
 * `base` option, kept independently here so this helper stays a plain,
 * dependency-free unit usable from any `.ts`/`.astro` module scope, per the WP01
 * research note).
 *
 * Behaviour:
 *   - a root-absolute in-site path (`/…`) is prefixed with the normalized base
 *     (leading slash, no trailing slash, no doubled slashes);
 *   - a path that already carries the base is left untouched (idempotent —
 *     guards double-prefixing, the WP01 reviewer risk);
 *   - anything that is NOT root-absolute — external `http(s)://…`/`mailto:…`/
 *     any other URL scheme, a protocol-relative `//…`, an anchor-only `#…`, or
 *     an already-relative path — passes through untouched (NFR-004: external/
 *     anchor/directory-index-relative links stay unaffected).
 */

import { routeOfSlug } from './vocabulary-core.mjs';

/** Any `scheme:` prefix (`http:`, `https:`, `mailto:`, `tel:`, …). */
const SCHEME_RE = /^[a-z][a-z0-9+.-]*:/i;

/**
 * Normalize a raw Astro base value to a leading-slash, no-trailing-slash
 * prefix with no doubled slashes. `''`/`'/'` (no prefix configured) → `''`.
 * Mirrors `config.ts`'s `normalizeBasePrefix` (same shape, independently
 * implemented so this module carries no import from `config.ts`).
 */
function normalizeBase(raw: string): string {
  if (!raw || raw === '/') return '';
  return ('/' + raw + '/').replace(/\/{2,}/g, '/').replace(/\/$/, '');
}

/**
 * Prefix an in-site, root-absolute path with the site's configured base.
 * External/`mailto`/anchor-only/already-relative paths are returned verbatim.
 */
export function withBase(path: string): string {
  if (path === '') return path;
  if (SCHEME_RE.test(path)) return path; // http:, https:, mailto:, tel:, …
  if (path.startsWith('//')) return path; // protocol-relative
  if (path.startsWith('#')) return path; // anchor-only
  if (!path.startsWith('/')) return path; // already-relative — leave to Astro

  const base = normalizeBase(import.meta.env.BASE_URL ?? '/');
  if (base === '') return path; // no base configured — nothing to add
  if (path === base || path.startsWith(`${base}/`)) return path; // already based

  return `${base}${path}`;
}

/**
 * The base-prefixed href of a page, from its page id. The one place an HTML
 * surface (Hub, On this page, Related, the audience link) turns an id into an
 * address: the route rule is `routeOfSlug`'s alone, so a folder index
 * (`guide/index`) and the root (`index`, `''`) are listed where the site serves
 * them (FR-001, issue 134).
 */
export function hrefOfSlug(slug: string): string {
  return withBase(routeOfSlug(slug));
}
