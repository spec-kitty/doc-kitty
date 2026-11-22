---
work_package_id: WP04
title: readPack and PackModel
dependencies:
- WP03
requirement_refs:
- FR-005
- FR-006
- FR-007
- FR-008
- FR-009
- FR-010
- FR-011
- NFR-002
- SC-003
- C-002
planning_base_branch: feat/330-packs-reader-producer-registry
merge_target_branch: feat/330-packs-reader-producer-registry
branch_strategy: Planning artifacts for this mission were generated on feat/330-packs-reader-producer-registry. During /spec-kitty.implement this WP may branch from a dependency-specific base, but completed changes must merge back into feat/330-packs-reader-producer-registry unless the human explicitly redirects the landing branch.
subtasks:
- T013
- T014
- T015
- T016
- T017
- T018
- T019
agent: claude
history:
- timestamp: '2026-11-22T12:40:00Z'
  agent: planner-priti
  action: Prompt generated via /spec-kitty.tasks
agent_profile: node-norris
authoritative_surface: src/lib/packs/read.mjs
create_intent:
- src/lib/packs/read.mjs
- src/lib/packs/readme.mjs
- src/lib/packs/index.mjs
- src/tests/packs-read.test.ts
- src/tests/packs-readme.test.ts
execution_mode: code_change
owned_files:
- src/lib/packs/read.mjs
- src/lib/packs/readme.mjs
- src/lib/packs/index.mjs
- src/tests/packs-read.test.ts
- src/tests/packs-readme.test.ts
- src/tests/fixtures/packs/**
role: implementer
---

# WP04 — `readPack` and `PackModel`

## ⚡ Do This First: Load Agent Profile

Load the assigned profile before reading anything else: run `/spk-charter-profile-load node-norris`.

## Objective

Build the tolerant reader of ADR-0079 D3 and D4:
`readPack(dir, options) → PackModel` (FR-005 to FR-011, NFR-002, SC-003). It never
throws on pack content: every irregularity is a `problems[]` warning. The only
throw is a broken contract snapshot (from `loadContract`) or a `dir` that is not a
directory.

## Branch strategy

Planning branch and final merge target: `feat/330-packs-reader-producer-registry`.
Run `spec-kitty agent action implement WP04 --agent claude --mission packs-reader-producer-registry-01M81KGE`.

## Context

- `data-model.md` (field rules, problem codes); `contracts/pack-model.schema.json`.
- `research.md` R5 (membership) and R6 (artefact ids).
- WP02's `loadContract`, WP03's `createClassifier`.
- open-packs layout for orientation: `https://github.com/spec-kitty/spec-kitty-open-packs`
  `packs/<dir>/` (pack.yaml, README.md, pack-manifest.yaml, presets/, policy.yaml,
  one folder per kind). Its manifests list a `routing_catalog` kind the pinned
  contract lacks: that must be a warning.

## API

```js
/**
 * @param {string} dir the pack directory
 * @param {{ contract?: string | LoadedContract, charterLock?: string, repoRoot?: string }} [options]
 * @returns {PackModel}
 */
export function readPack(dir, options = {}) {...}
```

`contract` is a snapshot directory or an already loaded contract (default: the
vendored one). `charterLock` is a path to a YAML file with a `commit` key.
`repoRoot` (default `process.cwd()`) makes `path` repository-relative.

## Subtasks

### T013 — Fixtures (`src/tests/fixtures/packs/`) [P]

Four source roots, each holding one pack directory (the classifier path is
`<packdir>/<rel>`):

- `with-manifest/alpha/`: `pack.yaml` (pack_id, name `alpha-pack`, pack_version,
  pack_level `org`, depends_on one entry with range, mutability_policy
  `policy.yaml`), `README.md` (frontmatter, H1, preamble, two H2 sections),
  `policy.yaml` (kind_defaults + artifacts), `presets/minimal.yaml`,
  `directives/a.directive.yaml` (id `a`), `tactics/t.tactic.yaml` (id `t`, **CRLF line
  endings**; WP02 marks `src/tests/fixtures/packs/** -text`, so git keeps them), `templates/spec.md` (template payload), `pack-manifest.yaml` whose
  constituents and preset carry the **correct** hashes (compute them with a
  small script; record how in a comment in the test).
- `no-manifest/beta/`: pack.yaml (no depends_on), README with no H1, one
  directive, no manifest, no policy.
- `retired-file/gamma/`: pack.yaml, README, `pack.md` (retired), `notes.txt`
  (unmodelled), `docs/notes.md` (ignored: no problem).
- `stale-manifest/delta/`: a manifest listing a missing file, one wrong hash, and
  missing a directive that is on disk.

### T014 — README parser (`src/lib/packs/readme.mjs`) [P]

`parsePackDocument(source) → { frontmatter?, title?, preamble, sections[], problems[] }`.

- Frontmatter: `gray-matter`; keep it as an object (omit when empty or absent).
- Parse the body with `unified().use(remarkParse)` (both are dependencies); walk
  top-level children only. Use `position.start.offset` to slice the source.
- If the first top-level node is a depth-1 heading → `title` = its plain text
  (concatenate `value` of text and inlineCode descendants).
- Preamble: the source between the title (or the start) and the first depth-2
  heading, trimmed of surrounding blank lines.
- Each depth-2 heading → `{ title, content }`, content = source up to the next
  depth-2 heading, trimmed of surrounding blank lines.
- A depth-1 heading anywhere else → problem `readme-ambiguous-heading` (it stays
  in the content).
- Normalise CRLF to LF before parsing. `src/tests/packs-readme.test.ts` covers:
  no H1, H1 + no sections, frontmatter, a `##` inside a fenced code block (not a
  section), a second H1, setext headings.

### T015 — Descriptor, presets, policy

- `pack.yaml` missing → problem `descriptor-missing`; unparsable →
  `descriptor-unreadable`. Identity defaults: `packId: ''`, `name: dir`,
  `version: ''`, `dependsOn: []`.
- Keys not in `schemas['pack-descriptor'].properties` → `descriptor-unknown-key`
  (one problem per key). A missing required key (from the schema's `required`)
  → `descriptor-missing-key`. `schema_version` present and not `"1.0"` →
  `descriptor-schema-version`.
- Identity mapping: `pack_id → packId`, `name`, `pack_version → version`,
  `pack_level → level`, `parent_pack → parent` (present only when the key is
  present), `depends_on[] → dependsOn[{packId, range}]`, `schema_version → schemaVersion`.
- Presets: files the classifier maps to kind `preset`; `name` = the YAML `id`
  when it parses, else the stem; sorted by path.
- Policy: when `mutability_policy` is set, read `<dir>/<value>` (refuse a value
  that escapes the pack: problem `policy-missing`). Missing → `policy-missing`,
  unparsable → `policy-unreadable`. `kindDefaults` = `kind_defaults ?? {}`,
  `artifacts` = `artifacts ?? {}`.

### T016 — Walk, classification problems, inventory from the walk

- Recursive walk of `dir` with `readdirSync({withFileTypes:true})`, sorted.
  Skip `.git` directories. A symlink → problem `symlink`, never followed.
- Classify `<basename(dir)>/<rel>`. `retired` → problem `retired` (message names
  the rule and its reason); `unmodelled` → problem `unmodelled`. Excluded and
  ignored files produce nothing.
- Constituent candidates (`research.md` R5): mapped files whose kind, with `-`
  written as `_`, is in `fileKinds.artifact_kinds`. Artefact id (R6): YAML `id`
  when it parses; for `template`, the path below `templates/`, prefixed
  `<type>/` for `missions/<type>/templates/`; else the stem before the kind suffix.
- Walk inventory: group candidates by artefact kind token.

### T017 — Manifest verification

- `pack-manifest.yaml` absent → no `manifest`. Unparsable → `manifest-unreadable`,
  no `manifest`.
- For each constituent and preset entry: the file missing → `manifest-missing-file`;
  hash (`sha256` of bytes with `\r\n` and lone `\r` replaced by `\n`, lower hex)
  differs → `manifest-hash-mismatch`. A constituent `kind` not in
  `artifact_kinds` → `manifest-unknown-kind` (still a member, not a mismatch).
- A candidate on disk not listed → `manifest-unlisted`; a preset file not listed
  → `manifest-unlisted`.
- `schema_version` not `"1.0"` → `manifest-schema-version`.
- `verified` = no missing file, no hash mismatch, no unlisted file.
- `manifest.constituents` = entries mapped to `{kind, id, path, contentHash}`
  (as written). `hash` = `manifest_hash` as written.
- Inventory: `source: 'manifest'` and kinds from the manifest's constituents only
  when `verified`; else the walk inventory with `source: 'file-kinds'`.

### T018 — Contract commits, charterLock, ordering

- `contract.readWith` = the snapshot lock's `commit`.
- `charterLock`: read YAML; `commit` a string → `provenAgainst`; differs from
  `readWith` → `charter-lock-mismatch` (message names both). Missing, unreadable or
  no `commit` → `charter-lock-unreadable`, no `provenAgainst`.
- Append the contract's own `warnings` (unknown key, unknown content form) to
  `problems` with no `file`.
- Sort `problems` by `file` (absent first), then `code`, then `message`. Sort
  inventory kinds and ids by code unit. Emit object keys in the D4 order, so
  `JSON.stringify` is byte-stable (NFR-002).

### T019 — Public surface and model tests

- `src/lib/packs/index.mjs` re-exports `readPack`, `parsePackDocument`,
  `loadContract`, `verifyContractLock`, `createClassifier`, `classify`.
- `src/tests/packs-read.test.ts` (write red first, fixture by fixture):
  - alpha: full identity; `document.title`; two sections; policy mapped;
    `presets` one entry; `manifest.verified === true`; `inventory.source === 'manifest'`;
    `problems` empty; the CRLF tactic's recomputed hash matches its manifest entry.
  - beta: no `manifest`; `inventory.source === 'file-kinds'`; no `document.title`; no problems.
  - gamma: exactly a `retired` problem for `pack.md` and an `unmodelled` problem for `notes.txt`.
  - delta: `verified === false`, `inventory.source === 'file-kinds'`, and exactly
    one each of `manifest-missing-file`, `manifest-hash-mismatch`, `manifest-unlisted`.
  - charterLock: a temp lock with another commit → `charter-lock-mismatch` and
    both commits on the model; the same commit → no problem.
  - Determinism: two reads give identical `JSON.stringify` output.
  - Robustness: a temp pack with an unparsable `pack.yaml`, a binary file, an
    empty README and a symlink reads without throwing.
  - Shape: validate the alpha model against `contracts/pack-model.schema.json`?
    No JSON Schema validator is a dependency: assert the keys instead.

## Definition of Done

- All tests red first, green after; lint, typecheck and full unit suite clean.

## Risks

- Hash recipe: CRLF **and** lone CR become LF before hashing.
- Do not validate against the schemas (C-002): the schemas supply key lists only.
