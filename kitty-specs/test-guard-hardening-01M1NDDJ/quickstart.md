# Quickstart — Test-Guard Hardening

```bash
pnpm install --offline
```

## #53 — Hub draft-exclusion guard
```bash
pnpm -C src test hub-children      # the guard
# mutation check: delete the `&& isPublished(...)` clause in src/lib/hub-children.mjs → the test REDS; restore → green
```

## #54 — no vitest build-race
```bash
pnpm -C src test                   # full suite; run twice — deterministic, example-adopter + glossary-build-warning green, no race
```

Full gate parity: `pnpm -C src test && pnpm lint && pnpm typecheck` (clear stray `example/dist*` before `astro check`).
