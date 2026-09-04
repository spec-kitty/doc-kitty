import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // Only the framework-agnostic units are tested here; Astro-coupled route
    // wiring is covered by the example site's build in CI.
    include: ['tests/**/*.test.ts'],
    environment: 'node',
    // #54: example-adopter.test.ts and glossary-build-warning.test.ts each spawn a
    // full `astro build` against the SAME example/ site (they both clear
    // example/dist + example/.astro), so under default file-parallelism the two
    // builds race on that shared output and flake. vitest 2.1.9 dropped
    // poolMatchGlobs (no clean per-suite isolation) and `workspace` needs a
    // separate file (outside this WP's owned files), so serialize test files to
    // guarantee the two builds never overlap. `fileParallelism: false` keeps each
    // file in its own fork (isolation intact); `poolOptions.forks.singleFork` was
    // rejected — reusing one process leaks state and turns route-feeds tests red.
    fileParallelism: false,
  },
});
