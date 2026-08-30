---
title: Adopting doc-kitty — the spec-kitty proving ground
description: "What a demanding real adoption (spec-kitty) proves about doc-kitty: two asymmetries, the SWOT, reuse ceiling, and the phased path with two hard gates."
doc_status: active
updated: 2026-08-30
type: Architecture
kind: Explanation
tags: [adoption, spec-kitty, common-docs, migration, markua, leanpub, swot]
related:
  - architecture/research/markua-syntax-support
  - architecture/research/ars-rethorica-book-example
  - adr/0004-amend-common-docs-as-extensible-variation
  - adr/0008-swappable-theme-layer
---

# Adopting doc-kitty — the spec-kitty proving ground

doc-kitty is a general, reusable documentation toolkit. This note is not a plan to
migrate spec-kitty; it is a fit study written **for doc-kitty**, using spec-kitty as
the **proving ground** — a large, governed, real consumer whose demands stress-test
the toolkit. The question is not "should spec-kitty adopt doc-kitty" in the abstract.
It is: *what does a demanding real adoption look like, what does doc-kitty genuinely
offer, what are the risks, and what doc-kitty-side changes reduce adoption friction?*

## BLUF

A demanding real adopter confirms doc-kitty's render-layer value is **real, reusable,
and native** to an agent-first, doctrine-governed org — and exposes exactly the
immature edges a first adopter should force upstream before anyone fans it out.

Two asymmetries frame everything below:

1. **The incumbent's investment is gates, not rendering.** spec-kitty's DocFX skin is
   an **857-LOC** CSS/JS layer over stock DocFX; its real documentation investment is
   **~12,836 LOC of Python enforcement gates**. A renderer swap discards almost no
   rendering value but must re-port those gates — the redirect gate being the hard one.
2. **doc-kitty's value is real but unevenly distributed.** **Per-kind layouts + section
   hubs + structure/display decoupling are the disproportionate prize** that justifies
   an eventual swap. The agent-API and reference blocks are *cheap* — approximable on
   DocFX with data spec-kitty already owns. Decks are *niche* for a docs-heavy adopter like the proving ground (still a first-class product pillar for doc-kitty itself).

**Recommendation (one line):** adopt in three phases — bank the convention and the
cheap wins now with zero platform risk (Phase 0), clear the two hard gates next
(Phase 1), and prove the render-layer bundle on net-new and one bounded section before
touching the full corpus (Phase 2); defer org-wide fan-out until the ceiling clears.

**The two hard gates — both unsoftened, both human-owned:**

- **License.** doc-kitty is **UNLICENSED, has no LICENSE file, ships at `0.0.0`, and is
  ~9–10 days old with a bus factor of one.** A wheel-publishing, governed repo must not
  ingest unlicensed code. Cheap to clear (one operator owns both repos) but still an *open* blocker — no code crosses until it is resolved.
- **NFR-002 redirect parity.** doc-kitty ships **no redirect-coverage equivalent**, and
  a DocFX→Astro move changes **every URL** (`…/foo.html` → `…/foo/`), reopening the
  ~1,589-link SEO/404 regression class. It must be re-architected and **live-validated
  before** any cutover, not after.

---

## What the proving ground has today

spec-kitty ships a **DocFX + Python** pipeline over a large corpus: **790 `.md` files,
60 `index.md` section indexes, 18 top-level sections.** It is a governed consumer — a
wheel-publishing Python repo with CI gates (`test_pyproject_shape.py`,
`clean-install-verification`) built specifically to keep non-Python runtimes out.

The load-bearing fact is *where the documentation investment actually lives*:

- **Rendering is a thin skin.** The DocFX template (`docs/templates/spec-kitty/`) is
  `main.js` + `main.css`, **~857 LOC total, zero custom partials or layouts** — stock
  DocFX plus a CSS skin. spec-kitty has never engaged DocFX's template engine.
- **The real investment is gates.** The `scripts/docs/*.py` pipeline is **~12,836 LOC**,
  almost all *enforcement*: the NFR-002 redirect-coverage machinery, the
  `generate_kitty_specs_docs.py` mission dashboard (~955 LOC, no equivalent),
  freshness/inventory lockfiles, and the `glossary_linker.py` post-build pass.

The pain the proving ground brings is genuine, not hypothetical. `docs/plans/` is the
single largest section at **265 `.md`**, and `docs/plans/engineering-notes/` alone holds
**108 `.md`** across weakly-typed sub-buckets — a textbook append-only dumping ground.
The ledger shows **~60 doc-cleanup / consolidation Missions** and a standing "Common-Docs"
cluster already migrating piecemeal toward exactly this kind of curated convention —
paying the semantic authoring cost in place, over and over, never banking a render-layer
payoff.

So the proving ground arrives with (a) a rendering layer worth almost nothing to
preserve, (b) a large, valuable **gate** layer that must survive any swap, and (c) real,
located, recurring content drift that a curation convention is designed to arrest.

## What doc-kitty offers

doc-kitty's net-new value over the incumbent is a **render-layer bundle**, verified as
real, reusable code in `src/`. For an executive read, that bundle sorts into three tiers.

> **Prize · Cheap · Niche — the exec cut**
>
> - **Prize (disproportionate to replicate):** **per-kind layouts + section hubs +
>   structure/display decoupling** (`src/layouts/kind-layouts.ts`, `Default.astro`,
>   `Hub.astro`, `Persona.astro`, `DeckLayout.astro`; ~650 LOC). DocFX has no first-class
>   per-kind dispatch or content/presentation decoupling primitive. Building these
>   natively means bending a template engine spec-kitty has never touched, against its
>   grain — realistically *weeks*, fragile, still an approximation. Astro/Starlight gives
>   them for free. **This slice alone justifies an eventual swap.**
> - **Cheap (approximable on DocFX, with data spec-kitty already owns):** the
>   **agent-API + RSS + `llms.txt`** (a static-JSON projection of already-parsed
>   frontmatter — ~1–2 Python-days, its cheapest slice) and **reference blocks**
>   (spec-kitty already owns `related`/`audience` data; rendering it is CSS + template
>   work, not new modelling).
> - **Niche (optional):** reveal.js **decks** (a handful of 790 docs) and chrome/theming
>   (spec-kitty already ships a working skin).

The consequence for the tempting shortcut — *"keep DocFX and just build the agent-API
ourselves"* — is that it substitutes only the **smallest** slice and leaves the
render-layer bundle (per-kind layouts + hubs) unaddressed.

**Markua → Leanpub, scoped precisely.** doc-kitty's Markua path (`src/lib/markua/`,
ADR-0030) is an **export enabler** — Should/MVP on the roadmap — *not* an in-tool
book/manuscript content type, which is an explicit Won't ("competes with Leanpub"). A
Markua-clean source makes a future Leanpub book or course materially easier to spin up;
it does **not** make doc-kitty a publisher. See
[Supporting Markua syntax](./markua-syntax-support.md) and
[Example content from ars-rethorica](./ars-rethorica-book-example.md).

## SWOT

Carried faithfully from the adjudicated spine; compressed to a callout.

> **Strengths.** Verified render-layer bundle as real, reusable code (per-kind layouts,
> hubs, decoupling, reference slots, decks, glossary, token themes, Markua). Packaged
> toolkit (`@commondocs-kitty/toolkit`, exports map / peer-deps / example split) with a
> spec-kitty brand theme already shipping. Agent-first surface aligned with spec-kitty's
> profile-load direction. The convention arrests dumping-ground drift and hits the located
> pain (`docs/plans` 265 md). Correctly-scoped Markua→Leanpub dividend. And spec-kitty is
> *already* drifting toward the convention (~60 Missions), so adoption **banks work in
> flight**; little rendering value is lost on a swap (857-LOC skin).
>
> **Weaknesses.** License **UNLICENSED / no LICENSE / `0.0.0` / bus-factor-1**. **No
> NFR-002 redirect equivalent**; every URL changes. Value **unevenly distributed** (only
> per-kind layouts/hubs/decoupling are disproportionate; agent-API and reference blocks
> approximable; decks niche). **`Feature` vocab** collides with the adopter's Mission
> canon. Convention **duplicates** spec-kitty's governed `042-common-docs` directive
> (#2302). Adds Node/pnpm to a governed Python repo; portals are **design-only**; doc-honesty
> drift (ADR-0030 unindexed, AGENTS.md/README stale).
>
> **Opportunities.** Rework-anyway leverage (adopt the convention now, pay authoring once,
> bank the ~60-Mission drift). Cheap early wins on DocFX, independent of migration.
> Zero-risk render-layer proof on net-new content. Org-wide reuse later. Markua→Leanpub
> book/course path. doc-kitty-side enablers also fix its own bugs (dogfooding dividend).
>
> **Threats.** Coupling risk — tying urgent clarity to a blocker-laden swap delays clarity.
> Public SEO/404 regression (~1,589 links). Dependency risk at scale (betting, esp.
> org-wide, on a bus-factor-1, unlicensed, `0.0.0` dep). Dual-runtime + gate-rebuild tax
> (the real sunk cost — Python gates — must be re-ported). Canonical-source fork (#2302);
> terminology regression (`Feature`).

## Reusability across spec-kitty repositories

doc-kitty is architected as a **distributable toolkit**, and the reuse contract is on
disk: `src/package.json` is `@commondocs-kitty/toolkit` with a proper `exports` map, a
`files` allowlist, and `peerDependencies` on `astro`/`@astrojs/starlight`;
`pnpm-workspace.yaml` splits toolkit from `example/`; `src/lib/theme.ts` implements a pure
`default → brand → consumer` merge (ADR-0008/0011/0013); and the toolkit's `routes/` make
every consuming docsite agent-discoverable. A spec-kitty brand theme already ships.

> **The honest reuse ceiling.** Confidence that the toolkit is a sound vehicle is **0.62**;
> confidence that org-wide rollout is justified *now* is **0.30** — and that gap is the
> ceiling, not a rounding error. The license blocker **multiplies** across N repos rather
> than sharing. The dependency is `0.0.0` / ~9-day-old / bus-factor-1. Reuse is proven at
> **N=1** (only the spec-kitty brand theme is instantiated — the `consumer` layer is a
> contract, not a fleet). The two un-shrunk gates (NFR-002, `Feature`) are the template
> every later repo inherits. Portals (`mission-status-portal`, `qa-portal`,
> `ticketing-report`) are Could/Extended, **design-only**, and cannot be counted as
> delivered value. **Prove the toolkit on one demanding repo first; fan out after license,
> bus-factor, and portals clear.**

## Tie-in to the emerging spec-kitty design

The fit is native, not forced; doc-kitty's shape mirrors patterns spec-kitty already runs.

- **Agent-first.** The agent-API / RSS / `llms.txt` surface and enforced `agent{}` / `kind`
  / audience metadata map directly onto spec-kitty's profile-load / agent-context direction
  (`spec-kitty agent profile show …`, `charter context`). Docs become a first-class
  agent-consumable surface, the same way governance already is.
- **Convention-as-doctrine.** doc-kitty's Common Docs convention states the counter-principle
  to the dumping ground verbatim (*"`docs/` is curated, not a wiki — stale docs are updated
  or deleted"*) and enforces it via per-file `type`/`kind` and a `plans/ = future`,
  `adr/ = past`, `architecture/ = present` separation. But it **overlaps** spec-kitty's
  governed `042-common-docs` directive — the canonical-source fork this study maps onto spec-kitty **#2302** (which predates, and does not itself name, doc-kitty). The
  clean reconciliation is a plane split: **spec-kitty doctrine owns the governance overlay**
  (section list, required frontmatter, terminology); **the toolkit's `convention.md` owns the
  render/toolkit contract.** Stop duplicating.
- **Reusable-toolkit governance dissolves bus-factor.** spec-kitty already ships doctrine,
  skills, and mission-steps as a packaged, upgrade-propagated toolkit consumed by every
  kittified repo. doc-kitty's toolkit/example/brand-theme split is the **docs-plane analogue**
  of that governance-plane pattern. Adoption *under spec-kitty governance* dissolves the
  bus-factor-1 tax by construction: the dependency stops being one author's greenfield and
  becomes governed, co-maintained infrastructure.

## Recommendation — phased reference adoption

The dialectic resolves not to a binary but to a **phased sequence**; the residual
disagreement is a *label* ("broad" vs "pilot"), not a path. Two framings are load-bearing:
**"the proving ground IS a pilot"** (a proving ground is a staged pilot that converts to the
fold when green, not a big-bang cutover — so no early work is wasted if the swap slips), and
**"rework anyway → pay authoring once"** (the docs are being reworked repeatedly regardless;
the per-file semantic judgement a cleanup performs — purpose, `kind`, `related`, `audience`,
`sources`, `doc_status` — *is* the convention's metadata, and it is both target-shaped and
DocFX-valid, so authoring it now is not lost if the renderer swap slips).

- **Phase 0 — now, no platform risk.** Curate and sanitize content, and **adopt the
  convention as portable frontmatter** — banking the ~60-Mission drift and arresting the
  dumping ground. Build the **cheap slices** (agent-API, reference-block data) on DocFX with
  data spec-kitty already owns. All reversible; no URL change; no renderer commitment.
- **Phase 1 — gates, human-owned.** Clear the **two hard gates** — resolve the **license**
  and **live-validate NFR-002 redirect parity** against the full ~1,589-link baseline. Land
  the doc-kitty-side churn-reducers (below), and trial **Node-in-CI** in one job.
- **Phase 2 — render-layer proof → migration.** Prove the bundle on **net-new content**
  first (`presentations/` decks, fresh hubs — *zero* redirect risk), then migrate **one
  bounded section** — `docs/development/` (32 md, an "extra section with no canonical home,"
  a genuine stress test) — end-to-end to validate the redirect map, PlantUML no-egress
  render, diagram engine, lockfile rollup parity, and `related` `.md` resolution before
  touching the full 790. **Per-kind layouts + hubs are the prize that earns the swap.**
- **Org-wide reuse — deferred.** Single-repo proof first; fan out only after license,
  bus-factor, and portals clear.

## Doc-kitty-side enablers (upstream to-do)

Concrete action items doc-kitty owns to reduce a real adopter's churn. Most **also fix
doc-kitty's own bugs** — the dogfooding dividend, and the reason a first adopter should force
these upstream now.

1. **`index.md`-as-index loader option** *(single biggest lever)*. Teach the loader to accept
   **both** `README` and `index` (`/(^|\/)(README|index)$/i` + an `indexBasename` option).
   Spares ~60 renames plus the ~1,589-link rewrite plus the rename-driven half of the URL churn.
2. **`type`/`kind` optional + derived.** Relax the standalone validator: `type` optional and
   registry-derived, `kind` optional. Avoids forcing two new required fields onto all 790 docs
   (the single largest raw authoring cost).
3. **Add `durable` to the `doc_status` enum** — an additive one-liner; spec-kitty uses it and
   doc-kitty's enum currently rejects it.
4. **Overridable vocabulary — neutralize `Feature`.** Make `type`/`kind` vocab overridable so a
   Mission-canon adopter can alias or neutralize `Feature`. This is *also* an internal doc-kitty
   inconsistency (`mission-status-portal.md` is itself typed `Feature`). Optionally add a
   generic config-driven forbidden-terms hook.
5. **Tolerate `adr/<era>/` paths** — accommodate era-partitioned ADR trees (spec-kitty has 124
   in `adr/3.x/`) without flattening.
6. **LICENSE resolution — BLOCKER.** UNLICENSED + no LICENSE file must be resolved before *any*
   doc-kitty code is vendored. Needs a human decision.
7. **A first-class redirect-coverage gate for migrating adopters.** doc-kitty ships *no* redirect
   equivalent; a renderer that changes every URL owes migrating adopters a redirect-coverage gate
   as a toolkit primitive, not a per-adopter rebuild.
8. **Doc-honesty fixes.** Add ADR-0030 to the ADR index; fix AGENTS.md (stale `status`, 4-of-13
   section list) and the README "early scaffold" drift.

## Key risks & open decisions

- **License** — UNLICENSED, no LICENSE, `0.0.0`, ~9–10 days old, bus-factor-1. A
  wheel-publishing governed repo must not ingest unlicensed code. **Hard gate; human decision.**
- **NFR-002 redirect rebuild** — no doc-kitty equivalent; DocFX→Astro changes every URL,
  reopening the ~1,589-link SEO/404 regression class. Must be re-architected and **live-validated
  before** any cutover. **Highest single technical risk.**
- **Node-in-CI** — adopting Node 22 / pnpm / corepack / Astro / Vale / markdownlint is a
  **permanent** second governance surface in a repo whose gates exist to keep it out. A one-time
  render gain amortized against a standing runtime tax.
- **`Feature` terminology** — doc-kitty ships `Feature` as both a `type` and a `kind`; the
  adopter's charter makes `Feature` **forbidden** in active surfaces, CI-enforced — canonical term
  is **Mission**. Blocked until the overridable-vocabulary enabler (enabler 4 / #40) ships. `Feature` appears
  here only as a collision to neutralize.
- **#2302 canonical-source fork** — the convention duplicates governed `042-common-docs`. Resolve
  via the plane split (doctrine owns governance, `convention.md` owns render) before broad
  adoption, or the fork widens.
- **Bus-factor-1** — a single-author, `0.0.0`, ~9-day-old dependency. Mitigated *structurally* by
  adoption under spec-kitty governance and co-maintenance; the risk **multiplies** if org-wide
  rollout precedes that mitigation.

**Net.** The genuine prize (per-kind layouts + hubs) justifies the eventual swap; the two
immovable gates (license, redirect) justify not doing it first; and the convention, content
clarity, and cheap slices are winnable **now**. A demanding real adoption proves doc-kitty's
render-layer bundle is real, reusable, and native to an agent-first, doctrine-governed org —
and proves that its immature edges are exactly what a reference adopter should force upstream
before anyone fans it out.
