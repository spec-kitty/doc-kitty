// Playwright config for the accessibility + visual-regression lane (WP09 T039).
//
// Targets the ALREADY-BUILT `example/dist` served statically — never a fresh
// `astro dev`/`astro preview`. The lane asserts against the exact artifact CI
// publishes; in CI that dist is the downloaded `build-example` artifact (T042).
//
// Both colour modes are real, asserted contracts: two projects, `light` and `dark`,
// each emulating `prefers-color-scheme` AND (via tests/a11y/mode.ts) seeding
// Starlight's `localStorage['starlight-theme']`, then asserting the resolved mode
// before any check runs. Nothing here runs light twice.
import { defineConfig, devices } from '@playwright/test';

const PORT = Number(process.env.A11Y_PORT ?? 4321);
const BASE_URL = `http://localhost:${PORT}`;

export default defineConfig({
  testDir: './tests/a11y',
  // Baselines live under tests/a11y/__screenshots__/<spec>/<name>-<project>.png.
  snapshotPathTemplate: '{testDir}/__screenshots__/{testFilePath}/{arg}-{projectName}{ext}',
  // Deterministic snapshots/axe runs: no cross-test parallelism inside a file, and
  // a single worker in CI so screenshot rendering is stable.
  fullyParallel: false,
  workers: process.env.CI ? 1 : undefined,
  forbidOnly: !!process.env.CI,
  retries: 0,
  reporter: process.env.CI ? [['github'], ['list']] : [['list']],

  // Visual-regression tolerance (T041): a small, explicit pixel-diff budget.
  expect: {
    toHaveScreenshot: {
      maxDiffPixelRatio: 0.01,
      animations: 'disabled',
    },
  },

  use: {
    baseURL: BASE_URL,
    // Deterministic rendering for snapshots + layout-sensitive checks.
    viewport: { width: 1280, height: 800 },
    deviceScaleFactor: 1,
    reducedMotion: 'reduce',
    ignoreHTTPSErrors: true,
    // Keep evidence on failure for the reviewer.
    screenshot: 'only-on-failure',
    trace: 'retain-on-failure',
    // In CI the lane runs inside the pinned Playwright container as root, where
    // Chromium's sandbox cannot start; these flags do not affect rendering, so the
    // committed baselines (generated in the same image) stay valid.
    launchOptions: {
      args: process.env.CI ? ['--no-sandbox', '--disable-dev-shm-usage'] : [],
    },
  },

  projects: [
    {
      name: 'light',
      use: { ...devices['Desktop Chrome'], colorScheme: 'light' },
    },
    {
      name: 'dark',
      use: { ...devices['Desktop Chrome'], colorScheme: 'dark' },
    },
  ],

  // Serve the built dist under the site base. Fails fast (via the server exiting /
  // 404s) if `example/dist` is absent — the lane depends on the build artifact.
  webServer: {
    command: 'node tests/a11y/serve-dist.mjs',
    url: `${BASE_URL}/doc-kitty/`,
    reuseExistingServer: !process.env.CI,
    timeout: 30_000,
    env: { A11Y_PORT: String(PORT) },
  },
});
