/**
 * `disclosure/disclosure.client` — upgrades every `[data-dk-disclosure]` on the page.
 * A component that renders a disclosure imports this from its `<script>`, so Astro
 * bundles and dedupes it and a page without one loads no script.
 *
 * The sheet comes with it, not through `GLOBAL_COMPONENT_SHEETS`. Astro attaches a
 * script-imported sheet by the route's module graph, not by what renders: imported from
 * a component every docs page loads, the sheet is inline in all docs pages' `<head>`,
 * with or without a disclosure, so it applies before first paint and with scripts off.
 * Only the script is per page. The gains are a clean deck route (it loads neither) and
 * no emitted `.css` file, so the CSS golden list is unchanged.
 */
import '../../styles/disclosure.css';
import { upgradeDetails } from './upgrade-details.js';

export function upgradeAllDisclosures(): void {
  for (const root of document.querySelectorAll<HTMLElement>('[data-dk-disclosure]')) {
    upgradeDetails(root);
  }
}

// Print fallback for browsers without `::details-content` (the CSS print rule covers the
// rest): open each closed block for the print, then put back what was closed.
const PRINT_BLOCKS = '.dk-panel.dk-disclosure > details:not([open])';
let reopened: HTMLDetailsElement[] = [];
window.addEventListener('beforeprint', () => {
  // Accumulate: a second `beforeprint` before `afterprint` finds these already open.
  for (const details of document.querySelectorAll<HTMLDetailsElement>(PRINT_BLOCKS)) {
    reopened.push(details);
    details.open = true;
  }
});
window.addEventListener('afterprint', () => {
  for (const details of reopened) details.open = false;
  reopened = [];
});

// INERT re-init hook, as in the TOC rail's island: no ClientRouter is configured
// today, so `astro:page-load` does not fire. Registered once, at module top level.
document.addEventListener('astro:page-load', upgradeAllDisclosures);

// Module scripts run after the document is parsed, so the wrappers exist here.
upgradeAllDisclosures();
