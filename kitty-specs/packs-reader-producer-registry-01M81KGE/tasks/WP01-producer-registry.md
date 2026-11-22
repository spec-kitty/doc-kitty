---
work_package_id: WP01
title: Producer registry and ownership scopes
dependencies: []
requirement_refs:
- FR-015
- FR-016
- FR-017
- NFR-004
- SC-004
planning_base_branch: feat/330-packs-reader-producer-registry
merge_target_branch: feat/330-packs-reader-producer-registry
branch_strategy: Planning artifacts for this mission were generated on feat/330-packs-reader-producer-registry. During /spec-kitty.implement this WP may branch from a dependency-specific base, but completed changes must merge back into feat/330-packs-reader-producer-registry unless the human explicitly redirects the landing branch.
subtasks:
- T001
- T002
- T003
- T004
- T005
agent: claude
history:
- timestamp: '2026-11-22T12:40:00Z'
  agent: planner-priti
  action: Prompt generated via /spec-kitty.tasks
agent_profile: node-norris
authoritative_surface: src/lib/producers.mjs
create_intent:
- src/lib/producers.mjs
- src/lib/producer-output.mjs
- src/tests/producers.test.ts
- src/tests/producer-output.test.ts
execution_mode: code_change
owned_files:
- src/lib/producers.mjs
- src/lib/producer-output.mjs
- src/lib/generator-stamp.mjs
- src/scripts/validate-frontmatter.mjs
- src/lib/gherkin/generate.mjs
- src/tests/producers.test.ts
- src/tests/producer-output.test.ts
role: implementer
---

# WP01 — Producer registry and ownership scopes

## ⚡ Do This First: Load Agent Profile

Load the assigned profile before reading anything else: run `/spk-charter-profile-load node-norris` (the `spk-charter-profile-load` skill). Act within its boundaries for the whole WP.

## Objective

Replace the Gherkin and glossary special cases with one **producer registry**
(ADR-0079 D6, decisions D1 and D2 in `research.md`). Each producer declares a
**role** (`ownership` or `provenance`) and, for an ownership producer, an
**ownership scope** (a whole section, or directories within one section,
optionally restricted to page kinds). `PRODUCERS`, `isGeneratedStamp`,
`isRegenerableStamp`, `isGeneratedPage` and the Gherkin output scan read the
registry. **Every existing test passes without being edited** (NFR-004, SC-004).

Keep it generic: #359 (generated-section contract) and #413 (`doc-kitty-missions`,
`doc-kitty-ops`, each whole-section) and #338 (`doc-kitty-packs`, directories)
register producers later. This WP registers no new producer in the built-in set.

## Branch strategy

Planning branch and final merge target: `feat/330-packs-reader-producer-registry`.
The execution worktree is allocated per computed lane from `lanes.json`; run
`spec-kitty agent action implement WP01 --agent claude --mission packs-reader-producer-registry-01M81KGE`
and work in the worktree it prints.

## Context

- `src/lib/generator-stamp.mjs`: `GHERKIN_PRODUCER`, `GLOSSARY_PRODUCER`,
  `PRODUCERS`, `SCAFFOLD_PRODUCER`, `RETIRED_STAMP_BY_PRODUCER`, `REGENERATE_HINT`,
  `isRegenerableStamp`, `stampProducer`, `regenerateHint`, `isGeneratedStamp`.
- `src/scripts/validate-frontmatter.mjs:141` `isGeneratedPage(relPath, data)`:
  Gherkin stamp anywhere, or glossary path-and-kind rule. `validate()` uses it.
- `src/lib/gherkin/generate.mjs` `scanOutputDir(outDir)` and `isOwnedPage(contents)`.
- Tests that must stay green unedited: `src/tests/schema-validator-parity.test.ts`,
  `src/tests/legacy-stamp-removal.test.ts`, `src/tests/gherkin-generate.test.ts`,
  and every `glossary-*.test.ts`.
- **Coordination**: PR #410 changes `makeStamp` in `generator-stamp.mjs`. Do not
  touch `makeStamp`, `serializeStamp`, `feedInstant`, `okfGenerated` or
  `stampContentHash`. Edit only the producer lookups.

## Subtasks

### T001 — Red tests (`src/tests/producers.test.ts`)

Write these first and watch them fail (the module does not exist yet):

1. `PRODUCER_REGISTRY.ids('ownership')` equals `['doc-kitty-gherkin', 'doc-kitty-glossary']`
   and `ids('provenance')` equals `['doc-kitty-scaffold']`. `PRODUCERS` in
   `generator-stamp.mjs` equals the ownership ids.
2. `inScope`:
   - `{type:'section'}` matches `behaviour/a.md` and `x/y/z.md`, not `README.md` (root).
   - `{type:'section', section:'behaviour'}` matches `behaviour/a/b.md`, not `other/a.md`, not `behaviourx/a.md`.
   - `{type:'section', section:'glossary', kinds:['Glossary','Hub']}` matches `glossary/x.md` with kind `Glossary`, not with kind `Reference`.
   - `{type:'directories', section:'packs', dirs:['qa','built-in']}` matches `packs/qa/index.md` and `packs/qa/x/y.md`, not `packs/index.md`, not `packs/qaz/index.md`, not `other/qa/index.md`.
3. **Positive control** (the do-nothing guard for SC-004): build a registry with a
   test-only `{id:'test-packs', role:'ownership', scope:{type:'directories', section:'packs', dirs:['qa']}}`.
   A page `packs/qa/index.md` stamped `test-packs/1.0.0` is owned by `test-packs`;
   the same stamp on `packs/other/index.md` or `guides/x.md` is owned by nobody;
   an unstamped page in `packs/qa/` is owned by nobody.
4. `ownerOfPage` with the built-in registry:
   - `behaviour/shipping/a.md` stamped `doc-kitty-gherkin/9.9.9` → `doc-kitty-gherkin`.
   - the same with `{scopes:{'doc-kitty-gherkin':{type:'section', section:'features'}}}` → `undefined`.
   - root `README.md` stamped `doc-kitty-gherkin/9.9.9` → `undefined`.
   - `glossary/x.md` kind `Glossary`, no stamp → `doc-kitty-glossary`.
   - `guides/x.md` stamped `doc-kitty-glossary/9.9.9` → `undefined`.
   - any page stamped `doc-kitty-scaffold/9.9.9` → `undefined`.
5. `createProducerRegistry` throws on a duplicate id, on an ownership producer
   with no scope, on a provenance producer with a scope, and on an unknown scope type.

### T002 — `src/lib/producers.mjs`

fs-free ES module with JSDoc types (it is imported by `validate-frontmatter.mjs`,
which runs in bare Node, and by build-time code).

```js
/** @typedef {{type:'section', section?: string, kinds?: string[]}
 *   | {type:'directories', section: string, dirs: string[], kinds?: string[]}} OwnershipScope */
/** @typedef {{id: string, role: 'ownership'|'provenance', scope?: OwnershipScope,
 *   recognition?: 'stamp-and-scope'|'scope', retiredBy?: string, regenerateHint?: string}} Producer */
export function inScope(scope, relPath, kind) {...}
export function createProducerRegistry(entries) {...} // returns a frozen object
export const PRODUCER_REGISTRY = createProducerRegistry([...]);
```

- `recognition` defaults to `'stamp-and-scope'`. A page is owned by producer P when
  `inScope(scopeFor(P), relPath, data.kind)` and (recognition is `'scope'` or the
  page's `generated.by` is P's versioned stamp: starts with `${id}/` and is
  longer than the prefix).
- `scopeFor(P)` is `options.scopes?.[P.id] ?? P.scope`.
- Path rules: `relPath` is POSIX, relative to the docs root. Split on `/`; a
  section scope needs at least two segments and, when `section` is set, the
  first segment equal to it. A directories scope needs at least three segments,
  `segments[0] === section` and `dirs.includes(segments[1])`.
- Built-in entries, in this order:
  - gherkin: `{id:'doc-kitty-gherkin', role:'ownership', scope:{type:'section'}, retiredBy:'doc-kitty/gherkin', regenerateHint:'run `dockitty-generate-feature-pages`'}`
  - glossary: `{id:'doc-kitty-glossary', role:'ownership', scope:{type:'section', section:'glossary', kinds:['Glossary','Hub']}, recognition:'scope', retiredBy:'doc-kitty/glossary', regenerateHint:'run `astro build` or `astro dev`, which rewrites the glossary pages'}`
  - scaffold: `{id:'doc-kitty-scaffold', role:'provenance'}`
- Registry methods: `ids(role?)`, `get(id)`, `producerOfStamp(by)` (ownership
  producers only; the versioned stamp), `retiredProducerOf(by)` (the producer
  whose `retiredBy` equals `by`), `ownerOfPage(relPath, data, options?)`.
- Document the module header: what the registry is, the two roles, the rule
  "a stamp alone never exempts a page", and that later producers register here
  (#338 packs, #359, #413).

### T003 — `generator-stamp.mjs`

- Keep exporting `GHERKIN_PRODUCER`, `GLOSSARY_PRODUCER`, `SCAFFOLD_PRODUCER` (as
  string constants, or read from the registry; keep the names).
- `PRODUCERS` becomes `Object.freeze(PRODUCER_REGISTRY.ids('ownership'))`.
- `RETIRED_STAMP_BY_PRODUCER`, `RETIRED_STAMP_BY` and `REGENERATE_HINT` derive from
  the registry's `retiredBy` and `regenerateHint`.
- `isGeneratedStamp`, `isRegenerableStamp`, `stampProducer`, `regenerateHint` keep
  their exact behaviour and messages (`retiredStampProblem` messages are pinned by
  tests). Diff-minimal: do not restructure the rest of the file.

### T004 — `validate-frontmatter.mjs`

- `isGeneratedPage(relPath, data, options = {})` returns
  `PRODUCER_REGISTRY.ownerOfPage(relPath, data, { scopes: options.producerScopes }) !== undefined`.
- `validate(relPath, data, options)` accepts `producerScopes` and passes it on.
- Update the JSDoc: the registry, both recognisers, the scope narrowing, and why
  the Gherkin scope is any one section by default (the gate does not evaluate
  `gherkin.section`; decision D1).
- Remove the now-unused `GHERKIN_PRODUCER`/`isGeneratedStamp` import if unused.

### T005 — `src/lib/producer-output.mjs` and the Gherkin scan

- `scanProducerOutput(outDir, producerId)` → `{owned, authored}`: the body of
  today's `scanOutputDir`, generic over the producer (owned = `.md` whose
  frontmatter parses and whose `generated.by` passes `isRegenerableStamp(by, producerId)`).
  Same symlink, dotfile and sort rules. Uses `gray-matter`.
- `isProducerOwnedPage(contents, producerId)` exported for the planned-page defence.
- In `gherkin/generate.mjs`, `scanOutputDir(outDir)` returns
  `scanProducerOutput(outDir, GHERKIN_PRODUCER)` and `isOwnedPage(contents)` calls
  `isProducerOwnedPage(contents, GHERKIN_PRODUCER)`. Keep `scanOutputDir`
  exported with the same signature (tests import it).
- `src/tests/producer-output.test.ts`: a temp dir with a stamped page, an
  authored page, a retired-stamp page (owned, regenerable), a page of another
  producer (authored for this producer), a symlink (authored) and a dotfile
  (ignored).

## Definition of Done

- New tests red before, green after; `cd src && npx vitest run` fully green
  with no existing test edited.
- `pnpm lint` and `pnpm typecheck` clean, no suppressions.
- `git diff origin/main -- src/lib/generator-stamp.mjs` touches only the producer
  lookups.

## Risks and reviewer guidance

- Reviewer: confirm the positive control fails if `inScope` returns `true`
  unconditionally, and that a scaffold stamp never owns a page.
- Confirm `validate()` results for every existing fixture are unchanged (the
  full suite covers this).
