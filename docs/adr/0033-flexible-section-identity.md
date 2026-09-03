---
title: "ADR-0033: Flexible section identity — configurable index basename and first-class section rename"
description: index.md joins README.md as a section-index basename, and a registry-driven section rename is first-class supported — reversing ADR-0004's tolerated-not-supported stance.
doc_status: active
updated: 2026-09-03
type: ADR
kind: ADR
authors:
  - stijn@sddevelopment.be
related:
  - adr/0002-readme-as-index
  - adr/0004-amend-common-docs-as-extensible-variation
  - adr/0029-sidebar-autogenerate-content-root-coupling
  - context/convention
  - architecture/section-registry
---

# ADR-0033: Flexible section identity — configurable index basename and first-class section rename

## Status

**Accepted** — 2026-09-03. Introduced by the adopter-loader-migration mission
(issues #37, #48; spec C-007, US1/US2). **Supersedes [ADR-0002](./0002-readme-as-index.md)
in part**: `README.md` is no longer the *sole* index basename, only the default
one. **Reverses** the "adaptation is tolerated, not supported" stance
[ADR-0004](./0004-amend-common-docs-as-extensible-variation.md) recorded for a
project's own section-folder adaptation: an `index.md`-named section index and a
renamed section folder (including its sub-path subtype) are, from this ADR
forward, **first-class supported** toolkit capabilities, not graceful-degradation
tolerance.

## Context

ADR-0002 fixed `README.md` as the one reserved section-index basename, chosen so
the same file renders on GitHub/Bitbucket and as the Starlight landing page.
ADR-0004 then generalized doc-kitty's relationship to Common Docs: the canonical
section set is what the toolkit officially supports, and a project's own
deviation — different sections, different naming — is *tolerated* (the toolkit
degrades gracefully rather than hard-failing) but explicitly **not supported**.

A real, demanding adopter (the spec-kitty proving ground; see
[`spec-kitty-adoption-proof.md`](../architecture/research/spec-kitty-adoption-proof.md))
exposes the cost of that tolerated-not-supported posture in two concrete places:

1. **Every section index is `index.md`, not `README.md`.** Adopting doc-kitty as
   written means renaming roughly sixty index files and rewriting the ~1,589
   internal links that point at them — pure migration churn with no product
   value, and the single largest adopter friction the research names.
2. **A section folder's name is governance-mandated** (for example
   `plans/features` must become `plans/missions`). The derived `type`/subtype for
   pages under that folder is driven by a **hardcoded sub-path table**, mirrored
   in the TypeScript lib (`src/lib/metadata.ts`) and the bare-Node validator
   twin (`src/scripts/validate-frontmatter.mjs`). Renaming the folder without
   editing that table silently reverts every child page to the section's bare
   default type — a rename cannot be a pure data change today.

Both are exactly the class of adaptation ADR-0004 named and declined to support.
Continuing to decline forces every adopter with an existing, governed docs tree
through avoidable file renames, link rewrites, or a fork of the derivation code —
the reproduction of the docs-next-to-code rigidity doc-kitty exists to remove
(see [problem.md](../context/problem.md)). This mission (spec C-007) makes the
deliberate governance call to promote these two adaptations from tolerated to
supported, and records it here rather than silently changing behavior.

## Decision

### 1. `indexBasename` — a configurable section-index basename

Broaden the section-index detection from the literal `README` to a configurable,
case-insensitive basename (`README` or `index`), threaded through an
`indexBasename` loader option that **defaults to `README`** so today's corpus —
including doc-kitty's own tree — is unaffected (C-001). This amends ADR-0002:
`README.md` is no longer the *only* basename the toolkit recognizes as a section
index, only the default one; the frontmatter-and-dual-audience rationale ADR-0002
gave for `README.md` is unchanged and remains the reason it stays the default.
`indexBasename` accepts either a single basename or a set (`['README', 'index']`),
so one build can collapse both conventions at once — the case the worked example
exercises to prove `index.md` sections coexist with a README-indexed corpus.

Every surface that detects a section index honors the configured basename, so an
`index.md` tree is never half-recognized (the partial-adoption trap): the content
loader and route-slug derivation, `draftRoutes`, the `docs/`-root helper, the
`llms.txt` description emitter, the bare-Node frontmatter validator gate
(including its root-index exemption), the link checker (`check-links.mjs`), the
scaffolder, and the new-doc tool. The bare-Node gate gets its own hand-mirrored
detection twin — it runs with no Astro build context and cannot import the
build-coupled loader helper — guarded by the derivation-twin parity tests
(consistent with the twin discipline [ADR-0031](./0031-vocabulary-override.md)
already established).

A folder containing **both** `README.md` and `index.md` resolves deterministically:
the configured basename wins as the section index, the other file is demoted to
an ordinary page, and a warning names the collision. Ambiguity is never resolved
silently.

### 2. Registry-driven section rename (top-level id and sub-path subtype)

A section-folder rename — including a sub-path subtype rename such as
`plans/features` → `plans/missions` — becomes a **data edit**, not a derivation-
code edit. The section registry (`docs/_meta/sections.yaml`) gains an optional
`subtypes` field per section:

```yaml
sections:
  - id: plans
    type: Plan
    subtypes:
      - match: missions   # first sub-path segment under the section folder
        type: Mission
```

Resolution order for a page with no authored `type` is: authored `type` (always
wins) → registry `subtypes[].match` on the first sub-path segment → the built-in
sub-path table (kept as the backward-compatible fallback, so doc-kitty's own tree
is a no-op) → the section-level default. Both derivation twins — the TypeScript
lib and the bare-Node validator — implement this identical order and are guarded
by the parity tests (NFR-001). A rename to a section id with **no** registry
entry falls back to the documented section default and is surfaced as a warning,
never a silent mis-type or a hard failure.

A rename also regenerates the renamed section's child routes, and the
[ADR-0029](./0029-sidebar-autogenerate-content-root-coupling.md) `docsDir`-prefix
coupling is asserted to survive it — the sidebar group still renders its hub link
and children rather than silently emptying.

### The reversal, stated

ADR-0004's Decision item 4 held that a project's section-set adaptation is
"tolerated, not supported" — the toolkit degrades gracefully but such adaptation
is not built for. **This ADR reverses that stance for exactly the two
adaptations above** — an `index.md`-named section index, and a renamed section
folder with a registry-declared `subtypes` mapping. Both move from
tolerated-degradation to first-class, tested, documented toolkit capability.
ADR-0004's general posture is otherwise unchanged: an *undeclared* deviation
(an unregistered section, an unrecognized `type`) remains tolerated-not-supported
graceful degradation, not an invitation to arbitrary adaptation.

## Consequences

### Positive

- Spares a migrating adopter with an existing `index.md`-indexed, differently-named
  tree the file renames and link rewrites that were previously mandatory (SC-001).
- A section rename is now provably data-only: no per-rename edit to derivation
  code, zero dangling `related:` links, and a rendered sidebar group (SC-002).
- Both frictions this ADR resolves also correct a doc-kitty-side inconsistency
  (the loader's own basename detection had no bare-Node twin; the subtype table
  was a hardcoded switch) — the dogfooding dividend the mission's research names.

### Negative

- `README.md` vs. `index.md` is now a per-project choice rather than one fixed
  convention, so a reader moving between doc-kitty projects may see either.
  Mitigated by the case-insensitive collision rule and the unchanged `README`
  default.
- The registry `subtypes` field is a second guarded twin (alongside the
  `indexBasename` detection twin) added to the existing mjs↔ts split-brain
  surface. The parity tests are the containment; the full single-source
  consolidation (issue #49) remains explicitly out of scope (C-003).

### Risks

- A future basename beyond `README`/`index` is not covered by this decision and
  would need its own amendment.
- An adopter that declares `subtypes` but does not also update `related:`
  references or add covering redirects (see [ADR-0034](./0034-redirect-coverage-gate.md))
  can still produce dangling links or dead URLs; this ADR makes the rename
  mechanism data-only, it does not itself guarantee the adopter completes the
  accompanying link/redirect bookkeeping — the referential-integrity and
  redirect-coverage gates are the backstop.

## Alternatives considered

### Option A: A separate `index-config.yaml` file

Rejected. A single loader option (`indexBasename`) is sufficient; a new
configuration file adds surface area without adding capability.

### Option B: Recognize both `README.md` and `index.md` unconditionally, with no default control

Rejected. Removes the opt-out an existing adopter needs and reintroduces the
FR-004 collision case with no configured winner.

### Option C: Narrow section rename to top-level ids only (no sub-path `subtypes`)

Rejected. Issue #48's own motivating case (`plans/features` → `plans/missions`)
*is* a sub-path subtype rename; a top-level-only fix would not satisfy it and
would leave the hardcoded sub-path table as the actual blocker.

### Option D: Edit the two-twin `switch` per adopter rename

Rejected. This is the whack-a-field anti-pattern the mission exists to remove —
every rename would still require a derivation-code change.

## References

- [ADR-0002](./0002-readme-as-index.md) — README-as-index, partially superseded
  by the `indexBasename` default here.
- [ADR-0004](./0004-amend-common-docs-as-extensible-variation.md) — the
  tolerated-not-supported posture this ADR reverses for these two adaptations.
- [ADR-0029](./0029-sidebar-autogenerate-content-root-coupling.md) — the sidebar
  coupling a section rename must survive.
- [ADR-0031](./0031-vocabulary-override.md) — the twin-discipline precedent this
  ADR's `indexBasename` gate twin follows.
- Spec C-007, FR-001–FR-007, US1/US2; research D-01–D-03, D-06; data-model
  E-01, E-02, E-05, E-06.
- [`spec-kitty-adoption-proof.md`](../architecture/research/spec-kitty-adoption-proof.md).
