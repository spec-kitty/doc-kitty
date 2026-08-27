# Tasks: Glossary + Contextive (M4)

**Branch**: `feat/glossary` | **Spec**: [spec.md](./spec.md) | **Plan**: [plan.md](./plan.md)

9 work packages: 8 dormant infra/logic (WP01–WP08) + 1 terminal atomic on-switch (WP09).
Every infra WP is registered but no-op/unreferenced until WP09 lands the example
`.contextive/definitions.yaml`, so `ci-ok` stays green at every boundary. The pure resolver
(WP02) is split from the auto-link plugin (WP04); `config.ts` is a single-owner integration
(WP08); WP09 lands `.contextive` + generated pages + `sections.yaml` + `AXE_PAGES` +
count-pins atomically.

## Subtask Index

| ID | Description | WP | Parallel |
|----|-------------|----|----------|
| T001 | Shared glossary types (`SharedTermIndex`, `Term`, `Context`, `Resolution`) | WP01 | |
| T002 | `anchor.ts` deterministic `slug(name)` + unit test | WP01 | [P] |
| T003 | `load.internal.ts` pinned zod schema + build-fatal validation + `safeHref` scheme-check | WP01 | |
| T004 | `load.ts` presence-gated file read → `SharedTermIndex` (built once) | WP01 | |
| T005 | Loader/validation/scheme unit tests (valid, malformed, bad-scheme) | WP01 | |
| T006 | `resolve.ts` pure resolver: single/multi/unresolved/none, aliases-as-names | WP02 | |
| T007 | Deterministic `competing[]` ordering for the greppable warning | WP02 | |
| T008 | Exhaustive resolver unit tests (collision matrix, ignore-list, alias) | WP02 | |
| T009 | `generate.ts` codegen hub + per-context pages into `docs/glossary/**` | WP03 | |
| T010 | Markdown-render `definition`/`meta`; deterministic anchors; `domainVisionStatement` | WP03 | |
| T011 | Self-declared `glossary_context` + default Reference nav entry | WP03 | |
| T012 | Generator determinism + presence-gating unit tests | WP03 | |
| T013 | `glossary-autolink` section model (H2 spans) + first-eligible-per-section | WP04 | |
| T014 | Ancestor-type guard + whole-word case-insensitive; ignore-list + `glossary_autolink:false` | WP04 | |
| T015 | Emit the shared link node (`target=_blank`, `rel=noopener`, `data-glossary-*`); unresolved→warn | WP04 | |
| T016 | Publish distinct `glossary_links_used` to `remarkPluginFrontmatter`; deck no-op | WP04 | |
| T017 | Auto-link unit tests (section-walk, guards, warning multiplicity, links-used) | WP04 | |
| T018 | Pin `remark-directive`+`mdast-util-directive`; commit lockfile; supply-chain evidence | WP05 | |
| T019 | `glossary-term` directive → shared link node via explicit context; `link=false` suppress | WP05 | |
| T020 | `:term` counts as used + as section's first-eligible; unknown-context warning | WP05 | |
| T021 | `:term` unit tests (force, suppress, collision-resolve, unknown-context) | WP05 | |
| T022 | `preview.client.ts` footprint-guarded island (injectScript + early-return + dynamic import) | WP06 | |
| T023 | Custom popover: hoverable, Esc-dismiss, persistent, both colour modes (1.4.13) | WP06 | |
| T024 | `OnThisPage.astro` composes M3 `resolveRelated`/`resolveCitation`+`buildCatalog`(catalog.ts) + molecules (no frozen-M3 edits) | WP07 | |
| T025 | Re-derive links-used via `linksForBody` (parse→directive→:term→computePageLinks; `:term` incl.); dedup+order+omit-empty | WP07 | |
| T036 | Own the presence-gated mount in `MarkdownContent.astro` (swap standalones→`OnThisPage` when glossary active) | WP07 | |
| T026 | Add `glossary_context`+`glossary_autolink` to `docKittyDocsSchema` + validator (ADR-0028) | WP08 | |
| T027 | Wire generator hook + pinned remark order (`gfm→directive→:term→autolink`) presence-gated | WP08 | |
| T028 | Inject preview island page-wide (M5 pattern); deck guard; glossary-free build byte-identical | WP08 | |
| T029 | Foundation spike: confirm `remarkPluginFrontmatter` surfaces to route data (record result) | WP08 | |
| T030 | Example `.contextive/definitions.yaml` (2 contexts + `policy` collision) + demonstrator pages | WP09 | |
| T031 | Malformed fixture (FR-002) kept out of the normal build | WP09 | |
| T032 | `example/docs/_meta/sections.yaml` Reference placement + committed generated `docs/glossary/**` | WP09 | |
| T033 | `AXE_PAGES` glossary entry + non-vacuity gate (≥1 auto-link + ≥1 `:term` collision before scan) | WP09 | |
| T034 | Count-pins + footprint twin (glossary page requests chunk; control does not) | WP09 | |
| T035 | Update feature page + new `docs/architecture/glossary.md` (FR-015) | WP09 | |

## Work Packages

### WP01 — Definitions loader + validation + anchor  *(~260 lines)*
- **Goal**: Parse `.contextive/definitions.yaml` once, validate build-fatally, emit the
  shared term/alias→anchor index; deterministic anchors; scheme-safe `meta`.
- **Priority**: P1 (root). **Depends on**: none.
- **Independent test**: vitest — valid file → index; malformed → throw naming field;
  non-allowlisted `meta` URL → throw; absent file → `{present:false}`.
- **Subtasks**: T001–T005. **Prompt**: [tasks/WP01-loader-validation-anchor.md](./tasks/WP01-loader-validation-anchor.md)

### WP02 — Pure resolver (the one shared matcher)  *(~200 lines)*
- **Goal**: `(surface, pageContext, index)` → link / unresolved / none; aliases as names;
  deterministic `competing[]`.
- **Priority**: P1. **Depends on**: WP01 (imports the shared types).
- **Independent test**: vitest collision matrix (single, page-resolved, unresolved,
  ignore-listed, alias).
- **Subtasks**: T006–T008. **Prompt**: [tasks/WP02-pure-resolver.md](./tasks/WP02-pure-resolver.md)

### WP03 — Glossary page generator + hub + nav default  *(~280 lines)*
- **Goal**: Codegen hub + per-context pages into `docs/glossary/**`; markdown-render
  definitions/meta; deterministic anchors; default Reference nav.
- **Priority**: P1. **Depends on**: WP01.
- **Independent test**: vitest — same index → byte-identical files; absent index → no files.
- **Subtasks**: T009–T012. **Prompt**: [tasks/WP03-page-generator.md](./tasks/WP03-page-generator.md)

### WP04 — Auto-link remark plugin + links-used  *(~320 lines)*
- **Goal**: First-eligible-per-H2-section auto-link over the resolver; guards; unresolved→
  greppable warn (exit 0); publish links-used; deck no-op.
- **Priority**: P1. **Depends on**: WP02.
- **Independent test**: vitest — section-walk counts, guard exclusions, one-warning-per-
  distinct-term, links-used array.
- **Subtasks**: T013–T017. **Prompt**: [tasks/WP04-autolink-plugin.md](./tasks/WP04-autolink-plugin.md)

### WP05 — `:term` directive  *(~230 lines)*
- **Goal**: `remark-directive` `:term[text]{context=…}` → shared link node; `link=false`
  suppress; counts as used + first-eligible; new pinned deps.
- **Priority**: P1. **Depends on**: WP02.
- **Independent test**: vitest — force, suppress, collision-resolve, unknown-context warn.
- **Subtasks**: T018–T021. **Prompt**: [tasks/WP05-term-directive.md](./tasks/WP05-term-directive.md)

### WP06 — Hover-preview island  *(~220 lines)*
- **Goal**: Footprint-guarded custom popover (not `title`): hoverable, Esc-dismiss,
  persistent, both modes; loads only where glossary links exist.
- **Priority**: P1. **Depends on**: WP04 (the marker attributes).
- **Independent test**: a11y (WP09 gate) — 1.4.13 direct assertions; footprint twin.
- **Subtasks**: T022–T023. **Prompt**: [tasks/WP06-hover-preview-island.md](./tasks/WP06-hover-preview-island.md)

### WP07 — "On this page" block + owned mount  *(~250 lines)*
- **Goal**: New `OnThisPage.astro` composing M3 refs+related (no frozen-M3 edits) + glossary
  links used via the render-time re-derive (`linksForBody`, `:term` included); dedup, stable
  order, omit-when-empty, JS-off; **owns the presence-gated mount** in the ADR-0013 carrier
  `MarkdownContent.astro` (swap standalones→`OnThisPage` when glossary active).
- **Priority**: P1. **Depends on**: WP04 + WP05 (the re-derive reuses `computePageLinks` +
  `glossary-term`).
- **Independent test**: build + a11y — the block renders three sub-lists; JS-off present;
  glossary-free carrier byte-identical.
- **Subtasks**: T024, T025, T036. **Prompt**: [tasks/WP07-on-this-page-block.md](./tasks/WP07-on-this-page-block.md)

### WP08 — Single-owner config.ts integration + schema fields  *(~300 lines)*
- **Goal**: Own the one config.ts seam — schema fields (ADR-0028), pinned remark order,
  generator hook, island inject; all presence-gated; glossary-free build byte-identical.
- **Priority**: P1. **Depends on**: WP01–WP07.
- **Independent test**: build — glossary-free site byte-identical; spike result recorded.
- **Subtasks**: T026–T029. **Prompt**: [tasks/WP08-config-integration.md](./tasks/WP08-config-integration.md)

### WP09 — Terminal example demonstrator (the atomic on-switch)  *(~360 lines)*
- **Goal**: Land `.contextive` + demonstrator pages + malformed fixture + `sections.yaml` +
  generated `docs/glossary/**` + `AXE_PAGES` non-vacuity gate + count-pins + docs-of-record,
  atomically. This WP flips activation; its `ci-ok` is green with the full seam live.
- **Priority**: P1 (MVP demonstrator). **Depends on**: WP01–WP08.
- **Independent test**: full `ci-ok` (code-quality, doc-sanity, build-example browser-free,
  a11y) green; non-vacuity assertions fire.
- **Subtasks**: T030–T035. **Prompt**: [tasks/WP09-terminal-example.md](./tasks/WP09-terminal-example.md)

## Dependencies

```
WP01 ─┬─ WP02 ─┬─ WP04 ─┬─ WP06 ─────────┐
      │        │        └─ WP07 ─┐       │
      │        └─ WP05 ──────────┴───────┤   (WP07 depends on WP04 AND WP05)
      ├─ WP03 ───────────────────────────┼─ WP08 ─ WP09
      └───────────────────────────────────┘
```

WP01 is the MVP root. WP02/WP03 parallel after WP01. WP04/WP05 parallel after WP02.
WP06 after WP04; **WP07 after WP04 + WP05** (its `linksForBody` re-derive reuses both).
WP08 integrates all; WP09 is the terminal on-switch.
