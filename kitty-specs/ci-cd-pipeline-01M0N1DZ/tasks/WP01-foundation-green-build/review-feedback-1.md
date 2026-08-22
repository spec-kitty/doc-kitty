# WP01 Review — Changes Requested (1 item)

**Verdict**: Request changes. One blocking item; everything else is approved.

## Approved (do not redo)
- `pnpm-lock.yaml` committed; install green on Node 22. ✅
- Vitest: 16 tests pass; mutation probe genuinely fails (delegated-logic probe →
  6 failing tests) — the suite protects behavior. ✅
- `pnpm build`: exit 0, no error output, non-empty `example/dist/`. ✅
- `pnpm lint` (real eslint) green at baseline, fails on a bad probe. ✅
- Frozen install passes; drift fails with `ERR_PNPM_OUTDATED_LOCKFILE` (NFR-008). ✅
- The `ROOT_ENTRY_ID` build fix is behavior-preserving (verified slug/route). ✅

## BLOCKING — `pnpm typecheck` is red at baseline

Confirmed by the reviewer: `pnpm typecheck` exits non-zero with
`error TS2307: Cannot find module 'astro:content'` and implicit-any errors from
Starlight's own `.ts` sources. A typecheck gate that is red at baseline is not a
usable gate — WP04's **code-quality lane runs `pnpm typecheck`**, so as-is
`ci-ok` can never be green for a code PR, which defeats the mission's core promise.

The WP01 DoD explicitly requires `pnpm typecheck` to be "a real gate that fails on
a bad probe" — i.e. **green at baseline, red on a bad probe**.

### Required fix (within WP01's owned files)
Replace the toolkit-isolated `tsc --noEmit` typecheck with an Astro-aware typecheck
that resolves virtual modules. Preferred: make `pnpm typecheck` run **`astro check`
in the example** (add `@astrojs/check` + `typescript` as devDeps to
`example/package.json`; `astro check` runs `astro sync` first, generating the
`astro:content` types, and typechecks the project including the toolkit code it
imports). Re-commit the updated `pnpm-lock.yaml`.

If `astro check` alone does not cover the toolkit route handlers, an acceptable
alternative is `astro sync` (to generate `astro:content` types) followed by a
scoped `tsc` with `skipLibCheck: true` — you may edit `src/tsconfig.json` for this
(small, out-of-map edit, record a one-line rationale).

### Acceptance for the fix
1. `pnpm typecheck` is **green at baseline** (exit 0).
2. A bad probe (introduce a real type error in `src/`) makes it **red**; then revert.
3. `pnpm-lock.yaml` re-committed if devDeps changed.
4. Keep everything else as-is.

Record the baseline-green result and the probe evidence in your report.
