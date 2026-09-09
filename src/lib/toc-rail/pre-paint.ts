/**
 * `toc-rail/pre-paint` — the no-flash inline `<head>` script SOURCE (IC-01,
 * contract C-1, invariant INV-1 / NFR-001). WP03 embeds this string verbatim in
 * the Starlight `head[]` as a synchronous **classic** inline script (rendered
 * `is:inline`, so Astro emits it untouched — no `type=module`, no `defer`, no
 * `async`). Running synchronously in `<head>` sets `data-toc-collapsed` on
 * `<html>` BEFORE first paint, so a returning reader with a collapsed preference
 * sees zero expanded frames.
 *
 * ## Why a raw string (not an imported function)
 * The script must execute during document parse, before any module graph loads,
 * so it cannot be a normal ESM import. Exporting the SOURCE keeps it embeddable
 * by WP03 AND executable by tests (which run it against a stubbed document).
 *
 * ## Blocked storage (C-1 / FR-005)
 * The read is inside a real `try/catch`. In private mode `localStorage` exists
 * but `getItem` THROWS — the bare `typeof` guard Starlight's ThemeProvider uses
 * would abort the whole inline script. The `catch` leaves the outline expanded
 * (the safe default) rather than throwing during head parse.
 *
 * Kept intentionally tiny and dependency-free (it ships inline on every page).
 */
export const PRE_PAINT_SCRIPT: string =
  "try{if(localStorage.getItem('dk-toc-collapsed')==='1')" +
  "{document.documentElement.setAttribute('data-toc-collapsed','');}}catch(e){}";
