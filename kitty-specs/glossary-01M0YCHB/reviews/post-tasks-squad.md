# Post-tasks adversarial squad — Glossary + Contextive (M4)

Three independent profile-loaded lenses reviewed the finalized tasks (9 WPs + ADRs +
contracts) in parallel, read-only. Convergent + complementary findings and their
dispositions below. `changed` = remediated in the tasks/ADRs before implement; `deferred`
= filed as a follow-up; `accepted` = confirmed sound.

## Lenses

1. **reviewer-renata** — anti-laziness / non-fakeable DoDs / FR-proof honesty
2. **architect-alphonso** — ADR-seam fidelity / AS-3 channel coherence
3. **paula-patterns** — decomposition / ownership boundaries / whack-a-field

## Findings & dispositions

### AS-3 — the "On this page" links-used channel (architect, 3×HIGH) — biggest risk

| # | Sev | Finding | Disposition |
|---|-----|---------|-------------|
| A-1 | HIGH | The **primary channel is architecturally dead**: `docsSchema({ extend: z.object() })` strips an undeclared `glossary_links_used`, and `entry.data` is frozen at collection-load while the remark write happens at render. The self-resolving carrier block can never read `route.entry.data.glossary_links_used`. | **changed** — dropped the remarkPluginFrontmatter primary; the deterministic **re-derive is now the sole mechanism** (ADR-0025 Decision 2/3 rewritten; WP08 T029 spike retired). |
| A-2 | HIGH | The **re-derive cannot reproduce `:term` links** (a fresh `entry.body` parse has no `data-glossary-term` nodes until `remarkDirective`+`glossary-term` run), and ADR/contract/WP named **three different** fallbacks (`resolve.ts` vs `computePageLinks`) — none runs the directive+term pre-pass, so `:term` pages get a strictly-smaller list (FR-010 violation). | **changed** — pinned **one** shared helper `linksForBody(body, ctx, index, ignore)` = parse → `remarkDirective` → `glossary-term` → `computePageLinks`, collecting **all** `data-glossary-term` nodes. ADR-0025 + contract + WP07 reconciled; `resolve.ts` wording removed. WP07 now depends on WP04 **and** WP05. |
| A-3 | HIGH | **No WP owns mounting `OnThisPage`**, and the ADR-intended mount (MarkdownContent.astro) already renders `<Related/>`/`<ExternalReferences/>` → double-render. That carrier is the ADR-0013 M1 carrier (**not** an INV-G5-frozen M3 file). | **changed** — WP07 now owns `src/components/MarkdownContent.astro`; it mounts `<OnThisPage/>` **presence-gated** (`isGlossaryActive()` from WP01): glossary inactive → the two standalones render as today (byte-identical dormancy, NFR-002); active → `<OnThisPage/>` replaces them (no double render). |

### Nav / section identity (paula, HIGH)

| # | Sev | Finding | Disposition |
|---|-----|---------|-------------|
| P-1 | HIGH | The "default Reference nav" (D7) + glossary **section identity** has no owned home; the only live mechanism is hardcoded `SECTION_ORDER`/`SECTION_LABEL` in the **M3-frozen** `metadata.ts` (consumed by llms-txt/rss). `_meta/sections.yaml` is **unwired** (draft spec, zero loaders). WP09 T032's "under Reference" assertion is unsatisfiable without the forbidden M3 edit. | **changed + deferred** — de-scoped D7 from WP03 T011; re-anchored WP09 T032 to Starlight **tree-autogeneration** (a `docs/glossary/` folder yields a sidebar group with no M3 edit) and the real-file generators (sitemap/agent-API/llms.txt see the globbed pages). **FR-013's sections.yaml-driven relocation is descoped** (documented deviation) and the registry-wiring filed as a follow-up issue. |

### Anti-laziness (renata, HIGH + MED)

| # | Sev | Finding | Disposition |
|---|-----|---------|-------------|
| R-1 | HIGH | WP09 non-vacuity gate under-pinned: since `:term` emits a **byte-identical** link node, `a[data-glossary-term]` count ≥1 proves neither half distinctly — a pure-auto-link page passes vacuously. | **changed** — WP09 T033 pins **two semantic `guardRoots` selectors**: an auto-link discriminator and `a[data-glossary-context="hr"][href*="/glossary/hr/#policy"]` on a **non-`hr`** page (provable only via `:term`), both wired into `AXE_PAGES[].guardRoots` (which gate the axe scan), scanned route = the context-less page. |
| R-2 | MED | NFR-007 greppable warning proven only at vitest, not against real build output. | **changed** — WP09 adds a build-output capture that greps the exact line, asserts one occurrence for the page, asserts exit 0. |
| R-3 | MED | FR-010 dedup/stable-order/omit-empty has no owned asserting test. | **changed** — WP07 T025 gains a concrete test (double-linked term → one entry; empty sub-list omitted; empty block omitted). |
| R-4 | MED | WP08 byte-identity (NFR-002) is a manual "diff vs pre-WP08", not a committed gate. | **changed** — WP08 T028 makes it a committed assertion (glossary-free build output/array hash vs a pinned baseline), mirroring `diagrams:false`. |
| R-5 | LOW | WP07 JS-off (NFR-005) unasserted. | **changed** — WP09 adds a Playwright `javaScriptEnabled:false` assertion for the block + plain anchors. |
| R-6 | LOW | Footprint-twin control route not pinned nor guaranteed term-free (auto-link could silently add a link). | **changed** — WP09 T034 names a dedicated control route + guards it carries zero `a[data-glossary-term]`. |

### Accuracy LOWs (paula)

| # | Finding | Disposition |
|---|---------|-------------|
| L-1 | `buildCatalog` is in `src/lib/catalog.ts`, not `metadata.ts`. | **changed** — corrected in ADR-0025, contract, WP07. |
| L-2 | resolver.md "four consumers" overstates — WP03 generator imports `anchor.slug` only (cross-links come from the auto-linker over generated pages). | **changed** — reworded to "three runtime consumers + generated-page cross-links via the auto-linker". |
| L-3 | WP05 T020 ":term counts-as-used" offered an unowned `file.data` alternative. | **changed** — pointed to WP04 T016 tree-scan as the single sanctioned mechanism. |

## Confirmed sound (conceded across lenses — not rubber-stamped)

- owned_files fully disjoint across all 9 WPs, matching lanes.json write_scope; dependency
  graph correct; WP08 single-owner clean; resolver-split (D1/D6) clean; WP04↔WP05 tree
  coupling correctly modeled; WP09 atomic bundling right; WP06/WP07 sizing defensible.
- AS-1/AS-2 remark order + ancestor guards + deck no-op faithful to the deck-split/diagram
  precedents; NFR-002 presence-gated dormancy sound; INV-G5 compose-not-mutate achievable
  without an M3 refactor; AS-6 codegen-into-collection timing sound; `entry.body` present on
  the glob loader; NFR-001 hover 1.4.13 direct assertions sound; NFR-004 determinism
  adequately covered.

## Deferred (filed, out of M4 glossary surface)

- **Wire `_meta/sections.yaml` registry to override the hardcoded `SECTION_ORDER`/
  `SECTION_LABEL` in `metadata.ts`.** Today section identity is split-brained (draft registry
  spec vs hardcoded list); every new section collides with the "don't edit M3" invariant.
  Non-goal for M4 — the glossary ships on Starlight tree-autogeneration. Tracker issue filed.

## Outcome

No finding silently dropped. The biggest-risk seam (AS-3) was materially corrected before
implementation: the dead primary channel removed, the `:term`-inclusive re-derive pinned as
the sole mechanism, and the mount assigned + presence-gated. FR-013's relocation mechanism is
an honest documented descope (deferred registry). Tasks re-finalized clean.
