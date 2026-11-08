---
affected_files: []
cycle_number: 1
mission_slug: openapi-second-slice-01M6WXJ4
reproduction_command:
reviewed_at: '2026-11-08T13:09:10Z'
reviewer_agent: claude:claude-opus-5-5:reviewer
wp_id: WP02
---

# WP02 review — changes requested (claude:claude-opus-5-5:reviewer)

Everything else checks out: the acceptance suites pass (214, seam 41, consumption 16), typecheck and lint are clean, all registry seams are present and tested, the publisher takes the config-time bytes, and arm A is byte-identical. The 6 changed test expectations all fix wrong expectations (flattenText dropped 'd'; synthetic-entry.md requires escaping parens; a directory path needs .yaml; operationSlug keeps operations/). None of them weakens a test.

## Must-fix
1. src/lib/openapi/options.mjs:200 `normaliseSpec` has cyclomatic complexity 27 (ESLint `complexity` rule; the limit is 15). This complexity is new in WP02: the mission-branch version does not trip the rule. Split it into helpers such as `normaliseLabel`, `normaliseFileSpec`, `normaliseRemoteSpec` and `normaliseSha256`, keep the messages byte-identical, and get each function to 15 or below. Re-run `npx eslint --rule '{"complexity":["error",15]}' lib/openapi` from src/.

## Nice-to-have
- src/lib/config.ts `defineDocKittyIntegrations` went from 58 to 62. It already broke the limit before WP02, so WP02 did not cause it. The openapi block could move into a helper that returns {opts, specs}.
- src/lib/openapi/materialise.mjs:280 has `{  let document;` on one line. Fix the formatting.
- The renderer still reads `renderPath` (= absPath) itself, so the doc comment saying it "holds exactly bytes" is only true when the source has not changed. Reword the comment, or write the renderer's input from the bytes later.
- cache.mjs runs lstat on the leaf directory only, after mkdir. That is acceptable for a toolkit-internal cache, but say in a comment that parent directories are not checked.
