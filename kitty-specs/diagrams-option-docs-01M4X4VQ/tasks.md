# Tasks: Document the diagrams option

**Mission**: diagrams-option-docs-01M4X4VQ · **Branch**: `issue-153-diagrams-option-docs`
**Plan**: [plan.md](./plan.md) · **Grounding**: [research/code-grounding.md](./research/code-grounding.md)

One work package. The three edits describe the same behaviour and are small.

## Subtask Index

| ID | Description | WP | Parallel |
|----|-------------|----|----------|
| T001 | `src/lib/config.ts`: the `diagrams?: boolean` doc comment opens with "`false` (default): diagram blocks are shown as code, not drawn." | WP01 | |
| T002 | `docs/guides/consumer-setup.md`: add `## Optional: Diagrams` before the Gherkin section (on/off, render modes, `DK_DIAGRAM_BUILD_RENDER`, engines, minimal config); bump `updated` | WP01 | |
| T003 | Prove the section alone enables client-side Mermaid on a scratch copy of the example (on and off builds) | WP01 | |
| T004 | `CHANGELOG.md`: Unreleased → Added entry; record D-01 (no hint) | WP01 | |
| T005 | Run `pnpm lint`, `pnpm typecheck`, `pnpm validate:docs`, `pnpm validate:links`, `pnpm validate:catalog` | WP01 | |

## Work Packages

### WP01 — Document the diagrams option (#153)
- **Goal**: An adopter can turn on diagrams and choose a render mode from the consumer guide alone; the option comment states what `false` does.
- **Priority**: P1. **Independent test**: T003's scratch build draws a Mermaid fence in client mode after following only the new section.
- **Subtasks**: T001–T005. **Dependencies**: none.
- **Prompt**: `tasks/WP01-diagrams-option-docs.md`.
