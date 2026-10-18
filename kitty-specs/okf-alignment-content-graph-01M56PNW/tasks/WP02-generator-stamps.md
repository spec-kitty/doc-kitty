---
work_package_id: WP02
title: Generators write versioned, stable stamps (#177)
dependencies:
- WP01
requirement_refs:
- FR-003
- FR-005
- FR-006
- NFR-001
- C-004
- C-007
- SC-004
- SC-005
planning_base_branch: feat/okf-alignment-content-graph
merge_target_branch: feat/okf-alignment-content-graph
branch_strategy: Planning artifacts for this mission were generated on feat/okf-alignment-content-graph. During /spec-kitty.implement this WP may branch from a dependency-specific base, but completed changes must merge back into feat/okf-alignment-content-graph unless the human explicitly redirects the landing branch.
base_branch: kitty/mission-okf-alignment-content-graph-01M56PNW
base_commit: adae23c84656a365fd82dd6da6c0387b172e5f04
created_at: '2026-10-18T05:49:51.703555+00:00'
subtasks:
- T007
- T008
- T009
- T010
- T011
phase: Phase 1 - Metadata alignment (#177)
agent: claude
history:
- at: '2026-10-18T12:00:00Z'
  actor: system
  action: Prompt generated via /spec-kitty.tasks
agent_profile: node-norris
authoritative_surface: src/lib/gherkin/
create_intent: []
execution_mode: code_change
model: sonnet
owned_files:
- src/lib/gherkin/feature-core.mjs
- src/lib/gherkin/generate.mjs
- src/lib/gherkin/include-scan.mjs
- src/lib/glossary/generate.ts
- src/scripts/scaffold.mjs
- src/tests/gherkin-feature-core.test.ts
- src/tests/gherkin-generate.test.ts
- src/tests/gherkin-fixture-parity.test.ts
- src/tests/glossary-generate.test.ts
- src/tests/index-basename.test.ts
- example/docs/behaviour/**
role: implementer
task_type: implement
---

# Work Package Prompt: WP02 – Generators write versioned, stable stamps (#177)

## ⚡ Do This First: Load Agent Profile

Use the `/ad-hoc-profile-load` skill to load the agent profile specified in the frontmatter, and behave according to its guidance before parsing the rest of this prompt.

- **Profile**: `node-norris`
- **Role**: `implementer`
- **Agent/tool**: `claude` (model `sonnet`)

If no profile is specified, run `spec-kitty agent profile list` and select the best match.

---

## ⚠️ IMPORTANT: Review Feedback

- Check `review_ref` in the event log (`spec-kitty agent tasks status`). Address all feedback before completing.

---

## Review Feedback

*[If this WP was returned from review, the reviewer feedback reference appears in the Activity Log below or in the status event log.]*

---

## Markdown Formatting

Wrap HTML/XML tags in backticks. Use language identifiers in code blocks.

---

## Objectives & Success Criteria

Every generator names its tool and version (SC-004) and regeneration stays byte-idempotent (NFR-001).

Done when:

- The Gherkin generator writes `generated: { by: doc-kitty-gherkin/<toolkit version>, at: <UTC instant>, content_hash: sha256:<12> }` using `makeStamp` from `src/lib/generator-stamp.mjs` (WP01).
- Rerun with unchanged input → 0 changed bytes. Source change → `at` and `content_hash` move. Version bump alone → only `by` changes, once.
- Gherkin-generated index pages (`README.md` hubs) carry `okf_version: "0.2"`.
- The glossary generator's own-page recognition (`HUB_KEYS`/`CONTEXT_KEYS` key-set match) accepts the new `generated` key; glossary pages are stamped with producer `doc-kitty-glossary`.
- The scaffold writes UTC `updated`, `okf_version` on every index it creates (not only the root), and a `human:` placeholder author.
- `example/docs/behaviour/**` regenerated once with the new stamp and committed.

## Context & Constraints

- Plan IC-02; spec FR-003 (scaffold part), FR-005, FR-006; C-004 (version from `src/package.json` only); decision 01M56PPPPDNWYZKTNYAQYWWWXN.
- Do not edit WP01 files (`generator-stamp.mjs`, `vocabulary-core.mjs`, `validate-frontmatter.mjs`). If you need a change there, report it to the orchestrator.
- The glossary previously forbade a `generated:` stamp (its C-003, see `glossary/generate.ts:153`). FR-005 overrides that; WP09 records it in the ADR-0059 addendum. Update the doc comment at `:153` to say so.

## Branch Strategy

- **Planning base branch**: feat/okf-alignment-content-graph
- **Merge target branch**: feat/okf-alignment-content-graph

## Subtasks & Detailed Guidance

### Subtask T007 – Red-first stamp assertions

- **Steps**: In `src/tests/gherkin-feature-core.test.ts` strengthen the existing frontmatter-shape assertions:
  1. `by` matches `^doc-kitty-gherkin/\d`; `at` matches the instant regex; `content_hash` matches `^sha256:[0-9a-f]{12}$`.
  2. Same input + `previous` stamp with same hash → `at` unchanged (inject `now`).
  3. Changed content → new `at`, new hash.
  4. Different toolkit version (inject) + same hash → only `by` changes.
  Confirm they fail before T008.
- **Files**: `src/tests/gherkin-feature-core.test.ts`.

### Subtask T008 – Gherkin adopts the stamp module

- **Seams (verified)**:
  - `src/lib/gherkin/feature-core.mjs:29` `GENERATED_BY = 'doc-kitty/gherkin'` → producer id `doc-kitty-gherkin` (keep an exported constant for the producer).
  - `:121` JSDoc (`at` is `sha256:<12 hex>`) → update to the new shape.
  - `:215` `shortHash` → becomes the `content_hash` value.
  - `:658` `generated: { by: GENERATED_BY, at: shortHash(hash) }` → `makeStamp(...)` with `previous` read from the existing page.
  - `:712`, `:736-737` serialisers → three keys, stable key order `by`, `at`, `content_hash`.
  - `:728` `serializeHubFrontmatter` → add `okf_version: "0.2"` to hub/index frontmatter, plus the stamp.
  - `src/lib/gherkin/generate.mjs:70,420,480,564`: detection `data?.generated?.by === GENERATED_BY` → `isGeneratedStamp(by, 'doc-kitty-gherkin')` (legacy value accepted).
  - `src/lib/gherkin/include-scan.mjs:135-140`: the parity with `GENERATED_BY` (a parity test pins the two; update `gherkin-fixture-parity.test.ts` if it pins the literal).
  - The generator must read the previous page's `generated` block to pass `previous` (it already parses the page for the refuse-to-overwrite check at `generate.mjs:420`).
- **Files**: the three gherkin modules, `src/tests/gherkin-generate.test.ts` (extend existing rerun/idempotence case).

### Subtask T009 – Glossary generator [P]

- **Seams**: `src/lib/glossary/generate.ts:153-157` (`HUB_KEYS`, `CONTEXT_KEYS`), `:248` `hasGeneratorKeys` (exact key-set equality). Add `generated` to the sets and emit a `makeStamp({producer: 'doc-kitty-glossary', ...})` stamp whose hash covers the emitted body; previous read from the existing file if present.
- **Tests**: strengthen `src/tests/glossary-generate.test.ts` (key-set recognition with the stamp; rerun byte-identical).
- **Notes**: glossary output is generated at build time; confirm whether files land in the tree (`GLOSSARY_OUTPUT_DIRNAME`, `:64`). If committed, they are owned here only if they live under `example/docs/behaviour/**` — otherwise report the path to the orchestrator before writing.

### Subtask T010 – Scaffold forms [P]

- **Seams**: `src/scripts/scaffold.mjs:114,134,166` (`updated: ${today}`) → UTC instant; `:160-162` root `okf_version` → also on every section index the scaffold creates; author placeholder `human:<you>` (or similar, commented).
- **Tests**: strengthen the scaffold assertion that already exists (grep `scaffold` in `src/tests/index-basename.test.ts`); assert every index has `okf_version: "0.2"`.

### Subtask T011 – Regenerate behaviour pages once

- **Steps**:
  1. `pnpm validate:features` (root script, `--check`) must fail before regeneration (stamps out of date).
  2. Regenerate: `node src/scripts/generate-feature-pages.mjs --root example --sources features --docs docs --section behaviour --titles hr=HR`.
  3. Run it again; `git status` must show 0 changes (NFR-001).
  4. Commit the regenerated `example/docs/behaviour/**` in this WP (C-007).
- **Ripple**: `gherkin-example.test.ts` or pinned example baselines may pin page bytes or the stamp literal; if one fails, report it — it is not in `owned_files`; note a justified out-of-map one-line update in the Activity Log.

### Post-tasks adversarial additions (must do)

- **Hash input excludes the stamp**: `content_hash` must be computed over the source content (Gherkin: the feature source hash already computed at `feature-core.mjs:215`; glossary: the emitted body plus non-`generated` frontmatter). Hashing the serialised page including `generated` makes every rerun change `at`.
- **`--check` must pass `previous` too**: `generate-feature-pages.mjs --check` compares in memory. If the check path builds the stamp without reading the on-disk `previous`, `at` becomes `now` and `pnpm validate:features` fails on every unchanged tree. Assert in `gherkin-generate.test.ts`: generate, then `--check` with no input change exits 0.
- **Glossary runs on every build** (`integrations/glossary.ts:72`, inside `astro:config:setup`) and writes into the docs tree (`example/docs/glossary/**` is committed). With `previous` read from the file, two builds are byte-stable; without it every build dirties the tree and breaks NFR-001 and the content-graph two-build diff (WP06). Assert in `glossary-generate.test.ts`: generate twice with different injected `now` → identical bytes. The committed `example/docs/glossary/**` pages change once here; they are outside `owned_files` — a justified out-of-map regeneration, record it in the Activity Log.
- **Legacy `at`** (`sha256:<12>` in the old shape) has no `content_hash`, so the first regeneration takes `now` once. Expected; note it.

## Test Strategy

- `pnpm --filter @spec-kitty/doc-toolkit test -- gherkin glossary-generate index-basename`
- Toolkit typecheck (glossary `generate.ts` is typed).
- `pnpm validate:features` green after regeneration; `pnpm validate:example` shows no stamp-related errors.

## Risks & Mitigations

- Using wall-clock time in the generator breaks determinism: `now` is used only when the hash changes.
- A release bump re-stamps `by` once on every generated page; expected (spec "Re-stamp on release").

## Review Guidance

- Reviewer runs on `opus`. Verify rerun idempotence by running the generator twice; verify `toolkitVersion()` value equals `src/package.json` `version`; verify no hand-copied stamp logic outside `generator-stamp.mjs`.

## Activity Log

- 2026-10-18T12:00:00Z – system – Prompt created.


## Brownfield scout notes

_paula-patterns scout, 2026-10-18, against a6e15e66._

- **BLOCKER (whack-a-field):** `generated.at` is read as a content HASH outside the files this WP owns: `src/lib/routes/scenario-index.ts:261-266` (`hashMatches`, strips `sha256:` and prefix-matches) and `src/lib/remark/gherkin-fence.ts:658,676` (an out-of-date warning that suppresses results). If `at` becomes an instant, every generated page counts as stale and scenario results disappear without a failure. Both readers must move to `content_hash`, falling back to the legacy `at` hash. Put that in ONE helper (e.g. `stampHash(generated)` in generator-stamp.mjs) so the two readers do not drift apart.
- **The `by` equality check is duplicated beyond generate.mjs:** `scenario-index-filter.ts:21`, `gherkin-fence.ts:704`, `generate.mjs:480`. All three need `isGeneratedStamp`. `scenario-index.ts:456` emits `generated_from: GENERATED_BY` into the public scenarios API, so decide whether that value changes. If it does, pin it in a test.
- Test importers of the constant: `docs-loader-includes.test.ts:39`, `schema-validator-parity.test.ts:13,432-435`, `gherkin-generate.test.ts:432,505`.
- T010: `src/scripts/new-doc.mjs:114,121` is a second scaffolder that writes `updated: ${today}` (date-only). Treat it like scaffold.mjs.
- feature-core.mjs:691 also serialises `updated:`. Check that it emits the instant form.
