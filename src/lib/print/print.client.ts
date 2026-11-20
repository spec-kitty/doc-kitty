/**
 * `print/print.client` — the page print layer's browser half (#378, #386, ADR-0081).
 *
 * `PageTitle.astro` loads this from its `<script>`, so every in-frame page gets it and
 * the out-of-frame deck route does not. It brings two sheets with it, through the module
 * graph like `disclosure.client` (no `.css` file joins the global list): the print rules,
 * and the generated print-token fallback that keeps a dark page light when a browser
 * prints without firing `beforeprint`.
 *
 * Force light: a reader in the dark theme would otherwise print a near-black page,
 * because doc-kitty's `--dk-* → --sl-*` bridge keys every colour on `data-theme`. On
 * `beforeprint` the root is switched to `light`; on `afterprint` the reader's own value
 * comes back. The theme is never written to storage, so the reader's choice is
 * untouched. Client-mode diagrams keep the drawing they have: their `[data-theme]`
 * re-render is paused for the print (`data-dk-printing`), and build-mode diagrams follow
 * the light tokens through `var(--dk-diagram-*)`. This listener shares no state with the disclosure print
 * fallback, so the two can fire in either order.
 */
import '../../styles/print.css';
import 'virtual:doc-kitty/print-tokens.css';

const root = document.documentElement;
/** The reader's theme while a print is in progress; `undefined` when none is. */
let saved: string | null | undefined;

window.addEventListener('beforeprint', () => {
  // Pause client-mode diagram re-renders first: a re-render resets each node to its
  // Mermaid source at once and redraws later, so the print would catch raw source.
  // The renderer's `[data-theme]` observer skips while this attribute is set.
  root.setAttribute('data-dk-printing', '');
  // A second `beforeprint` before `afterprint` must not overwrite the reader's value.
  if (saved === undefined) saved = root.getAttribute('data-theme');
  if (root.getAttribute('data-theme') !== 'light') root.setAttribute('data-theme', 'light');
});

// The print control (`PrintControl.astro`, #379): its button prints the page. Delegated,
// so it costs nothing on a page without the control.
document.addEventListener('click', (event) => {
  const target = event.target instanceof Element ? event.target.closest('[data-dk-print]') : null;
  if (target) window.print();
});

window.addEventListener('afterprint', () => {
  if (saved !== undefined) {
    if (saved === null) root.removeAttribute('data-theme');
    else if (root.getAttribute('data-theme') !== saved) root.setAttribute('data-theme', saved);
    saved = undefined;
  }
  // Clear the pause one task later: the observer's records for the restore above are
  // delivered as a microtask first, and must still see the pause (the diagrams already
  // show the reader's theme, so there is nothing to redraw).
  setTimeout(() => root.removeAttribute('data-dk-printing'), 0);
});
