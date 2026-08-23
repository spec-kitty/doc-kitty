/**
 * Path math for resolving a frontmatter image reference to the key of an
 * `import.meta.glob` entry, kept free of any Astro/Vite imports so it stays
 * unit-testable and lint-clean under `eslint src/**\/*.ts`.
 *
 * A `hero_image.src` / `social_thumb` value is authored RELATIVE to its page
 * (e.g. `./assets/overview-hero.png` on `docs/architecture/overview.md`). The
 * optimized-image slots glob the consuming site's docs tree with a project-root
 * absolute pattern (`/docs/**`), whose keys are project-root absolute paths
 * (`/docs/architecture/assets/overview-hero.png`). This module maps the former
 * to the latter, and also recognises values that are already an absolute or
 * remote URL (a bare-string `social_thumb` pointing at a `public/` asset or an
 * external host), which must be used verbatim rather than optimized.
 */

/** True when `src` is an external URL or a site-absolute (`public/`) path. */
export function isAbsoluteOrRemote(src: string): boolean {
  return /^(https?:)?\/\//.test(src) || src.startsWith('/') || src.startsWith('data:');
}

/**
 * Resolve a page-relative image `src` against the page's `filePath` (relative to
 * the site root, as Astro records it on a content entry) into the project-root
 * absolute key an `import.meta.glob('/docs/**')` map is keyed by.
 *
 * Returns `null` when the value is absolute/remote (nothing to optimize) or when
 * `filePath` is unavailable.
 */
export function resolveColocatedKey(
  src: string,
  filePath: string | undefined,
): string | null {
  if (!filePath || isAbsoluteOrRemote(src)) return null;
  const dir = filePath.replace(/\\/g, '/').replace(/\/[^/]*$/, '');
  const parts = dir ? dir.split('/').filter(Boolean) : [];
  for (const seg of src.split('/')) {
    if (seg === '' || seg === '.') continue;
    if (seg === '..') parts.pop();
    else parts.push(seg);
  }
  return '/' + parts.join('/');
}

/**
 * Pick the matching glob entry for a resolved key from a set of glob keys.
 * Prefers an exact match; falls back to a suffix match so a difference in how
 * the loader roots `filePath` (with or without a leading collection segment)
 * still resolves the intended asset. Returns the matched key or `null`.
 */
export function matchGlobKey(
  resolvedKey: string | null,
  globKeys: string[],
): string | null {
  if (!resolvedKey) return null;
  if (globKeys.includes(resolvedKey)) return resolvedKey;
  const tail = resolvedKey.replace(/^\//, '');
  const suffixed = globKeys.filter((k) => k.endsWith('/' + tail) || k.endsWith(tail));
  return suffixed.length === 1 ? suffixed[0] : null;
}
