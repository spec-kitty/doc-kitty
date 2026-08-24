# Post-tasks adversarial squad — M3 work packages

**Point-cut**: after `/spec-kitty.tasks`, before `/spec-kitty.implement`
**Reviewed**: `tasks.md` + `tasks/WP01…WP06` (finalized commit `acfd4c5`), `lanes.json`
**Nature**: anti-laziness / feasibility enrichment — advisory, not a gate.

## Squad (3 lenses, profile-loaded, read-only)

| Lens | Profile | Charge |
|---|---|---|
| Fakeable DoDs | `reviewer-renata` | could a WP pass green while broken? |
| Decomposition / ownership | `planner-priti` | dependency + owned-files + boundary realism |
| Feasibility / seams | `architect-alphonso` | do the prompts survive contact with the real code? |

The feasibility lane confirmed **every line-ref is exact** (`PERSONA_PAGE`:188,
`PERSONA_FRAGMENT_URL`:190, `ROUTES.persona`:13/`AXE_PAGES`:22,
`EXPECTED_INDEX_ENTRY_COUNT`:54/`EXPECTED_SITEMAP_URL_COUNT`:57, the
`{Slot && <Slot/>}`+named-`<slot>` passthrough at `MarkdownContent.astro:41–57`) and
the count math base 12 → WP03 14 → WP06 16.

## Findings & dispositions (all folded)

### BLOCKER — no stale-target artifact exists (renata)
The stale-marker assertion (WP06/T030, FR-005) needs a `deprecated`/`superseded`
page, but the whole `example/docs` tree is only `draft`/`active`, and `resolveRelated`
fails the build on a dangling ref — so the marker could never go green in scope.
→ **Fixed**: WP06/T032 now **creates** `example/docs/architecture/superseded-note.md`
(published, `doc_status: superseded`) as the demonstrator's stale related target;
added to WP06 `owned_files`/`create_intent`; folded into the final count (+1 → 16).

### HIGH — WP04 blocks unscanned by axe at their own boundary (priti + renata, convergent)
No example page declares `audience`/`related` until WP06's demonstrator, so WP04's
"blocks clear the a11y lane" was vacuous and the block renderers were exercised by
zero pages.
→ **Fixed**: WP04's objective/DoD now state the blocks are implemented + self-resolving
in WP04, but their **a11y verification lands in WP06** (demonstrator + AXE_PAGES +
assertions); WP04's bar is "correct + no regression of existing routes."

### HIGH — WP03 count "cross-check" is human-only + the authoring comment is already wrong (renata)
The pin gate detects drift from the constant, not truth; and
`assert-build-artifacts.mjs` (~:40–61) claims "13 files / one draft" when the tree
has **14 files / two drafts**.
→ **Fixed**: WP03/T018 now requires correcting that comment (and the persona-as-draft
comment at assert-chrome:185–187), and **showing the derivation** (published `.md`
minus drafts) in the review notes so the pin is corroborated.

### HIGH — WP03 persona-requiredness has no owned test surface (architect)
The parity corpus is hard-coded in `src/tests/schema-validator-parity.test.ts:55–64`,
owned by no WP; the fixtures would sit dormant.
→ **Fixed**: `schema-validator-parity.test.ts` added to WP03 `owned_files`; T019
directs `valid-persona.md` → `SHAPE_PARITY` and `missing-role.md` →
**`PRESENCE_LENIENT`** (schema lenient-accepts, validator rejects — placing it in
`SHAPE_PARITY` would red the suite).

### HIGH — WP03 out-of-map reach-in invisible to the ownership gate (priti)
WP03 edits three WP06-owned verification files for the atomic relocation; only prose
declared it.
→ **Disposition**: kept WP06 as single owner (the tooling forbids dual-ownership; the
overlap check passed precisely because they are not dual-listed). The reach-in is now
explicitly rationale-documented in WP03/T018 **and** flagged in WP06's risks. Safe
because WP06 depends transitively on WP03 — they never run in parallel (priti agreed
WP06 ownership is defensible).

### MEDIUM — folded
- **WP04 self-resolve path unstated** (architect): WP04 + ADR-0017 now state each
  prop-less body self-resolves via `Astro.locals.starlightRoute` + `getCollection`.
- **WP05 resolved-`related` type would lie vs frozen `AgentRecord`** (renata): WP01/T004
  now exports a `ResolvedRelated` type; WP05/T027 types the record against it (no cast).
- **WP05 version is a default** (architect): WP05/T028 now bumps the owned default at
  `agent-index.ts:35`; WP06/T031 asserts the concrete value.
- **WP06 `EXPECTED_PAGE_KEYS` string-loop** (renata): T031 now forbids appending array
  keys to the `:323–327` string loop and requires a bespoke shape assertion.
- **WP03 profile under-scoped** (priti): reassigned `frontend-freddy` → `implementer-ivan`
  (the `.mjs` gate + count work outweighs the one `.astro` layout).
- **count-pin canonical owner** (priti): WP03's pin labeled **interim (→14)**, WP06
  owns the **final** pin (→16).

### LOW — folded / noted
- WP05/T027 index-shape adaptation (`DocEntry` → flat index) stated.
- WP04/T022 reframed (`RelatedCard` already has props; the real gap is the stale prop;
  `resolveRelated` already collapses `note`/`description`).
- WP01 purity is guarded by vitest import, not a gate (accepted); WP06 accessible-name
  assertion is a static-HTML approximation of the WCAG name (noted for T030).

## Verdict

Decomposition, dependency edges, and the atomic-WP03 / carrier-merged-WP04 decisions
are sound. One in-scope BLOCKER (missing stale-target) and a cluster of fakeable/feasibility
gaps are folded into the WP prompts + ADR-0017. Ready for `/spec-kitty.analyze` → `/spec-kitty.implement`.
