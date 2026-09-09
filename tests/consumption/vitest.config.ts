// Minimal, ON-DEMAND runner config for the repo-root consumption tests.
//
// Deliberately import-free: `tests/consumption/` has no local `node_modules`, so
// importing `vitest/config` from here would not resolve. vitest accepts a plain
// default-exported config object, so this stays runnable without an install here.
//
// It is SEPARATE from the toolkit's standing gate
// (`pnpm --filter @commondocs-kitty/toolkit test` → vitest in `src/`, whose
// include is `tests/**` relative to `src/`, i.e. `src/tests/**` ONLY). This
// config's root is `tests/consumption/`, so that gate never picks it up and
// `consumption-gap.test.ts` stays OFF the always-green CI suite — the test itself
// passes, but it constructs and asserts an INTERNAL build failure, which belongs
// to the consumption workflow (WP06), not the unit gate.
//
// Run it explicitly (vitest lives in the toolkit's node_modules):
//   ( cd src && ./node_modules/.bin/vitest run --root ../tests/consumption )
export default {
  test: {
    include: ['**/*.test.ts'],
    environment: 'node',
    // Crafted-fixture pack+install+build is slow; give it room.
    testTimeout: 600_000,
    hookTimeout: 600_000,
    // The self-test mutates a shared crafted install between arms; never overlap.
    fileParallelism: false,
  },
};
