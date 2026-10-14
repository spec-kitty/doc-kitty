---
affected_files: []
cycle_number: 1
mission_slug: diagrams-option-docs-01M4X4VQ
reproduction_command:
reviewed_at: '2026-10-14T12:15:27Z'
reviewer_agent: user
wp_id: WP01
---

**Changes requested (1 finding).**

1. `src/lib/config.ts:157-163`: the rest of the `diagrams` doc comment still says `true` wires "the single client render owner (`diagram-render.client`) injected page-wide" and calls the option Mermaid-only. In build mode no client script ships, and PlantUML is covered too. An editor hover would still suggest a browser script always ships. Fix: say `true` wires the metadata + figure plugins plus either the build-time renderers (build mode, Mermaid and PlantUML) or the client render owner (client mode, Mermaid only).

Checked and correct: every guide statement against `resolveDiagramMode`, `chromiumResolvable`, the build and client branches, and `resolvePlantumlServerUrl`. The first sentence is exact. FR-001..FR-007 covered (FR-006 as plan D-01; it does not belong in the CHANGELOG, which records changes).
