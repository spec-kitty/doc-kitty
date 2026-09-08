---
work_package_id: WP01
title: Footnote Markua feature (first-class opt-in)
dependencies: []
requirement_refs:
- FR-004
- FR-013
- NFR-001
planning_base_branch: feat/ars-rethorica-example
merge_target_branch: feat/ars-rethorica-example
branch_strategy: Planning artifacts for this mission were generated on feat/ars-rethorica-example. During /spec-kitty.implement this WP may branch from a dependency-specific base, but completed changes must merge back into feat/ars-rethorica-example unless the human explicitly redirects the landing branch.
subtasks:
- T001
- T002
- T003
- T004
- T005
history:
- created by /spec-kitty.tasks
agent_profile: node-norris
authoritative_surface: src/
create_intent:
- src/lib/remark/markua-footnotes.ts
- src/lib/remark/markua-footnotes.internal.ts
- src/tests/markua-footnotes.test.ts
- docs/adr/0041-markua-footnotes.md
- example/docs/guides/markua-footnotes-showcase.md
- example/docs/guides/markua-footnotes-malformed.md
execution_mode: code_change
owned_files:
- src/lib/remark/markua-footnotes.ts
- src/lib/remark/markua-footnotes.internal.ts
- src/tests/markua-footnotes.test.ts
- src/lib/config.ts
- src/scripts/assert-markua-builds.mjs
- docs/adr/0041-markua-footnotes.md
- example/docs/guides/markua-footnotes-showcase.md
- example/docs/guides/markua-footnotes-malformed.md
role: implementer
tags: []
tracker_refs: []
---

## ⚡ Do This First: Load Agent Profile

Before reading anything else, load your assigned profile via `/ad-hoc-profile-load node-norris` (role: implementer). Apply its identity, boundaries, and the charter directives (`spec-kitty charter context --action implement --json`); state which you applied. Relevant: DIRECTIVE_001 (architectural integrity — pure `.internal` split), DIRECTIVE_010 (spec fidelity), DIRECTIVE_051 (supply-chain — **no new dependency is permitted here**).

## Objective

Add **footnotes** as a first-class, opt-in Markua-subset feature so the source's `[^^N_M]` reference markers and `[^^N_M]:` definitions render as real footnotes. The source manuscript uses 364 markers / 182 definitions across Book I, so this is load-bearing for the showcase. Read `../spec.md` (FR-004, FR-013, NFR-001), `../plan.md` (IC-01), `../research.md` (**D1 — the spike**), and `../contracts/footnote-feature.md`.

Key facts (from research):
- `remark-gfm` **4.0.1 is already present** (`package.json`) and is Astro/Starlight's built-in remark plugin — it runs before every doc-kitty pass and already carries GFM footnote support. **No new dependency may be added.**
- The Markua passes are registered in `src/lib/config.ts` inside `markuaIntegration()`, gated by the `markua` preset (default OFF). Effective remark order today: `remarkDirective → markuaNormalise → markuaAttributes → markuaCallouts`.
- Convention: a thin remark-facing `.ts` plugin + a **pure** `.internal.ts` (NO remark/unified/mdast/vfile/Astro imports) holding the logic. `isPresentationFile` is imported only in the `.ts` half.

## Subtasks

### T001 — De-risking spike (DO THIS FIRST; it decides the design)
The double caret may already parse under GFM. Determine current behaviour before writing the pass:
1. Create a scratch page (temporarily, outside owned files is fine — delete after) containing a reference `Text[^^0_1] more.` and a definition line `[^^0_1]: A note.`
2. Build the example twice and inspect the rendered `example/dist` HTML for that page:
   - `pnpm --filter example build` (Markua ON — default) — does `[^^0_1]` become a footnote ref? With what label/anchor? Is the `^0_1` caret leaking into visible text?
   - `DK_MARKUA=off pnpm --filter example build` — what does OFF render?
3. Record the finding in a one-paragraph note in the ADR (T005). Decide:
   - **If GFM already pairs `[^^0_1]`/`[^^0_1]:`** → the pass's job is to normalise the visible label (strip the leading caret so refs read `1`, `2`, … or `1.3`) and guarantee pairing/ordering, acting ONLY when `markua` is on so **preset-OFF output stays byte-identical** (NFR-001).
   - **If GFM does NOT pair them** → the pass rewrites `[^^X]`→`[^X]` (reference and `[^^X]:`→`[^X]:` definition) at the mdast/text level so GFM then renders them.
`mark-status T001 --status done` with the recorded outcome.

### T002 — `src/lib/remark/markua-footnotes.internal.ts` (pure normaliser)
Implement the normalisation decided in T001 as a pure function over the relevant unit (a string, a list of mdast text/paragraph nodes, or an mdast tree slice — mirror how `markua-normalise.internal.ts` structures its pure state machine). MUST NOT import remark/unified/mdast-typed runtime/vfile/Astro. Handle:
- reference markers `[^^<label>]` and definition lines `[^^<label>]:` where `<label>` is the source form `N_M` (digits + underscore) — but accept any non-whitespace, non-`]` label.
- **unmatched** marker or definition → leave as harmless text; never throw (totality, NFR-002 spirit).
- do not touch already-plain GFM `[^x]`.
- do not corrupt inline code / fenced code containing `[^^...]` (respect code spans as `markua-normalise` does).
Export a small, exhaustively testable API.

### T003 — `src/lib/remark/markua-footnotes.ts` + register in `config.ts`
Thin unified/remark plugin wrapping the `.internal` logic; `export default`. Heavy JSDoc header stating the contract, FR-004/FR-013, deck behaviour, and the dormant-until-`markua` note (mirror sibling files). Import `isPresentationFile` here only.
- **Deck scoping v1**: deck-agnostic → register as `guardDeck(markuaFootnotes)` (mirror `markuaTocDemote`), OR delegate internally via `isPresentationFile` — pick per the sibling pattern and justify in the ADR. Slides get no footnote apparatus in v1.
- **Register** in `markuaIntegration()`'s bare `remarkPlugins` array in `src/lib/config.ts`, **after `markuaNormalise`, before `markuaAttributes`**, still gated by `markuaActive`. Preserve the single `remarkDirective` owner (do not add a second). When `markua` is OFF the pass must not be registered / must be inert.

### T004 — `src/tests/markua-footnotes.test.ts`
Follow the `markua-*.test.ts` pattern: end-to-end via `unified().use(remarkParse).use(remarkGfm).use(markuaFootnotes)` asserting the rendered footnote structure, plus pure `.internal` unit cases. Cover: matched ref+def pairing/ordering; multiple refs to one def; unmatched ref; unmatched def; ref inside inline code left untouched; deck file (`makeFile('Presentation')`) → no-op; a preset-OFF-equivalent assertion of byte-stability where feasible. Run: `pnpm --filter @commondocs-kitty/toolkit exec vitest run tests/markua-footnotes.test.ts`.

### T005 — assert:markua fixtures + ADR-0041
- Add two **draft** fixtures (so they do NOT move the build-artifact ratchet): `example/docs/guides/markua-footnotes-showcase.md` (`doc_status: draft`, `<!-- markdownlint-disable -->`, a handful of `[^^N]` footnotes rendering correctly) and `example/docs/guides/markua-footnotes-malformed.md` (`doc_status: draft`, an unmatched marker + unmatched definition that must degrade without failing the build).
- Extend `src/scripts/assert-markua-builds.mjs`: assert the showcase fixture renders footnote references + a notes list, and that the preset-OFF (`DK_MARKUA=off`) build leaves the footnote source degraded/literal (portability). Keep the gate total (exit 0 on the malformed fixture).
- Author `docs/adr/0041-markua-footnotes.md`: record the reuse-remark-gfm decision, the T001 spike outcome + the double-caret normalisation rule, deck scoping choice, degradation/totality rules, and the byte-identical-when-off invariant. Follow the house ADR format (read `docs/adr/0040-*.md`).

## Definition of Done
- Footnotes render when `markua` on; **byte-identical example build when `DK_MARKUA=off`** (verify by diffing dist trees or precise reasoning + gate).
- No-op on `kind: Presentation`. No new npm dependency (grep the diff for package.json/lock changes — there must be none).
- vitest green incl. the new test; `assert:markua` green; typecheck + lint green.
- ADR-0041 committed; fixtures are `doc_status: draft`.
- `spec-kitty agent tasks mark-status T001 T002 T003 T004 T005 --status done`.

## Risks / reviewer guidance
- **NFR-001 is the sharp edge**: any change to preset-OFF output fails the mission's core invariant — reviewer must confirm OFF byte-identity (the pass must be gated/inert when off).
- Reviewer: independently re-run the T001 spike reasoning; confirm the test reds if the pairing logic is broken; confirm no dependency was added; confirm deck no-op.
- Env: run gates from a lane worktree with `pnpm install --offline`; `pnpm clean` before a fresh build (stale `example/.astro`). `astro check` OOMs on stray `example/dist*` — clear them first.
