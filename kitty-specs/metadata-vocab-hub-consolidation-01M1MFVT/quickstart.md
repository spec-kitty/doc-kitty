# Quickstart — Metadata / Vocabulary / Hub Consolidation

How to validate the delivered mission locally.

## Setup

```bash
pnpm install --offline   # hardlinks from the local store (avoids the root-owned node_modules hazard)
```

## Verify the consolidation (#49) + durable (#39)

```bash
# All tests, incl. the golden-master + single-source gate + parity retargets
pnpm -C src test

# Type layer: z.enum(STATUSES) + derived unions compile
pnpm typecheck            # astro check — 0 errors expected

# The bare-Node frontmatter gate still runs with no Astro build context
node src/scripts/validate-frontmatter.mjs        # exit 0 (advisory warnings only)

# Structural single-sourcing: this reds if any 2nd vocabulary/enum definition reappears
pnpm -C src test vocabulary-single-source
```

Expected: one canonical definition of section vocabulary + type-derivation in `src/lib/vocabulary-core.mjs`; a doc with `doc_status: durable` validates and is treated as published.

## Verify the ADR Hub card (#50)

```bash
pnpm -C src test hub-adr-card         # ordering + status/date fidelity vs the generated table
pnpm -C src test adr-index-generator  # generator output unchanged
```

Expected: an ADR hub over ≥2 ADRs lists them in ADR-number order with a lifecycle status badge + date, matching the generated own-tree table 1:1 over the published+numbered set; number-less and `type:Template` ADRs are excluded on both sides.

## Full gate parity with CI

```bash
pnpm -C src test && pnpm lint && pnpm typecheck && \
  node src/scripts/assert-build-artifacts.mjs && node src/scripts/assert-chrome-artifacts.mjs
```
