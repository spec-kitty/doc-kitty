# Phase 0 Research — Glossary + Contextive (M4)

All spec open-questions and the four planning ADRs are resolved below. Format:
**Decision / Rationale / Alternatives**. The four ADRs (0025–0028) carry the full argument;
this file consolidates the decisions and records the dependency + adversarial evidence the
plan step contract requires.

## R-01 — The "On this page" links-used data channel (AS-3, biggest risk)

- **Decision**: A new `OnThisPage.astro` block **composes** the M3 renderers (imports
  `src/lib/metadata.ts` resolvers + `themes/spec-kitty/.../molecules`, never edits them) and
  reads the distinct glossary links used from the **one shared matcher's** result, published
  by the auto-linker into `file.data.astro.frontmatter.glossary_links_used` and surfaced via
  Starlight route data. A foundation spike confirms the surfacing; the certain fallback is a
  deterministic **re-derive** of the used-list at render via the same pure matcher over
  `entry.body`. (ADR-0025.)
- **Rationale**: No single pass holds both the M3 refs (render-layer `getCollection` +
  `Astro.locals`) and the links-used (remark `file.data`). Composing M3 keeps ADR-0017
  literally intact; the shared matcher guarantees "links used" == "links inserted"
  (NFR-004). The spike+fallback mirrors ADR-0023's discipline.
- **Alternatives**: rehype-append the glossary sub-list (splits one block across two
  stages — rejected as primary); thread props into M3 components (ADR-0015-incompatible);
  read the rendered DOM client-side (breaks NFR-005 no-JS).

## R-02 — Generated-page registration (AS-6)

- **Decision**: **Codegen glossary pages as Markdown into the `docs` collection**
  (`docs/glossary/**.md`), not an injected route. (ADR-0026.)
- **Rationale**: The `docs` collection is a `glob({ base: 'docs' })`; only on-disk files
  under `docs/` are seen by `getCollection('docs')`, `_meta/sections.yaml`, the sidebar, the
  sitemap draft filter, the agent API, and `llms.txt`. FR-013 requires all of them, so an
  injected route (invisible to every one) fails the spec. Files-under-`docs/` satisfy FR-013
  with zero new wiring.
- **Alternatives**: `injectRoute` (invisible to the generators — rejected); a separate
  glossary collection (would still need per-generator glue — rejected).

## R-03 — `remark-directive` dependency + plugin ordering (AS-1/AS-2)

- **Decision**: Add pinned `remark-directive` + `mdast-util-directive` for `:term`. Pinned
  remark order: `remark-gfm` (Astro built-in) → `remarkDirective` → `glossary-term` →
  `glossary-autolink`, registered after Starlight via `updateConfig` append semantics in the
  single config.ts owner. Every rewrite is ancestor-type-guarded; the auto-linker is an
  explicit **no-op on `kind: Presentation`** (deck). (ADR-0027.)
- **Rationale**: `:term` is standard directive syntax the toolkit does not currently parse;
  a pinned mainstream dependency beats hand-rolling tokenization. Order-by-registration +
  ancestor guards design out the AS-1 failure mode (linking inside code/headings/links, or
  re-scanning a directive node).
- **Alternatives**: hand-rolled `:term` parser (more risk, diverges from documented syntax);
  case-sensitive matching (rejected in rev 2, squad T-01); auto-link decks (rejected — slide
  layout sensitivity).

## R-04 — The new frontmatter fields (C-007)

- **Decision**: Two optional, page-local fields — `glossary_context: <string>` and
  `glossary_autolink: boolean` (default `true`) — added to `docKittyDocsSchema` and the
  standalone validator; unknown `glossary_context` is a build **warning**, not fatal.
  (ADR-0028, per ADR-0009's new-field-means-new-ADR rule.)
- **Rationale**: Page-local scoping is testable and explicit; flat well-named fields avoid
  the ambiguous `glossary: false` the squad flagged (L-02). Absent fields = byte-identical
  build (NFR-002).
- **Alternatives**: a `glossary: { context, autolink }` object (ambiguous — rejected);
  inheritable context (v1 complexity — rejected); fatal unknown context (blocks authoring —
  rejected).

## R-05 — Global auto-link config toggle (spec open-question)

- **Decision**: **Not added.** Activation is presence-driven (definitions file present) with
  per-page `glossary_autolink: false`, the ignore-list, and `:term` opt-outs.
- **Rationale**: A global toggle duplicates the presence trigger and the per-page opt-out
  with no new capability; presence + per-page is the C-005 model.

## R-06 — Hover preview + footprint (reuse M5)

- **Decision**: Custom popover island (not `title`), reusing the M5 pattern:
  `injectScript('page')` + early-return when no `[data-glossary-term]` node + dynamic
  `import()` of the preview chunk. WCAG 1.4.13 asserted directly (hoverable, Esc, persistent,
  both modes); NFR-003 footprint proven by Playwright network capture (glossary page requests
  the chunk; a glossary-free control route does not).
- **Rationale**: Proven M5 footprint discipline (ADR-0023); axe can't assert 1.4.13, so
  direct assertions per NFR-001/rev 2 T-04/T-06.
- **Alternatives**: `title` attribute (can't meet 1.4.13 — rejected, T-04); always-load the
  chunk (fails NFR-003 — rejected).

## Dependency & supply-chain evidence (plan step contract)

| Package | Version posture | Registry authenticity | Freshness | Lifecycle scripts | Node |
|---------|-----------------|-----------------------|-----------|-------------------|------|
| `remark-directive` | pin exact | npm, unified org, widely depended | mature/maintained | none of concern (deny-by-default preinstall/install/postinstall) | Active LTS ≥20 |
| `mdast-util-directive` | pin exact | npm, `syntax-tree` org | mature/maintained | none of concern | Active LTS ≥20 |

Both are standard `unified`/`mdast` ecosystem packages already transitively present in most
Astro toolchains. No install-time lifecycle scripts are relied upon; pin exact versions in
`package.json`. This is advisory (no new blocking gate) but examined, not silent.

## Adversarial evidence (contested findings + dispositions)

Per `contracts/adversarial-evidence-contract.md`, security-impacting/decision-bearing
challenges raised while planning and their disposition (`accepted` / `changed` /
`deferred_with_rationale`):

| # | Challenge | Disposition |
|---|-----------|-------------|
| AE-1 | "remarkPluginFrontmatter may not surface to the carrier block → AS-3 channel breaks." | **changed** — ADR-0025 adds a foundation spike + a deterministic re-derive fallback via the shared matcher; the datum is guaranteed either way. |
| AE-2 | "Codegen writes into the tracked `docs/` tree — a stale generated tree could diverge from the definitions file." | **accepted** — generation is idempotent/deterministic and gated in the build; the terminal WP's count-pins assert the generated set matches the fixture. |
| AE-3 | "A `meta`/`source` URL in the definitions file is a stored-XSS vector." | **accepted** — reuse the M5 `safeHref` allowlist; a non-allowlisted scheme is build-fatal (FR-004), consistent with the diagram seam. |
| AE-4 | "New pinned deps expand the supply-chain surface." | **accepted** — pinned exact, mainstream unified packages, deny-by-default lifecycle scripts (table above). |
| AE-5 | "Whole-word case-insensitive over-links common words." | **accepted** — ignore-list + `glossary_autolink: false` + `:term[…]{link=false}` + first-per-section bound volume (FR-006/008/011). |

No contested finding is silently dropped.

## Post-design Charter re-check

Re-evaluated after Phase 1: no new gaps. The pure-resolver/AST-plugin split (DIRECTIVE_001),
compose-not-mutate (ADR-0025), single config owner (DIRECTIVE_024), and documented decisions
(DIRECTIVE_003) all hold. Ready for `/spec-kitty.tasks`.
