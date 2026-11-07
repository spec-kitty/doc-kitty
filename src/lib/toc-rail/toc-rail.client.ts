/**
 * `toc-rail/toc-rail.client` — the accessible collapse toggle island (IC-02/IC-03,
 * contract C-3, FR-001/FR-003/FR-006/FR-007). It AUGMENTS Starlight's rendered
 * `.right-sidebar` DOM with one native `<button>` rather than overriding
 * `PageSidebar` (the five-carrier chrome lock, DIRECTIVE_001): the toggle is
 * injected from the browser, so no Starlight `components` carrier is touched.
 *
 * ## Persistence + the layout driver (INV-3)
 * Clicking flips `data-toc-collapsed` on `<html>` — the single layout driver the
 * CSS (`../../styles/toc-rail.css`) keys every collapsed rule on — and persists via
 * WP01's blocked-storage-safe `setCollapsed`. The pre-paint inline script
 * (`./pre-paint`) sets that same attribute BEFORE first paint for a returning
 * reader, so this module only has to REFLECT the persisted state onto the button at
 * mount and MUTATE it on click; it never fights the pre-paint for the initial
 * attribute.
 *
 * ## Accessibility (C-3 / WCAG 2.1 AA)
 * The button comes from the shared `../disclosure/toggle` (ADR-0077). A native
 * `<button type="button">` gives Enter/Space activation for free. The
 * button carries `aria-expanded` (state of the outline region), `aria-controls`
 * naming the outline panel, a non-empty `aria-label` + matching `title` that swap
 * per state, and a `:focus-visible` accent ring (in the sheet). The chevron `<svg>`
 * is `aria-hidden` (decorative), and the sheet rotates it 180° under
 * `html[data-toc-collapsed]`; the accessible name comes from `aria-label`.
 *
 * ## Mount point (FR-008)
 * The button is the FIRST CHILD of `.right-sidebar-container`, ahead of
 * `.right-sidebar`. Document order is focus order, so the toggle is reached
 * immediately before the first outline link instead of after the footer, which is
 * where a body-mounted button ended up.
 *
 * Starlight 0.32.6 nests the rail as
 * `.right-sidebar-container > .right-sidebar > .right-sidebar-panel`
 * (`TwoColumnContent.astro`, `PageSidebar.astro`). The collapsed sheet makes
 * `.right-sidebar` `pointer-events: none` and `.right-sidebar-panel`
 * `display: none`; the container is an ancestor of the button but neither of those
 * two is, so the button stays rendered and clickable while collapsed.
 *
 * The button is `position: fixed`. No ancestor of the container has a `transform`,
 * `filter` or `contain`, so its containing block is the viewport and the rail's
 * scroll overflow cannot clip it. Being out of flow, it does not move the reading
 * column when it is injected (NFR-005).
 */

import { createDisclosureButton } from '../disclosure/toggle.js';
import { isCollapsed, setCollapsed } from './preference.js';

/** Stable unique id — the idempotency sentinel AND the CSS anchor hook. */
const TOGGLE_ID = 'dk-toc-toggle';

/** Stable id for the outline panel, the target of the button's `aria-controls`.
 * Starlight gives `.right-sidebar-panel` no id, so the island supplies one. */
const PANEL_ID = 'dk-toc-panel';

/** Accessible-name / tooltip text per state (C-3). Non-empty in both states. */
const LABEL_WHEN_EXPANDED = 'Hide the table of contents';
const LABEL_WHEN_COLLAPSED = 'Show the table of contents';

/** Drive the `<html>` attribute (the layout driver) and persist the state
 * (blocked-storage-safe): the rail's state adapter for the shared toggle. */
function applyCollapsed(collapsed: boolean): void {
  const root = document.documentElement;
  if (collapsed) {
    root.setAttribute('data-toc-collapsed', '');
  } else {
    root.removeAttribute('data-toc-collapsed');
  }
  setCollapsed(collapsed);
}

/**
 * Inject the collapse toggle once, on a page that has a right-hand TOC rail.
 *
 * Guards, in order: (1) do nothing when there is no `.right-sidebar-container` (a
 * route with no on-page TOC — nothing to collapse); (2) idempotent — bail if the
 * toggle id is already present (so a re-entrant call, or a future ClientRouter
 * `astro:page-load`, never stacks a second button). Safe to call any number of times.
 */
export function initTocRail(): void {
  const container = document.querySelector('.right-sidebar-container');
  if (!container) return; // no TOC rail here
  if (document.getElementById(TOGGLE_ID)) return; // already injected (idempotent)

  // Name the region the button controls (FR-008). An id already on the panel is
  // kept; otherwise the island assigns its own.
  const panel = container.querySelector('.right-sidebar-panel');
  if (panel && !panel.id) panel.id = PANEL_ID;

  const button = createDisclosureButton({
    id: TOGGLE_ID,
    controls: panel?.id ?? '',
    labelWhenExpanded: LABEL_WHEN_EXPANDED,
    labelWhenCollapsed: LABEL_WHEN_COLLAPSED,
    isCollapsed,
    setCollapsed: applyCollapsed,
  });
  button.className = 'dk-toc-toggle';

  // First child of the container, ahead of `.right-sidebar`: next to the outline in
  // focus order and outside the two subtrees the collapsed sheet disables. See the
  // module header.
  container.prepend(button);
}

// INERT re-init hook (no ClientRouter is configured today, so `astro:page-load`
// never fires on a client-side navigation). Registered ONCE at module top level —
// deliberately NOT inside `initTocRail`, which would stack a fresh listener on
// every call. If a future WP adds `<ClientRouter/>`, this re-injects the toggle
// after each swap; the idempotency guard keeps that from duplicating the button.
document.addEventListener('astro:page-load', initTocRail);

// Initial mount for the ordinary full-page-load path (module scripts run after the
// document is parsed, so the rail container exists here).
initTocRail();
