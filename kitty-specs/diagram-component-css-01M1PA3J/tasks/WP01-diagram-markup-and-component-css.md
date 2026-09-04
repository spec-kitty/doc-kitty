---
work_package_id: WP01
title: Diagram markup correctness + component-CSS delivery + gates (#59/#60/#68)
dependencies: []
requirement_refs:
- FR-001
- FR-002
- FR-003
- FR-004
- FR-005
- NFR-001
- NFR-002
- NFR-003
- NFR-004
planning_base_branch: fix/diagram-component-css
merge_target_branch: fix/diagram-component-css
branch_strategy: Planning artifacts for this mission were generated on fix/diagram-component-css. During /spec-kitty.implement this WP may branch from a dependency-specific base, but completed changes must merge back into fix/diagram-component-css unless the human explicitly redirects the landing branch.
subtasks:
- T001
- T002
- T003
- T004
- T005
- T006
- T007
- T008
history:
- created by /spec-kitty.tasks
agent_profile: frontend-freddy
authoritative_surface: src/
create_intent:
- src/styles/dk-components.css
- src/tests/diagram-pipeline.test.ts
execution_mode: code_change
owned_files:
- src/lib/config.ts
- src/styles/dk-components.css
- src/styles/theme.css
- src/layouts/DeckLayout.astro
- src/tests/theme-merge.test.ts
- src/tests/diagram-pipeline.test.ts
- src/scripts/assert-build-artifacts.mjs
- tests/a11y/diagram.spec.ts
role: implementer
tags: []
tracker_refs: []
---

## ⚡ Do This First: Load Agent Profile

Before reading anything else, load your assigned profile via `/ad-hoc-profile-load frontend-freddy` (role: implementer). Apply its identity, boundaries, and the charter directives (`spec-kitty charter context --action implement --json`); state which you applied. Discipline for this WP: **DIRECTIVE_043** (close the defect class by construction, not a downstream patch), **DIRECTIVE_024** (smallest blast radius — one seam), **DIRECTIVE_041 / USE_MUTATION_TESTING** (each new gate must go RED on the re-introduced defect, GREEN after), red-first per the ATDD directive.

## Objective

Close #59, #60, #68. Emit a **well-formed Mermaid figure** (no stray `<pre>`), write the **figure/caption stylesheet**, and **deliver global component CSS** (callouts + diagrams) to branded docs pages AND out-of-frame decks — then add gates that close today's mutation-dead zone. Read `../spec.md`, `../plan.md` (IC-01/IC-02/IC-03), `../research.md` (D1–D5), `../data-model.md`, `../quickstart.md`. The approach is squad-decided — do not re-litigate it.

## Critical context (file:line, verified)

- **#59 root cause** — `src/lib/config.ts` `mermaidFenceTransform` (~:403-421) sets `data.hName='pre'`/`hProperties`/`hChildren` on a node still typed `code`. `mdast-util-to-hast@13.2.1` `handlers/code.js:43,46` applies `data.*` to the inner `<code>` and keeps its own outer `<pre>` → `<pre><figure class="dk-diagram">…</figure></pre>` on all 6 diagrams / 3 pages (deck, `architecture/overview`, `architecture/diagram-demonstrator`).
- **#68 root cause** — `src/lib/config.ts` (~:670-671): a brand theme replaces `customCss` slot 0 (static `theme.css`) with a tokens-only generated sheet (`src/lib/theme.ts:15-21`), so `theme.css` component rules (`.dk-callout*`, and any new `.dk-diagram*`) never reach branded docs. Confirmed: branded `example/dist/guides/markua-showcase` renders `.dk-callout` markup with no `.dk-callout` CSS linked.
- **Keep, don't delete**: `.reveal … pre:not(.mermaid)` (`src/styles/dk-reveal-theme.css:158`) and the code-block `tabindex` loop (`src/layouts/DeckLayout.astro` ~:216-220) — legitimate for REAL code blocks; they just stop *accidentally* matching the stray `<pre>` after T001.
- **Render owner** `src/lib/diagram/diagram-render.client.ts` selects `pre.mermaid` — unaffected by the retype (class preserved). `diagramMeta` runs BEFORE `mermaidFenceTransform` (pinned order) and keys on the `code`/`mermaid` node — retype after it, so it is unaffected. accTitle/accDescr live in `node.value` (untouched).
- The existing `example/docs/presentations/showcase-deck.md` already carries 3 Mermaid diagrams — it IS the deck fixture (FR-004); no new deck needed.

## Subtasks

### T001 — Retype the Mermaid node off `code` (#59)
In `mermaidFenceTransform` (`src/lib/config.ts`): keep the `hName:'pre'`/`hProperties{class:mermaid}`/`hChildren` projection but change the node's `type` off `code` (e.g. `dkMermaid`), so `mdast-util-to-hast`'s unknown-node handler emits a **single** `<pre class="mermaid">` with no wrapping `<pre>`. Leave `src/lib/rehype/diagram-figure.ts` UNCHANGED (fallback: only if a downstream remark consumer breaks on the custom type, and record the rationale). Confirm the render selector still matches. Update the misleading comment (~:394-401) so it states the truth.

### T002 — Author `src/styles/dk-components.css` (#60 + #68)
Create the standalone component stylesheet:
- Relocate the `.dk-callout*` block verbatim from `src/styles/theme.css` (behavior-preserving move).
- Add `.dk-diagram` (centered block, vertical margin, `overflow-x:auto`), `.dk-diagram__caption` (`font-size: var(--dk-text-sm)`, `color: var(--dk-color-text-muted)`, centered, top spacing, **`white-space: normal`**, non-monospace `font-family`), `.dk-diagram__desc`, `.dk-diagram__attr a` (link accent). Use general text tokens — NOT the `--dk-diagram-*` graph-color tokens (C-003). No separate dark block (tokens flip by mode).

### T003 — Remove `.dk-callout*` from `src/styles/theme.css` (#68)
Delete only the `.dk-callout*` block now living in `dk-components.css`; leave tokens/bridge intact.

### T004 — Wire delivery on both surfaces (#68)
- In `src/lib/config.ts`, add `dk-components.css` as its OWN `customCss` entry (NOT slot 0), so it survives the brand slot-0 replacement and bundles into branded docs (both themed and default paths).
- In `src/layouts/DeckLayout.astro`, add an explicit `<link>` to `dk-components.css` (out-of-frame decks get no global injection).

### T005 — Update the customCss invariant (NFR-004)
`src/tests/theme-merge.test.ts` asserts the default-path `customCss` shape (e.g. length===1). Update it deliberately to reflect the added component entry; keep the token/bridge contract assertions intact.

### T006 — Build-artifact gates (red-first, #59/#60/#68)
In `src/scripts/assert-build-artifacts.mjs`:
- Assert **no `<pre>` directly wraps `<figure class="dk-diagram">`** across ALL 3 diagram pages (deck, `architecture/overview`, `architecture/diagram-demonstrator`) — `architecture/overview` is currently in no lane.
- Assert a branded docs page that renders a callout/diagram **delivers** `.dk-callout` AND `.dk-diagram__caption` rules (the sheet is linked/bundled on that page).
Prove both go RED on today's build before T001-T004 land (capture in review notes).

### T007 — Pipeline unit (red-first, #59)
Add `src/tests/diagram-pipeline.test.ts` running the REAL chain (`diagramMeta → mermaidFenceTransform → mdast-util-to-hast → diagramFigure`) on a ```mermaid fence and asserting the resulting `<figure class="dk-diagram">` has **no `<pre>` ancestor**. (Today's `diagram-figure.test.ts` hand-builds the fixture and is blind — do not rely on it.) Must fail if the outer `<pre>` returns.

### T008 — Playwright computed-style check (#60), docs + deck
Extend `tests/a11y/diagram.spec.ts`: on `figcaption.dk-diagram__caption`, assert computed `font-family` is not monospace and `white-space` is not `pre`, and the figure is not inside a code-card — on BOTH a docs diagram page AND the deck (`presentations/showcase-deck/`). Do NOT re-enable #31's deferred internal-node-geometry assertions (C-004).

## Branch strategy

Planning branch: `fix/diagram-component-css`. Final merge target: `main` (PR). Execution worktree is the computed lane from `lanes.json`; completed WP merges back into `fix/diagram-component-css`.

## Definition of Done

- `pnpm build` clean; 0 `<pre>`-wrapped diagram figures across the 3 pages; branded docs/deck ship `.dk-callout` + `.dk-diagram` rules; captions non-mono/wrapping on docs + deck.
- New gates (T006/T007/T008) demonstrably RED before the fix, GREEN after (mutation-true).
- Existing diagram/deck/a11y/build gates still green; real code blocks keep code-card + focusable scroll.
- `pnpm -C src test`, `pnpm assert:artifacts`, `eslint`, `astro check` pass locally where the env allows; CI is the authority.

## Risks / reviewer guidance

- Verify the retype doesn't disturb non-diagram fenced code (Shiki/expressive-code) — a non-`code` node strengthens the sidestep; confirm real code blocks still render + keep `tabindex`.
- Confirm `dk-components.css` reaches BOTH branded docs and the deck (not just one) — the false-green trap is "bundled ≠ applied"; the computed-style check (T008) is the applied-proof.
- Keep the `.dk-callout` move byte-equivalent (no rule changes during relocation).
