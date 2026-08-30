/**
 * `glossaryAutolink` — the thin remark wrapper over {@link computePageLinks}
 * (ADR-0027 Decision 2, contract `autolink-and-term.md`). It owns only the gates
 * and the vfile; ALL resolution and tree work is the pure core's. Registered
 * LAST among the M4 remark plugins by WP08 (`remark-gfm → remarkDirective →
 * glossary-term → glossary-autolink`), so `:term` link nodes already exist and
 * are respected as the section's first eligible occurrence.
 *
 * The wrapper (mirroring the `deck-split` precedent):
 *   - is a strict no-op unless a shared term index is supplied AND non-empty
 *     (presence gate — no glossary corpus ⇒ byte-identical output, NFR-002);
 *   - is a strict no-op on a deck (`kind: Presentation`) — a slide is not
 *     auto-linked; `:term` still works there (AS-1/AS-4, ADR-0027 Decision 6);
 *   - honors the per-page `glossary_autolink: false` opt-out (whole-page no-op,
 *     FR-008);
 *   - reads the page's own `glossary_context` for per-page disambiguation; and
 *   - re-emits each distinct unresolved collision as one greppable warning
 *     (NFR-007) — via `file.message` AND `console.warn` to stderr, because Astro
 *     does not surface remark `file.message` to the build console; the build
 *     still exits 0.
 *
 * It DELIBERATELY does NOT publish the used-list to
 * `file.data.astro.frontmatter`: that channel is RETIRED (ADR-0025 Decision 2 /
 * post-squad A-1 — `docKittyDocsSchema` strips undeclared keys and `entry.data`
 * freezes at load). WP07's "On this page" block re-derives the list by calling
 * the SAME `computePageLinks` over `entry.body` at render.
 *
 * DORMANT: no caller registers this plugin until WP08 wires the order and WP09
 * lands the definitions file. Until then the corpus is byte-identical.
 */
import {
  computePageLinks,
  formatUnresolvedWarning,
  type MdRoot,
} from './glossary-autolink.internal.js';
import type { SharedTermIndex } from '../glossary/types.js';
import { isPresentationFile } from '../deck/is-presentation.js';

/** Options WP08 supplies at registration (the shared index + ignore-list). */
export interface GlossaryAutolinkOptions {
  /** WP01's shared term index; absent/empty ⇒ the plugin is a no-op. */
  index?: SharedTermIndex;
  /** Lowercased surfaces never linked (FR-008); defaults to empty. */
  ignoreList?: ReadonlySet<string>;
}

/** The subset of the remark VFile this plugin reads (Astro injects `data.astro`). */
interface GlossaryVFile {
  data?: {
    astro?: {
      frontmatter?: Record<string, unknown>;
    };
  };
  message(reason: string): unknown;
}

/**
 * Remark plugin factory. Returns the transformer Astro runs over each page's
 * mdast; assignable to Astro's `RemarkPlugin` (a unified `Plugin<[], Root>`).
 */
export default function glossaryAutolink(options: GlossaryAutolinkOptions = {}) {
  const index = options.index;
  const ignoreList = options.ignoreList ?? new Set<string>();

  return function transformer(tree: MdRoot, file: GlossaryVFile): void {
    // Presence gate: no shared corpus ⇒ nothing to link (NFR-002).
    if (index === undefined || index.bySurface.size === 0) return;

    const frontmatter = file.data?.astro?.frontmatter;
    // Deck no-op — a slide is never auto-linked (AS-1/AS-4).
    if (isPresentationFile(file)) return;
    // Per-page opt-out — the whole plugin is a no-op for this page (FR-008).
    if (frontmatter?.glossary_autolink === false) return;

    const pageContext =
      typeof frontmatter?.glossary_context === 'string'
        ? frontmatter.glossary_context
        : undefined;

    computePageLinks(tree, pageContext, index, ignoreList, (surface, competing) => {
      const warning = formatUnresolvedWarning(surface, competing);
      // NFR-007 lives at the BUILD layer: the collision must be a greppable line a
      // build gate can assert on. Astro does NOT forward remark `file.message`
      // diagnostics to the console, so ALSO write the pinned line to stderr. The
      // pure core dedups (once per distinct surface per page), so this stays a
      // single line per collision; it is non-fatal — the build still exits 0
      // (INV-G3 skip-and-warn). `file.message` is retained for any dev overlay.
      file.message(warning);
      console.warn(warning);
    });
  };
}
