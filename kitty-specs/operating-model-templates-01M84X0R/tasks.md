# Tasks: Operating-model templates and a Role kind

**Mission**: `operating-model-templates-01M84X0R` · **Planning base and merge target**: `feat/402-operating-model-templates`
**Inputs**: [spec.md](./spec.md), [plan.md](./plan.md), [research.md](./research.md), [data-model.md](./data-model.md), [contracts/cli.md](./contracts/cli.md), [quickstart.md](./quickstart.md)

Subtask rows are reference rows. Completion is recorded with `spec-kitty agent tasks mark-status <Txxx> --status done`, never by editing this file.

## Subtask index

| ID | Description | WP | Parallel |
|----|-------------|----|----------|
| T001 | Write ADR-0085: the Role kind | WP01 | |
| T002 | Add Role to the kind list in `docs/context/convention.md` | WP01 | [P] |
| T003 | Add Role to the kind list in `docs/architecture/metadata-model.md` | WP01 | [P] |
| T004 | Red tests: Role kind and requiredness, Persona unchanged | WP02 | |
| T005 | Append `Role` to `KINDS` and update the vocabulary-core pin | WP02 | |
| T006 | Gate rule: `kind: Role` requires `role` and `responsibilities` | WP02 | |
| T007 | Full suite and docs gates green | WP02 | |
| T008 | Red tests: manifest invariants and the renderer | WP03 | |
| T009 | Template manifest module (12 records) | WP03 | |
| T010 | Pure renderer `renderTemplatePage` | WP03 | |
| T011 | 12 template bodies (headings and prompts only) | WP03 | [P] |
| T012 | Gate check over every rendered template; NFR-004 body check | WP03 | |
| T013 | Pin the no-template output; red CLI tests | WP04 | |
| T014 | `new-doc.mjs --template <id>` | WP04 | |
| T015 | `scaffold.mjs --preset operating-model` | WP04 | |
| T016 | Conflicts and unknown ids exit 2 | WP04 | |
| T017 | Preset `sections.yaml` snippet with a registry-parse test | WP05 | |
| T018 | Guide "Documenting your operating model" | WP05 | |
| T019 | List the guide in `docs/guides/README.md` | WP05 | [P] |
| T020 | Changelog fragment `402-operating-model-templates.md` | WP05 | [P] |
| T021 | Quickstart smoke and docs gates | WP05 | |

## Phase 1: Decision and the kind

### WP01 - ADR-0085 and the kind lists

**Prompt**: [tasks/WP01-adr-0085-role-kind.md](./tasks/WP01-adr-0085-role-kind.md) · **Priority**: P1 · **Dependencies**: none

**Goal**: ADR-0085 records `Role` as a canonical kind, and the docs that list the kinds include it.
**Independent test**: `pnpm validate:docs`, `pnpm validate:links`, `pnpm validate:adr-ids`.

T001 Write ADR-0085 (WP01)
T002 Kind list in convention.md (WP01)
T003 Kind list in metadata-model.md (WP01)

**Risks**: do not edit `docs/adr/README.md`; the index is regenerated after merge.

### WP02 - Role kind in the vocabulary and the gate

**Prompt**: [tasks/WP02-role-kind-code.md](./tasks/WP02-role-kind-code.md) · **Priority**: P1 · **Dependencies**: none (can run in parallel with WP01)

**Goal**: `kind: Role` is accepted by the schema and the gate. A Role page without `role` or `responsibilities` fails, and the Persona rule is unchanged.
**Independent test**: `src/tests/role-kind.test.ts` and `src/tests/vocabulary-core.test.ts`.

T004 Red tests (WP02)
T005 KINDS append (WP02)
T006 Gate rule (WP02)
T007 Full suite green (WP02)

**Risks**: the KINDS length pin; any snapshot that lists every kind.

## Phase 2: Templates

### WP03 - Template set and renderer

**Prompt**: [tasks/WP03-templates-and-renderer.md](./tasks/WP03-templates-and-renderer.md) · **Priority**: P1 · **Dependencies**: WP02

**Goal**: 12 templates render into pages that pass the frontmatter gate with 0 errors. Their measures resolve against the default catalog, and their bodies hold no prose.
**Independent test**: `src/tests/operating-model-templates.test.ts`.

T008 Red tests (WP03)
T009 Manifest (WP03)
T010 Renderer (WP03)
T011 Bodies (WP03)
T012 Gate and NFR-004 checks (WP03)

**Risks**: YAML quoting of titles that contain a colon; the Role placeholders must be non-empty.

### WP04 - Stub-tool flags

**Prompt**: [tasks/WP04-stub-tool-flags.md](./tasks/WP04-stub-tool-flags.md) · **Priority**: P1 · **Dependencies**: WP03

**Goal**: `new-doc --template` and `scaffold --preset operating-model` write template pages, never overwrite, and leave the default runs byte-identical.
**Independent test**: `src/tests/stub-tools-templates.test.ts`.

T013 Pin and red tests (WP04)
T014 new-doc --template (WP04)
T015 scaffold --preset (WP04)
T016 Conflicts and unknown ids (WP04)

**Risks**: changing the default output by accident (FR-014).

## Phase 3: Opt-in preset and docs

### WP05 - Preset snippet, guide and changelog

**Prompt**: [tasks/WP05-preset-guide-changelog.md](./tasks/WP05-preset-guide-changelog.md) · **Priority**: P2 · **Dependencies**: WP04

**Goal**: the opt-in snippet parses with the real registry loader and is absent from the default registry. The guide and the fragment ship, and the quickstart runs clean.
**Independent test**: `src/tests/operating-model-preset.test.ts`, `pnpm validate:docs`, `pnpm validate:links`, `pnpm validate:changelog`.

T017 Preset snippet and test (WP05)
T018 Guide (WP05)
T019 Guides list (WP05)
T020 Changelog fragment (WP05)
T021 Quickstart smoke and gates (WP05)

**Risks**: the guide must say the templates are not legal advice (C-006).

## Dependencies

```
WP01 ─┐
WP02 ─┴─(WP02)→ WP03 → WP04 → WP05
```

WP01 and WP02 can run in parallel. WP03 to WP05 are a chain. MVP: WP01 and WP02, which deliver the Role kind on their own.
