---
work_package_id: WP02
title: ADR-0081 and the pdf configuration
dependencies: []
requirement_refs:
- FR-011
- FR-012
- FR-013
- C-002
- C-003
- C-007
- C-008
planning_base_branch: feat/print-pdf-output
merge_target_branch: feat/print-pdf-output
branch_strategy: Planning artifacts for this mission were generated on feat/print-pdf-output. During /spec-kitty.implement this WP may branch from a dependency-specific base, but completed changes must merge back into feat/print-pdf-output unless the human explicitly redirects the landing branch.
subtasks:
- T008
- T009
- T010
- T011
- T012
history:
- timestamp: '2026-11-20T18:20:00Z'
  agent: claude
  action: Prompt generated via /spec-kitty.tasks
agent_profile: node-norris
authoritative_surface: src/lib/
create_intent:
- src/lib/pdf-options.ts
- src/tests/pdf-options.test.ts
- src/tests/sections-pdf.test.ts
- docs/adr/0081-print-and-pdf-output-from-built-html-via-chromium.md
execution_mode: code_change
owned_files:
- src/lib/sections.ts
- src/lib/vocabulary-loader.mjs
- src/lib/vocabulary-core.mjs
- src/lib/pdf-options.ts
- src/lib/config.ts
- src/lib/internal-env.mjs
- src/tests/pdf-options.test.ts
- src/tests/sections-pdf.test.ts
- docs/adr/0081-print-and-pdf-output-from-built-html-via-chromium.md
role: implementer
tags: []
tracker_refs: []
---
# Work Package Prompt: WP02 – ADR-0081 and the pdf configuration

## ⚡ Do This First: Load Agent Profile

Before reading further or touching anything, load your assigned profile:

- Use the `/spk-charter-profile-load` skill with `node-norris`, or run
  `spec-kitty agent profile show node-norris`.
- Then load the action context: `spec-kitty charter context --action implement --json`.

## Branch Strategy

Planning branch, base and final merge target: `feat/print-pdf-output`. The mission topology is `single_branch`, so no lane worktree is allocated: implement in the repository root checkout on `feat/print-pdf-output`.

Implementation command:

```bash
spec-kitty agent action implement WP02 --agent claude --mission print-pdf-output-01M7X19V
```

## Objective

One resolved `pdf` model (per-section key plus site option) that every consumer reads, and ADR-0081 recording the contract (#382). Requirements: FR-011, FR-012, FR-013.

## Subtasks

### T008 `pdf` key in both registry normalizers

- `SectionRegistryEntry.pdf?: { section?: boolean; site?: 'main' | 'appendix' | 'omit' }` in `src/lib/sections.ts`; `normalizeSectionEntries` parses `true`/`false`/mapping; anything else → `warn(...)` (advisory) and dropped.
- `src/lib/vocabulary-loader.mjs` `normalizeSectionRegistryEntries` carries the same normalized `pdf` (bare Node: used by gates and the CLI). Share one pure normaliser `normalizeSectionPdf(value, warn)` in `vocabulary-core.mjs` (bare-Node safe) and import it in both.

### T009 `src/lib/pdf-options.ts`

- `PdfOptionsInput { sections?: boolean; site?: boolean; exclude?: { sections?: string[]; kinds?: string[] } }`, `validatePdfOptions(input)` (`[dk-config]` errors, unknown keys throw).
- `resolvePdfOptions(input, registry)` → `ResolvedPdfOptions { sections: string[]; site: boolean; appendix: string[]; omit: string[]; excludeSections: string[]; excludeKinds: string[] }` (registry order; `excludeKinds` always starts with `Presentation`). Authored section value wins over `input.sections`. Throws when id `site` would get its own PDF. Excluded sections never get a section PDF.
- `pdfOptions()` reader of `DK_PDF_OPTIONS` (pattern of `chromeOptions()`), returning a disabled default when unset.

### T010 Config wiring

`DocKittyOptions.pdf?: PdfOptionsInput` in `config.ts`; validate early; resolve against `resolveSectionRegistry(docsRoot)`; `setInternalEnv(DK_PDF_OPTIONS_ENV, JSON.stringify(resolved))`. Add the env name to `internal-env.mjs`.

### T011 Tests

Key parsing (true/false/mapping/unknown → warning), both normalizers agree, resolution order, floor, `site` reservation, unknown-key error, env round-trip.

### T012 ADR-0081

`docs/adr/0081-print-and-pdf-output-from-built-html-via-chromium.md` from `docs/adr/template.md`, status Accepted? No: **Proposed** (operator accepts on merge, like ADR-0080). Records: context (#377 PoC), decision (print layer, Chromium from built HTML, route, CLI, post-pass), why not pandoc/WeasyPrint/Vivliostyle, the `pdf` schema and resolution order, exclusions floor and appendix placement, reserved `/print/` and `/pdf/<name>.pdf` + `/pdf/site.pdf`, determinism (dates pinned, build-clock fields for #300), whole-site PDF scope boundary vs the *Won't* manuscript type, pandoc + Typst deferred (PDF/UA, #384), the operator rulings (defaults, dist on main, A4, ordering vs #369/#370 non-blocking, whole-site yes) and the open item (lane joining `ci-ok`). Do not edit `docs/adr/README.md`.

## Definition of Done

Tests pass; `pnpm validate:adr-ids` passes; `pnpm lint` and typecheck clean.
