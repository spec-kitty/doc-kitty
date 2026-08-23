---
work_package_id: WP01
title: Atomic contract cutover
dependencies: []
requirement_refs:
- FR-001
- FR-002
- FR-003
- FR-004
- FR-005
- FR-006
- FR-007
- FR-008
- FR-009
- FR-010
- FR-018
- FR-019
- FR-020
- FR-021
- FR-022
- FR-024
- NFR-005
planning_base_branch: feat/metadata-model-and-chrome
merge_target_branch: feat/metadata-model-and-chrome
branch_strategy: Planning artifacts for this mission were generated on feat/metadata-model-and-chrome. During /spec-kitty.implement this WP may branch from a dependency-specific base, but completed changes must merge back into feat/metadata-model-and-chrome unless the human explicitly redirects the landing branch.
subtasks:
- T001
- T002
- T003
- T004
- T005
- T006
- T007
- T008
- T009
- T010
history:
- '2026-08-23: authored by /spec-kitty.tasks'
agent_profile: node-norris
authoritative_surface: src/lib/
create_intent:
- src/tests/schema-validator-parity.test.ts
- src/tests/fixtures/
execution_mode: code_change
owned_files:
- src/lib/schema.ts
- src/lib/metadata.ts
- src/lib/routes/**
- src/scripts/validate-frontmatter.mjs
- src/scripts/check-links.mjs
- src/scripts/scaffold.mjs
- src/scripts/new-doc.mjs
- src/scripts/assert-build-artifacts.mjs
- src/tests/**
- docs/**
- example/docs/**
role: implementer
tags: []
tracker_refs: []
---

## ⚡ Do This First: Load Agent Profile

Before reading anything else, load your assigned profile:
`/ad-hoc-profile-load node-norris` (role: implementer). Apply its initialization,
boundaries, directives, and tactics. Then read this WP end to end, plus
[../spec.md](../spec.md), [../plan.md](../plan.md), [../data-model.md](../data-model.md),
[../occurrence_map.yaml](../occurrence_map.yaml), and
[../contracts/frontmatter-contract.md](../contracts/frontmatter-contract.md).

## Objective

Land the **finalized frontmatter contract** and everything that must move with it,
as a single green step. This is the atomic cutover (spec C-010): when you finish,
`doc-sanity` and `build-example` are green, `git grep '^status:'` over tracked docs
is empty, and every page carries `doc_status` + `kind`. Do **not** split this WP
across separate CI pushes — the tree is red between the validator change and the
migration.

Governing rule: the current `validate-frontmatter.mjs` requires `status` and
`metadata.ts` gates on `status`. The moment a doc flips to `doc_status` while the
code still keys `status`, doc-sanity fails and `isPublished` sees
`undefined → 'draft'`, collapsing the agent-index count below 12. Change code and
docs together.

## Subtasks

### T001 — Finalize the zod schema (`src/lib/schema.ts`)

- Rename the `status` field to `doc_status` (same enum
  `draft|active|deprecated|superseded`). Keep it lenient for the site build
  (default allowed) — strict presence is the standalone validator's job.
- Add `kind: z.string()` (open vocabulary; the site schema stays permissive,
  the standalone validator warns on unknown).
- Add the finalized optional families to `docKittyFields`:
  - `hero_image: z.object({ src: z.string(), alt: z.string() })` — **`alt` required**.
  - `social_thumb: z.union([z.object({ src, alt }), z.string()])`.
  - `related: z.array(z.union([z.string(), z.object({ ref: z.string(), note: z.string().optional() })]))`.
  - `external_references: z.array(z.union([z.object({ url, title, note? }), z.object({ type, id })]))`.
  - `audience: z.array(z.object({ profile: z.string(), guidance_text: z.string() }))`.
  - `moscow: z.object({ level: z.enum(['Must','Should','Could','Won't']), rationale: z.string() })`.
- Add `Presentation` to `DOC_TYPES` (Boy-Scout: the toolkit's `presentations`
  section would otherwise warn).
- Export a `Kind` type/const for reuse by the layout map (WP02).

### T002 — Finalize the standalone validator (`src/scripts/validate-frontmatter.mjs`)

- Rename `status` → `doc_status` in the strict schema (required enum, no default)
  and in every message string.
- Add required `kind` (error if missing); warn (observably printed) on a `kind`
  outside the canonical set (the four Divio quadrants + Hub, ADR, Changelog,
  Glossary, Presentation, Persona, Planning, Feature, User-Journey).
- Keep `DESCRIPTION_SOFT_MIN=50` (warning) and `DESCRIPTION_MAX=180` (error).
- Keep the built-in section→type map + sub-path overrides (add `Presentation`);
  a root without `_meta/sections.yaml` (example) must still validate via the map.
- Bundle root `docs/README.md`: exempt from `type`, but **require** `doc_status`
  and `kind`.
- Shape-validate the families from T001 (moscow.level enum + rationale required;
  audience.guidance_text required; hero_image.alt required; empty related/audience
  lists valid).
- Every warning must print an identifiable message (not silent exit 0).

### T003 — Teach `check-links.mjs` the object form

- At the `related` loop (currently `if (typeof ref !== 'string') continue;`),
  unwrap `{ ref, note }` and resolve `ref` too. A dangling object-form ref is an
  error, exactly like a bare-slug dangling ref.

### T004 — Gating + agent record → `doc_status`, add `kind`

- `src/lib/metadata.ts`: rename the `status` field on `DocKittyFrontmatter`,
  `DocStatus`-typed accesses, `isPublished` (read `data.doc_status`),
  `AgentRecord.status → doc_status`, and the `toAgentRecord` default. Add `kind`
  to `DocKittyFrontmatter` and to `AgentRecord` (string, from `data.kind`).
- `src/lib/routes/*`: any `data.status` read → `data.doc_status`; the agent
  index/page payloads carry `doc_status` and `kind`.
- **DECOY — do not touch**: `src/lib/routes/agent-page.ts` `status: 404` is an
  HTTP Response status, not the frontmatter field (occurrence_map).

### T005 — Doc generators emit the finalized contract

- `src/scripts/scaffold.mjs` (3 templates) and `src/scripts/new-doc.mjs`: emit
  `doc_status: draft` (not `status:`) and a `kind:` placeholder appropriate to the
  section (e.g. `Reference` default, `Hub` for a section README).

### T006 — Migrate all frontmatter (the tree)

- Migrate **all 85** tracked frontmatter files — **72 under `docs/` and 13 under
  `example/docs/`** — skipping `log.md`. Enumerate with a depth-inclusive selector
  (`git ls-files 'docs/*.md' 'docs/**/*.md' 'example/docs/*.md' 'example/docs/**/*.md'`);
  the bare `**/*.md` glob **silently omits the two depth-1 `README.md` files**
  (git pathspec quirk — proven: it matches 71+12, not 72+13). For each file, rename
  `status:` → `doc_status:` and add a `kind:` chosen per page:
  - `adr/*` → `ADR`; `adr/template.md` → `ADR`; changelog → `Changelog`; a section
    `README.md` → `Hub`; ADR/architecture prose → `Reference`/`Explanation`; guides
    → `How-To`/`Tutorial`; planning → `Planning`/`Feature`/`User-Journey`; docs that
    already carry `kind` — reconcile.
- **The two bundle roots — `docs/README.md` AND `example/docs/README.md`** (both
  currently `status: active`, `okf_version: "0.2"`, no `kind`) — each gains
  `doc_status` (from `status`) and a `kind` (e.g. `Hub`); each keeps `okf_version`
  and stays exempt from `type`. These are the exact pages the naive glob misses, so
  migrate them by name.
- Rename any `banner:` → `hero_image:` (likely none; guard).
- Operate on **git-tracked paths only** (never `.worktrees/`).

### T007 — Amend the normative `convention.md`

- Update `docs/context/convention.md`: `status` → `doc_status` (required-field
  block + the meanings), add `kind` (required, the taxonomy), keep the `type`
  table, the bundle-root exemption, and the publication note. Match the finalized
  contract and the validator. House style: sentence-case headings, no Vale hedges.

### T008 — Update build-artifact assertions (forward-compatible)

- `src/scripts/assert-build-artifacts.mjs`: set
  `EXPECTED_PAGE_KEYS = ['slug','route','section','title','doc_status','kind']`
  (each string), keep `EXPECTED_INDEX_ENTRY_COUNT = 12`, keep the index shape,
  and **remove the stale "M1 … out of scope (C-010)" note**. Leave the sitemap
  check as well-formedness-only for now (WP02 tightens it with the filter, so this
  WP stays green with the draft still in the sitemap).

### T009 — Validator/schema parity fixtures + test

- Create `src/tests/fixtures/` with one valid page and fixtures for **both** the
  error and the warning sides:
  - **Error fixtures** (must fail): missing doc_status, missing kind, description
    >180, out-of-enum doc_status, moscow without rationale, out-of-enum
    moscow.level, audience without guidance_text, hero_image without alt, dangling
    related **bare slug**, dangling related **`{ref, note}` object without `ref`**.
  - **Warning fixtures** (must exit 0 **and print an identifiable message**):
    unknown `kind`, unknown `type`, section/`type` mismatch, under-50 `description`.
- Create `src/tests/schema-validator-parity.test.ts`: run both the standalone
  validator logic and the zod schema against each fixture and assert identical
  pass/fail (NFR-005). For the warning fixtures, **capture the validator's stdout
  and assert the warning message text appears** (the post-spec/post-tasks squads
  require warnings to be observably printed, not merely exit 0). Factor a small
  shared field-list if it reduces drift.

### T010 — Update unit tests; full green sweep

- `src/tests/metadata.test.ts` + `src/tests/agent-api.test.ts`: `status` →
  `doc_status` everywhere; add `kind` expectations on records.
- Run the whole local `ci-ok` (see DoD). Fix everything to green **before** handoff.

## Branch Strategy

Planning/base branch: `feat/metadata-model-and-chrome`; final merge target:
`feat/metadata-model-and-chrome` (the mission PR to `main` is opened later, once
the whole mission is green). Execution worktrees are allocated per computed lane
from `lanes.json`; work inside your lane's worktree.

## Definition of Done

- Use **depth-inclusive** pathspecs in every check (the bare `**/*.md` glob misses
  the two depth-1 READMEs):
  - `git grep -nE '^status:' -- 'docs/*.md' 'docs/**/*.md' 'example/docs/*.md' 'example/docs/**/*.md'` → no matches.
  - `git grep -L '^doc_status:' -- 'docs/*.md' 'docs/**/*.md' 'example/docs/*.md' 'example/docs/**/*.md'`
    and the same for `^kind:` → no files listed.
  - **Positive READMEs check**: `docs/README.md` and `example/docs/README.md` each
    contain `^doc_status:` and `^kind:` and no `^status:`.
- Confirm the migrated set is **85** files (72 `docs/` + 13 `example/docs/`).
- `src/lib/routes/agent-page.ts` still returns HTTP `status: 404`.
- All green: `pnpm --filter @commondocs-kitty/toolkit test`, `pnpm lint`,
  `pnpm --filter example typecheck`, `pnpm validate:docs`, `pnpm validate:example`,
  `pnpm validate:links`, `npx markdownlint-cli2 "docs/**/*.md" "example/docs/**/*.md"`,
  `pnpm --filter example build`, `pnpm assert:artifacts` (count 12, records carry
  doc_status+kind).
- Vale error-level clean on `docs` + `example/docs` (no hedges: obviously, of
  course, needless to say, it goes without saying, as everyone knows, undoubtedly,
  without a doubt).

## Risks & reviewer guidance

- **Half-rename** is the top risk — verify the greps above; a single missed file
  turns every page draft. Reviewer: run the full sweep, not a sample.
- **Decoy**: confirm `agent-page.ts` HTTP status untouched; confirm ADR bodies
  keep their `## Status` section (that is ADR *decision* status, not the field).
- **Parity**: the two validators must agree — reviewer runs the parity test and
  spot-checks one fixture by hand.
- **kind values**: reviewer sanity-checks that section READMEs are `Hub` and ADRs
  are `ADR`; unknown kinds should warn, not fail.
