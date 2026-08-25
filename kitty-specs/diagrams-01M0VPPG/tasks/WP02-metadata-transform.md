---
work_package_id: WP02
title: Diagram metadata transform (remark parse + rehype figure), standalone
dependencies: []
requirement_refs:
- FR-003
- FR-004
- FR-005
- FR-013
- NFR-005
planning_base_branch: feat/diagrams
merge_target_branch: feat/diagrams
branch_strategy: Planning artifacts for this mission were generated on feat/diagrams. During /spec-kitty.implement this WP may branch from a dependency-specific base, but completed changes must merge back into feat/diagrams unless the human explicitly redirects the landing branch.
subtasks:
- T006
- T007
- T008
- T009
history:
- '2026-08-25: authored by /spec-kitty.tasks'
agent_profile: implementer-ivan
authoritative_surface: src/lib/remark/
create_intent:
- src/lib/remark/diagram-meta.ts
- src/lib/remark/diagram-meta.internal.ts
- src/lib/rehype/diagram-figure.ts
- src/tests/diagram-meta.test.ts
execution_mode: code_change
owned_files:
- src/lib/remark/diagram-meta.ts
- src/lib/remark/diagram-meta.internal.ts
- src/lib/rehype/diagram-figure.ts
- src/tests/diagram-meta.test.ts
role: implementer
tags: []
tracker_refs: []
---

## ⚡ Do This First: Load Agent Profile

`/ad-hoc-profile-load implementer-ivan` (role: implementer). Apply its initialization,
boundaries, directives, and tactics. Then read this WP, [../spec.md](../spec.md),
[../plan.md](../plan.md), [../data-model.md](../data-model.md),
[../contracts/diagram-meta-transform.md](../contracts/diagram-meta-transform.md), and
`docs/adr/0023-diagram-render-and-metadata-seam.md`.

## Objective

Build the **metadata transform** — a remark plugin that parses the leading `%%` metadata
block on a `mermaid` fence, strips it, injects Mermaid `accTitle`/`accDescr` so the
client-rendered SVG names itself, and stashes caption fields on `file.data`; plus a rehype
plugin that wraps the `<pre class="mermaid">` in an accessible `<figure>` + `<figcaption>`.
Pure logic lives in `diagram-meta.internal.ts` (Astro-free, fully unit-tested). **This WP
wires nothing** — it lands standalone and stays green because nothing imports it yet (WP03
registers both plugins).

**Reserved-directive guard is load-bearing**: never treat `%%{ … }%%` (Mermaid's init
directive) as metadata. Only `^%%\s+(title|description|attribution|source):` lines match.

## Subtasks

### T006 — remark plugin (`diagram-meta.ts`)
- A remark plugin visiting each `code` node with `lang === 'mermaid'`. For each:
  1. **Parse** the leading run of `^%%\s+(title|description|attribution|source):\s*(.+)$`
     lines, stopping at the first non-`%%`, non-blank line. Never match `%%{`.
  2. **Strip** matched lines from the code value; leave unknown `%% key:` lines in place.
  3. **Inject** accessibility statements into the code value **after the diagram-type
     declaration line** (skip a leading `%%{ init }%%` directive and/or a `---` YAML
     frontmatter block to find it): `accTitle: <title || description>` (name, with
     description fallback) and `accDescr: <description>` (omit if no description).
  4. **Stash** `{ title, description, attribution, source }` on
     `file.data.dkDiagrams[<stable node key>]` for the rehype pass (key by node position).
- Delegate all pure string work to `diagram-meta.internal.ts`.

### T007 — pure helpers (`diagram-meta.internal.ts`)
- `parseMeta(code) → { fields, strippedCode }` — the closed-set parse + strip.
- `injectAccStatements(code, fields) → code` — placement after the type-declaration line,
  skipping a leading init directive and/or `---` frontmatter; title→description name fallback.
- `figureFields(fields) → { description?, attribution?, source? }` — the caption shape.
- No remark/hast imports here — plain string/AST-value functions, so vitest needs no Astro.

### T008 — rehype plugin (`diagram-figure.ts`)
- Visit each `<pre class="mermaid">`; read the matching caption fields off `file.data`
  and wrap per the contract:
  `<figure class="dk-diagram" role="group"> <pre class="mermaid">…</pre>
  <figcaption class="dk-diagram__caption"><span class="dk-diagram__desc">{description}</span>
  <span class="dk-diagram__attr">{attribution}</span></figcaption></figure>`.
- `attribution` links to `source` when present. **Omit** `<figcaption>` when neither
  `description` nor `attribution` exists (empty-safe figure). Inner SVG is **not**
  `aria-hidden`; the figure sits in the searchable content region.

### T009 — vitest matrix (`diagram-meta.test.ts`, Astro-free)
Against `diagram-meta.internal`: all four fields parse · unknown-key passthrough ·
`%%{ init }%%` **not** matched as metadata · strip removes only metadata lines · **accTitle
falls back to description when title absent** · accDescr omitted when no description ·
injection **after the type-declaration line** · injection **with a leading `%%{ init }%%`**
(after the declaration, not the init) · injection **with leading `---` frontmatter** · figure
shape with/without each field · guaranteed types **flowchart / sequence / class**.

## Branch Strategy

Planning branch: `feat/diagrams`. Final merge target: `feat/diagrams`. **No deps** — runs in
parallel with WP01. Implement with `spec-kitty agent action implement WP02 --agent claude`.

## Definition of Done

- remark parses/strips/injects per contract; reserved `%%{ }%%` never treated as metadata.
- rehype wraps the figure; empty-safe when no caption fields; SVG not `aria-hidden`.
- vitest matrix green (incl. both fallbacks + both placement-skip cases + guaranteed types);
  pure logic is Astro-free.
- `ci-ok` green — nothing imports these plugins yet, so the corpus is byte-identical.

## Risks / Reviewer guidance

- **Injection placement** — verify accTitle/accDescr land *after* the type-declaration line,
  and that a leading init directive / `---` frontmatter is skipped (Mermaid rejects statements
  before the declaration). The two placement tests are the guard.
- **Name fallback** — with only `description` and no `title`, `accTitle` must still be set
  (the accessible name); the direct name assertion in WP06 depends on it.
- **Standalone** — confirm no import wires these in (WP03 owns registration); the corpus must
  be unchanged at this WP's boundary.
