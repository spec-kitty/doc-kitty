---
work_package_id: WP01
title: Docs-index neutral owner + Hub dedup
dependencies: []
requirement_refs:
- C-001
- C-002
- C-003
- FR-001
- FR-002
- FR-003
- FR-004
- NFR-001
- NFR-002
planning_base_branch: feat/docs-index-owner
merge_target_branch: feat/docs-index-owner
branch_strategy: Planning artifacts for this mission were generated on feat/docs-index-owner. During /spec-kitty.implement this WP may branch from a dependency-specific base, but completed changes must merge back into feat/docs-index-owner unless the human explicitly redirects the landing branch.
subtasks:
- T001
- T002
- T003
- T004
- T005
history: []
agent_profile: implementer-ivan
authoritative_surface: src/lib/docs-index.ts
create_intent:
- src/lib/docs-index.ts
execution_mode: code_change
owned_files:
- src/lib/docs-index.ts
- src/lib/routes/shared.ts
- src/lib/metadata.ts
- src/lib/routes/rss.ts
- src/lib/routes/agent-index.ts
- src/lib/routes/llms-txt.ts
- src/lib/routes/agent-page.ts
- src/components/slots/Audience.astro
- src/components/slots/Related.astro
- src/components/slots/OnThisPage.astro
- src/layouts/Hub.astro
- src/lib/deck/deck-slug.ts
- src/tests/collect-doc-entries-order.test.ts
role: implementer
tags: []
tracker_refs: []
---
## Objective
Move the docs-index derivation to a neutral owner and let Hub use it. Byte-neutral (#90). See ../spec.md, ../plan.md. Orchestrator-implemented.
## Definition of Done
- collectDocEntries+buildDocsIndex defined once in src/lib/docs-index.ts; shared.ts exports neither; docs-root + feed helpers stay in shared.ts.
- collectDocEntries has opt-in {withBody}; DocEntry.body?:string; default shape unchanged.
- Hub.astro calls collectDocEntries({withBody:true}); no inline getCollection('docs').map.
- All importers rewired; the one affected test rewired + a withBody case added.
- Build byte-identical to pre-change (hash oracle); full suite green; tsc baseline unchanged; no dependency change.
