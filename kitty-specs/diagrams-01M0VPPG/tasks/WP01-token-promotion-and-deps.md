---
work_package_id: WP01
title: Token promotion + deps (--dk-diagram-* to Default + brand)
dependencies: []
requirement_refs:
- FR-006
- NFR-004
planning_base_branch: feat/diagrams
merge_target_branch: feat/diagrams
branch_strategy: Planning artifacts for this mission were generated on feat/diagrams. During /spec-kitty.implement this WP may branch from a dependency-specific base, but completed changes must merge back into feat/diagrams unless the human explicitly redirects the landing branch.
subtasks:
- T001
- T002
- T003
- T004
- T005
history:
- '2026-08-25: authored by /spec-kitty.tasks'
agent_profile: implementer-ivan
authoritative_surface: src/lib/theme.ts
create_intent:
- src/tests/diagram-tokens.test.ts
execution_mode: code_change
owned_files:
- src/lib/theme.ts
- src/styles/theme.css
- src/themes/spec-kitty/tokens.css
- src/themes/spec-kitty/assets/diagram-tokens.css
- src/scripts/assert-chrome-artifacts.mjs
- src/tests/diagram-tokens.test.ts
- package.json
- pnpm-lock.yaml
role: implementer
tags: []
tracker_refs: []
---

## ⚡ Do This First: Load Agent Profile

`/ad-hoc-profile-load implementer-ivan` (role: implementer). Apply its initialization,
boundaries, directives, and tactics. Then read this WP, [../spec.md](../spec.md),
[../plan.md](../plan.md), [../data-model.md](../data-model.md),
[../contracts/render-token-and-assertions.md](../contracts/render-token-and-assertions.md),
and `docs/adr/0024-diagram-token-promotion-and-brand-wiring.md`.

## Objective

Pin the diagram dependencies and **promote the `--dk-diagram-*` tokens into the Default
catalog** (light **and** dark) **and** wire them into the brand `tokens.css`, retiring the
orphan `diagram-tokens.css`. Prove the contrast pairs meet AA with a vitest, and update the
chrome/CSS-signature assertion for the promoted tokens. **No diagram renders in this WP** —
the example stays `diagrams: false` (WP03 flips it), so `ci-ok` stays green.

## Supply-chain (NFR-004 — read `research.md` supply-chain note)

`astro-mermaid@2.1.0` + `mermaid@11.17.1`, **exact-pinned**, no CDN, no lifecycle scripts of
concern. Verify: (a) `astro-mermaid@2.1.0` peer range admits our Astro; (b) the **build/prod
dependency graph** pulls **no Playwright and no puppeteer** (either would defeat the
browser-free-build premise; mermaid's SSR/CLI path uses **puppeteer**). Record both in the
handoff note. Deny-by-default posture on install scripts per directive 051.

> **NOTE (squad F6):** `pnpm why playwright` is **not** empty here — `@playwright/test` +
> `@axe-core/playwright` are existing **dev** deps of the a11y lane. The NFR-004 guard is about
> the **build** graph, so scope the check to production/build (see T001), not the dev tree.

## Subtasks

### T001 — Pin deps
- Add `astro-mermaid@2.1.0` and `mermaid@11.17.1` to `package.json` (exact versions, no `^`).
- `pnpm install`; commit the resulting `pnpm-lock.yaml`.
- Confirm the peer range (a).
- **Browser-free-build guard (b)** — scope to the **build/prod** graph, not the dev tree:
  - `pnpm why playwright --prod` and `pnpm why puppeteer --prod` are **empty**, **or**
  - inspect the `astro-mermaid` + `mermaid` subtrees directly (`pnpm why astro-mermaid`,
    `pnpm why mermaid`) and assert **neither pulls playwright or puppeteer** as a
    non-dev dependency.
- Paste the exact commands + output into the handoff note (this is the NFR-004 evidence).

### T002 — Promote `--dk-diagram-*` to the Default catalog (light + dark)
- `src/lib/theme.ts`: add the `--dk-diagram-*` keys to `DEFAULT_BASE` (light values) **and**
  `DEFAULT_DARK` (dark values), so `emitTokenSheet` emits them in both modes. Keys (ADR-0024):
  `node-fill`, `node-border`, `node-text`, `edge`, `subgraph-title`, `cluster-fill`.
- `src/styles/theme.css`: add the same tokens under `:root` (light) and `[data-theme=dark]`.
- Pick values that (a) read as "diagram" surfaces against page bg and (b) satisfy the AA pairs
  in T005. The dark values may reuse the retired orphan's palette as a starting point.

### T003 — Wire the brand motif + retire the orphan
- `src/themes/spec-kitty/tokens.css`: add the brand's `--dk-diagram-*` values (light + dark
  under the brand's existing `:root` / `[data-theme=dark]` blocks), so a brand-themed site
  gets brand diagram colours.
- **Delete** `src/themes/spec-kitty/assets/diagram-tokens.css` (the dark-only orphan imported
  nowhere). Grep to confirm zero importers before deleting.

### T004 — Update the chrome/CSS-signature assertion
- `src/scripts/assert-chrome-artifacts.mjs`: extend the catalog/CSS-signature assertion so the
  promoted `--dk-diagram-*` tokens are **required present** in the emitted Default + brand
  sheets (both modes), and the orphan path is asserted **absent**.

### T005 — Contrast vitest (where the tokens are authored)
- `src/tests/diagram-tokens.test.ts` (Astro-free): read the `--dk-diagram-*` values from
  `theme.ts` (Default) and assert the AA pairs, **size-aware**, in **both** modes:
  - `node-text` on `node-fill` ≥ 4.5:1 (body text on nodes);
  - `edge` and `subgraph-title` each vs `cluster-fill` ≥ 3:1 (non-text/large-graphic);
  - node-`border` vs page/cluster bg ≥ 3:1.
- Use the repo's existing contrast helper if one exists; else inline a small WCAG ratio fn.

## Branch Strategy

Planning branch: `feat/diagrams`. Final merge target: `feat/diagrams`. **No deps** — runs in
parallel with WP02. Implement with `spec-kitty agent action implement WP01 --agent claude`.

## Definition of Done

- Deps exact-pinned; lockfile committed; peer range OK and no transitive Playwright (evidenced).
- `--dk-diagram-*` present in the emitted **Default** sheet (light+dark) **and** brand
  `tokens.css`; orphan deleted; chrome assertion updated and green.
- Contrast vitest green in both modes.
- `ci-ok` green — build-example still browser-free, example still `diagrams: false`, **no
  diagram rendered yet**.

## Risks / Reviewer guidance

- **No render this WP** — verify the example config is untouched (`diagrams` stays off); a
  rendered-but-unwrapped fence here would fail a11y. WP03 owns the flip.
- **Both modes** — the most common miss is dark-only or light-only token values; confirm
  `DEFAULT_DARK` and `[data-theme=dark]` both carry the keys.
- **Orphan** — confirm nothing imported `diagram-tokens.css` before deleting (grep the tree).
