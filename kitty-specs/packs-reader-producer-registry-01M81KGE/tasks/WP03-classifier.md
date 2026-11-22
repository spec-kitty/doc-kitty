---
work_package_id: WP03
title: Classifier held to the conformance cases
dependencies:
- WP02
requirement_refs:
- FR-004
- SC-001
planning_base_branch: feat/330-packs-reader-producer-registry
merge_target_branch: feat/330-packs-reader-producer-registry
branch_strategy: Planning artifacts for this mission were generated on feat/330-packs-reader-producer-registry. During /spec-kitty.implement this WP may branch from a dependency-specific base, but completed changes must merge back into feat/330-packs-reader-producer-registry unless the human explicitly redirects the landing branch.
base_branch: kitty/mission-packs-reader-producer-registry-01M81KGE
base_commit: e3b2d83b8a3a00a1164295fd4fc38fc9e72fc31e
created_at: '2026-11-22T13:27:10.119559+00:00'
subtasks:
- T010
- T011
- T012
agent: claude
history:
- timestamp: '2026-11-22T12:40:00Z'
  agent: planner-priti
  action: Prompt generated via /spec-kitty.tasks
agent_profile: node-norris
authoritative_surface: src/lib/packs/classify.mjs
create_intent:
- src/lib/packs/classify.mjs
- src/tests/packs-classify.test.ts
execution_mode: code_change
owned_files:
- src/lib/packs/classify.mjs
- src/tests/packs-classify.test.ts
role: implementer
---

# WP03 — Classifier held to the conformance cases

## ⚡ Do This First: Load Agent Profile

Load the assigned profile before reading anything else: run `/spk-charter-profile-load node-norris`.

## Objective

Reimplement **classification only** (ADR-0079 D1) and hold it to the vendored
`conformance/classifier-cases.yaml` (FR-004, SC-001). The classifier is pure:
`(path, contract) → Classification`.

## Branch strategy

Planning branch and final merge target: `feat/330-packs-reader-producer-registry`.
Run `spec-kitty agent action implement WP03 --agent claude --mission packs-reader-producer-registry-01M81KGE`.

## Context

The authoritative statement is the header of
`src/lib/packs/contract/conformance/classifier-cases.yaml` (vendored by WP02). Read
it in full. Summary (`research.md` R4):

- Paths are relative to the directory holding the pack directories, `/`-separated.
- `*` matches within one segment, a leading dot included; `**/` matches zero or
  more whole segments; every other character is literal. No trailing `**`.
- Order:
  1. `files`, `exclusions`, `retired`: first match in table order; a `retired`
     match beats a `files` match unless an `exclusions` rule also matches.
     Concretely: `f` = first files match, `e` = first exclusions match,
     `r` = first retired match. If `f && r && !e` → retired(r). Else `f` →
     mapped(f). Else `e` → excluded(e). Else `r` → retired(r).
  2. `payloads`: first match → mapped (kind and content form from the rule, no schema).
  3. Root case variant: a root rule is a `files` or `retired` rule whose glob is
     `*/<name>` with no `*` or `/` in `<name>`. A two-segment path whose second
     segment equals `<name>` ignoring case (and differs in case, since an exact
     match was caught in step 1) → retired, rule = that root rule's glob.
  4. `ignored`, matched case-insensitively, **except** when a `files`, `retired`
     or `payloads` rule matches with path and glob both lower-cased → `unmodelled`.
  5. Otherwise `unmodelled`.
- Mapped by a `files` rule: `kind` = the rule's `schema`, `schema` =
  `schemas/<schema>.schema.json`, `contentForm` = the rule's `content_form`
  (default `yaml`). Mapped by a payload: `kind` and `content_form` from the rule,
  no `schema`.

## Subtasks

### T010 — Glob compiler

`compileGlob(glob, {caseInsensitive})` → `RegExp`. Build from tokens:
`**/` → `(?:[^/]+/)*`, `*` → `[^/]*`, everything else escaped. Anchor `^…$`.
Unit-test edge cases: `*/pack.yaml` vs `core/sub/pack.yaml` (no match);
`**/*.tactic.yaml` vs `core/a.tactic.yaml` and `core/x/y/z/a.tactic.yaml` (match);
`*/assets/**/.*` vs `core/assets/.DS_Store` (match); `built-in.source.yaml` (one segment).

### T011 — `classify(path, contract)`

```js
/** @returns {{expect:'mapped'|'excluded'|'retired'|'unmodelled', rule?: string,
 *   kind?: string, schema?: string, contentForm?: string, reason?: string}} */
export function classify(path, fileKinds) {...}
export function createClassifier(fileKinds) // precompiles the globs once; returns path => Classification
```

`fileKinds` is `loadContract().fileKinds`. Precompile in `createClassifier` and
cache per `fileKinds` object (a `WeakMap`). Carry `reason` for exclusions,
retired and ignored rules (used in problem messages).

### T012 — Conformance test (`src/tests/packs-classify.test.ts`)

- Load the vendored cases with `yaml`. `it.each` over every case: assert
  `expect`, `rule` (absent for `unmodelled`), `kind`, `schema`, `content_form`
  exactly as the case gives them (absent keys must be absent in the result).
- Rule coverage: every `match` of `files`, `exclusions`, `retired`, `payloads`
  and `ignored` appears as some case's `rule` (mirrors the charter's own
  `ClassifierConformanceTest`). Fail naming the uncovered rule.
- The case count is at least 80 (guards against a truncated file read).
- Red first: write the test against a stub that returns `unmodelled`, see it
  fail, then implement.

## Definition of Done

- 100% of cases pass; lint, typecheck and the full unit suite clean.

## Risks

- Case-insensitive step 4 and its lower-case exception (`core/toolguides/a.guide.MD`
  → unmodelled; `core/docs/NOTES.MD` → excluded).
- Step-3 variant `core/PACK.yaml` → retired under `*/pack.yaml` (a `files` rule).
