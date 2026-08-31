# Contract — ADR-index generator + sync-check (#44)

## Generator: `src/scripts/generate-adr-index.mjs`
- **Input**: recursively discover `docs/adr/**/NNNN-*.md` (exclude `template.md`, any depth — era subfolders included).
- **Per file**: parse frontmatter (`title`, `updated`) + body `## Status` (first status token) + derive `number` from filename.
- **Output**: rewrite the ADR table region of `docs/adr/README.md` with rows ordered by ascending ADR number, columns `ID | Title | Status | Date`, intro prose + frontmatter preserved. Deterministic + idempotent (INV-A1).
- **Invocation**: `node src/scripts/generate-adr-index.mjs` regenerates in place; a `--check` mode (or a sibling `assert-adr-index.mjs`) regenerates to a buffer and exits non-zero on any diff from the committed file.

## Sync-check (lockfile-style, CI)
- Wire `--check` into the docs-validation gate (`package.json` scripts, e.g. alongside `validate:docs`).
- **Contract**: a committed `docs/adr/README.md` that is not regeneration-clean fails CI (SC-003a). This verifies a *generated artifact*, NOT hand-maintenance — no gate requires hand-editing the index (C-004).

## Referential-integrity guard (FR-008)
- A check (test or gate) that resolves every ADR→ADR reference; a reference to a non-existent ADR **fails**, a valid one **passes** — both polarities in one test (SC-004). Reuse the existing `collectDanglingRelated` shape.

## Example tree (FR-013)
- Delete the redundant table from `example/docs/adr/README.md`; the `kind: Hub` layout auto-lists ADRs on build.
- **Test**: extend `src/scripts/assert-build-artifacts.mjs` — add an ADR fixture, build, assert the rendered `/adr/` HTML contains a link to it (SC-003b). Must NOT be satisfiable by grepping source Markdown.

## Living-docs sync (FR-012)
- Update `docs/context/convention.md` so it no longer describes a hand-maintained ADR table (states the table is generated).

## Non-goals (C-006, filed follow-ups)
- ADR-number-ordered / status-aware Hub card for multi-ADR *rendered* trees (the example demo is single-ADR; own tree uses the generator).
