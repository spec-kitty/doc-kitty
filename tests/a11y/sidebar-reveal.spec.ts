// The current sidebar entry is revealed BEFORE the sidebar is first painted
// (layout-guards-decisions-01M59CGE WP03 T011; FR-004, NFR-005, ADR-0061, #203).
//
// Why this spec exists: `layout-geometry.spec.ts` (FR-022) measures the pane after
// `load`, and its CLS test cannot see a scroll INSIDE a scroll container. A reveal
// that waits for `DOMContentLoaded` therefore passes both, yet a reader on a slow
// connection sees the sidebar painted at the top and then jump. This spec samples
// the pane's `scrollTop` at the first animation frame in which the whole sidebar
// is in the DOM (the first paint of the sidebar) and at `DOMContentLoaded`, in
// three load scenarios, and requires both to equal the revealed position within
// 1 px.
//
// The pages come from `helpers/slow-server.mjs`, an in-process server on its own
// port (SIDEBAR_REVEAL_PORT, default 4421) that can hold back the HTML after the
// sidebar region, or every module script, for 2000 ms. It marks the end of the
// sidebar region with an inert `<template>` (SIDEBAR_END_SENTINEL): "the whole
// sidebar is in the DOM" means that sentinel exists. Without it a frame that
// Chromium renders while the parser has yielded half-way through the sidebar
// (seen under CPU load) would count, and no reveal placed after the tree could
// pass; the first frame in which the pane merely exists is still recorded and
// printed in the failure messages.
//
// FAIL-FIRST: see the WP03 history note (red against the head-entry reveal, which
// waited for `DOMContentLoaded`: both samples measured 0).
import { test, expect, type Page } from '@playwright/test';
import { startSlowServer, SIDEBAR_END_SENTINEL } from './helpers/slow-server.mjs';
import { settle } from './helpers/geometry';

const TOLERANCE = 1;
const DELAY_MS = 2000;
const PORT = Number(process.env.SIDEBAR_REVEAL_PORT ?? 4421);
const DEEP = '/doc-kitty/rhetoric/book-one/chapter-15/';
const PREVIOUS = '/doc-kitty/rhetoric/book-one/chapter-14/';
const PERSIST_CLOSE = '</sl-sidebar-state-persist>';
/** A fragment only the reveal script contains (REVEAL_CURRENT_SCRIPT). */
const REVEAL_SIGNATURE = "p.addEventListener('toggle'";

type Mode = 'none' | 'html-tail' | 'module-scripts';
let server: Awaited<ReturnType<typeof startSlowServer>>;

test.beforeEach(({}, testInfo) => {
  test.skip(testInfo.project.name !== 'light', 'the reveal is identical in both colour schemes');
});

test.beforeAll(async ({}, testInfo) => {
  if (testInfo.project.name !== 'light') return;
  server = await startSlowServer({ port: PORT, delayMs: DELAY_MS });
});

test.afterAll(async () => {
  await server?.close();
});

interface Probe {
  /** scrollTop at the first frame in which the whole sidebar is in the DOM. */
  firstFrame: number | null;
  /** Which frame of the chain that was (0-based). */
  firstFrameIndex: number | null;
  /** Diagnostics: the first frame in which `#starlight__sidebar` merely exists. */
  paneFrameIndex: number | null;
  paneFrame: number | null;
  /** scrollTop at `DOMContentLoaded` (capture phase, before page listeners). */
  dcl: number | null;
}

/** Installs the probe before any page script runs. */
async function installProbe(page: Page): Promise<void> {
  await page.addInitScript((sentinel) => {
    const w = window as unknown as { __dkReveal: Probe };
    const probe: Probe = { firstFrame: null, firstFrameIndex: null, paneFrameIndex: null, paneFrame: null, dcl: null };
    w.__dkReveal = probe;
    const sample = (): number | null => document.getElementById('starlight__sidebar')?.scrollTop ?? null;
    document.addEventListener(
      'DOMContentLoaded',
      () => {
        probe.dcl = sample();
      },
      true,
    );
    let frame = 0;
    const tick = (): void => {
      const v = sample();
      if (v !== null && probe.paneFrame === null) {
        probe.paneFrame = v;
        probe.paneFrameIndex = frame;
      }
      if (v !== null && probe.firstFrame === null && document.querySelector(sentinel)) {
        probe.firstFrame = v;
        probe.firstFrameIndex = frame;
      }
      frame += 1;
      if (frame < 2000 && probe.firstFrame === null) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }, SIDEBAR_END_SENTINEL);
}

interface Geometry {
  scrollTop: number;
  /** Where the reveal formula puts the pane for the current entry. */
  revealed: number;
  clientHeight: number;
  href: string;
}

/** The revealed position, from the entry's geometry and the reveal's centring formula. */
async function geometry(page: Page, selector = '[aria-current="page"]'): Promise<Geometry> {
  return page.evaluate((sel) => {
    const pane = document.getElementById('starlight__sidebar');
    const entry = pane?.querySelector<HTMLAnchorElement>(sel);
    if (!pane || !entry) throw new Error(`no sidebar pane or no ${sel} entry`);
    const a = pane.getBoundingClientRect();
    const b = entry.getBoundingClientRect();
    const natural = b.top - a.top + pane.scrollTop;
    const centred = natural - (a.height - b.height) / 2;
    const max = pane.scrollHeight - pane.clientHeight;
    return {
      scrollTop: pane.scrollTop,
      revealed: Math.min(Math.max(centred, 0), max),
      clientHeight: pane.clientHeight,
      href: entry.getAttribute('href') ?? '',
    };
  }, selector);
}

async function load(page: Page, mode: Mode, path = DEEP): Promise<{ probe: Probe; geo: Geometry }> {
  server.setMode(mode);
  await installProbe(page);
  await page.goto(`${server.origin}${path}`, { waitUntil: 'load', timeout: 30_000 });
  await settle(page);
  const probe = await page.evaluate(() => (window as unknown as { __dkReveal: Probe }).__dkReveal);
  return { probe, geo: await geometry(page) };
}

test.describe('the current sidebar entry is revealed before first paint (FR-004, NFR-005)', () => {
  const scenarios: Array<{ name: string; mode: Mode }> = [
    { name: 'local, no delay', mode: 'none' },
    { name: `HTML tail delayed ${DELAY_MS} ms`, mode: 'html-tail' },
    { name: `module scripts delayed ${DELAY_MS} ms`, mode: 'module-scripts' },
  ];

  for (const { name, mode } of scenarios) {
    test(`1280x600, ${name}: first sidebar frame and DOMContentLoaded are at the revealed position`, async ({
      page,
    }) => {
      test.setTimeout(60_000);
      await page.setViewportSize({ width: 1280, height: 600 });
      const { probe, geo } = await load(page, mode);
      expect(geo.href, 'the aria-current entry is the page under test').toBe(DEEP);
      // Non-vacuity: the entry is far below the pane's first screen, so 0 is wrong.
      expect(geo.revealed, 'the revealed position is well below the top').toBeGreaterThan(geo.clientHeight);
      expect.soft(Math.abs(geo.scrollTop - geo.revealed), `${name}: after load`).toBeLessThanOrEqual(TOLERANCE);
      expect.soft(probe.firstFrame, `${name}: the whole sidebar is in the DOM in some frame`).not.toBeNull();
      expect
        .soft(
          Math.abs((probe.firstFrame ?? 0) - geo.revealed),
          `${name}: first sidebar frame (#${probe.firstFrameIndex}) scrollTop ${probe.firstFrame} vs revealed ` +
            `${geo.revealed} (pane first seen in frame #${probe.paneFrameIndex} at ${probe.paneFrame})`,
        )
        .toBeLessThanOrEqual(TOLERANCE);
      expect
        .soft(
          Math.abs((probe.dcl ?? 0) - geo.revealed),
          `${name}: DOMContentLoaded scrollTop ${probe.dcl} vs revealed ${geo.revealed}`,
        )
        .toBeLessThanOrEqual(TOLERANCE);
    });
  }

  test("1280x600: Starlight's in-session restore wins over the reveal", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 600 });
    await load(page, 'none');
    const target = 1881;
    await page.evaluate((top) => {
      const pane = document.getElementById('starlight__sidebar');
      if (pane) pane.scrollTop = top;
    }, target);
    await settle(page);
    const set = await page.evaluate(() => document.getElementById('starlight__sidebar')?.scrollTop ?? -1);
    expect(Math.abs(set - target), 'the pane was scrolled away from the reveal').toBeLessThanOrEqual(TOLERANCE);
    await Promise.all([
      page.waitForURL(`**${PREVIOUS}`, { waitUntil: 'load' }),
      page.locator(`#starlight__sidebar a[href="${PREVIOUS}"]`).click(),
    ]);
    await settle(page);
    const after = await geometry(page);
    const stored = await page.evaluate(
      () => (JSON.parse(sessionStorage.getItem('sl-sidebar-state') || '0') as { scroll?: number } | 0) || null,
    );
    expect(after.href).toBe(PREVIOUS);
    expect(stored?.scroll, 'Starlight stored the scroll position').toBeDefined();
    // Non-vacuity: re-centring would land somewhere else.
    expect(Math.abs(after.revealed - set), 'the centred position differs from the restored one').toBeGreaterThan(10);
    expect(Math.abs(after.scrollTop - (stored?.scroll ?? -1)), "the pane is at Starlight's restored value").toBeLessThanOrEqual(
      TOLERANCE,
    );
    expect(Math.abs(after.scrollTop - set), 'and that is where the reader left it').toBeLessThanOrEqual(TOLERANCE);
  });

  test('390x600: nothing scrolls with the menu closed; opening it reveals the entry', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 600 });
    await load(page, 'none');
    const closed = await page.evaluate(() => ({
      scrollY: window.scrollY,
      pane: document.getElementById('starlight__sidebar')?.scrollTop ?? -1,
    }));
    expect(closed.scrollY, 'the document is not scrolled').toBe(0);
    expect(closed.pane, 'the closed pane is not scrolled').toBe(0);
    await page.locator('button[popovertarget="starlight__sidebar"]').click();
    await expect(page.locator('#starlight__sidebar')).toBeVisible();
    const open = await page.evaluate(() => {
      const pane = document.getElementById('starlight__sidebar');
      const entry = pane?.querySelector('[aria-current="page"]');
      if (!pane || !entry) throw new Error('no sidebar pane or no aria-current entry');
      const a = pane.getBoundingClientRect();
      const b = entry.getBoundingClientRect();
      return { a: { top: a.top, bottom: a.bottom }, b: { top: b.top, bottom: b.bottom }, scrollTop: pane.scrollTop };
    });
    expect(open.scrollTop, 'the open pane was scrolled').toBeGreaterThan(0);
    expect(open.b.top).toBeGreaterThanOrEqual(open.a.top - TOLERANCE);
    expect(open.b.bottom).toBeLessThanOrEqual(open.a.bottom + TOLERANCE);
  });

  test("structure: one reveal script, after Starlight's tree and its restore script", async ({ request }) => {
    server.setMode('none');
    const html = await (await request.get(`${server.origin}${DEEP}`)).text();
    const scripts = [...html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/g)];
    const reveals = scripts.filter((m) => m[1].includes(REVEAL_SIGNATURE));
    const headEnd = html.indexOf('</head>');
    const persistClose = html.indexOf(PERSIST_CLOSE);
    const restore = scripts.find((m) => m[1].includes('_starlightScrollRestore') && m[1].includes('scroller.scrollTop'));
    expect(persistClose, 'the page has a persisted sidebar tree').toBeGreaterThan(-1);
    expect(restore, "Starlight's restore script is present").toBeDefined();
    expect(reveals, 'exactly one reveal script').toHaveLength(1);
    const at = reveals[0]?.index ?? -1;
    expect.soft(at, 'the reveal script is not in <head>').toBeGreaterThan(headEnd);
    expect.soft(at, 'the reveal script follows </sl-sidebar-state-persist>').toBeGreaterThan(persistClose);
    expect.soft(restore?.index ?? Infinity, "Starlight's restore script precedes it").toBeLessThan(at);
    const tag = reveals[0]?.[0].slice(0, reveals[0][0].indexOf('>') + 1) ?? '';
    expect.soft(tag, 'classic inline script').not.toMatch(/type="module"|\bdefer\b|\basync\b/);
    expect.soft(tag, 'carries the carrier marker').toContain('data-dk-sidebar-reveal');
  });
});
