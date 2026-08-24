---
title: "ADR-0020: Persona location reconciliation (context/audience/)"
description: Personas live at context/audience/ per the design of record; the example persona relocates, an Audiences hub is added, and the agent-surface reorder is accepted.
doc_status: active
updated: 2026-08-24
type: ADR
kind: ADR
authors:
  - stijn@sddevelopment.be
related:
  - adr/0009-finalize-metadata-contract
  - architecture/metadata-model
---

# ADR-0020: Persona location reconciliation (context/audience/)

## Status

Accepted. Reconciles a code/design split that M2 left behind.

## Context

The design of record (`metadata-model.md`) states personas live at
`context/audience/<profile>.md` and that `audience[].profile` resolves there. But M2
shipped the example persona at `example/docs/personas/example-persona.md` and
hard-coded that path in the build and a11y gates. `audience.profile` resolution (M3)
must target one location, so the split must be reconciled. The product owner chose the
design-of-record location.

## Decision

1. **Personas live at `context/audience/<profile>.md`** (`kind: Persona`,
   `type: Context`). `audience[].profile` resolves here (soft: link if present, else
   warn).

2. **The shipped example persona relocates.** `example/docs/personas/example-persona.md`
   (and its asset) move under `example/docs/context/audience/`; its `type` is
   reconciled `Guide` → `Context`; it is promoted `doc_status: draft` → `active` so it
   lists cleanly on the hub and US1 links resolve to a published page.

3. **An Audiences hub is added** at `context/audience/README.md` (`kind: Hub`,
   published), listing the persona pages as described links via the existing `Hub`
   layout (no new Starlight override).

4. **Every hard-coded old-path site is rewritten atomically** with the move:
   `assert-chrome-artifacts.mjs` (`PERSONA_PAGE`, `PERSONA_FRAGMENT_URL`),
   `tests/a11y/routes.ts` (`ROUTES.persona`, the `AXE_PAGES` entry), and
   `metadata-model.md`. A bare `git mv` without these reds the a11y and chrome lanes.

5. **The agent-surface reorder is accepted.** `personas/` sorted as an unknown
   section (last); `context/audience/` sorts into `context` (rank 0), so
   `/api/index.json` and `llms.txt` reorder. This is benign and expected.

6. **The example-count pins move.** Promoting the persona (+1 published) and adding
   the hub (+1) — net of a retained draft demonstrator — change
   `EXPECTED_INDEX_ENTRY_COUNT` / `EXPECTED_SITEMAP_URL_COUNT`
   (`assert-build-artifacts.mjs`); they are recomputed and cross-checked in the same
   work package.

## Consequences

### Positive

- Code and design agree on one persona location; `audience.profile` has a single
  resolution target.
- Personas gain a discoverable Audiences hub.

### Negative

- The relocation touches four gate sites and the pinned counts — it must land as one
  atomic work package to keep every boundary green (C-007).

### Risks

- A draft-exclusion demonstrator is lost when the persona is promoted. Mitigation: a
  draft example page is retained expressly for that assertion (spec FR-022).

## Alternatives considered

### Keep personas at `personas/` and change the design doc

Rejected by the product owner: `context/audience/` carries the semantic that an
audience profile is project *context*, and it is the design of record.

## References

- [ADR-0009](./0009-finalize-metadata-contract.md).
- [Metadata model](../architecture/metadata-model.md).
