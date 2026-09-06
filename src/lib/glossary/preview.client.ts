/**
 * `preview.client` — the glossary hover-preview island ENTRY (FR-009, NFR-001,
 * NFR-003, NFR-005). It mirrors the M5 footprint discipline of
 * `diagram-render.client`'s `initDiagrams`: WP08 injects this module page-wide via
 * `injectScript('page', …)`, so the module that lands on EVERY route must do
 * nothing — and pull no heavier code — on a route that has no glossary links.
 *
 * ## Footprint (NFR-003 / FP-1)
 * The guard (`if (anchors.length === 0) return;`) runs BEFORE the dynamic
 * `import('./preview-popover.client.js')`, so a glossary-free page never resolves
 * the popover chunk (WP09's network-capture twin asserts: a glossary page requests
 * the chunk, a control route does not). All popover markup, styling, positioning,
 * and the WCAG 2.2 1.4.13 event wiring live in that separate chunk — this entry is
 * only the guard + the import, keeping the always-injected surface tiny.
 *
 * ## No-JS safety (NFR-005)
 * The island only ADDS the preview behaviour. The anchors WP04/WP05 emit are plain
 * same-tab links (`class="dk-glossary-link"`, `data-glossary-*` markers, href
 * `/glossary/<ctx>/#<anchor>`, no `target`/`rel` — #64) that work with JS off; this
 * module never rewrites `href` and never hijacks click, so the full-definition
 * click-through resolves in the same tab whether or not JS is present.
 *
 * ## Definition source (self-contained, NFR-006)
 * The anchors carry `data-glossary-term` / `data-glossary-context` markers but NOT
 * the definition text. The popover chunk sources the definition with no network
 * call — see `preview-popover.client.ts` for the payload contract WP08 honours.
 *
 * DORMANT: nothing calls this until WP08's `injectScript('page')` wires it.
 */

/**
 * Attach the hover/focus definition preview to every glossary link on the page.
 * A no-op (and no popover chunk) when the page has no `a[data-glossary-term]`.
 * This is the entry WP08's `injectScript` calls, mirroring `initDiagrams`.
 */
export async function initGlossaryPreview(): Promise<void> {
  const anchors = document.querySelectorAll<HTMLAnchorElement>(
    'a[data-glossary-term]',
  );
  if (anchors.length === 0) return; // load-only-where-needed (NFR-003/FP-1)

  // Dynamic import INSIDE the guard: a glossary-free route never resolves this
  // chunk, so the always-injected entry stays free of the popover code path.
  const { mountGlossaryPreview } = await import('./preview-popover.client.js');
  mountGlossaryPreview(anchors);
}
