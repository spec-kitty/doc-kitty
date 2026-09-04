# Tasks: Diagram markup + component-CSS delivery fixes

**Mission**: diagram-component-css-01M1PA3J · **Branch**: `fix/diagram-component-css` · **Merge target**: `main` (PR)
**Spec**: [spec.md](./spec.md) · **Plan**: [plan.md](./plan.md) · **Research**: [research.md](./research.md)

## Subtask Index

| ID | Description | WP | Parallel |
|----|-------------|----|----------|
| T001 | Retype the Mermaid mdast node off `code` in `mermaidFenceTransform`; confirm `diagram-figure.ts` + render selector unchanged | WP01 | |
| T002 | Create `src/styles/dk-components.css`: relocate `.dk-callout*` + add `.dk-diagram*`/`__caption`/`__desc`/`__attr` (general text tokens, white-space normal, non-mono) | WP01 | |
| T003 | Remove the `.dk-callout*` block from `src/styles/theme.css` | WP01 | |
| T004 | Wire `dk-components.css` as its OWN `customCss` entry (config.ts) + explicit `<link>` in `DeckLayout.astro` | WP01 | |
| T005 | Update `src/tests/theme-merge.test.ts` default-path `customCss` shape invariant | WP01 | |
| T006 | Build-artifact asserts: no `<pre>` wraps `figure.dk-diagram` across all 3 diagram pages; branded page ships `.dk-callout` + `.dk-diagram` rules (red-first) | WP01 | |
| T007 | Pipeline-level unit running real `remark→hast→rehype`, asserting the figure has no `<pre>` ancestor (red-first) | WP01 | |
| T008 | Playwright computed-style check on docs AND deck shells (caption non-mono, white-space normal, no code-card) | WP01 | |
| T009 | ADR: remark→rehype→CSS diagram-figure ownership contract | WP02 | |
| T010 | Dated changelog fragment under `docs/changelog/` (impact-first, refs #59/#60/#68) | WP02 | |
| T011 | Regenerate/verify the ADR index if a new ADR page is added (`generate-adr-index --check`) | WP02 | |

## Work Packages

### WP01 — Diagram markup correctness + component-CSS delivery + gates

- **Goal**: Emit a well-formed Mermaid figure (#59), deliver figure + callout component CSS to branded docs and decks (#60/#68), and add mutation-true gates.
- **Priority**: P1
- **Independent test**: Build the branded example — 0 `<pre>`-wrapped diagram figures; branded docs/deck ship `.dk-callout`+`.dk-diagram` rules; captions render non-mono/wrapping; new gates go red on each re-introduced defect.
- **Subtasks**: T001, T002, T003, T004, T005, T006, T007, T008
- **Dependencies**: none
- **Estimated prompt size**: ~500 lines
- **Risks**: config.ts hosts both the remark retype and the customCss wiring (single owner); a downstream remark consumer keying on the `code` node (none found — `diagramMeta` runs first); false-green if CSS-presence isn't paired with the computed-style check.

### WP02 — ADR + changelog

- **Goal**: Make the remark→rehype→CSS figure-ownership contract explicit and record the user-facing change.
- **Priority**: P2
- **Independent test**: ADR renders and (if a new page) the ADR index passes `generate-adr-index --check`; changelog fragment present and impact-first.
- **Subtasks**: T009, T010, T011
- **Dependencies**: WP01
- **Estimated prompt size**: ~180 lines
- **Risks**: ADR index drift if the inventory isn't regenerated.

## MVP

WP01 is the MVP — it delivers every user-facing fix (#59/#60/#68) and the regression gates. WP02 is documentation follow-through.
