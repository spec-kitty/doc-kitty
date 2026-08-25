---
work_package_id: WP03
title: Diagram integration + render owner (opt-in preset; flip example on)
dependencies:
- WP01
- WP02
requirement_refs:
- FR-001
- FR-002
- FR-007
- FR-014
- NFR-007
planning_base_branch: feat/diagrams
merge_target_branch: feat/diagrams
branch_strategy: Planning artifacts for this mission were generated on feat/diagrams. During /spec-kitty.implement this WP may branch from a dependency-specific base, but completed changes must merge back into feat/diagrams unless the human explicitly redirects the landing branch.
subtasks:
- T010
- T011
- T012
- T013
history:
- '2026-08-25: authored by /spec-kitty.tasks'
agent_profile: implementer-ivan
authoritative_surface: src/lib/diagram/
create_intent:
- src/lib/diagram/diagram-render.client.ts
- src/tests/diagram-preset.test.ts
execution_mode: code_change
owned_files:
- src/lib/config.ts
- src/lib/diagram/diagram-render.client.ts
- example/astro.config.mjs
- example/docs/architecture/overview.md
- src/tests/diagram-preset.test.ts
role: implementer
tags: []
tracker_refs: []
---

## ⚡ Do This First: Load Agent Profile

`/ad-hoc-profile-load implementer-ivan` (role: implementer). Apply its initialization,
boundaries, directives, and tactics. Then read this WP, [../spec.md](../spec.md),
[../plan.md](../plan.md),
[../contracts/render-token-and-assertions.md](../contracts/render-token-and-assertions.md),
[../contracts/diagram-meta-transform.md](../contracts/diagram-meta-transform.md), and
`docs/adr/0023-diagram-render-and-metadata-seam.md`.

## Objective

Wire diagrams into the toolkit as an **opt-in preset** and own the **single client render
loop**. `defineDocKittyIntegrations({ diagrams: true })` prepends `mermaid()` (autoTheme
**off**, strict) before `starlight()`, registers the WP02 remark + rehype plugins, and injects
the render module. Then **flip `example/astro.config.mjs` to `diagrams: true`** so the
pre-existing `overview.md` fence renders as a themed, self-named `<figure>`. This WP is where
diagrams first render — it must keep `ci-ok` green.

**Single render owner (NFR-007)**: astro-mermaid does the **fence transform only**
(`autoTheme` off, `startOnLoad` off). Our `diagram-render.client.ts` is the *only* thing that
calls `mermaid.run` — exactly one render loop per `pre.mermaid`.

**Foundation spike is a DoD GATE, not a note (squad F5/F2-coverage).** `autoTheme: false`
disables theme-watching, **not** rendering — so you must actively confirm astro-mermaid can be
put in transform-only mode **and** that it code-splits the `mermaid` library (the footprint
claim NFR-006/FP-1 depends on it). Resolve the spike **before** WP03 is done:
- If astro-mermaid transforms-only + code-splits → suppress its render, our module renders.
- If not → **fall back**: our own fence→`<pre class="mermaid">` transform, drop astro-mermaid's
  runtime, and load `mermaid` ourselves via the guarded dynamic import below.
Either way the outcome is **gated by** the "exactly one `<svg>` per `pre.mermaid`" runtime
assertion (WP06 T019) and the footprint capture (WP06 T021) — not merely recorded.

**Footprint-safe loading (squad F1-coverage / NFR-006)**: the render module is injected
**page-wide** (`injectScript('page', …)`), so it must **not** pull the `mermaid` chunk onto
diagram-free routes. Load mermaid with a **dynamic `await import('mermaid')` *inside* the
`nodes.length` guard** — a top-level static `import mermaid` would resolve the chunk on every
page and fail FP-1. The early-return-when-no-`pre.mermaid` must precede the import.

## Subtasks

### T010 — Opt-in preset (`src/lib/config.ts`)
- Add a `diagrams?: boolean` option to `defineDocKittyIntegrations`. **Default off.**
- When **on**: **prepend** `mermaid({ autoTheme: false })` to the integrations array **before**
  `starlight()` (index 0 must remain reachable per existing ordering contract — insert mermaid
  ahead of it). Register the WP02 plugins via the existing markdown seam:
  `remarkPlugins: [diagramMeta]` (before the fence transform) and
  `rehypePlugins: [diagramFigure]` (after). Inject the render module with
  `injectScript('page', "import { initDiagrams } from '…/diagram-render.client'; initDiagrams();")`.
- When **off**: none of the above is added — zero diagram cost (asserted by T013).

### T011 — Render owner (`src/lib/diagram/diagram-render.client.ts`)
- Per [render-token-and-assertions.md](../contracts/render-token-and-assertions.md): read
  `--dk-diagram-*` off `:root` into a `theme:'base'` `themeVariables` object (the token→var
  map), `mermaid.initialize({ startOnLoad:false, securityLevel:'strict', themeVariables })`,
  then `mermaid.run({ nodes: document.querySelectorAll('pre.mermaid') })`.
- **Load-only-where-needed + footprint-safe**: `const nodes = …('pre.mermaid'); if
  (!nodes.length) return;` **then** `const { default: mermaid } = await import('mermaid');`
  (dynamic import *inside* the guard — the contract sketch's top-level `import mermaid` is
  illustrative; the shipped module must dynamic-import so diagram-free pages never resolve the
  chunk — squad F1-coverage).
- Re-render on `[data-theme]` toggle via a `MutationObserver` on `document.documentElement`
  (attributeFilter `['data-theme']`) — the single loop re-runs with the other mode's colours.
  Mermaid's `data-processed` guard prevents a double SVG; keep exactly one `<svg>` per node.
- Exported (`initDiagrams`) so `DeckLayout` (WP05) can import the same module.

**Also in T011 — give the pre-existing `overview.md` fence a name (squad F-B / F1-actionability)**
- `example/docs/architecture/overview.md` (now owned here) has a **bare** `flowchart LR` fence
  with **no `%%` metadata** → the transform injects no `accTitle`/`accDescr` and the figure is
  caption-less/**unnamed**. Add a `%% title:` + `%% description:` block to that fence so the
  first diagram the flip renders is a genuinely **self-named**, captioned figure (makes this
  WP's own "self-named" DoD true and removes a latent nameless-diagram on a real page).

### T012 — Flip the example on (`example/astro.config.mjs`)
- Change `defineDocKittyIntegrations({ … })` to pass `diagrams: true`.
- This is co-landed with the integration so the pre-existing `overview.md` mermaid fence
  renders wrapped + named + themed at the same WP boundary (never unwrapped/unnamed).

### T013 — Preset vitest (`src/tests/diagram-preset.test.ts`)
- `defineDocKittyIntegrations({ diagrams: false })` (and default) → the integrations array
  contains **no** `mermaid()` and registers no diagram plugins.
- `defineDocKittyIntegrations({ diagrams: true })` → `mermaid()` is present and ordered
  **before** `starlight()`; the remark + rehype plugins are registered.

## Branch Strategy

Planning branch: `feat/diagrams`. Final merge target: `feat/diagrams`. **Depends on WP01
(tokens) + WP02 (transform)**; both must be `approved` first. Implement with
`spec-kitty agent action implement WP03 --agent claude`.

## Definition of Done

- Opt-in wired: on prepends `mermaid()` before Starlight + registers both plugins + injects the
  render module; off adds nothing (vitest green both ways).
- Render owner draws every `pre.mermaid` with token-derived `themeVariables`, **dynamic-imports
  `mermaid` inside the `nodes.length` guard** (footprint-safe), re-renders on `[data-theme]`,
  and is a **single loop** — the spike outcome (astro-mermaid transform-only+code-split, or the
  own-transform fallback) is **resolved here** and gated by WP06's one-`<svg>`-per-node + the
  footprint capture, not left as a note.
- Example flipped `diagrams: true`; `overview.md` (given `%%` metadata here) renders as a
  themed, **self-named**, captioned `<figure>`.
- `ci-ok` green — build-example still browser-free (render is client-side); a11y still passes
  (overview.md is **not** in AXE_PAGES; WP06 adds the demonstrator and tightens the deck's
  render-gate).

## Risks / Reviewer guidance

- **Ordering** — `mermaid()` must sit before `starlight()`; verify the integrations array and
  that starlight is still reachable (existing tests must stay green).
- **One render loop** — grep for any second `mermaid.run`/`startOnLoad:true`; astro-mermaid
  must not also render. This is the NFR-007 guard.
- **build-example stays browser-free** — the render is client JS; nothing in the build step
  may spawn Chromium. Confirm the build lane is untouched.
- **overview.md now renders** — a rendered-but-unwrapped/unnamed fence would regress a11y even
  though it is not yet in AXE_PAGES; confirm the figure wrap + injected statements apply here.
