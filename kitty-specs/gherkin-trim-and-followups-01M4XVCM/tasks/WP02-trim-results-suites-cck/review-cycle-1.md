---
affected_files: []
cycle_number: 1
mission_slug: gherkin-trim-and-followups-01M4XVCM
reproduction_command:
reviewed_at: '2026-10-14T19:23:14Z'
reviewer_agent: claude
wp_id: WP02
---

# WP02 review: changes requested (trim depth)

## What is correct (keep it)
- No production code changed. CCK files were only deleted whole (C-002). PROVENANCE matches what was removed.
- The fixture budget is met: 651 lines.
- The inline JSON status test does real work. Reviewer mutation `statusOf('ambiguous') -> 'failed'` (results.mjs:163) made it fail, along with all-statuses (ndjson).
- The retired rows have survivors, and the 102 tests in the two unit files pass.

## Why this is rejected
Test lines fell only about 1%. The mission's target is at least 30% overall, and the results suites were expected to be among the files that give up the most. Here are concrete cuts, about 180–230 lines (at least 15%) in total, that keep every guard:

1. **gherkin-results-render.test.ts L46–143: the duplicated real-chain harness** (HastNode/Heading/EntryType types, astro entry-type import, `docKittyRemark`, `render`, `all/text/elements/byClass`, `headingResults`). The header says it is "as in gherkin-fence.test.ts", and agent-page-includes.test.ts has the same harness. Move it into `tests/helpers/` (next to remark-stack.ts) and import it. Saves about 75–90 lines here. Use the helper in the fence test too if your scope allows; otherwise record it as a follow-up.
2. **render "an include shows its results": five tests render the same `include()` with `ON(RESULTS)`** ("a result line right after each scenario heading", "the badge…", "an Examples table gains a Result column", "the feature header gains a results summary", "nothing else from the report reaches the page"). Render once (beforeAll or one test) and assert each in turn: about 20–30 lines.
3. **"the agent Markdown of an include": `agentMarkdown`** rebuilds a unified processor. Put it in the helper as well, or share it with agent-page-includes: about 10 lines.
4. **gherkin-results-build.test.ts: about 100 lines of setup for 3 tests.** Check it against helpers/ and the scenario-index build setup, and share what overlaps.
5. **gherkin-results.test.ts "status rules" `statusOf` it.each**: drop the rows the new inline JSON test already covers end to end (passed/failed; keep only aliases such as error/hook_error/pending_warn/untested_undefined/executing/undefined). Also check whether `worstStatus` is already fixed by the CCK "(2 failed, 2 passed)" and checkout counts assertions.
6. **CCK examples-tables / rules-backgrounds `it.each(['ndjson','jvm.json'])`**: the jvm.json leg exists for the JSON path, which is now also covered by cucumber-js.json plus the jvm background fold in the inline test. Keep one jvm leg (rules-backgrounds, background fold) and retire the other with a named survivor.
7. **Layer duplicates between render and results**: "a JSON report gives the same page, less the retry and the commit" (render) repeats the parse-level JSON test in results plus the HTML structure tests. Retire one of them, with its survivor named.
8. **scenario-index.test.ts (RES-32..38)**: if it is in WP02's scope, apply the same check. Its results tests at L400–440 repeat statuses that the results suite already proves.

Every RETIRE still needs a survivor reference (`file:"name":L<n>`), and the C-006 rows (RES-04 privacy, RES-21 size cap) must stay KEEP and be break-checked.
