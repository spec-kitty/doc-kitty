// Interactive-target collection and the WCAG 2.2 SC 2.5.8 check for the page
// chrome (layout-guards-decisions WP06 T032/T033; issue #202; mission
// sidebar-frame-header-carrier-01M4T3CB NFR-004).
//
// axe's `target-size` rule already runs in the lane, but it files ambiguous cases
// (overlapping or closely spaced targets) as `incomplete`, which the lane does not
// fail on. This measures the chrome regions directly: every rendered target in
// the header, sidebar, rail and footer is at least 24 x 24 CSS px, or meets the
// spacing exception. Content is out of scope (it holds inline text links, which
// SC 2.5.8 exempts); the chrome has no inline-text exemption here.
import type { Page } from '@playwright/test';

export type Region = 'header' | 'sidebar' | 'rail' | 'footer';

/**
 * Region roots, as found in the built markup (Starlight 0.42 plus the toolkit):
 *   header   the header bar;
 *   sidebar  the sidebar pane (`sl-sidebar-pane`, also the mobile menu popover);
 *   rail     the reserved rail column: the outline panel and the collapse toggle;
 *   footer   Starlight's page `<footer>` (the one holding `.pagination-links`, so
 *            its `.meta` block, edit link and last-updated, is covered when a
 *            consumer enables them) and the toolkit's site footer ("Back to
 *            top"). Starlight renders `.meta` and `.pagination-links` empty on a
 *            page with no edit link and no neighbours (the example's case), so
 *            the site footer keeps the region non-empty there; `.meta` is not
 *            required to exist.
 */
export const REGIONS: Readonly<Record<Region, readonly string[]>> = {
  header: ['header.header'],
  sidebar: ['#starlight__sidebar'],
  rail: ['.right-sidebar-container'],
  footer: ['footer:has(> .pagination-links)', '.dk-site-footer'],
};

export const TARGET_SELECTOR = 'a[href], button, input:not([type=hidden]), select, summary, [role=button]';

export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface Target {
  region: Region;
  /** Accessible name, or text trimmed to 40 characters. */
  label: string;
  /** The union of the client rects (the bounding box). */
  rect: Rect;
  /** Each client rect: a wrapped inline link has more than one. */
  rects: Rect[];
  /** DOM index path from the root element, `0/3/1`; a prefix means "contains". */
  path: string;
  /** The element's `id`, or `''`. */
  id: string;
}

/** Collect the rendered targets of `regions` as the page is now. */
export async function collectTargets(page: Page, regions: readonly Region[]): Promise<Target[]> {
  const roots = regions.map((region) => [region, REGIONS[region]] as const);
  return page.evaluate(
    ({ roots, selector }) => {
      const round = (n: number) => Math.round(n * 100) / 100;
      const toRect = (r: DOMRect) => ({ x: round(r.x), y: round(r.y), width: round(r.width), height: round(r.height) });
      const pathOf = (el: Element) => {
        const parts: number[] = [];
        for (let e: Element | null = el; e && e.parentElement; e = e.parentElement) {
          parts.unshift(Array.prototype.indexOf.call(e.parentElement.children, e));
        }
        return parts.join('/');
      };
      const rendered = (el: Element) => {
        if (el.getClientRects().length === 0) return false;
        const cs = getComputedStyle(el);
        if (cs.visibility === 'hidden' || cs.pointerEvents === 'none') return false;
        const r = el.getBoundingClientRect();
        if (!(r.width > 0 && r.height > 0)) return false;
        for (let e = el.parentElement; e; e = e.parentElement) {
          if (getComputedStyle(e).display === 'none') return false;
        }
        return true;
      };
      const labelOf = (el: Element) => {
        const by = el.getAttribute('aria-labelledby');
        const named =
          el.getAttribute('aria-label') ??
          (by ? by.split(/\s+/).map((id) => document.getElementById(id)?.textContent ?? '').join(' ') : null) ??
          el.getAttribute('title');
        const text = (named && named.trim() !== '' ? named : el.textContent ?? '').replace(/\s+/g, ' ').trim();
        return (text || el.getAttribute('href') || el.tagName.toLowerCase()).slice(0, 40);
      };

      const out: Array<{ region: string; label: string; rect: ReturnType<typeof toRect>; rects: ReturnType<typeof toRect>[]; path: string; id: string }> = [];
      const seen = new Set<Element>();
      for (const [region, selectors] of roots) {
        for (const rootSel of selectors) {
          for (const root of document.querySelectorAll(rootSel)) {
            for (const el of root.querySelectorAll(selector)) {
              if (seen.has(el) || !rendered(el)) continue;
              seen.add(el);
              out.push({
                region,
                label: labelOf(el),
                rect: toRect(el.getBoundingClientRect()),
                rects: Array.from(el.getClientRects(), toRect).filter((r) => r.width > 0 && r.height > 0),
                path: pathOf(el),
                id: el.id,
              });
            }
          }
        }
      }
      return out;
    },
    { roots, selector: TARGET_SELECTOR },
  ) as Promise<Target[]>;
}

/** SC 2.5.8 minimum, with a rounding allowance for sub-pixel layout. */
export const MIN_TARGET = 23.99;
/** The diameter of the spacing-exception circle. */
const CIRCLE = 24;

const centreOf = (r: Rect) => ({ x: r.x + r.width / 2, y: r.y + r.height / 2 });

/** Distance from a point to the nearest point of a rectangle (0 inside it). */
function distanceToRect(p: { x: number; y: number }, r: Rect): number {
  const dx = Math.max(r.x - p.x, 0, p.x - (r.x + r.width));
  const dy = Math.max(r.y - p.y, 0, p.y - (r.y + r.height));
  return Math.hypot(dx, dy);
}

const nested = (a: Target, b: Target) =>
  a.path === b.path || a.path.startsWith(`${b.path}/`) || b.path.startsWith(`${a.path}/`);

export const undersized = (t: Target) => t.rect.width < MIN_TARGET || t.rect.height < MIN_TARGET;

const fmt = (n: number) => String(Math.round(n * 10) / 10);

/**
 * SC 2.5.8 over `targets`. A target passes when it is at least 24 x 24; an
 * undersized one passes under the spacing exception when a 24px circle on its
 * box's centre intersects no other target's rect (centre-to-rect distance >= 12)
 * and no other undersized target's circle (centre distance >= 24). Nested
 * targets (one inside the other) are one target and are not compared.
 * Returns one message per failing target: `region label WxH (nearest conflict: ...)`.
 */
export function targetSizeFailures(targets: readonly Target[]): string[] {
  const failures: string[] = [];
  for (const t of targets) {
    if (!undersized(t)) continue;
    const c = centreOf(t.rect);
    let worst: { margin: number; other: Target; why: string } | null = null;
    for (const o of targets) {
      if (o === t || nested(t, o)) continue;
      const rects = o.rects.length > 0 ? o.rects : [o.rect];
      const toRect = Math.min(...rects.map((r) => distanceToRect(c, r)));
      let margin = toRect - CIRCLE / 2;
      let why = `${fmt(toRect)}px from its centre to "${o.label}"`;
      if (undersized(o)) {
        const oc = centreOf(o.rect);
        const centres = Math.hypot(oc.x - c.x, oc.y - c.y);
        if (centres - CIRCLE < margin) {
          margin = centres - CIRCLE;
          why = `${fmt(centres)}px between its centre and undersized "${o.label}"`;
        }
      }
      if (worst === null || margin < worst.margin) worst = { margin, other: o, why };
    }
    if (worst !== null && worst.margin < 0) {
      failures.push(
        `${t.region} "${t.label}" ${fmt(t.rect.width)}x${fmt(t.rect.height)} ` +
          `(nearest conflict: ${worst.other.region} ${worst.why}; needs 12px to a rect, 24px between centres)`,
      );
    }
  }
  return failures;
}
