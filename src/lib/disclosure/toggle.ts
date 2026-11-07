/**
 * `disclosure/toggle` — the one disclosure button (FR-017, ADR-0077), extracted
 * from the TOC rail's toggle. It owns the button's markup, chevron and ARIA state.
 *
 * It holds no state and touches no storage: the caller passes an adapter
 * (`isCollapsed`/`setCollapsed`), so whether a state persists is the caller's
 * choice and nothing can store a metadata block's state by accident (FR-016).
 */

export interface DisclosureOptions {
  id: string;
  /** The `aria-controls` target id. Empty when there is no target to name. */
  controls: string;
  /** The accessible name while expanded, describing what the next click does. */
  labelWhenExpanded: string;
  /** The accessible name while collapsed, describing what the next click does. */
  labelWhenCollapsed: string;
  isCollapsed(): boolean;
  /** The state adapter. Persisting, or not, is its business. */
  setCollapsed(next: boolean): void;
  /** The button shows its label as text, so a `title` would only repeat it. */
  labelled?: boolean;
}

/** Decorative chevron. `aria-hidden` so the name comes only from `aria-label`.
 * Each caller's sheet rotates it to show the state. */
const CHEVRON_SVG =
  '<svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true" focusable="false">' +
  '<path d="M6 3.5 10.5 8 6 12.5" fill="none" stroke="currentColor" ' +
  'stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"/></svg>';

/** Reflect a state onto the button: `aria-expanded` mirrors whether the region is
 * expanded (= `!collapsed`), and the label describes the ACTION of the next click. */
export function reflectState(
  button: HTMLButtonElement,
  collapsed: boolean,
  options: DisclosureOptions,
): void {
  button.setAttribute('aria-expanded', String(!collapsed));
  const label = collapsed ? options.labelWhenCollapsed : options.labelWhenExpanded;
  button.setAttribute('aria-label', label);
  if (!options.labelled) button.title = label;
}

/**
 * A native `<button type="button">` (Enter and Space for free) that flips the
 * adapter's state on click. The caller sets its class and places it.
 *
 * A click reflects the state it asked for, not a re-read: a store that reads but
 * refuses writes (a full `localStorage`) must still show the click's result.
 */
export function createDisclosureButton(options: DisclosureOptions): HTMLButtonElement {
  const button = document.createElement('button');
  button.type = 'button';
  button.id = options.id;
  button.innerHTML = CHEVRON_SVG; // constant markup only — no user data (safe)
  if (options.controls) button.setAttribute('aria-controls', options.controls);

  reflectState(button, options.isCollapsed(), options);
  button.addEventListener('click', () => {
    const next = !options.isCollapsed();
    options.setCollapsed(next);
    reflectState(button, next, options);
  });
  return button;
}
