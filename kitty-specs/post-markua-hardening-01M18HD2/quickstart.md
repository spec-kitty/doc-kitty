# Quickstart / Verification: Post-Markua Hardening

How to run and verify each fix. Local `node_modules` is healthy this session (unit suite 553/553), so the a11y lane is locally runnable; **CI remains the authoritative verifier**.

## Baseline (before changes)

```bash
pnpm --filter @commondocs-kitty/toolkit test    # unit — expect 553 passing
pnpm build && pnpm assert:markua                 # build + Markua build asserts
pnpm test:a11y -- diagram.spec.ts                # a11y (the flake may appear on toggle test)
```

## IC-01 — #34 a11y flake

```bash
# Reproduce the flake first (revert-and-observe), then apply the fix.
# Prove class-closure by running the toggle test repeatedly across both colour modes:
for i in $(seq 1 20); do pnpm test:a11y -- diagram.spec.ts -g "theme toggle" || break; done
# Expect: 20/20 green, zero "Cannot parse colour ''".
grep -rn "toRgbTriple\|nodeFill" tests/a11y/*.spec.ts   # expect: imported from helpers/colour.ts, no local defs
```

## IC-02 — #35 parity guard

```bash
pnpm --filter @commondocs-kitty/toolkit test glossary-substrate-parity
# Negative check: temporarily add a dummy doc-kitty remark stage in config.ts
# without mirroring/excluding it → the parity test must fail naming it. Revert.
```

## IC-03 — #36 deck-scope

```bash
pnpm --filter @commondocs-kitty/toolkit test deck-guard
# Deck-Markua inertness: build the deck fixture containing {…}/W>/::: and assert
# slide structure equals the marker-free deck (no slide line consumed).
pnpm build && pnpm assert:markua && pnpm test:a11y   # decks still render as before
```

## IC-04 — Markua minor edges

```bash
pnpm --filter @commondocs-kitty/toolkit test markua-attributes markua-callouts
```

## IC-05 — docs

```bash
pnpm validate:docs   # frontmatter/lifecycle for the touched docs
# Visual check: ADR-0025 + glossary.md parity note; markua.md/slide-decks.md deck scope; ADR-0030 Consequences.
```

## Byte-identity falsifier (NFR-002)

```bash
# The named gates test invariants, not a frozen baseline. Prove byte-identity directly:
git stash && pnpm build && cp -r example/dist /tmp/dist_baseline && git stash pop
pnpm build && diff -r /tmp/dist_baseline example/dist && echo "BYTE-IDENTICAL ✓"
# Empty diff (esp. under example/dist for the deck pages) ⇒ the guards are true no-ops today.
```

## Full gate (before PR)

```bash
pnpm lint && pnpm typecheck && \
pnpm --filter @commondocs-kitty/toolkit test && \
pnpm build && pnpm validate && pnpm assert:markua && pnpm assert:artifacts && \
pnpm test:a11y
```

All green + byte-identical rendered corpus ⇒ NFR-002 satisfied.
