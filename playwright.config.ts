// Playwright config for the accessibility + visual-regression lane (WP09 T039).
//
// Targets ALREADY-BUILT dists served statically — never a fresh `astro dev`/
// `astro preview`. The lane asserts against the exact artifacts CI builds; in CI
// they are the downloaded `build-example` artifacts (T042).
//
// The lane covers BOTH draft modes (layout-guards-decisions WP08, FR-012..FR-014;
// contract: kitty-specs/layout-guards-decisions-01M59CGE/contracts/a11y-server-env.md):
//   - `light` and `dark` serve `example/dist`, built with DK_PUBLISH_DRAFTS=on, so
//     every sidebar lists the example's draft pages. `pnpm build:a11y` builds it.
//     Every spec runs here.
//   - `published-light` and `published-dark` serve `example/dist-nodrafts`, built
//     with DK_PUBLISH_DRAFTS=off: the sidebar readers see. Build it with
//     `DK_PUBLISH_DRAFTS=off DK_OUTDIR=dist-nodrafts pnpm build`. Only the sidebar
//     specs run here (PUBLISHED_SPECS and PUBLISHED_AXE_PAGES in tests/a11y/routes.ts):
//     layout-geometry, target-size and sidebar-membership in `published-light`,
//     visual and axe in both. sidebar-reveal and reading-width stay drafts-on only;
//     the FR-022 reveal on this build is covered by layout-geometry's FR-022 describe.
// Each project has its own server and baseURL, and `serve-dist.mjs` exits 1 when
// its dist was built with the other draft mode, so no project can measure the
// wrong dist. Both dists must exist before `pnpm test:a11y`: both servers start
// whichever projects you select.
//
// Both colour modes are real, asserted contracts in each lane: `*light` and `*dark`
// each emulate `prefers-color-scheme` AND (via tests/a11y/mode.ts) seed Starlight's
// `localStorage['starlight-theme']`, then assert the resolved mode before any check
// runs. Nothing here runs light twice.
import { defineConfig, devices } from '@playwright/test';
import { AXE_PAGES, PUBLISHED_AXE_PAGES, PUBLISHED_SPECS, a11yPorts } from './tests/a11y/routes';

// Drafts-on on A11Y_PORT, published (drafts-off) on A11Y_PORT + 1.
const PORTS = a11yPorts();
const BASE_URL = `http://localhost:${PORTS.draftsOn}`;
const PUBLISHED_URL = `http://localhost:${PORTS.published}`;

// The published projects scan only PUBLISHED_AXE_PAGES: every other axe page's
// tests are left out by title (axe.spec.ts names each describe after its page).
const escapeRegExp = (text: string): string => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const UNPUBLISHED_AXE_TITLES = new RegExp(
  AXE_PAGES.filter((p) => !PUBLISHED_AXE_PAGES.includes(p))
    .map((p) => escapeRegExp(p.name))
    .join('|'),
);
const PUBLISHED_LANE = {
  testMatch: [...PUBLISHED_SPECS],
  grepInvert: UNPUBLISHED_AXE_TITLES,
};

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
    {
      name: 'published-light',
      ...PUBLISHED_LANE,
      use: { ...devices['Desktop Chrome'], colorScheme: 'light', baseURL: PUBLISHED_URL },
    },
    {
      name: 'published-dark',
      ...PUBLISHED_LANE,
      use: { ...devices['Desktop Chrome'], colorScheme: 'dark', baseURL: PUBLISHED_URL },
    },
  ],

  // Serve each built dist under the site base, one server per draft mode. A
  // server exits 1 before listening when its dist or its `index.html` is
  // missing, or when the dist was built with the other draft mode
  // (tests/a11y/serve-dist.mjs), so Playwright fails fast instead of measuring
  // the wrong sidebar.
  webServer: [
    {
      command: 'node tests/a11y/serve-dist.mjs',
      url: `${BASE_URL}/doc-kitty/`,
      reuseExistingServer: !process.env.CI,
      timeout: 30_000,
      env: {
        A11Y_PORT: String(PORTS.draftsOn),
        DK_A11Y_DIST: 'example/dist',
        DK_A11Y_EXPECT_DRAFTS: 'on',
      },
    },
    {
      command: 'node tests/a11y/serve-dist.mjs',
      url: `${PUBLISHED_URL}/doc-kitty/`,
      reuseExistingServer: !process.env.CI,
      timeout: 30_000,
      env: {
        A11Y_PORT: String(PORTS.published),
        DK_A11Y_DIST: 'example/dist-nodrafts',
        DK_A11Y_EXPECT_DRAFTS: 'off',
      },
    },
  ],
});
