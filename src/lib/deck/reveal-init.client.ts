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

/** The minimal reveal surface the button wiring needs (prev/next). */
interface DeckInstance {
  initialize(): Promise<unknown>;
  prev(): void;
  next(): void;
}

/**
 * Initialize reveal on the deck's `.reveal` root. Idempotent-safe: a missing
 * root (e.g. a non-deck page that somehow loads this) is a no-op. Reduced motion
 * disables transitions so the interaction test sees `transition-duration: 0s`
 * (paired with the `@media (prefers-reduced-motion: reduce)` block in
 * `dk-reveal-theme.css`). Print activates reveal's print view. The deck's own
 * `<button class="dk-deck-prev|next">` controls are wired to reveal here.
 */
export async function initDeck(): Promise<void> {
  const el = document.querySelector<HTMLElement>('.reveal');
  if (!el) return;

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
}
