/**
 * `baseAbsoluteLinks` — the rehype half of the authored-content link fix
 * (review-cycle-1, WP01 FR-004/SC-002, replacing the failed `.md`-relative
 * approach from D2).
 *
 * **Why this exists.** Astro/Starlight's dynamic-route architecture does NOT
 * rewrite a raw markdown `href` the way it rewrites a link naming a real
 * collection source file elsewhere in the toolchain — a hand-authored,
 * root-absolute in-site link (`/architecture/overview/`) is emitted VERBATIM
 * into the rendered HTML, so on a based deployment (`base: '/doc-kitty'`) it
 * 404s exactly the way an un-prefixed component href did before `withBase`
 * (#61). Component hrefs are fixed at the call site (`withBase`); AUTHORED
 * markdown content has no call site to fix — the fix has to live in the
 * rendered-HTML seam every page passes through, which is this rehype plugin.
 *
 * **Scope — root-absolute internal links only.** This plugin walks the
 * rendered HAST and prefixes the site base onto every `<a href="/...">` it
 * finds, EXCEPT:
 *   - external links (any `scheme:` — `http:`, `https:`, `mailto:`, `tel:`, …);
 *   - protocol-relative links (`//host/…`);
 *   - anchor-only links (`#section`);
 *   - a href that is NOT root-absolute (`./sibling/`, `../parent/`,
 *     `sibling.md`) — those are either already-relative (left to the browser)
 *     or a raw `.md` reference (a separate, already-known failure mode; this
 *     plugin does not attempt to resolve those, only to base-prefix real
 *     root-absolute routes);
 *   - a href that ALREADY starts with the configured base — idempotent, so a
 *     link some other pass already based (or a second run in dev/watch mode)
 *     is never double-prefixed.
 *
 * With NO base configured (`base` omitted or `''` — the default, un-based
 * site) this is a strict no-op on every href: `normalizeBasePrefix('/')` (or
 * `''`) collapses to `''`, and the guard below short-circuits before touching
 * the tree, so a base-less site's corpus stays byte-identical (mirrors the
 * `diagrams`/`markua` opt-in seams' NFR-001/002 shape, though this one is
 * always registered — see `config.ts`).
 *
 * Mirrors `../with-base.ts`'s classification rules exactly (same scheme regex,
 * same protocol-relative/anchor/relative passthroughs) so a component href
 * fixed by `withBase` and an authored content href fixed by this plugin agree
 * on what counts as "in-site, root-absolute" — one shared definition, applied
 * at the two different seams (component render vs. rendered markdown HAST)
 * that each need it.
 */

/** Any `scheme:` prefix (`http:`, `https:`, `mailto:`, `tel:`, …). Mirrors `with-base.ts`. */
const SCHEME_RE = /^[a-z][a-z0-9+.-]*:/i;

/** Minimal structural hast node — enough to find `<a href>` elements and recurse. */
interface HastNode {
  type: string;
  tagName?: string;
  properties?: Record<string, unknown>;
  children?: HastNode[];
  [key: string]: unknown;
}

export interface BaseAbsoluteLinksOptions {
  /**
   * The site's already-normalized base prefix (leading slash, no trailing
   * slash, e.g. `/doc-kitty`) — `config.ts` threads `normalizeBasePrefix(base)`
   * here, the SAME value the glossary plugins receive (one base source, no
   * cloned prefix logic). Defaults to `''` (no base configured), which makes
   * the plugin a strict no-op.
   */
  base?: string;
}

/**
 * Decide the base-prefixed href for one candidate value, or `undefined` when
 * it must be left untouched (external/protocol-relative/anchor-only/already
 * relative/already based/no base configured). Exported for direct unit
 * coverage without needing to build a hast tree.
 */
export function prefixIfRootAbsolute(href: string, base: string): string | undefined {
  if (!base) return undefined; // no base configured — nothing to add
  if (href === '') return undefined;
  if (SCHEME_RE.test(href)) return undefined; // http:, https:, mailto:, tel:, …
  if (href.startsWith('//')) return undefined; // protocol-relative
  if (href.startsWith('#')) return undefined; // anchor-only
  if (!href.startsWith('/')) return undefined; // relative — left to the browser
  if (href === base || href.startsWith(`${base}/`)) return undefined; // already based — idempotent

  return `${base}${href}`;
}

/** True for an element with a string `href` property this plugin should inspect. */
function hasHref(node: HastNode): node is HastNode & { properties: { href: string } } {
  return (
    node.type === 'element' &&
    node.tagName === 'a' &&
    typeof node.properties?.href === 'string'
  );
}

/**
 * Rehype plugin factory. Returns the transformer Astro runs over each page's
 * hast; assignable to Astro's `RehypePlugin` (a unified `Plugin<[options?], Root>`).
 */
export default function baseAbsoluteLinks(options: BaseAbsoluteLinksOptions = {}) {
  const base = options.base ?? '';

  return function transformer(tree: HastNode): void {
    if (!base) return; // no base configured — strict no-op (byte-identical)

    const walk = (node: HastNode): void => {
      if (hasHref(node)) {
        const prefixed = prefixIfRootAbsolute(node.properties.href, base);
        if (prefixed !== undefined) {
          node.properties.href = prefixed;
        }
      }
      if (Array.isArray(node.children)) {
        for (const child of node.children) walk(child);
      }
    };

    walk(tree);
  };
}
