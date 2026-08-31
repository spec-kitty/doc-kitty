# Quickstart — verifying the QOL Adoption-Enabler Cluster

How to confirm each enabler works (maps to Success Criteria).

## #38 — optional/derived type/kind
```bash
# A doc with no type/kind under a registered section passes; type is derived.
node src/scripts/validate-frontmatter.mjs docs        # green over the corpus (NFR-002)
pnpm --filter @commondocs-kitty/toolkit test -- schema-validator-parity   # missing-kind fixture now ACCEPTED (retargeted)
```
- SC-001: fixture with no `type`/`kind` → passes, effective type = section-derived.
- FR-003: fixture with a conflicting authored `type` → `problems == []` AND `warnings[]` contains the mismatch.

## #40 — overridable vocabulary
```bash
# With a _meta/vocabulary.yaml aliasing/forbidding Feature:
pnpm --filter @commondocs-kitty/toolkit test -- vocabulary   # authored+derived alias/forbid + no-file default
```
- SC-002: forbidden `Feature` fails with the replacement named; alias resolves authored AND derived `Feature`; no file → `Feature` valid.
- NFR-004: parity test — same YAML → mjs.resolve == ts.resolve.

## #40 — own-corpus correction
```bash
node src/scripts/validate-frontmatter.mjs docs   # zero authored-vs-derived path-mismatch warnings on docs/plans/features/
```
- SC-005: no `docs/plans/features/` page warns; `Feature` still valid; corrected pages match content.

## #44 — ADR index (own tree, generated)
```bash
node src/scripts/generate-adr-index.mjs          # regenerate docs/adr/README.md
node src/scripts/generate-adr-index.mjs --check  # exits non-zero if the committed table is stale
```
- SC-003a: add an ADR → generated row is number-ordered with Status + Date; stale table fails `--check`.
- SC-004: referential-integrity test — dangling ADR ref fails, valid passes.

## #44 — ADR index (example tree, Hub)
```bash
pnpm --filter example build
node src/scripts/assert-build-artifacts.mjs      # rendered /adr/ HTML links the ADR fixture
```
- SC-003b: example table removed; Hub auto-lists in built HTML.

## #44 — doc-honesty prose
- AGENTS.md → `doc_status` (not `status`), full section list, amended optional-frontmatter contract.
- README.md + src/README.md → no "early scaffold"; UNLICENSED stated honestly.
- convention.md → ADR table described as generated.

## #41 — era-tolerant ADR typing
```bash
pnpm --filter @commondocs-kitty/toolkit test -- section-type-parity metadata-sections
```
- SC-006: `adr/<era>/NNNN-*.md` → `ADR` on both mjs and ts derivations.

## Full gate sweep (must stay green — NFR-001)
```bash
pnpm --filter @commondocs-kitty/toolkit test
pnpm run validate:docs
pnpm run build && node src/scripts/assert-build-artifacts.mjs
pnpm run assert:markua && pnpm run test:a11y
```
