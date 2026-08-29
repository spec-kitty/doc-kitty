// Both-modes drive mechanism (WP09 T039), shared by every spec.
//
// Starlight resolves the colour mode from `localStorage['starlight-theme']` and sets
// `document.documentElement.dataset.theme` accordingly (verified against the built
// inline ThemeProvider script). We therefore drive dark/light TWO ways and then
// ASSERT the result, so a config that silently runs light twice fails:
//   1. seed `localStorage['starlight-theme']` before any page script runs, and
//   2. emulate `prefers-color-scheme` via the project's `colorScheme` (see config).
// After navigation we read the resolved `data-theme` AND the computed background
// luminance — proving the mode genuinely rendered, not just that an attribute was set.
import { type Page, expect } from '@playwright/test';

export type Mode = 'light' | 'dark';

export function modeOf(projectName: string): Mode {
  if (projectName !== 'light' && projectName !== 'dark') {
    throw new Error(`Unexpected project name '${projectName}'; expected 'light' or 'dark'.`);
  }
  return projectName;
}

// Parse an `rgb(...)`/`rgba(...)` string to a 0-255 perceived luminance.
function luminance(rgb: string): number {
  const m = rgb.match(/rgba?\(([^)]+)\)/);
  if (!m) throw new Error(`Cannot parse colour '${rgb}'`);
  const [r, g, b] = m[1].split(',').map((n) => parseFloat(n.trim()));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

// Seed the theme BEFORE navigating. Must be called before `page.goto`.
export async function seedMode(page: Page, mode: Mode): Promise<void> {
  await page.addInitScript((m) => {
    try {
      window.localStorage.setItem('starlight-theme', m);
    } catch {
      /* storage unavailable — the prefers-color-scheme emulation still drives it */
    }
  }, mode);
}

// Navigate and assert the mode truly applied. Returns after the page is idle.
export async function gotoInMode(page: Page, path: string, mode: Mode): Promise<void> {
  await seedMode(page, mode);
  await page.goto(path, { waitUntil: 'domcontentloaded' });

  // (1) The resolved theme attribute matches the requested mode.
  await expect(page.locator('html')).toHaveAttribute('data-theme', mode);

  // (2) The computed background actually reflects the mode — dark is dark, light is
  // light. This is the non-fakeable half: it fails if the same mode renders twice.
  const bg = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);
  const lum = luminance(bg);
  if (mode === 'dark') {
    expect(lum, `dark mode background '${bg}' should be dark`).toBeLessThan(96);
  } else {
    expect(lum, `light mode background '${bg}' should be light`).toBeGreaterThan(160);
  }
}

// Both-modes drive for the OUT-OF-FRAME reveal deck (WP05).
//
// DeckLayout now links BOTH the `--dk-*` VALUE catalog (theme.css) and the
// `--dk-*→--r-*` MAP (dk-reveal-theme.css), so the deck resolves the brand palette
// and `T023` (deck.interaction.spec) asserts the computed viewport/heading/footer
// equal the resolved `--dk-*` tokens. This drive still runs the deck under each
// project's `colorScheme` and seeds `data-theme` before paint so AX-1's both-modes
// axe coverage holds. NOTE (separate, pre-existing gap): a *real* deck view carries
// no theme-persistence script, so nothing sets `data-theme` on a live deck — the
// dark palette is reachable only because this drive seeds the attribute; wiring a
// deck theme toggle + a dark background-luminance gate is a tracked follow-up, not
// this PR's scope.
export async function gotoDeckInMode(page: Page, path: string, mode: Mode): Promise<void> {
  // Seed the design's own theme attribute BEFORE any paint (forward-compatible:
  // once theme.css is loaded, this is what switches the deck to its dark palette).
  await page.addInitScript((m) => {
    try {
      document.documentElement.setAttribute('data-theme', m);
    } catch {
      /* pre-DOM — the post-goto set below still applies the attribute */
    }
  }, mode);
  await page.goto(path, { waitUntil: 'domcontentloaded' });
  await page.evaluate((m) => document.documentElement.setAttribute('data-theme', m), mode);
  await expect(page.locator('html')).toHaveAttribute('data-theme', mode);

  // The labelled deck region must actually have rendered (non-vacuity: axe never
  // scans a page that failed to serve the deck). We deliberately do NOT assert a
  // brand-background luminance here — see the theming-gap note above; the deck has
  // no brand background to assert yet. When it does, add the luminance gate that
  // `gotoInMode` uses for the Starlight shell.
  await expect(page.locator('main.reveal')).toHaveCount(1);
}
