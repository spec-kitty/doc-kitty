---
affected_files: []
cycle_number: 1
mission_slug: ars-rethorica-example-01M204RR
reproduction_command: spec-kitty agent tasks move-task WP01 --to approved --mission ars-rethorica-example-01M204RR
reviewed_at: '2026-09-08T10:36:20Z'
reviewer_agent: user
wp_id: WP01
---

Approved by user: APPROVED (reviewer-renata). Approach sound: remark-gfm already pairs [^^N_M]; pure .internal strips ONE leading caret from footnoteReference/Definition identifier+label symmetrically, preserving pairing+ordinal ordering; totality verified (unmatched ref stays text, orphan def renders nowhere, inline-code untouched, plain [^x] no-op, idempotent). Verified LIVE in a real ON build: data-footnote-ref+data-footnotes rendered with clean user-content-fn-0_1 anchors, ZERO %5E leaks, code-span marker literal. NFR-001 byte-identity holds: config.ts L1307 gates markuaIntegration() (hence markuaFootnotes) behind markuaActive, so DK_MARKUA=off never registers the pass. No new dependency (package.json/pnpm-lock untouched; internal.ts imports nothing). DIRECTIVE_001 pure split honored. The 3 OUT-OF-MAP guard edits (deck-guard, glossary-substrate-parity, markua-attributes) are each MINIMAL forced pinned-baseline updates from registering the new pass, not scope creep. Fixtures doc_status:draft (ratchet safe). ADR-0041 high quality. assert:markua asserts BOTH modes. 4 affected test files green (77 tests). The 1 failing test (example-adopter T023) CONFIRMED pre-existing/env-gated: PlantUML self-hosted-server ECONNREFUSED 127.0.0.1:8091 (cites #13 WP03), unrelated to WP01 (build even exits 0 with footnote pages rendering). Anti-pattern checklist all PASS/N/A.
