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
