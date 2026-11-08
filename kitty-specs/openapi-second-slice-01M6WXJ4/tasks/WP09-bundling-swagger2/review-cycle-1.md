---
affected_files: []
cycle_number: 1
mission_slug: openapi-second-slice-01M6WXJ4
reproduction_command:
reviewed_at: '2026-11-08T15:10:40Z'
reviewer_agent: claude:claude-opus-5-5:reviewer
wp_id: WP09
---

# WP09 review: REJECTED (claude-opus-5-5 reviewer)

## Must-fix
1. **Full-suite regression introduced by this WP:** `tests/package-runtime-deps.test.ts` reports `…materialise.mjs <- lib/openapi/bundle.mjs`. The cause is the comment at `src/lib/openapi/bundle.mjs:432` (``JSDoc `import('…materialise.mjs')` ``), which the scanner reads as a bare import. Reword it so the comment holds no `import(...)` call.
2. **FR-028 / T043 "parser's network resolver off" is not met.** `runAsChild` (`bundle.mjs` around line 452) still runs the http resolver with a 5 s timeout, because the options builder always rebuilds it. In the child, before `bundle()`, set `globalThis.fetch` to a function that throws. json-schema-ref-parser 13.0.5 `resolvers/http.js:144` calls the global `fetch`. Add a test. Optional: pass `resolve.file`, which the builder honours, as a resolver that re-checks realpath containment and regular files. That also closes the window between the walk and the bundle.
3. **Deviation 1:** replace the top-level `await import('./bundle.mjs')` at `materialise.mjs:413` with a static `import { assertRefsUnderLimit, bundleSource, swagger2Source } from './bundle.mjs'` plus the two `registerSpecSource` calls. This is WP08's pattern (lane-h `materialise.mjs:38/141`). I verified that the static import passes the bundle, materialise and seam suites (84/84), including two cold astro builds. Nothing cycles, because bundle.mjs never imports materialise.mjs. The vite-node rationale in the comment is incorrect. The top-level await sits on every site's `config.ts` load chain and breaks `require(esm)`.
4. **Untested contract rows:** the encoded-separator ref in `fixtures/openapi/rejected/ref-symlink-escape/api.yaml` is never reached, because the walk throws on `link.yaml` first. Add separate rows for the encoded separator (`..%2fout.yaml`), `http(s)://`, a bare absolute `/etc/passwd` and a non-regular target (a directory). A probe shows all four are rejected correctly today.

## Passing
- `pnpm install --frozen-lockfile` passes.
- The dependency is pinned to exactly 4.1.2, the lockfile diff is only the importer entry, and there are no lifecycle scripts.
- The acceptance vitest run passes 84/84, and typecheck and lint are clean.
- The example build passes.
- Mutating the realpath check is caught by the symlink row.
- Deviation 2 (`assertRefsUnderLimit` in the base flow) is minimal and correct.
- Deviation 3 (the reshaped error messages) still matches contracts/rejected-inputs.md.
- The two-build bundled-byte determinism test passes.
