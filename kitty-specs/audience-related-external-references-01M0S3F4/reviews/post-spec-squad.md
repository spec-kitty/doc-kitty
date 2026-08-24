# Post-spec adversarial squad — M3 (audience / related / external references)

**Point-cut**: after `/spec-kitty.specify`, before `/spec-kitty.plan`
**Mission**: `audience-related-external-references-01M0S3F4`
**Spec reviewed**: `spec.md` rev 1 (commit `b917e72`)
**Nature**: enrichment pass — advisory, not a mission gate.

## Squad composition (4 lenses, profile-loaded, read-only)

| Lens | Profile | Charge |
|---|---|---|
| Testability / anti-laziness | `reviewer-renata` | fakeable DoDs, requirement ambiguity, agent-surface + invariant pins |
| Architecture seams | `architect-alphonso` | ADR-0013/0011/0015 seams, the slot-props-vs-carrier-body decision, frozen-shape discipline |
| Decomposition / scope | `planner-priti` | sequencing, severability of deferrals, green-at-every-boundary realism |
| Terminology | `lexical-larry` | synonym drift vs. `docs/context/` canonical vocabulary |

Each delegate loaded its profile via `spec-kitty agent profile show <id>` +
`charter context --action specify` and applied the resolved directives/tactics.

## Convergent findings (multiple independent lenses) — highest confidence

### C1 — Persona-relocation blast radius understated → **BLOCKER**
*renata [BLOCKER], architect [HIGH], priti [HIGH] — three lenses, independently.*

FR-012 / C-006 (rev 1) said the move touches "the one hard-coded assertion path."
In fact `personas/example-persona` is hard-coded across **four** gate sites, all
verified:

- `src/scripts/assert-chrome-artifacts.mjs:188` — `PERSONA_PAGE`
- `src/scripts/assert-chrome-artifacts.mjs:190` — `PERSONA_FRAGMENT_URL` (+ uses at :682/699/706/712/717)
- `tests/a11y/routes.ts:13` — `ROUTES.persona`
- `tests/a11y/routes.ts:22` — `AXE_PAGES` entry
- plus `docs/architecture/metadata-model.md`

After a bare `git mv`, `test:a11y` 404s and `assert:chrome` fails — falsifying
C-007 (green-at-every-boundary) and NFR-002. (No persona-specific visual baseline
exists — only `home-*.png` — so that is *not* a relocation site.)

**Resolution**: rev 2 FR-012 + C-006 enumerate all four sites and require the move,
both assertion rewrites, the a11y-route rename, and the doc update to land in one
atomic step. Also reconcile the example persona's `type: Guide` → `Context`.

### C2 — The example page-count invariant will move, owned by no FR → **BLOCKER**
*priti [BLOCKER], renata [HIGH], architect [LOW-note].*

The Audiences hub (FR-013) is a new **published** page. The pins
`EXPECTED_INDEX_ENTRY_COUNT = 12` (`assert-build-artifacts.mjs:54`) and
`EXPECTED_SITEMAP_URL_COUNT = 12` (`:57`) will red the instant it lands. Rev 1's
FR-019 named only `assert-chrome-artifacts.mjs`; **no FR owned
`assert-build-artifacts.mjs`.** The count bump lived only in a soft Assumption.

**Resolution**: rev 2 adds **FR-023** (example-invariant pins) owning
`assert-build-artifacts.mjs` — the count/sitemap/`EXPECTED_PAGE_KEYS` updates land
atomically with the published-set delta.

### C3 — Persona's post-move `doc_status` undecided (compounds C2 + US1 + US5)
*renata [MEDIUM], priti [HIGH], architect [note].*

The persona is `doc_status: draft` today — it is the single draft that makes the
`13 files − 1 = 12` invariant, and it is US5's only draft-exclusion subject
(`assert-build-artifacts.mjs`). If it stays draft, the Audiences hub may drop it
from its child list (empty hub) and US1 links to a draft page; if promoted, US5
loses its draft subject.

**Resolution (decision taken)**: the relocated persona becomes **`active`
(published)** — you link readers to real persona pages and a Hub lists published
children. Rev 2 **FR-022** requires **≥1 draft example page to remain** as the US5
draft-exclusion demonstrator, and **FR-023** pins the recomputed counts. Exact
integers are computed and cross-checked in the implementing WP.

### C4 — `toAgentRecord` cannot resolve `related` while pure/single-entry
*architect [MEDIUM], renata [MEDIUM], priti [MEDIUM].*

`toAgentRecord(entry)` (`metadata.ts:207`) is single-entry and emits raw
`related`; resolving to `{ref,title,kind,doc_status}` needs the whole corpus, and
changes a **published** `AgentRecord.related` shape for existing consumers.

**Resolution**: rev 2 FR-014 keeps `toAgentRecord` pure, adds a separate
`resolveRelated(refs, index)` composed in the routes (which already call
`getCollection('docs')`), and **bumps the agent-API `version`** (DIRECTIVE_018).

## Single-lens findings folded

### From architecture (architect-alphonso)
- **A1 [HIGH]** The slot-props path is **ADR-0015-incompatible** — `MarkdownContent.astro:41-57`
  invokes slot bodies with **no props** and `manifest.ts` types them as bare
  factories. → rev 2 **C-002 resolves toward carrier-body rendering** (props path
  dropped) and **FR-021 adds a content-block-rendering ADR** (or an ADR-0015
  amendment) covering the double-render/theme-override coexistence
  (`{AudienceSlot && <AudienceSlot/>}` + named `<slot>` + new data render).
- **A2 [MEDIUM]** FR-016 "resolvers reused **by import** in the build-free gates"
  contradicts the standalone-gate design (`check-links.mjs` is zero-dep, re-implements
  its checks; parity tests exist *because* gate ≠ TS schema). → rev 2 FR-016: pure TS
  resolvers reused by the **build + API routes + vitest**; the build-free gate
  **parity-duplicates** ref/citation resolution, covered by NFR-004.
- **A3 [MEDIUM]** Persona-field requiredness cannot live in the lenient zod schema
  (`kind` is open `z.string()`, fields globally optional). → rev 2 FR-010:
  requiredness is a **standalone-validator** concern (path/kind-aware); zod stays
  lenient (protects parity semantics).
- **A4 [MEDIUM]** Catalog fail-fast couples consumers to two collection wirings. →
  rev 2 FR-007: the toolkit **exports catalog schema + loader** (mirroring
  `docKittyDocsSchema()/Loader()`); fail-fast assumes the collections are wired.
- **A5 [LOW]** `/api/bibliography.json` sits **outside** `doc_status` gating (catalog
  records are not pages). → stated in rev 2 FR-015.
- **A6 [LOW]** Relocation reorders the agent surface (`personas` → `context`, rank 0).
  → noted for the location ADR.

### From testability (reviewer-renata)
- **R1 [HIGH]** The a11y lane never scans a wired block — `AXE_PAGES` covers
  persona/hub/prose only. → rev 2 **FR-022** adds a published demonstrator page
  rendering all three blocks, registered in `AXE_PAGES`.
- **R2 [HIGH]** FR-009 (accessible-name-is-title) bound to no check. → rev 2 FR-019
  adds a build assertion that the reference item's accessible/leading text is the
  resolved **title**, not the mono key.
- **R3 [MEDIUM]** FR-020 resolver fixtures (warn/build-fail) misassigned to the
  parity test. → rev 2 FR-020 splits fixtures by owning lane (resolver→vitest/NFR-005,
  schema→parity/NFR-004).
- **R4 [MEDIUM]** NFR-004 catalog parity unsatisfiable — no build-free catalog
  validator. → rev 2 FR-008 extends the build-free gate to validate catalog records
  + citation resolution.
- **R5 [MEDIUM]** `/api/bibliography.json` and the enriched page-record shapes
  under-pinned. → rev 2 FR-019 pins per-record expected shapes.
- **R6 [MEDIUM]** NFR-003 Pagefind check weaker than house bar (any fragment vs. the
  citing page's own url-scoped fragment). → rev 2 NFR-003 requires the **citing
  page's own** fragment.
- **R7 [MEDIUM]** FR-017 lilac-token escape hatch has no mechanical check. → rev 2
  FR-017 adds `--dk-color-tint-lilac` to the enumerated `REQUIRED_DK_TOKENS`
  completeness list.
- **R8 [LOW]** Audience inline-link target-size (WCAG 2.5.8) unverified by axe. →
  rev 2 NFR-001 documents the inline-link exception.
- **R9 [LOW]** SC-006 self-merge wording. → rev 2 clarifies the WP→feat→main flow.

### From decomposition (planner-priti)
- **P1 [HIGH]** Decomposition is **layered atomic-cutover, not per-user-story**;
  critical path: foundation (resolvers/catalog/gate/type-sync) → atomic persona WP →
  block fan-out → agent surface → hardening. → rev 2 adds an explicit
  **"Layered landing"** note (mirrors M1's atomic-cutover framing).
- **P2 [HIGH]** Catalog + first `{type,id}` demonstrator must co-land (both
  `docs/_meta/` and `example/docs/_meta/` roots). → rev 2 FR-007/FR-008 state co-landing.
- **P3 [MEDIUM]** FR-002 soft-warn needs a defined, observable warning **channel** the
  US1 test can bind. → rev 2 FR-002 fixes the channel (printed build-log line,
  matching the M1 validator posture).
- **P4 [MEDIUM]** FR-010 is 2–3 WPs (ADR + schema + validator + parity + render). →
  noted for tasks sizing.
- **P5 [LOW]** Deferred items confirmed genuinely severable — scope boundary clean.
  MVP-tightening lever if needed: persona attribute fields (FR-010/011) are not
  required for US1 link resolution.

### From terminology (lexical-larry)
- **L1 [HIGH]** The stale-marker element is named **5 ways** on a CI-asserted element.
  → rev 2 canonicalizes to **"stale-target status marker"** everywhere and adds a
  Domain Language section.
- **L2 [MEDIUM]** "registry" (US5) collides with the section/kind-layout registries.
  → rev 2 uses "catalog **projection**".
- **L3 [MEDIUM]** "CSL-JSON-lite" ungoverned. → rev 2 routes it to the catalog ADR +
  the Domain Language section.
- **L4 [MEDIUM]** citation/reference split **inverts** `metadata-model.md` (which calls
  the inline form an "inline citation"). → rev 2 Domain Language fixes: *external
  reference* = any entry; *citation* = a catalog `{type,id}` entry; *catalog record*
  = the resolved row; "citation key" scoped to the catalog case (FR-009).
- **L5 [MEDIUM]** catalog `type` overloads the frontmatter `type` axis. → rev 2
  qualifies every occurrence as "**catalog `type`**".
- **L6 [LOW]** `guidance_text` misattributed to the persona (FR-001). → reworded to
  "the entry's `guidance_text`".
- **L7 [LOW]** record/entry blur (US3 test). → reworded.

## Adjudicated divergences

No irreconcilable conflicts. The one place lenses touched the same seam —
FR-016 "shared resolvers" — architect (A2) and renata (R4) **converged**: the
build-free gate must **parity-duplicate** resolution, not import it. Resolution
applied as stated. All findings were grounded in cited code/ADR/spec evidence;
none were averaged away.

## Verdict

Spec is **structurally sound and buildable on the existing seams**; scope is
severable and terminology's hardest axes (audience/profile/persona) are precise.
Two **BLOCKER**-class green-boundary hazards (C1 relocation blast radius, C2
unowned count pin) plus the C3 persona-status decision and the C4 agent-record
seam are folded into **rev 2**. Ready for `/spec-kitty.plan` once rev 2 lands.
