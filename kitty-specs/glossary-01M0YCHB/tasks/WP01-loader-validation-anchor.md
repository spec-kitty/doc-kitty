---
work_package_id: WP01
title: Definitions loader + validation + anchor
dependencies: []
requirement_refs:
- FR-001
- FR-002
- FR-004
planning_base_branch: feat/glossary
merge_target_branch: feat/glossary
branch_strategy: Planning artifacts for this mission were generated on feat/glossary. During /spec-kitty.implement this WP may branch from a dependency-specific base, but completed changes must merge back into feat/glossary unless the human explicitly redirects the landing branch.
subtasks:
- T001
- T002
- T003
- T004
- T005
history:
- '2026-08-26: authored by /spec-kitty.tasks'
agent_profile: implementer-ivan
authoritative_surface: src/lib/glossary/
create_intent:
- src/lib/glossary/types.ts
- src/lib/glossary/anchor.ts
- src/lib/glossary/load.internal.ts
- src/lib/glossary/load.ts
- src/tests/glossary-load.test.ts
- src/tests/glossary-anchor.test.ts
execution_mode: code_change
owned_files:
- src/lib/glossary/types.ts
- src/lib/glossary/anchor.ts
- src/lib/glossary/load.internal.ts
- src/lib/glossary/load.ts
- src/tests/glossary-load.test.ts
- src/tests/glossary-anchor.test.ts
role: implementer
tags: []
tracker_refs: []
---

## ⚡ Do This First: Load Agent Profile

`/ad-hoc-profile-load implementer-ivan` (role: implementer). Apply its initialization,
boundaries, directives, and tactics. Then read this WP, [../spec.md](../spec.md),
[../plan.md](../plan.md), [../data-model.md](../data-model.md),
[../contracts/loader-and-validation.md](../contracts/loader-and-validation.md),
[../contracts/resolver.md](../contracts/resolver.md), and
`docs/adr/0026-glossary-source-and-generation-seam.md`.

## Objective

Build the **root** of the glossary: parse `.contextive/definitions.yaml` **once**, validate
it **build-fatally** against a pinned Contextive Community schema, scheme-check every URL in
`meta`, and emit the **shared term/alias→anchor index** every other WP consumes. This WP
also owns the deterministic `slug(name)` anchor function (a four-way shared contract, D6) and
the shared TypeScript types. **Nothing is wired into the build here** — the loader is called
by WP03 (generator) and WP08 (config integration); until WP09 lands the example
`.contextive/definitions.yaml`, this code is dormant and the corpus is byte-identical
(NFR-002). All logic is Astro-free and unit-tested (`load.internal.ts`, `anchor.ts`); the
thin `load.ts` only does file I/O + presence gating.

## Subtasks

### T001 — Shared glossary types
- Create `src/lib/glossary/types.ts` — the types shared by WP02/WP03/WP04/WP07:
  - `Term { name: string; definition: string; aliases?: string[]; examples?: string[]; meta?: Record<string,string> }`
  - `Context { name: string; domainVisionStatement?: string; terms: Term[] }`
  - `SharedTermIndex { bySurface: Map<string, Array<{ context: string; anchor: string; termName: string }>>; contexts: Map<string, { slug: string; terms: Term[]; domainVisionStatement?: string }> }`
  - `Resolution` (the discriminated union used by WP02 — define it here so WP02 imports it):
    `{ kind: 'link'; context; anchor; termName } | { kind: 'unresolved'; surface; competing: string[] } | { kind: 'none' }`.
  - `GlossaryLinkUsed { surface: string; context: string; anchor: string; termName: string }`.
- **Files**: `src/lib/glossary/types.ts` (~40 lines). **Validation**: `astro check` / `tsc` clean.

### T002 — Deterministic anchor `slug(name)` [P]
- Create `src/lib/glossary/anchor.ts` exporting `slug(name: string): string`.
- Rule: lowercase, trim, collapse non-alphanumerics to single `-`, strip leading/trailing
  `-`. **Deterministic** (NFR-004) — same name → same anchor, no randomness/date.
- This is the **single** anchor function used by the generator (WP03), the resolver (WP02),
  and `:term` (WP05). Do not duplicate it elsewhere.
- **Files**: `src/lib/glossary/anchor.ts` (~20 lines), `src/tests/glossary-anchor.test.ts`.
- **Validation**: unit tests — `"Cargo Booking"→"cargo-booking"`, punctuation/unicode edge
  cases, idempotent (`slug(slug(x))===slug(x)`).

### T003 — Pinned schema + build-fatal validation + scheme-check
- Create `src/lib/glossary/load.internal.ts` (Astro-free):
  - A **zod** schema mirroring the pinned Contextive Community format
    (`contexts[] → { name, domainVisionStatement?, terms[] → { name, definition, aliases?, examples?, meta? } }`).
    Record the pinned Contextive schema version in a header comment (FR-002, schema-drift risk).
  - `parseAndValidate(raw: unknown): Context[]` — on any violation **throw** an `Error`
    whose message **names the offending `context[/term[/field]]`** (FR-002). Do not swallow.
  - **Scheme-check** (FR-004, INV-G6): for every URL value in any term's `meta`, reuse the
    existing `safeHref` allowlist (`src/lib/rehype/diagram-figure.ts` exports it — import it,
    do NOT reinvent). A non-allowlisted scheme (`javascript:`, `data:`, protocol-relative)
    is **build-fatal** — throw naming the term/field.
- **Files**: `src/lib/glossary/load.internal.ts` (~90 lines).
- **Validation**: covered by T005.

### T004 — Presence-gated loader → `SharedTermIndex`
- Create `src/lib/glossary/load.ts`:
  - `loadGlossary(root: string): { present: false } | { present: true; index: SharedTermIndex }`.
  - **Presence gate** (FR-001, INV-G4): if `<root>/.contextive/definitions.yaml` is absent →
    `{ present: false }` (no throw). This is the switch that keeps a no-file build
    byte-identical.
  - Present → read the file, `parseAndValidate`, then **build the index once** (INV-G1):
    lowercased `bySurface` keys covering **names AND aliases together** (FR-012), each mapping
    to `{ context, anchor: slug(termName), termName }`; `contexts` map with `slug`, term
    list, `domainVisionStatement`.
  - Use `gray-matter`/`js-yaml` already present; do not add a YAML dep.
  - **Also export `isGlossaryActive(root: string): boolean`** — a cheap `.contextive/
    definitions.yaml` presence check (no parse). WP07's carrier mount imports it to
    presence-gate the `<OnThisPage/>` swap (post-squad A-3), and WP08's integration reuses the
    same presence signal. Keep it a pure FS-existence check so it is safe to call at
    component-render time.
- **Files**: `src/lib/glossary/load.ts` (~80 lines).
- **Validation**: covered by T005 (incl. `isGlossaryActive` true/false on presence/absence).

### T005 — Loader / validation / scheme unit tests
- `src/tests/glossary-load.test.ts` (vitest):
  - Valid 2-context fixture (inline in the test or a small `__fixtures__` string) → index has
    the right `bySurface` keys (incl. an alias resolving like its name) and per-context lists.
  - **Malformed** input (missing required `definition`) → `loadGlossary` throws, message
    names the context/term/field (FR-002).
  - **Bad scheme** (`meta.url: "javascript:alert(1)"`) → throws (FR-004).
  - **Absent file** → `{ present: false }`, no throw (FR-001).
  - Aliases share `bySurface` with names (FR-012); anchors are `slug(name)` (NFR-004).
- **Validation**: `pnpm test` green; `astro check` clean.

## Branch Strategy

Planning branch: `feat/glossary`. Final merge target: `feat/glossary`. **No deps** — this is
the MVP root; WP02 and WP03 branch from it. Implement with
`spec-kitty agent action implement WP01 --agent claude`.

## Definition of Done

- `types.ts`, `anchor.ts`, `load.internal.ts`, `load.ts` created; all Astro-free logic
  unit-tested.
- `loadGlossary` is presence-gated (absent → `{present:false}`, no throw), parses/validates
  once, throws build-fatal naming the offending field on invalid input, and scheme-checks
  `meta` URLs via the shared `safeHref`.
- The `SharedTermIndex` keys names+aliases together (lowercased) with `slug(name)` anchors.
- `ci-ok` green — **no build wiring in this WP**; the corpus is byte-identical (the loader is
  called by nobody until WP03/WP08).

## Risks / Reviewer guidance

- **Single parse (INV-G1)** — the index must be built once and returned; do not parse
  per-consumer. Reviewer: confirm `load.ts` is the only parse site.
- **Reuse `safeHref`** — import the existing allowlist from `rehype/diagram-figure.ts`; a
  re-implemented scheme check is a finding (drift risk).
- **Reuse `anchor.slug`** — this WP is the sole owner; WP02/03/05 import it. A second slug
  function anywhere is a finding.
- **No wiring** — verify `config.ts` is untouched; this WP adds files only.
