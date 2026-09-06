import { defineConfig } from 'vitest/config';

// #56: the file-parallelism serialization this config used to apply to ALL
// ~58 test files now lives SCOPED to just the two build-coupled suites, via
// `vitest.workspace.ts` (sibling file) — see that file for the #54 rationale
// (example-adopter.test.ts + glossary-build-warning.test.ts both spawn a full
// `astro build` against the shared example/ site and must never overlap each
// other). `vitest run` picks up the workspace file automatically when present,
// so this root config's `test.include`/`environment` are superseded by the
// workspace's two projects; it is kept (rather than deleted) as the config
// vitest/IDE tooling resolves for files outside the workspace's own include
// globs, and so a single project run (`vitest run --project fast`) still has a
// valid base to fall back to.
export default defineConfig({
  test: {
    include: ['tests/**/*.test.ts'],
    environment: 'node',
  },
});
