# Implementation Plan: Document the diagrams option

**Branch**: `issue-153-diagrams-option-docs` | **Date**: 2026-10-14 | **Spec**: [spec.md](./spec.md)
**Input**: Mission specification from `kitty-specs/diagrams-option-docs-01M4X4VQ/spec.md`

## Summary

Add an `## Optional: Diagrams` how-to section to `docs/guides/consumer-setup.md`
and make the `diagrams?: boolean` doc comment in `src/lib/config.ts` open with
the `false` behaviour. No runtime change. The optional build-time hint is not
added (decision D-01 below). One CHANGELOG entry under Unreleased → Added.

## Technical Context

- **Surfaces**: `docs/guides/consumer-setup.md` (How-To), `src/lib/config.ts`
  (reference, TSDoc on the option), `CHANGELOG.md`.
- **Behaviour documented**: `resolveDiagramMode`, `chromiumResolvable`,
  `diagramsIntegration` build and client branches,
  `resolvePlantumlServerUrl`. Grounding: `research/code-grounding.md` §1-4.
- **Gates**: `pnpm lint`, `pnpm typecheck`, `pnpm validate:docs`,
  `pnpm validate:links`, `pnpm validate:catalog`.
- **Proof of FR-004**: copy `example/` to the scratchpad inside the workspace
  (so `@spec-kitty/doc-toolkit` still resolves), reduce `astro.config.mjs` to
  the guide's minimal config, add one Mermaid page, build with
  `DK_DIAGRAM_BUILD_RENDER=client`, and check the built HTML for
  `figure.dk-diagram` + `pre.mermaid` and the injected render script. Repeat with
  the option removed and check the fence is a plain code block.

## Charter Check

- Living documentation: the docs change describes shipped behaviour only. Pass.
- Convention: `consumer-setup.md` keeps its frontmatter; `updated` bumps to
  2026-10-14. Pass.
- Writing policy: sentence-case headings, one idea per sentence, no padding.
  The section teaches, then links to `architecture/diagrams` and ADR-0040. Pass.
- No new gate, no ADR needed: ADR-0040 already holds the decision. Pass.

## Decisions

- **D-01 — No build-time hint.** Detecting fences while `diagrams` is off means
  scanning every page on a path that today costs nothing (`config.ts:1978`). The
  cause in #153 was missing documentation and a misleading comment; both are
  fixed here. Revisit if a second adopter hits the same mistake after this lands.
- **D-02 — Placement.** A new `## Optional: Diagrams` section before
  `## Optional: Gherkin feature pages`, so the Gherkin sibling dispatch can edit
  its own section without overlap (C-001).
- **D-03 — Mission type.** `software-dev`, matching every previous doc-kitty
  mission and the requested specify → plan → tasks → implement → review loop.
  The work is documentation (Divio How-To + Reference).

## Project Structure

### Documentation (this mission)

```
kitty-specs/diagrams-option-docs-01M4X4VQ/
├── spec.md
├── plan.md
├── research/code-grounding.md
├── tasks.md
└── tasks/WP01-diagrams-option-docs.md
```

### Source Code (repository root)

```
docs/guides/consumer-setup.md   # new section + updated bump
src/lib/config.ts               # diagrams?: boolean doc comment only
CHANGELOG.md                    # Unreleased → Added entry
```

**Structure Decision**: one work package; the three edits are small and
describe the same behaviour.

## Implementation Concern Map

### IC-01 — Adopter-facing diagrams documentation

- **Purpose**: Explain the option, the render modes and the engines where an
  adopter looks, and state the `false` behaviour where a developer looks.
- **Relevant requirements**: FR-001, FR-002, FR-003, FR-004, FR-005, FR-006, FR-007
- **Affected surfaces**: `docs/guides/consumer-setup.md`, `src/lib/config.ts`,
  `CHANGELOG.md`
- **Sequencing/depends-on**: none
- **Risks**: Over-promising a fallback for forced build mode; implying PlantUML
  works in client mode. Both guarded by grounding §2 and §3.
