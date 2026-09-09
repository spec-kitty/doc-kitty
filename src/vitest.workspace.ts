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
// `vitest run` (invoked by `pnpm test` → `pnpm --filter @commondocs-kitty/toolkit
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
    },
  },
]);
