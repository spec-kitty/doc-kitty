# Quickstart: build & verify the ars-rethorica showcase

Env note: repo-root `node_modules` may be root-owned/broken. Prefer running gates
from a lane worktree with `pnpm install --offline`; run `pnpm clean` before a fresh
build to avoid the `example/.astro` stale-cache trap.

## Build the example site
```bash
pnpm clean
pnpm --filter example build          # Markua preset is ON by default in the example
```

## Footnote feature spike (do this FIRST, before implementing IC-01)
Create a scratch fixture with `[^^0_1]` + `[^^0_1]:` and build with Markua ON and OFF:
```bash
DK_MARKUA=off pnpm --filter example build   # inspect rendered footnote handling
```
Decide per research.md D1 whether the pass rewrites the double caret or only guarantees pairing.

## Unit tests (toolkit)
```bash
pnpm --filter @commondocs-kitty/toolkit exec vitest run tests/markua-footnotes.test.ts
pnpm --filter @commondocs-kitty/toolkit test          # full fast suite
```

## Gate suite (must be green before PR)
```bash
# doc-sanity
pnpm validate:example && pnpm validate:links && pnpm validate:catalog && pnpm validate:adr-index
npx markdownlint-cli2 "docs/**/*.md" "example/docs/**/*.md"
vale --minAlertLevel=error docs example/docs
# build-example (post-build asserts)
pnpm --filter example build
pnpm assert:artifacts example/dist        # after bumping EXPECTED_* counts
pnpm assert:no-broken-links               # (run via its script args as in package.json)
pnpm assert:markua                        # footnote fixture + preset-off portability
# a11y (needs built example/dist)
pnpm test:a11y
# toolkit
pnpm --filter @commondocs-kitty/toolkit typecheck && pnpm --filter @commondocs-kitty/toolkit lint
```

## Verification checklist (maps to Success Criteria)
- SC-001: build exits 0; Intro + Preamble + 15 chapters + 3 book landings + hub present.
- SC-002: `grep -REl '\[\^\^|\{blurb|\{/blurb\}|\{pagebreak\}|\{mainmatter\}|\{class: part\}' example/dist` → no HTML hits.
- SC-003: `DK_MARKUA=off` build byte-identical to pre-mission (diff dist trees).
- SC-004: `assert:no-broken-links` clean; `test:a11y` 0 violations on opted-in routes.
- SC-005: markdownlint + Vale clean on new pages.
- SC-006: rhetoric glossary generated with all terms; ≥1 active persona resolves.
- SC-007: about/license page reachable; per-page CC-BY-SA notice present.
