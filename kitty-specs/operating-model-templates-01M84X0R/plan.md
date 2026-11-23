# Implementation Plan: Operating-model templates and a Role kind

**Branch**: `kitty/mission-operating-model-templates-01M84X0R` → merges into `feat/402-operating-model-templates` | **Date**: 2026-11-23 | **Spec**: [spec.md](spec.md)
**Input**: Mission specification from `kitty-specs/operating-model-templates-01M84X0R/spec.md`

## Summary

The mission adds `Role` to the single-source kinds list and gives a `kind: Role` page its own requiredness rule (`role`, `responsibilities`) in the frontmatter gate, next to the existing Persona rule. It records the kind in ADR-0085.

It ships 12 operating-model templates. Each is a manifest record plus a Markdown body:

- **Manifest record:** id, title, kind, default path, default type and preset measure ids.
- **Body:** headings and HTML-comment prompts only.

A pure renderer builds a page's frontmatter from the manifest record, including `tom_classification` entries with `scope: organisation`, and appends the body. `new-doc.mjs --template <id>` writes one page, and `scaffold.mjs --preset operating-model` writes the set plus a section index. Both tools keep their existing never-overwrite behaviour. The section preset ships as a documented `sections.yaml` snippet that is not in the default registry. A guide and a changelog fragment document the feature.

## Technical Context

**Language/Version**: JavaScript ESM (`.mjs`, checked with `// @ts-check`) on Node >= 22.22.0, plus TypeScript for the build schema and the tests
**Primary Dependencies**: none new. The work reuses `vocabulary-core.mjs`, `scaffold-meta.mjs`, `measures-default.mjs`, the `yaml` package already in use, and Vitest
**Storage**: files. Template bodies are Markdown under `src/lib/templates/operating-model/`; the manifest is a data module, `src/lib/operating-model-templates.mjs`
**Testing**: Vitest (`pnpm test`: the toolkit and mcp projects), with red-first tests per WP. The CLI tests spawn the real scripts in temp directories, and the validation test runs the real frontmatter gate
**Target Platform**: the Node CLI (bare `node`, as the stub tools run today) and the Astro build schema
**Project Type**: single (the toolkit package in `src/`)
**Performance Goals**: not performance-sensitive. Emitting the whole preset is 13 small file writes
**Constraints**: no new dependencies (DIRECTIVE_051 is not triggered); templates hold no policy wording (C-001); runs that use neither `--template` nor `--preset` produce byte-identical output (FR-014, C-005)
**Scale/Scope**: 1 new kind, 12 templates, 2 CLI flags, 1 ADR, 1 guide, 1 changelog fragment

## Charter Check

| Charter principle | Check |
|---|---|
| Structure: a predictable, browsable shape | Pass. The templates are structure (headings, frontmatter); the preset is an opt-in `sections.yaml` snippet. |
| Content scope: the toolkit does not author content | Pass, enforced by a test (NFR-004): template bodies hold headings and HTML-comment prompts only, with no policy or legal wording. |
| Maintainability: single source of truth | Pass. `Role` is added only to `KINDS` in `vocabulary-core.mjs`, which the schema, the gate and the tools all import (C-003). |
| Flexibility: adapt without a rewrite | Pass. The preset is opt-in; a consumer type alias applies through the existing vocabulary resolver. |
| Architectural intent: ADRs for structural changes | Pass. ADR-0085 records the kind, following the ADR-0067 precedent for appending a kind. |

No violations, so Complexity Tracking is empty.

## Project Structure

### Documentation (this mission)

```
kitty-specs/operating-model-templates-01M84X0R/
├── spec.md
├── plan.md            # this file
├── research.md        # decisions D1–D8
├── data-model.md      # Role page, Template record, preset
├── quickstart.md      # the author's walkthrough, used as acceptance smoke
├── contracts/
│   └── cli.md         # new-doc --template, scaffold --preset
└── checklists/requirements.md
```

### Source Code (repository root)

```
src/lib/vocabulary-core.mjs                  # KINDS += 'Role'
src/scripts/validate-frontmatter.mjs         # kind: Role requiredness
src/lib/operating-model-templates.mjs        # NEW manifest + pure renderer
src/lib/templates/operating-model/*.md       # NEW 12 template bodies
src/lib/templates/operating-model/sections.snippet.yaml  # NEW preset snippet
src/scripts/new-doc.mjs                      # --template <id>
src/scripts/scaffold.mjs                     # --preset operating-model
src/tests/role-kind.test.ts                  # NEW
src/tests/operating-model-templates.test.ts  # NEW (manifest, renderer, gate, NFR-004)
src/tests/stub-tools-templates.test.ts       # NEW (CLI emission, no-overwrite)
src/tests/vocabulary-core.test.ts            # KINDS list now 16
docs/adr/0085-role-kind.md                   # NEW
docs/guides/operating-model.md               # NEW guide
docs/context/convention.md, docs/architecture/metadata-model.md  # add Role to the kind lists
docs/changelog/unreleased/402-operating-model-templates.md      # NEW fragment
```

**Structure Decision**: single project. Template bodies live under `src/lib/`, which the package already ships (`files` includes `lib`), so no `package.json` change is needed (research D2).

## Complexity Tracking

None.

## Implementation Concern Map

### IC-01 — Role kind and its rule

- **Purpose**: make `Role` a canonical kind, with `role` and `responsibilities` required, and record it in ADR-0085.
- **Relevant requirements**: FR-001, FR-002, FR-003, FR-004; C-002, C-003, C-004
- **Affected surfaces**: `src/lib/vocabulary-core.mjs`, `src/scripts/validate-frontmatter.mjs`, `src/tests/vocabulary-core.test.ts`, new `src/tests/role-kind.test.ts`, `docs/adr/0085-role-kind.md`, the kind lists in `docs/context/convention.md` and `docs/architecture/metadata-model.md`
- **Sequencing/depends-on**: none
- **Risks**: any snapshot or count of KINDS elsewhere (the vocabulary-core test pins 15). The mcp package derives kinds and does not list them, so a full `pnpm test` is needed to catch drift.

### IC-02 — Template set and renderer

- **Purpose**: the 12 templates as manifest records plus Markdown bodies, and a pure renderer that builds a valid page.
- **Relevant requirements**: FR-005, FR-006, FR-011, FR-012; NFR-003, NFR-004; C-001
- **Affected surfaces**: new `src/lib/operating-model-templates.mjs`, new `src/lib/templates/operating-model/*.md`, new `src/tests/operating-model-templates.test.ts`
- **Sequencing/depends-on**: IC-01, because the Role template must pass the gate
- **Risks**: the markdownlint and link-check globs might pick up the template bodies. Exclude them, or make sure they pass. The renderer must emit YAML the gate parses, so quote titles that contain a colon.

### IC-03 — Stub-tool flags

- **Purpose**: `new-doc.mjs --template <id>` and `scaffold.mjs --preset operating-model`, keeping never-overwrite.
- **Relevant requirements**: FR-007, FR-008, FR-009, FR-014
- **Affected surfaces**: `src/scripts/new-doc.mjs`, `src/scripts/scaffold.mjs`, new `src/tests/stub-tools-templates.test.ts`
- **Sequencing/depends-on**: IC-02
- **Risks**: changing default output by accident. Pin the no-template output byte for byte before editing (FR-014).

### IC-04 — Section preset, guide and changelog

- **Purpose**: the opt-in `sections.yaml` snippet, the "Documenting your operating model" guide and the changelog fragment.
- **Relevant requirements**: FR-010, FR-013; NFR-005; C-005, C-006
- **Affected surfaces**: `src/lib/templates/operating-model/sections.snippet.yaml`, `docs/guides/operating-model.md`, `docs/guides/README.md` (the guides list), `docs/changelog/unreleased/402-operating-model-templates.md`
- **Sequencing/depends-on**: IC-03, so that the guide documents the real flags
- **Risks**: the snippet drifting from the registry schema. A test parses it with the real registry loader.
