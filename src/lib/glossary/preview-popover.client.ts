/**
 * `preview-popover.client` — the heavier chunk of the glossary hover-preview island
 * (FR-009, NFR-001), pulled ONLY via a dynamic `import()` from `preview.client.ts`
 * after its footprint guard, so a glossary-free route never requests it (NFR-003).
 * It owns the custom popover element, its token-driven styling, the positioning
 * helper, and the WCAG 2.2 1.4.13 event wiring.
 *
 * ## Why a custom popover, not `title` (FR-009 / NFR-001)
 * The HTML `title` attribute cannot meet WCAG 2.2 **1.4.13** (Content on Hover or
 * Focus): it is not hoverable, not Esc-dismissible, and auto-hides. So the preview
 * is a real element built to 1.4.13 by construction:
 *   - **Hoverable** — a short close-delay bridges the gap between the anchor and the
 *     popover; entering the popover cancels the pending close, so the pointer can
 *     travel from the link onto the popover without it vanishing.
 *   - **Dismissible** — a document `keydown` listener closes it on `Escape`.
 *   - **Persistent** — there is NO auto-hide timer; the popover closes only on
 *     pointer-leave (after the bridge delay, and only if neither the popover is
 *     hovered nor the anchor is still focused), on blur, or on `Escape`.
 * A single shared popover element serves every link; it is styled with the `--dk-*`
 * theme tokens (with `--sl-*` and literal fallbacks) so it reads correctly in both
 * colour modes, and toggles `aria-describedby` on the active anchor for SR support.
 *
 * ## Definition source — the contract WP08 must honour (self-contained, NFR-006)
 * The anchors carry only `data-glossary-term` (the term name) and
 * `data-glossary-context` (the context). This module reads the definition text with
 * NO network call, from one of two documented sources, in order:
 *   1. A `data-glossary-definition` attribute on the anchor itself (if a render WP
 *      chooses to inline it), OR
 *   2. A single per-page JSON payload — a
 *      `<script type="application/json" id="dk-glossary-definitions">` element whose
 *      body is `{ "<context>": { "<termName>": "<definition text>" } }` — keyed by
 *      the SAME `data-glossary-context` / `data-glossary-term` values the anchors
 *      carry. The text is inserted with `textContent` (never `innerHTML`), so the
 *      payload should hold PLAIN definition text (already stripped of markup); this
 *      keeps the island injection-safe.
 * WP08 (which wires the page-wide inject and lands the definitions file) is the
 * surface that emits this payload. Until it does, the lookup simply finds nothing
 * and no popover shows — the island still mounts and behaves cleanly (defensive).
 */

const POPOVER_ID = 'dk-glossary-popover';
/** The close-delay (ms) that makes the popover hoverable — long enough for the
 * pointer to cross the gap from the anchor onto the popover (1.4.13 hoverable). */
const CLOSE_DELAY_MS = 160;

/** The per-page definitions payload: context → termName → plain definition text. */
type DefinitionPayload = Record<string, Record<string, string> | undefined>;

/**
 * Read and parse the per-page `<script type="application/json"
 * id="dk-glossary-definitions">` payload once. Returns an empty map when the
 * payload is absent or malformed (defensive — the island still mounts).
 */
function readDefinitionPayload(): DefinitionPayload {
  const script = document.getElementById('dk-glossary-definitions');
  const raw = script?.textContent?.trim();
  if (!raw) return {};
  try {
    const parsed: unknown = JSON.parse(raw);
    if (parsed !== null && typeof parsed === 'object') {
      return parsed as DefinitionPayload;
    }
  } catch {
    // Malformed payload → behave as if there were no definitions.
  }
  return {};
}

/** Resolve a link's definition text from the anchor attribute first, then the
 * payload; `undefined` when neither source has it (that link shows no popover). */
function definitionFor(
  anchor: HTMLAnchorElement,
  payload: DefinitionPayload,
): string | undefined {
  const inline = anchor.getAttribute('data-glossary-definition');
  if (inline !== null && inline.trim() !== '') return inline;

  const term = anchor.getAttribute('data-glossary-term');
  const context = anchor.getAttribute('data-glossary-context');
  if (term === null || context === null) return undefined;
  const text = payload[context]?.[term];
  return text !== undefined && text.trim() !== '' ? text : undefined;
}

/** Inject the popover's token-driven stylesheet once (idempotent). */
function ensureStyle(): void {
  if (document.getElementById(POPOVER_ID + '-style')) return;
  const style = document.createElement('style');
  style.id = POPOVER_ID + '-style';
  style.textContent = `
    .dk-glossary-popover {
      position: absolute;
      top: 0;
      left: 0;
      z-index: 1000;
      max-width: min(320px, calc(100vw - 2rem));
      margin: 0;
      padding: var(--dk-space-2xs, 0.5rem) var(--dk-space-md, 0.75rem);
      font-family: var(--dk-font-sans, inherit);
      font-size: 0.875rem;
      line-height: var(--dk-leading-normal, 1.5);
      color: var(--dk-color-text, var(--sl-color-text, #1b1b1f));
      background: var(--dk-color-surface-1, var(--sl-color-bg, #ffffff));
      border: 1px solid var(--dk-color-border, var(--sl-color-hairline, #cbccd1));
      border-radius: var(--dk-radius-md, 0.5rem);
      box-shadow: var(--dk-shadow-md, 0 4px 14px rgba(0, 0, 0, 0.18));
      overflow-wrap: break-word;
      pointer-events: auto;
    }
    .dk-glossary-popover[hidden] { display: none; }
  `;
  document.head.appendChild(style);
}

/**
 * Mount the hover/focus preview over the supplied glossary anchors. Creates one
 * shared popover element; wires each anchor's hover/focus and the popover's own
 * hover so the pointer can cross onto it (hoverable); closes on pointer-leave
 * (after the bridge delay), blur, or `Escape` — never on an auto-hide timer.
 */
export function mountGlossaryPreview(
  anchors: ArrayLike<HTMLAnchorElement>,
): void {
  ensureStyle();
  const payload = readDefinitionPayload();

  const popover = document.createElement('div');
  popover.id = POPOVER_ID;
  popover.className = 'dk-glossary-popover';
  popover.setAttribute('role', 'tooltip');
  popover.hidden = true;
  document.body.appendChild(popover);

  let activeAnchor: HTMLAnchorElement | null = null;
  let pointerInPopover = false;
  let closeTimer: ReturnType<typeof setTimeout> | undefined;

  const cancelClose = (): void => {
    if (closeTimer !== undefined) {
      clearTimeout(closeTimer);
      closeTimer = undefined;
    }
  };

  const hide = (): void => {
    cancelClose();
    if (activeAnchor !== null) activeAnchor.removeAttribute('aria-describedby');
    activeAnchor = null;
    pointerInPopover = false;
    popover.hidden = true;
  };

  /** Position the popover just below the anchor, clamped into the viewport. */
  const position = (anchor: HTMLAnchorElement): void => {
    const rect = anchor.getBoundingClientRect();
    // Reveal for measurement, then place; margin keeps a hoverable gap small.
    popover.style.top = `${rect.bottom + window.scrollY + 6}px`;
    const maxLeft =
      window.scrollX + document.documentElement.clientWidth - popover.offsetWidth - 8;
    const left = rect.left + window.scrollX;
    popover.style.left = `${Math.max(window.scrollX + 8, Math.min(left, maxLeft))}px`;
  };

  const show = (anchor: HTMLAnchorElement): void => {
    const text = definitionFor(anchor, payload);
    if (text === undefined) return; // no definition for this link → no popover
    cancelClose();
    if (activeAnchor !== null && activeAnchor !== anchor) {
      activeAnchor.removeAttribute('aria-describedby');
    }
    activeAnchor = anchor;
    popover.textContent = text; // textContent, never innerHTML (injection-safe)
    anchor.setAttribute('aria-describedby', POPOVER_ID);
    popover.hidden = false;
    position(anchor);
  };

  /** Close after the bridge delay — but stay open (persistent) while the popover
   * is hovered or the anchor still holds focus (1.4.13 persistent). */
  const scheduleClose = (): void => {
    cancelClose();
    closeTimer = setTimeout(() => {
      closeTimer = undefined;
      if (pointerInPopover) return;
      if (activeAnchor !== null && document.activeElement === activeAnchor) return;
      hide();
    }, CLOSE_DELAY_MS);
  };

  for (let i = 0; i < anchors.length; i += 1) {
    const anchor = anchors[i];
    anchor.addEventListener('mouseenter', () => show(anchor));
    anchor.addEventListener('mouseleave', scheduleClose);
    // `focus` does not bubble, so it is bound per anchor (keyboard reveal).
    anchor.addEventListener('focus', () => show(anchor));
    anchor.addEventListener('blur', scheduleClose);
  }

  // Hovering the popover keeps it open and lets the pointer travel onto it.
  popover.addEventListener('mouseenter', () => {
    pointerInPopover = true;
    cancelClose();
  });
  popover.addEventListener('mouseleave', () => {
    pointerInPopover = false;
    scheduleClose();
  });

  // Esc dismisses the open popover (1.4.13 dismissible).
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && !popover.hidden) hide();
  });
}
