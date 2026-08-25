---
work_package_id: WP07
title: Docs of record — diagrams feature page + architecture surface
dependencies: []
requirement_refs:
- FR-015
planning_base_branch: feat/diagrams
merge_target_branch: feat/diagrams
branch_strategy: Planning artifacts for this mission were generated on feat/diagrams. During /spec-kitty.implement this WP may branch from a dependency-specific base, but completed changes must merge back into feat/diagrams unless the human explicitly redirects the landing branch.
subtasks:
- T022
- T023
history:
- '2026-08-25: authored by /spec-kitty.tasks'
agent_profile: implementer-ivan
authoritative_surface: docs/
create_intent:
- docs/architecture/diagrams.md
execution_mode: code_change
owned_files:
- docs/plans/features/diagrams.md
- docs/architecture/diagrams.md
role: implementer
tags: []
tracker_refs: []
---

## ⚡ Do This First: Load Agent Profile

`/ad-hoc-profile-load implementer-ivan` (role: implementer). Apply its initialization,
boundaries, directives, and tactics. Then read this WP, [../spec.md](../spec.md),
[../plan.md](../plan.md), the existing `docs/plans/features/diagrams.md`, and
`docs/adr/0023-diagram-render-and-metadata-seam.md` +
`docs/adr/0024-diagram-token-promotion-and-brand-wiring.md`.

## Objective

Land the **docs of record** for the diagrams feature: resolve the existing feature plan page to
reflect what shipped (client-side Mermaid in v1, with the enhanced-render + PlantUML follow-up
as tracker issue #13), and add a new `docs/architecture/diagrams.md` describing the diagrams
surface and linking the two ADRs. (ADR-0023/0024 were authored in the plan phase — this WP does
**not** re-author them.) Runs **parallel** to the whole build (no code deps).

## Subtasks

### T022 — Resolve the feature plan page (`docs/plans/features/diagrams.md`)
- Update the existing page to record the **shipped** decision: client-side render (astro-mermaid
  + mermaid, bundled, no CDN, no build-time browser), opt-in preset, `%%` metadata with the four
  non-technical fields, `--dk-diagram-*` theming, decks included.
- Record the **deferrals** to tracker issue **#13 "Enhanced diagram support"**: build-time
  static-SVG pre-render (zero-runtime-JS) for both engines, and PlantUML (its CI pre-render
  workflow). Point at #13 rather than restating the follow-up design here.

### T023 — Architecture surface page (`docs/architecture/diagrams.md`)
- New page describing the **diagrams surface**: the metadata transform (remark parse+inject /
  rehype figure), the single client render owner and the token→`themeVariables` map, the opt-in
  integration seam, and the two shells (doc pipeline + DeckLayout).
- Link **ADR-0023** (render/metadata seam) and **ADR-0024** (token promotion/brand). Keep it a
  navigational architecture doc — the ADRs remain the authoritative decisions.
- **CSP consumer note (squad F3-coverage / FR-014):** carry the consumer-facing note that
  client-side Mermaid needs **`style-src 'unsafe-inline'`** in a site's Content-Security-Policy
  (Mermaid injects inline `<style>`). ADR-0023 records the decision; this page is the
  **consumer surface of record** where a site author actually finds it.
- If the repo uses a small Mermaid diagram idiom in architecture docs, a minimal one showing the
  transform→render pipeline is welcome (dogfoods the feature), but keep it optional and small.

## Branch Strategy

Planning branch: `feat/diagrams`. Final merge target: `feat/diagrams`. **No code deps** — runs
in parallel with the build WPs. Implement with `spec-kitty agent action implement WP07 --agent claude`.

## Definition of Done

- `docs/plans/features/diagrams.md` reflects the shipped client-side v1 and points deferrals at
  issue #13.
- `docs/architecture/diagrams.md` exists, describes the surface, and links ADR-0023 + ADR-0024.
- `ci-ok` green (doc-sanity: no broken links, front-matter valid; these are toolkit `docs/**`
  pages, never built into the example site).

## Risks / Reviewer guidance

- **Don't re-author ADRs** — 0023/0024 are authoritative; these pages link, not duplicate.
- **#13 pointer** — verify the deferral text names issue #13 ("Enhanced diagram support") so the
  follow-up (Planning-Priti's tracked issue) is discoverable from the docs.
- **doc-sanity** — any dogfooded mermaid diagram lives under `docs/**` (toolkit tree), which is
  doc-sanity-only and never rendered/asserted; keep links valid.
