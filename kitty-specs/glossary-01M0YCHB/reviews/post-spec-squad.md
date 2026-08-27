# Post-spec adversarial squad — Glossary + Contextive (M4)

Four independent read-only lenses reviewed the draft spec in parallel. Findings and
dispositions below. Testability + terminology findings were folded into **spec rev 2**;
architecture + decomposition findings are **plan-phase** and are recorded here + in the
feature page's ADR impact for the plan session.

## Lenses

1. **reviewer-renata** — testability
2. **architect-alphonso** — architecture seams
3. **planner-priti** — decomposition
4. **lexical-larry** — terminology / ubiquitous language

## Disposition summary

`changed` = folded into spec rev 2. `plan` = recorded for the plan/ADR phase. `accepted` = no change needed.

### Testability (folded into rev 2)

| # | Sev | Finding | Disposition |
|---|-----|---------|-------------|
| T-01 | high | Case-sensitive rule contradicted the "cargo"/"Cargo" example → untestable flagship test | **changed** — FR-006 now whole-word **case-insensitive**; example reworded |
| T-02 | high | "first per H2 section" had no section boundary → link count unassertable | **changed** — FR-005 defines section = H2→next-H2, pre-first-H2 implicit, H3+ belong to parent |
| T-03 | high | Collision warning had no channel/format/multiplicity | **changed** — NFR-007 pins a stable greppable line, one per distinct term per page, exit 0 |
| T-04 | high | "native preview" could mean `title` attr, which cannot meet 1.4.13 | **changed** — FR-009 custom popover (not `title`); NFR-001 direct hoverable/Esc/persistent assertions |
| T-05 | high | a11y gate vacuous (M5 lesson) — scans a link-free page green | **changed** — FR-014 asserts ≥1 auto-link + ≥1 `:term` collision before the scan |
| T-06 | med | Footprint claim needed a capture method + non-vacuity twin | **changed** — NFR-003 Playwright network capture, glossary page requests chunk, control does not |
| T-07 | med | References block empty/dedup/order underspecified | **changed** — FR-010 omit-when-empty, dedup by distinct term, stable order |
| T-08 | med | SC-006 malformed-file criterion had no fixture | **changed** — FR-014 ships a malformed fixture |
| T-09 | med | "scheme-check any URL in meta" had no defined outcome | **changed** — FR-004 non-allowlisted scheme is build-fatal |
| T-10 | low | NFR-004 mixed observable + impl claim; "performant" unmeasurable | **changed** — NFR-004 is byte-identical determinism only; single-pass moved to plan |
| T-11 | low | presence-driven activation had no acceptance test | **changed** — FR-001 asserts the no-file build path |

### Terminology (folded into rev 2)

| # | Sev | Finding | Disposition |
|---|-----|---------|-------------|
| L-01 | high | `:term[word]` used the term's own banned synonym "word" | **changed** — `:term[text]{context=…}` |
| L-02 | high | `glossary: false` bool ambiguous (feature vs autolink; future object collision) | **changed** — renamed **`glossary_autolink: false`** |
| L-03 | med | "domain"/"namespace" leaked for context | **changed** — "context" throughout |
| L-04 | med | "A word defined in two contexts" | **changed** — "A term defined…" |
| L-05 | med | collision (data) vs ambiguity (resolution) used interchangeably | **changed** — **unresolved collision** defined as canonical |
| L-06 | med | "References" block vs "Reference" nav vs M3 "External references" clash | **changed** — renamed the per-page block **"On this page"** with labelled sub-lists |
| L-07 | low | "entry" used for term (banned) | **changed** — "definition"/"anchor" |
| L-08 | low | "definitions file" inconsistency | **changed** — standardized |
| L-09 | low | "terms linked" vs "links used" drift | **changed** — "glossary links used" |
| — | note | context-level `domainVisionStatement` never mentioned | **changed** — FR-003 renders it if present |

### Architecture seams (plan-phase — recorded for the plan/ADRs)

| # | Sev | Finding | Disposition |
|---|-----|---------|-------------|
| AS-3 | high (biggest) | References block needs remark `file.data` ("links used") but M3 renders refs as prop-less carrier-body components (ADR-0017) with no channel to it | **plan** — spec open-question; the references-block ADR must name the data channel (companion/amendment to ADR-0017); prefer compose-not-mutate |
| AS-6 | high | Generated glossary pages are non-authored → invisible to `getCollection('docs')`, `sections.yaml`, sidebar, sitemap, agent API, `llms.txt` unless codegen'd into the collection | **plan** — spec open-question + FR-013 now requires generators pick them up; the source+generation ADR must choose codegen-into-collection vs injected route |
| AS-2 | high | `:term` needs `remark-directive`/`mdast-util-directive` — not present today | **plan** — new pinned dep in the auto-link ADR; order directive-parse before the linker |
| AS-1 | high | Remark ordering (after gfm), ancestor-type guard, explicit deck behavior | **plan** — auto-link ADR pins order + guard + deck decision (mirror deck-split's `kind` early-return) |
| AS-4 | med | Hover-preview island vs out-of-frame deck shell (M5 `main.reveal` guard) | **plan** — reuse the M5 island pattern; decide deck glossary-link behavior |
| AS-5 | low | per-page frontmatter reaches remark via `file.data.astro.frontmatter` (confirmed, like deck-split); single shared matcher | **accepted** — mechanism confirmed |

### Decomposition (plan-phase — recorded for tasks)

| # | Sev | Finding | Disposition |
|---|-----|---------|-------------|
| D1 | high | The auto-linker WP is too big; split the pure resolver (collision/alias/anchor) from the AST plugin | **plan** — resolver is its own WP, shared by the linker and `:term` |
| D2 | high | `config.ts` single-owner contention (plugin + `:term` + preview + route) | **plan** — one integration WP owns `config.ts` (M5 WP03 pattern) |
| D3 | high | ci-green activation ordering: the example definitions file is the on-switch | **plan** — terminal WP lands `.contextive` + pages + `AXE_PAGES` + `sections.yaml` + count-pins atomically; all prior WPs dormant |
| D4 | high | M3 references block risks out-of-map edits | **plan** — settle reuse-vs-new in the AS-3 ADR before tasks; prefer a new block composing M3 |
| D5 | med | References block ↔ auto-linker "links used" data contract | **plan** — the linker exposes a per-page links-used collection |
| D6 | med | slug/anchor fn is a four-way shared contract | **plan** — owned by the resolver WP |
| D7 | low | nav is tiny + shared-file; don't make it a standalone late WP | **plan** — default entry folds into the generator WP; example pin into the terminal WP |

Recommended shape (planner-priti): ~9 WPs (8 dormant infra/logic + 1 terminal activation);
ADRs authored in the plan phase.

## Outcome

Spec advanced to **rev 2**: all testability (T-01..T-11) and terminology (L-01..L-09)
findings folded in; the two highest architectural risks (AS-3 references-block data channel,
AS-6 generated-page registration) plus AS-1/AS-2 are surfaced as spec open-questions and
handed to the plan phase. No finding was silently dropped. Spec is ready for
`/spec-kitty.plan` (a new session).
