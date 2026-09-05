/**
 * Browser-only reveal.js initializer (ADR-0022 decision 3) — the ONLY module in
 * the toolkit that imports `reveal.js`, and it does so with dynamic `import()`
 * so the DOM-dependent engine never enters the SSG Node run. `DeckLayout.astro`
 * pulls this in from a client `<script>` (`import('.../reveal-init.client')`);
 * there is deliberately NO top-level `import Reveal` anywhere in `.astro`
 * frontmatter, which would crash `astro build` (reveal touches `document`/
 * `window` at import).
 *
 * Plugin set is core + Notes only (ADR-0022 decision 2): Notes drives speaker
 * view and the `<aside class="notes">` asides. Markdown/Highlight are excluded —
 * slides are pre-rendered at build (Astro/Shiki already highlights code).
 *
 * Print/PDF (FR-013): reveal 6 folded the print stylesheet INTO core
 * `reveal.css` (its `@media print` block) and injects the `@page` sizing from
 * the `PrintView` controller at runtime; `initialize()` itself auto-activates
 * the print view when `print-pdf` is in the URL query
 * (`/print-pdf/gi.test(window.location.search)` in reveal's core). There is NO
 * separate `reveal.js/print/pdf.css` export in 6.0.1 (verified against the
 * package `exports` map — the v5-era path does not resolve), so the correct v6
 * integration is: import core `reveal.css` once (DeckLayout does, via `?url`),
 * and pass `view: 'print'` explicitly when the query is present. No distinct
 * static print artifact is emitted — the print rules ride the core sheet.
 *
 * ## Public surface: the `DeckController` facade (IC-07 / finding A5)
 * `initDeck()` returns a NARROW `DeckController`, never the raw `Reveal` object —
 * so this module stays the sole `import('reveal.js')` site and `DeckLayout` / the
 * diagram renderer gain ZERO reveal knowledge (it is a narrow facade for exactly
 * that reason). The facade exposes these members and nothing else:
 *   - `onSlideChange(cb)` subscribes to reveal 6.0.1's `slidechanged` event and
 *     invokes `cb(event.currentSlide)` — fires on horizontal AND vertical index
 *     changes (`currentSlide` is the active leaf `<section>`).
 *   - `currentSlide()` returns reveal's current leaf slide. Needed because
 *     `hash:true` (below) means a deep-link (`…/#/2`) can make the initially-active
 *     slide NOT slide 1, and `slidechanged` does NOT fire for that initial slide.
 *   - `isPrintView` is computed ONCE here (`/print-pdf/gi.test(...search)`, the same
 *     predicate that sets `view:'print'`) and exposed as a field: reveal-init is the
 *     SINGLE owner of print state (INV-PRINT-OWNER). The renderer READS this flag and
 *     never recomputes the regex — killing a whack-a-field drift hazard.
 *
 * The vertical-stack affordance (D-06 / C-AFFORD-1) is wired ENTIRELY inside
 * `initDeck()`: `updateStackAffordance` reads reveal's OWN `availableRoutes()`
 * (`{left,right,up,down}`) via the raw `DeckInstance` and toggles the deck's
 * `.dk-deck-up`/`.dk-deck-down` buttons directly, on init and on every
 * `slidechanged`. That route-availability read is NOT exposed on the
 * `DeckController` facade below — no caller outside this module needs it, so
 * the facade stays exactly as narrow as its actual callers require.
 */

/** reveal 6 config keys this initializer sets (a thin, typed subset). */
interface DeckRevealConfig {
  plugins: unknown[];
  hash: boolean;
  /** Our own labelled `<button>`s are the visible affordance; reveal's built-in
   *  control cluster is suppressed to avoid a duplicate, unlabelled nav. Keyboard
   *  navigation (arrows/space/Esc) stays on regardless of this flag. */
  controls: boolean;
  transition?: 'none';
  view?: 'print';
}

/** The minimal reveal 6 surface this module uses — a thin, typed subset declared
 *  locally so we never pull reveal's full types. Button wiring needs prev/next;
 *  the `DeckController` needs `on` (reveal 6 exposes `on`/`off`) to subscribe to
 *  `slidechanged` and `getCurrentSlide` for the deep-link initial slide. */
interface DeckInstance {
  initialize(): Promise<unknown>;
  prev(): void;
  next(): void;
  /** Vertical-stack navigation (D-06 / C-AFFORD-1) — wired to the deck's own
   *  labelled `.dk-deck-up`/`.dk-deck-down` buttons, mirroring prev/next. */
  up(): void;
  down(): void;
  on(type: string, cb: (event: { currentSlide: Element }) => void): void;
  getCurrentSlide(): Element | null;
  /** reveal 6's navigability query — `{left,right,up,down}` — read on init and
   *  on every `slidechanged` to show/hide the vertical-stack affordance. */
  availableRoutes(): { left: boolean; right: boolean; up: boolean; down: boolean };
}

/**
 * The narrow, reveal-agnostic control surface `initDeck()` hands back. Keeping it
 * a facade (NOT the raw `Reveal` instance) is what lets reveal-init stay the sole
 * reveal importer and gives print state a single owner (see the header note).
 */
export interface DeckController {
  /** Subscribe to active-leaf changes (horizontal AND vertical index changes). */
  onSlideChange(cb: (currentSlide: Element) => void): void;
  /** Print view, computed ONCE here (INV-PRINT-OWNER); the renderer only reads it. */
  isPrintView: boolean;
  /** reveal's current leaf slide — the initial one may not be slide 1 (deep-link). */
  currentSlide(): Element | null;
}

/**
 * Initialize reveal on the deck's `.reveal` root. Idempotent-safe: a missing
 * root (e.g. a non-deck page that somehow loads this) hands back an inert
 * controller. Reduced motion disables transitions so the interaction test sees
 * `transition-duration: 0s` (paired with the `@media (prefers-reduced-motion:
 * reduce)` block in `dk-reveal-theme.css`). Print activates reveal's print view.
 * The deck's own `<button class="dk-deck-prev|next">` controls are wired to reveal
 * here, as are the `dk-deck-up|down` vertical-stack affordance buttons (D-06):
 * their `hidden` attribute is toggled on init and on every `slidechanged` from
 * reveal's `availableRoutes()`, so the affordance only shows on a stacked slide.
 * Returns a narrow `DeckController` (see the header note) — never the raw
 * `Reveal` object.
 */
export async function initDeck(): Promise<DeckController> {
  const el = document.querySelector<HTMLElement>('.reveal');
  if (!el) {
    // No deck root: hand back an inert controller so callers need no null-guard —
    // no subscriptions, no print view, no current slide.
    return {
      onSlideChange: () => {},
      isPrintView: false,
      currentSlide: () => null,
    };
  }

  const [{ default: Reveal }, { default: RevealNotes }] = await Promise.all([
    import('reveal.js'),
    import('reveal.js/plugin/notes'),
  ]);

  const prefersReducedMotion = window.matchMedia(
    '(prefers-reduced-motion: reduce)',
  ).matches;
  const printPdf = /print-pdf/gi.test(window.location.search);

  const config: DeckRevealConfig = {
    plugins: [RevealNotes],
    hash: true,
    controls: false,
    ...(prefersReducedMotion ? { transition: 'none' } : {}),
    ...(printPdf ? { view: 'print' } : {}),
  };

  const deck = new Reveal(
    el,
    config as unknown as Record<string, unknown>,
  ) as unknown as DeckInstance;
  await deck.initialize();

  document
    .querySelector<HTMLButtonElement>('.dk-deck-prev')
    ?.addEventListener('click', () => deck.prev());
  document
    .querySelector<HTMLButtonElement>('.dk-deck-next')
    ?.addEventListener('click', () => deck.next());

  // Vertical-stack affordance (D-06 / C-AFFORD-1): the deck's own labelled
  // `.dk-deck-up`/`.dk-deck-down` buttons, wired the same way as prev/next.
  const upButton = document.querySelector<HTMLButtonElement>('.dk-deck-up');
  const downButton = document.querySelector<HTMLButtonElement>('.dk-deck-down');
  upButton?.addEventListener('click', () => deck.up());
  downButton?.addEventListener('click', () => deck.down());

  // Show up/down only when that route actually exists, so a flat slide shows
  // no misleading cue (C-AFFORD-1). Run once for the initial slide (deep-link
  // safe — `hash:true` means the initial active leaf may not be slide 1 and
  // `slidechanged` does not fire for it) and again on every `slidechanged`.
  const updateStackAffordance = () => {
    const routes = deck.availableRoutes();
    if (upButton) upButton.hidden = !routes.up;
    if (downButton) downButton.hidden = !routes.down;
  };
  updateStackAffordance();
  deck.on('slidechanged', updateStackAffordance);

  return {
    // `slidechanged` carries the active leaf as `event.currentSlide` (fires on
    // horizontal AND vertical index changes); forward just that leaf to `cb`.
    onSlideChange: (cb) =>
      deck.on('slidechanged', (event) => cb(event.currentSlide)),
    // Computed ONCE above; the renderer reads this and never recomputes the regex.
    isPrintView: printPdf,
    // The `.present` leaf — may not be slide 1 under a `hash:true` deep-link.
    currentSlide: () => deck.getCurrentSlide(),
  };
}
