import { describe, it, expect } from 'vitest';
import { spawnSync } from 'node:child_process';
import { rmSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

/**
 * WP09 T030 (NFR-007 / R-2) — the greppable collision warning proven at the REAL
 * BUILD LAYER, not just in a vitest of the pure core. The context-free
 * demonstrator page (`example/docs/glossary-demo/cargo-and-collisions.md`) uses
 * the word "policy", which is defined in BOTH the `hr` and `shipping` contexts of
 * `example/.contextive/definitions.yaml`. With no `glossary_context` the
 * auto-linker must leave it plain and emit exactly ONE pinned, greppable line to
 * stderr — and the build must still exit 0 (skip-and-warn, INV-G3).
 *
 * The build is spawned with a cleared Astro content cache so the markdown pipeline
 * genuinely re-runs (a warm cache would reuse a prior render and emit nothing).
 * This is an integration test over the shipped example, so it is given a generous
 * timeout.
 */

const REPO_ROOT = fileURLToPath(new URL('../../', import.meta.url));

// The exact line the resolver + wrapper pin (competing contexts sorted): the
// build gate greps for THIS string, so it is pinned here verbatim.
const PINNED_WARNING =
  '[glossary] unresolved collision "policy" in hr, shipping — left unlinked';

describe('example build surfaces the unresolved-collision warning (NFR-007 / R-2)', () => {
  it(
    'emits the pinned warning exactly once on stderr and exits 0',
    () => {
      // Clear the content-layer cache + prior output so the pipeline re-runs and
      // the warning is actually produced (a warm cache reuses a cached render).
      for (const dir of ['example/.astro', 'example/node_modules/.astro', 'example/dist']) {
        rmSync(new URL(`../../${dir}`, import.meta.url), { recursive: true, force: true });
      }

      const result = spawnSync('pnpm', ['--filter', 'example', 'build'], {
        cwd: REPO_ROOT,
        encoding: 'utf8',
        env: process.env,
      });

      // The build must SUCCEED — the collision is a warning, never fatal.
      expect(result.status, `build stderr:\n${result.stderr}`).toBe(0);

      // The pinned line appears EXACTLY once (one distinct unresolved surface on
      // exactly one context-free page — the dedup is per distinct surface/page).
      const occurrences = result.stderr.split(PINNED_WARNING).length - 1;
      expect(
        occurrences,
        `expected exactly one pinned collision warning; stderr:\n${result.stderr}`,
      ).toBe(1);
    },
    180_000,
  );
});
