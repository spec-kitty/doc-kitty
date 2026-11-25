---
work_package_id: WP04
title: dockitty-pdf CLI, post-pass, PDF gate and determinism
dependencies:
- WP03
requirement_refs:
- FR-020
- FR-021
- FR-022
- FR-023
- NFR-001
- NFR-004
- SC-003
- SC-004
- C-005
planning_base_branch: feat/print-pdf-output
merge_target_branch: feat/print-pdf-output
branch_strategy: Planning artifacts for this mission were generated on feat/print-pdf-output. During /spec-kitty.implement this WP may branch from a dependency-specific base, but completed changes must merge back into feat/print-pdf-output unless the human explicitly redirects the landing branch.
subtasks:
- T020
- T021
- T022
- T023
- T024
- T025
history:
- timestamp: '2026-11-20T18:20:00Z'
  agent: claude
  action: Prompt generated via /spec-kitty.tasks
agent_profile: node-norris
authoritative_surface: src/scripts/
create_intent:
- src/scripts/dockitty-pdf.mjs
- src/scripts/pdf-postprocess.mjs
- src/scripts/pdf-inspect.mjs
- src/scripts/assert-pdf-artifacts.mjs
- src/scripts/assert-pdf-determinism.mjs
- src/tests/pdf-postprocess.test.ts
- src/tests/pdf-inspect.test.ts
- src/tests/dockitty-pdf.test.ts
execution_mode: code_change
owned_files:
- src/scripts/dockitty-pdf.mjs
- src/scripts/pdf-postprocess.mjs
- src/scripts/pdf-inspect.mjs
- src/scripts/assert-pdf-artifacts.mjs
- src/scripts/assert-pdf-determinism.mjs
- src/tests/pdf-postprocess.test.ts
- src/tests/pdf-inspect.test.ts
- src/tests/dockitty-pdf.test.ts
- package.json
role: implementer
tags: []
tracker_refs: []
---
# Work Package Prompt: WP04 – dockitty-pdf CLI, post-pass, PDF gate and determinism

## ⚡ Do This First: Load Agent Profile

Before reading further or touching anything, load your assigned profile:

- Use the `/spk-charter-profile-load` skill with `node-norris`, or run
  `spec-kitty agent profile show node-norris`.
- Then load the action context: `spec-kitty charter context --action implement --json`.

## Branch Strategy

Planning branch, base and final merge target: `feat/print-pdf-output`. The mission topology is `single_branch`, so no lane worktree is allocated: implement in the repository root checkout on `feat/print-pdf-output`.

Implementation command:

```bash
spec-kitty agent action implement WP04 --agent claude --mission print-pdf-output-01M7X19V
```

## Objective

Deterministic, tagged PDFs from the built print routes, with a structure gate and a determinism check (#392–#395). Requirements: FR-020–FR-023, NFR-001, NFR-004. Contract: `contracts/dockitty-pdf-cli.md`.

Out-of-map: the `bin` entry in `src/package.json` (owned by WP03), recorded.

## Subtasks

### T020 `pdf-inspect.mjs`

Node-built-ins reader for Skia PDFs: find `startxref`, parse classic xref tables across `/Prev` chains (latest object wins), read objects by number, resolve the trailer `/Root` and `/Info`. Expose `inspectPdf(buf) → { pages, lang, tagged: {structTreeRoot, markInfo}, outline: tree of titles, info }`. Count pages via `/Type /Pages /Count`. Outline: walk `/Outlines /First` and `/Next`, children via `/First`. Decode PDF strings (literal with escapes, hex `<FEFF…>` UTF-16BE).

### T021 `pdf-postprocess.mjs`

`pinPdf(buf, { epochSeconds, title, producer })`: overwrite each `/CreationDate (D:…)` and `/ModDate (D:…)` value in place with the same-width `D:YYYYMMDDHHmmSS+00'00'`; then append an incremental update: new Info object (next object number = trailer `/Size`), `xref` subsection for it, trailer with `/Size`, `/Root`, `/Info`, `/Prev <old startxref>`, `startxref`, `%%EOF`. Refuse (throw) when no classic `xref` is present. Output is a pure function of input and arguments.

### T022 `dockitty-pdf.mjs`

Arguments `--dist`, `--base`, `--sections`, `--out`, `--timeout`. Reads `<dist>/print/manifest.json`. Static server (Node `http`, base-mounted like `tests/a11y/serve-dist.mjs`, ephemeral port). Chromium from `playwright` (dynamic import; missing → exit 2). For each document: new context, `addInitScript` setting `localStorage['starlight-theme']='light'`, goto, `document.documentElement.dataset.theme='light'`, `emulateMedia({ media: 'print' })`, `document.fonts.ready`, wait for `html[data-dk-diagram-theme="light"]` when `pre.mermaid` exists (timeout → exit 1 with the route named; superseded 2026-11-25 by the `data-processed` wait and a fixed-seed `Math.random`, see research.md "Rework for SC-004"), `page.pdf({ tagged: true, outline: true, preferCSSPageSize: true, printBackground: false })` (FR-005: only the `print-color-adjust: exact` elements keep their fills), `pinPdf`. Date: `SOURCE_DATE_EPOCH` else `git log -1 --format=%ct` else exit 2. Version from `src/package.json`.

### T023 `assert-pdf-artifacts.mjs`

Per contract: manifest ⇔ `dist/pdf/*.pdf` one-to-one; a document with `pages: 0` fails; each ≥1 page, `/StructTreeRoot`, `/MarkInfo`, `/Lang` = manifest lang, outline items at depth `titleLevel - 1` = `pages`. `ok()`/`fail()` reporting like `assert-build-artifacts`.

### T024 `assert-pdf-determinism.mjs`

Run the CLI twice into two temp dirs (`--out`), same `SOURCE_DATE_EPOCH`; compare `Buffer`s; on difference print file, first differing offset and the enclosing `N G obj`. Exit 1 on difference.

### T025 Tests

Inspect a synthetic minimal PDF (hand-built string with classic xref); post-pass: dates replaced, width unchanged, incremental update readable by `inspectPdf`, idempotent bytes for same inputs; CLI argument parsing and exit codes (no dist → 2).

Root `package.json` scripts: `pdf`, `assert:pdf`, `assert:pdf-determinism` (out-of-map note: owned here).

## Definition of Done

On a locally built drafts-off example: CLI exit 0, gate passes, determinism passes; unit tests pass.
