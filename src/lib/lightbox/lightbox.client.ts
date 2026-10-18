/**
 * `lightbox/lightbox.client` — expand a diagram or an image to the full viewport
 * (#185). The pre-toolkit portals shipped a `DiagramLightbox`; the toolkit never
 * ported it, so every doc-kitty site lost the ability to zoom a diagram.
 *
 * ## Targets
 * - every `figure.dk-diagram` (Mermaid client or build render, PlantUML): one
 *   native `<button>` is appended to the figure. The figure keeps its own
 *   `role="group"`; the button is the keyboard and screen-reader entry point.
 * - every `img` in page content that {@link isExpandableImage} accepts: it gets
 *   `tabindex="0"`, `role="button"` and an `aria-label` that keeps its `alt`.
 * The figure is static HTML, so its button exists before a client-side Mermaid
 * render; CSS hides it until the figure holds a drawing, and the SVG is looked
 * up when the button is pressed, never at mount.
 *
 * ## The dialog
 * One native `<dialog>` opened with `showModal()`. That gives the top layer (it
 * escapes Starlight's `isolation: isolate` stacking context without reparenting),
 * an inert page behind it, a focus trap and Esc to close, with no dependency.
 * The target is CLONED into it, scaled to fit the viewport; a click on the
 * backdrop or the close button closes it, and focus returns to the trigger.
 * The clone is `aria-hidden`: its duplicated ids would break the original's
 * `aria-labelledby`, so the dialog takes its name from the caption or `alt`.
 *
 * ## Footprint
 * Injected page-wide (`integrations/lightbox.ts`). It returns before creating
 * anything on a page with no target, and on the out-of-frame deck
 * (`main.reveal`), whose slides are not page content.
 */

/** Where content lives: Starlight's markdown body, or a custom page article. */
export const CONTENT_SCOPE = '.sl-markdown-content, main article';

const FIGURE_SELECTOR = 'figure.dk-diagram';
const TRIGGER_CLASS = 'dk-lightbox__trigger';
const DIALOG_CLASS = 'dk-lightbox';
const LABEL_EXPAND_DIAGRAM = 'Expand diagram';
const LABEL_EXPAND_IMAGE = 'Expand image';
const LABEL_CLOSE = 'Close';

/**
 * Decorative expand glyph; the button's name comes from `aria-label`. Text, not
 * an `<svg>`: a figure holds exactly one `<svg>`, its drawing (the diagram
 * e2e's single-render-loop probe counts them).
 */
const EXPAND_ICON = '<span aria-hidden="true">⤢</span>';

/**
 * The accessible name for an expanded target: the figure's caption text, else the
 * image's `alt`, else the generic label.
 */
export function lightboxLabel(target: Element): string {
  // The description only: the caption's attribution would make the name long.
  const caption = target.closest(FIGURE_SELECTOR)?.querySelector('.dk-diagram__desc')?.textContent;
  const alt = target.getAttribute('alt');
  const text = (caption ?? alt ?? '').replace(/\s+/g, ' ').trim();
  const generic = target.closest(FIGURE_SELECTOR) ? LABEL_EXPAND_DIAGRAM : LABEL_EXPAND_IMAGE;
  return text ? `${generic}: ${text}` : generic;
}

/** Below this rendered width an image is an icon or a badge, not worth expanding. */
export const MIN_IMAGE_WIDTH = 64;

/**
 * Is `img` worth a lightbox? Not when it is inside a link (it keeps its link),
 * decorative (`alt=""`, `role="presentation"`, `aria-hidden`), opted out with
 * `.dk-no-lightbox`, or rendered smaller than {@link MIN_IMAGE_WIDTH}.
 */
export function isExpandableImage(img: HTMLImageElement): boolean {
  if (img.closest(`a, ${FIGURE_SELECTOR}, .dk-no-lightbox`)) return false;
  if (img.getAttribute('alt') === '' || img.getAttribute('role') === 'presentation') return false;
  if (img.getAttribute('aria-hidden') === 'true') return false;
  const width = img.width || Number(img.getAttribute('width')) || 0;
  return width === 0 || width >= MIN_IMAGE_WIDTH;
}

/** The drawing inside a diagram figure: its SVG or image, if rendered yet. */
function figureDrawing(figure: Element): Element | null {
  return figure.querySelector('svg, img');
}

/** A copy of `source` that fills the dialog and is hidden from assistive tech. */
function scaledClone(source: Element): Element {
  const clone = source.cloneNode(true) as Element;
  clone.setAttribute('aria-hidden', 'true');
  clone.removeAttribute('tabindex');
  clone.removeAttribute('role');
  clone.removeAttribute('aria-label');
  clone.classList.add('dk-lightbox__content');
  // Mermaid writes `max-width` and fixed sizes inline; drop them so CSS can fit
  // the drawing to the viewport.
  clone.removeAttribute('style');
  // A responsive image would keep its small `srcset` pick; ask for the dialog size.
  if (clone.hasAttribute('srcset')) clone.setAttribute('sizes', '96vw');
  if (clone.localName === 'svg') {
    clone.removeAttribute('width');
    clone.removeAttribute('height');
  }
  return clone;
}

function createDialog(doc: Document): HTMLDialogElement {
  const dialog = doc.createElement('dialog');
  dialog.className = DIALOG_CLASS;
  const close = doc.createElement('button');
  close.type = 'button';
  close.className = 'dk-lightbox__close';
  close.setAttribute('aria-label', LABEL_CLOSE);
  close.title = LABEL_CLOSE;
  close.textContent = '×';
  close.addEventListener('click', () => dialog.close());
  dialog.append(close);
  // A click on the dialog box itself (outside the drawing and the button) is a
  // click on the backdrop: `::backdrop` events target the dialog element.
  dialog.addEventListener('click', (event) => {
    if (event.target === dialog) dialog.close();
  });
  doc.body.append(dialog);
  return dialog;
}

/**
 * Wire the lightbox on `doc`. Returns the number of targets wired (0 means the
 * page has none and nothing was created).
 */
export function initLightbox(doc: Document = document): number {
  if (doc.querySelector('main.reveal')) return 0;
  const scopes = [...doc.querySelectorAll(CONTENT_SCOPE)];
  const figures = scopes.flatMap((s) => [...s.querySelectorAll(FIGURE_SELECTOR)]);
  const images = scopes
    .flatMap((s) => [...s.querySelectorAll('img')])
    .filter(isExpandableImage);
  const targets = new Set<Element>([...figures, ...images]);
  if (targets.size === 0) return 0;

  let dialog: HTMLDialogElement | null = null;
  let returnFocus: HTMLElement | null = null;

  const open = (source: Element | null, trigger: HTMLElement): void => {
    if (!source) return;
    dialog ??= createDialog(doc);
    const current = dialog;
    current.querySelector('.dk-lightbox__content')?.remove();
    current.append(scaledClone(source));
    current.setAttribute('aria-label', lightboxLabel(source));
    returnFocus = trigger;
    current.addEventListener(
      'close',
      () => {
        current.querySelector('.dk-lightbox__content')?.remove();
        returnFocus?.focus();
      },
      { once: true },
    );
    current.showModal();
  };

  for (const target of targets) {
    if (target.matches(FIGURE_SELECTOR)) {
      if (target.querySelector(`.${TRIGGER_CLASS}`)) continue;
      const button = doc.createElement('button');
      button.type = 'button';
      button.className = TRIGGER_CLASS;
      const label = lightboxLabel(target);
      button.setAttribute('aria-label', label);
      button.title = label;
      button.innerHTML = EXPAND_ICON;
      button.addEventListener('click', () => open(figureDrawing(target), button));
      target.append(button);
      continue;
    }
    const img = target as HTMLElement;
    img.tabIndex = 0;
    img.setAttribute('role', 'button');
    img.setAttribute('aria-label', lightboxLabel(img));
    img.classList.add('dk-lightbox__image');
    img.addEventListener('click', () => open(img, img));
    img.addEventListener('keydown', (event) => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        open(img, img);
      }
    });
  }
  return targets.size;
}
