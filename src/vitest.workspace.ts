import { defineWorkspace } from 'vitest/config';

// #56 — scope the file-parallelism serialization vitest.config.ts previously
// applied to ALL ~58 test files down to just the two that need it.
//
// example-adopter.test.ts and glossary-build-warning.test.ts each spawn a full
// `astro build` against the SAME example/ site (they both clear example/dist +
// example/.astro first), so if they run concurrently the two builds race on
// that shared output and flake (#54). Every other suite is a framework-agnostic
// unit test with no shared mutable fixture, so it can run in parallel.
//
// Two workspace "projects":
//   - "fast": everything except the two build suites, default (parallel) file
//     parallelism — this is the ~56 files that don't touch example/dist.
//   - "build": the two build suites ONLY, `fileParallelism: false` so they
//     never overlap each other (mirrors the previous blanket setting, now
//     scoped to just the files that need it).
//
// `vitest run` (invoked by `pnpm test` → `pnpm --filter @spec-kitty/doc-toolkit
// test`) picks up this workspace file automatically when present alongside
// vitest.config.ts, and runs BOTH projects — so the full 884-test count is
// unchanged, just redistributed across the two projects.
const BUILD_SUITES = [
  'tests/example-adopter.test.ts',
  'tests/glossary-build-warning.test.ts',
  // Collapsible-TOC-rail no-flash build assertion (WP04): also spawns a full
  // `astro build` (into its own DK_OUTDIR), so it MUST run in this serialized
  // project — otherwise it races the other two build suites on the shared
  // `example/.astro` content-layer cache (a concurrent build corrupts the
  // mid-render cache and surfaces spurious render errors).
  'tests/toc-rail-build-html.test.ts',
  // Sidebar and TOC shaping build assertion (sidebar-frame-header-carrier
  // WP04): another full `astro build` into its own DK_OUTDIR, serialized here
  // for the same shared-`example/.astro` reason. Since WP07 it also builds the
  // same pages with a consumer-supplied sidebar, into a second DK_OUTDIR.
  'tests/sidebar-build-html.test.ts',
  // Draft-publication build assertion (sidebar-frame-header-carrier WP05):
  // builds the example with DK_PUBLISH_DRAFTS unset (on), off, and off with a
  // redirect that ends at a draft, each into its own DK_OUTDIR; serialized
  // here for the same shared-`example/.astro` reason.
  'tests/draft-publication-build.test.ts',
  // Header carrier build assertion (sidebar-frame-header-carrier WP06): builds
  // the example with and without a theme header, each into its own DK_OUTDIR;
  // serialized here for the same shared-`example/.astro` reason.
  'tests/header-carrier.test.ts',
  // In-page Gherkin build-failure proof (ADR-0051): builds a minimal fixture site
  // (written into `example/.dk-test-gherkin-fence/`, with its own dist and content
  // cache) three times to prove a broken fence makes `astro build` exit non-zero.
  // A real build of a few seconds each, so it belongs in this serialized project.
  'tests/gherkin-fence-build.test.ts',
  // Include freshness (ADR-0051 decision 11): builds a fixture site (in
  // `example/.dk-test-loader-includes/`) twice over one content cache, then runs
  // `astro dev` on it, to prove a page re-renders when only its included
  // `.feature` file changes. Real Astro runs, so serialized here.
  'tests/docs-loader-includes-build.test.ts',
  // Scenario results (ADR-0055): builds a fixture site (in
  // `example/.dk-test-gherkin-results/`) over one content cache with one report,
  // then another, to prove the pages that show results re-render when only the
  // report changes, and that an unreadable report fails the build.
  'tests/gherkin-results-build.test.ts',
];

export default defineWorkspace([
  {
    test: {
      name: 'fast',
      include: ['tests/**/*.test.ts'],
      exclude: [...BUILD_SUITES],
      environment: 'node',
    },
  },
  {
    test: {
      name: 'build',
      include: BUILD_SUITES,
      environment: 'node',
      // #54: keep the two `astro build`-against-shared-`example/dist` suites
      // serialized relative to EACH OTHER — the reason the blanket
      // `fileParallelism: false` existed on vitest.config.ts in the first
      // place. Scoped here to only the two files that need it (#56).
      fileParallelism: false,
      // Vitest 2 reads `fileParallelism` from the ROOT config only; inside a
      // workspace project it is ignored, and these suites were in fact running
      // side by side (measured: 23.5s of build tests in 12s of wall time). With
      // a fourth build suite the overlap became a reliable failure:
      // glossary-build-warning clears the content cache, a concurrent build
      // refills it, and its own build then reuses the warm render and never
      // emits the warning it asserts. One fork for the whole project is the
      // per-project setting that does serialize the files.
      pool: 'forks',
      poolOptions: { forks: { singleFork: true } },
    },
  },
]);
