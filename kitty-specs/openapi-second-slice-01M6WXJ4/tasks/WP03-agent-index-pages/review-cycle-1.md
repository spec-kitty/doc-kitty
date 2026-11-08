---
affected_files: []
cycle_number: 1
mission_slug: openapi-second-slice-01M6WXJ4
reproduction_command:
reviewed_at: '2026-11-08T14:22:44Z'
reviewer_agent: claude:claude-opus-5-5:reviewer
wp_id: WP03
---

# WP03 review: changes requested

The three acceptance commands pass (55 + 3 + 16 tests). The full toolkit suite has two regressions that WP03 introduced.

## Must-fix
1. **src/tests/agent-api-build-identity.test.ts:229** ("emits no key the published contract does not declare") fails. index.pages[70..72] and pages/reference/api/{main,v1,v1-1}.json emit `released`, `rawDocumentUrl`, `sha256` and `_links.describedby`, and the published contract does not declare them. Fix: declare them as optional fields on `AgentRecordEntry` and `AgentPagePayload`, and add `describedby` to `AgentPageLinks`, in src/lib/contract.ts. Then update the test's KEYS table (around line 140). These files are not in owned_files, so the orchestrator needs to rule on ownership.
2. **src/tests/page-atom-build.test.ts:293** fails. `EXAMPLE_UNDATED` (line 304) is `[]`, but the synthetic index entries reference/api/{main,v1,v1-1} have no Atom entry. Fix: either emit Atom entries for synthetic records, or exclude openapi-tagged synthetic records from the coverage check (or list them), and document the choice.

## Verified OK
- Contract version stays "3".
- buildId computation is unchanged (it covers the docs corpus only).
- Consumption arm A is green.
- MCP `loadSnapshot` and the shape guards pass.
- The hostile fixture is escaped.
- Synthetic entries are appended after the docs records in a deterministic order.
- The 73 count is 70 + 3 example specs, which is WP11's to fix.

## Not WP03
- config-invariants export list (`composeSitemapPredicates`).
- Sidebar and page-list failures caused by the WP02 example pages.
