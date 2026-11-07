/**
 * `disclosure/upgrade-details` — turns a native `<details>` into the shared
 * disclosure button (FR-017, ADR-0077). The baseline is complete with scripts off:
 *
 *   <div class="dk-disclosure" data-dk-disclosure
 *        data-label-expanded="Hide Related (3)" data-label-collapsed="Show Related (3)">
 *     <details id="..."><summary>...</summary>...</details>
 *   </div>
 *
 * `details.open` stays the only state and is never written here on first load
 * (NFR-006), and nothing is stored (FR-016).
 *
 * Anything short of that baseline is left alone: the native control still works,
 * whereas a button with no name or no target would not.
 */
import { createDisclosureButton, reflectState, type DisclosureOptions } from './toggle.js';

/** Marks a finished upgrade. Hiding the summary keys on it (`disclosure.css`). */
export const UPGRADED_CLASS = 'dk-disclosure--upgraded';
const TOGGLE_CLASS = 'dk-disclosure__toggle';

export function isUpgraded(root: HTMLElement): boolean {
  return root.classList.contains(UPGRADED_CLASS);
}

/** The two accessible names, as the wrapper states them, or null if one is missing.
 * They must contain the visible label (WCAG 2.5.3), which only the author knows. */
export function readLabels(
  root: HTMLElement,
): Pick<DisclosureOptions, 'labelWhenExpanded' | 'labelWhenCollapsed'> | null {
  const labelWhenExpanded = root.getAttribute('data-label-expanded');
  const labelWhenCollapsed = root.getAttribute('data-label-collapsed');
  return labelWhenExpanded && labelWhenCollapsed ? { labelWhenExpanded, labelWhenCollapsed } : null;
}

/**
 * The state adapter over `details.open`. With `viaSummary` a change goes through
 * `summary.click()`, because Starlight's `SidebarPersistState` records a toggle
 * only when a click lands in a `summary`. It toggles and bubbles even with the
 * summary `display: none`. Clicking only on a real change keeps a toggle from
 * ever inverting a state that is already right.
 */
export function detailsAdapter(
  details: HTMLDetailsElement,
  summary: HTMLElement,
  viaSummary: boolean,
): Pick<DisclosureOptions, 'isCollapsed' | 'setCollapsed'> {
  return {
    isCollapsed: () => !details.open,
    setCollapsed: viaSummary
      ? (next) => {
          if (next === details.open) summary.click();
        }
      : (next) => {
          details.open = !next;
        },
  };
}

/** Upgrade one `[data-dk-disclosure]` wrapper. Safe to call any number of times. */
export function upgradeDetails(root: HTMLElement): void {
  if (isUpgraded(root)) return;
  // Child selectors: a group's `details` holds nested groups with their own.
  const details = root.querySelector<HTMLDetailsElement>(':scope > details');
  const summary = details?.querySelector<HTMLElement>(':scope > summary');
  const labels = readLabels(root);
  if (!details?.id || !summary || !labels) return;

  // A summary with no text is chevron-only: it has no visible label to repeat, and
  // an icon it holds (WP06's caret) replaces the default chevron.
  const labelled = Boolean(summary.textContent?.trim());
  const options: DisclosureOptions = {
    id: `${details.id}-toggle`,
    controls: details.id,
    ...labels,
    ...detailsAdapter(details, summary, root.getAttribute('data-dk-toggle-via') === 'summary'),
    labelled,
  };
  const button = createDisclosureButton(options);
  button.className = TOGGLE_CLASS;

  const content = summary.cloneNode(true) as HTMLElement;
  for (const withId of content.querySelectorAll('[id]')) withId.removeAttribute('id');
  if (!labelled && content.children.length > 0) button.replaceChildren(...content.childNodes);
  else button.append(...content.childNodes);

  // The browser's in-page find, or Starlight's persister, can change `open`.
  details.addEventListener('toggle', () => reflectState(button, !details.open, options));

  const summaryHadFocus = root.ownerDocument.activeElement === summary;
  // A closed `details` hides all but its summary, so the button goes outside it.
  details.before(button);
  // Last, and only with the button in place: if anything above throws, the summary
  // stays visible and the content stays reachable.
  root.classList.add(UPGRADED_CLASS);
  if (summaryHadFocus) button.focus();
}
