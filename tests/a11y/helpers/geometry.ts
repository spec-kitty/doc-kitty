// Layout geometry measurement for the multi-width guard
// (sidebar-frame-header-carrier-01M4T3CB, WP03 T012 — FR-028, NFR-001).
//
// One `page.evaluate` reads every box, so all numbers come from the same frame;
// a second round-trip could straddle a reflow. Values are plain numbers rounded
// to 0.01px. An element that is absent or not rendered (`display: none`) is
// reported as `null`, so a caller must say which boxes it requires — a missing
// rail fails loudly instead of comparing against zero.
//
// Which element is which:
//   frame         `.main-frame`              Starlight's page frame, capped by `--dk-width-frame`.
//   sidebar       `.sidebar-pane`            the left sidebar's FIXED element (not `nav.sidebar`,
//                                            which is the static wrapper around it).
//   pane          `.main-pane`               the flex item the article lives in.
//   column        `.sl-container` holding    the reading column. This is the element Starlight caps
//                 `.sl-markdown-content`     at `--sl-content-width`, so its width IS the text measure;
//                                            `.content-panel` is wider by its inline padding.
//   railContainer `.right-sidebar-container` the in-flow column reserved for the rail.
//   rail          `.right-sidebar`           the fixed rail. Collapsed it still spans the viewport
//                                            width, so collapsed checks use `railContainer`.
//   panel         `#dk-toc-panel`            the outline panel (`display: none` when collapsed).
//   toggle        `#dk-toc-toggle`           the collapse button, injected by the client script.
//   headerFirst   `header.header a.site-title`  first content item of the header bar.
//   headerLast    `header.header .right-group`  last content item of the header bar.
import type { Page } from '@playwright/test';

export interface Box {
  x: number;
  y: number;
  width: number;
  height: number;
  right: number;
  bottom: number;
}

export interface Geometry {
  /** `ltr` or `rtl`, as computed on the root element. */
  dir: 'ltr' | 'rtl';
  /** Layout viewport width (`documentElement.clientWidth`: excludes a classic scrollbar). */
  viewportWidth: number;
  /** `documentElement.scrollWidth`; equals `viewportWidth` when the page does not scroll sideways. */
  scrollWidth: number;
  /** `--sl-sidebar-width` resolved to pixels. */
  sidebarWidthToken: number;
  /** `--sl-nav-pad-x` resolved to pixels. */
  navPad: number;
  frame: Box | null;
  sidebar: Box | null;
  pane: Box | null;
  column: Box | null;
  railContainer: Box | null;
  rail: Box | null;
  panel: Box | null;
  toggle: Box | null;
  headerFirst: Box | null;
  headerLast: Box | null;
  /**
   * Horizontal distance from the toggle to the nearest rendered article TEXT
   * (per-text-node `Range.getClientRects()`, not the column box), or `null` when
   * there is no toggle. Negative when the toggle covers text.
   */
  toggleToTextGap: number | null;
  /** Horizontal distance from the toggle to the nearest outline link box; `null` when no link is rendered. */
  toggleToTocLinkGap: number | null;
  /** Number of rendered outline links (non-vacuity for `toggleToTocLinkGap`). */
  tocLinkCount: number;
}

export const SELECTORS = {
  frame: '.main-frame',
  sidebar: '.sidebar-pane',
  pane: '.main-pane',
  railContainer: '.right-sidebar-container',
  rail: '.right-sidebar',
  panel: '#dk-toc-panel',
  toggle: '#dk-toc-toggle',
  headerFirst: 'header.header a.site-title',
  headerLast: 'header.header .right-group',
  tocLinks: '.right-sidebar-panel starlight-toc a',
} as const;

/** Measure the page as it is now. Does not wait; call `settle` first. */
export async function measure(page: Page): Promise<Geometry> {
  return page.evaluate((sel) => {
    const round = (n: number) => Math.round(n * 100) / 100;
    const toBox = (r: DOMRect) => ({
      x: round(r.x),
      y: round(r.y),
      width: round(r.width),
      height: round(r.height),
      right: round(r.right),
      bottom: round(r.bottom),
    });
    const box = (el: Element | null) => {
      if (!el || el.getClientRects().length === 0) return null;
      return toBox(el.getBoundingClientRect());
    };
    const q = (s: string) => box(document.querySelector(s));

    // Resolve a length token to pixels by laying out a probe with it.
    const px = (token: string) => {
      const probe = document.createElement('div');
      probe.style.cssText = `position:absolute;visibility:hidden;inline-size:var(${token});block-size:0`;
      document.body.appendChild(probe);
      const w = probe.getBoundingClientRect().width;
      probe.remove();
      return round(w);
    };

    // Positive when the two rectangles are apart on the inline axis, negative
    // by the overlap when they are not. Direction-agnostic.
    const apart = (a: DOMRect, b: DOMRect) => Math.max(a.left - b.right, b.left - a.right);

    const toggleEl = document.querySelector(sel.toggle);
    const toggleRect =
      toggleEl && toggleEl.getClientRects().length > 0 ? toggleEl.getBoundingClientRect() : null;

    let textGap: number | null = null;
    const paneEl = document.querySelector(sel.pane);
    if (toggleRect && paneEl) {
      const walker = document.createTreeWalker(paneEl, NodeFilter.SHOW_TEXT);
      const range = document.createRange();
      for (let node = walker.nextNode(); node; node = walker.nextNode()) {
        if (!node.nodeValue || node.nodeValue.trim() === '') continue;
        range.selectNodeContents(node);
        for (const r of range.getClientRects()) {
          // Skip visually-hidden text (clipped to a 1px box).
          if (r.width <= 1 || r.height <= 1) continue;
          const gap = apart(toggleRect, r);
          if (textGap === null || gap < textGap) textGap = gap;
        }
      }
    }

    let linkGap: number | null = null;
    let linkCount = 0;
    for (const a of document.querySelectorAll(sel.tocLinks)) {
      if (a.getClientRects().length === 0) continue;
      linkCount += 1;
      if (!toggleRect) continue;
      const gap = apart(toggleRect, a.getBoundingClientRect());
      if (linkGap === null || gap < linkGap) linkGap = gap;
    }

    const content = document.querySelector('.sl-markdown-content');
    const root = document.documentElement;
    return {
      dir: getComputedStyle(root).direction === 'rtl' ? ('rtl' as const) : ('ltr' as const),
      viewportWidth: root.clientWidth,
      scrollWidth: root.scrollWidth,
      sidebarWidthToken: px('--sl-sidebar-width'),
      navPad: px('--sl-nav-pad-x'),
      frame: q(sel.frame),
      sidebar: q(sel.sidebar),
      pane: q(sel.pane),
      column: box(content ? content.closest('.sl-container') : null),
      railContainer: q(sel.railContainer),
      rail: q(sel.rail),
      panel: q(sel.panel),
      toggle: toggleRect ? toBox(toggleRect) : null,
      headerFirst: q(sel.headerFirst),
      headerLast: q(sel.headerLast),
      toggleToTextGap: textGap === null ? null : round(textGap),
      toggleToTocLinkGap: linkGap === null ? null : round(linkGap),
      tocLinkCount: linkCount,
    };
  }, SELECTORS);
}

/**
 * Wait until measuring is meaningful: fonts loaded (glyph metrics move text
 * rectangles) and two animation frames elapsed, so a style injected or a `dir`
 * set just before has been laid out.
 */
export async function settle(page: Page): Promise<void> {
  await page.evaluate(async () => {
    await document.fonts.ready;
    await new Promise<void>((resolve) =>
      requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
    );
  });
}

/** A box's edges on the inline axis, as distances from the viewport's inline-start edge. */
export interface Inline {
  start: number;
  end: number;
  width: number;
  centre: number;
}

/**
 * Convert a physical box to inline-axis offsets. On a right-to-left page the
 * inline-start edge is the right-hand one, so the offsets of a mirrored layout
 * equal the left-to-right ones and one set of assertions serves both directions.
 */
export function inline(box: Box, g: Pick<Geometry, 'dir' | 'viewportWidth'>): Inline {
  const start = g.dir === 'rtl' ? g.viewportWidth - box.right : box.x;
  const r = (n: number) => Math.round(n * 100) / 100;
  return {
    start: r(start),
    end: r(start + box.width),
    width: box.width,
    centre: r(start + box.width / 2),
  };
}
