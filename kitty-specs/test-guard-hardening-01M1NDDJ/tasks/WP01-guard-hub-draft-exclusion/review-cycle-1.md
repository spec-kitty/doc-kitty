---
affected_files: []
cycle_number: 1
mission_slug: test-guard-hardening-01M1NDDJ
reproduction_command: spec-kitty agent tasks move-task WP01 --to approved --mission test-guard-hardening-01M1NDDJ
reviewed_at: '2026-09-04T05:48:56Z'
reviewer_agent: user
wp_id: WP01
---

Approved by user: APPROVED (forced past derived-status.json lane-hygiene catch-22 only — blocker is committed status.events.jsonl/status.json from the R-STATUS-JSON-REMATERIALIZE auto-rebase, NOT code). Mutation-verified: reviewer removed the isPublished clause -> hub-children.test.ts REDS (draft ADR adr/0009-wip + draft non-ADR adr/template leak), restored -> GREEN. Test exercises the REAL imported selectHubChildren; covers draft numbered ADR + draft non-ADR excluded, published kept + section/title ordered. Byte-identical extraction (buildAdrHubCards fully re-sorts ADRs by number; non-ADR filter-after-stable-sort preserves order). Full vitest 767/767 green, lint clean, hub-adr-card gate green. Files disjoint from WP02. typecheck (astro check) OOMs env-only; type-soundness verified by reasoning + CI.
