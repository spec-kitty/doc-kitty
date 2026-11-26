/**
 * `print/print.client` — the page print layer's browser half (#378, #386, ADR-0081).
 *
 * `PrintLayer.astro` loads this, and the manifest exports that component only on a site
 * with the print layer on, so the layer costs a site without it nothing (SC-004). It
 * brings two sheets with it, through the module graph like `disclosure.client` (no
 * `.css` file joins the global list): the print rules, and the generated print-token
 * fallback that keeps a dark page light when a browser prints without firing
 * `beforeprint`.
 *
 * Force light: a reader in the dark theme would otherwise print a near-black page,
 * because doc-kitty's `--dk-* → --sl-*` bridge keys every colour on `data-theme`. On
 * `beforeprint` the root is switched to `light`; on `afterprint` the reader's own value
 * comes back. The theme is never written to storage, so the reader's choice is
 * untouched. Build-mode diagrams follow the light tokens through `var(--dk-diagram-*)`.
 *
 * A page with client-mode diagrams (`pre.mermaid`) is not switched: the diagram renderer
 * redraws on a `data-theme` change, resetting each diagram to its Mermaid source first,
 * and a print taken in between would show the source. Such a page prints light through
 * the print-token fallback alone, and its client-mode diagrams keep the drawing they
 * have, in the reader's theme. PDFs always print light: `dockitty-pdf` loads every page
 * in the light theme. This listener shares no state with the disclosure print fallback,
 * so the two can fire in either order.
 */
import '../../styles/print.css';
import 'virtual:doc-kitty/print-tokens.css';

const root = document.documentElement;
/** The reader's theme while a print is in progress; `undefined` when none is. */
let saved: string | null | undefined;

window.addEventListener('beforeprint', () => {
  // Client-mode diagrams would be reset to their source by the renderer's redraw.
  if (document.querySelector('pre.mermaid')) return;
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
  if (saved === undefined) return;
  if (saved === null) root.removeAttribute('data-theme');
  else if (root.getAttribute('data-theme') !== saved) root.setAttribute('data-theme', saved);
  saved = undefined;
});
