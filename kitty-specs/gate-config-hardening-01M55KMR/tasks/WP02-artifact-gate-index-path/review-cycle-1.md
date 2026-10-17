---
affected_files: []
cycle_number: 1
mission_slug: gate-config-hardening-01M55KMR
reproduction_command:
reviewed_at: '2026-10-17T19:46:34Z'
reviewer_agent: claude
wp_id: WP02
---

# WP02 review feedback (round 1)

## 1. BLOCKER: fail-open on the index's top-level `_links` JSON targets (FR-006)
`assertAgentLinksResolve` adds to the scan set only the JSON files that `pages[]._links` name, plus everything under `dirname(indexPath)`. The index's own top-level `_links` (in the example: `bibliography` -> `api/bibliography.json`, `scenarios` -> `api/scenarios.json`) are checked for existence, but they are never walked. With `--index-path v2/data/index.json`, nothing reads `api/bibliography.json` or `api/scenarios.json`, so a dangling `_links` href inside them passes silently. The default path does not hit this, because it scans all of `api/`.

Fix: seed the scan from `linkHrefsOf(index._links)` as well as `pages[]._links`, using the same `builtRelOf` + `.json` + exists filter. A better fix is to follow links transitively, collecting JSON targets from every scanned doc until the set stops growing. Then add one assertion: plant a dangling href in `api/bibliography.json` (or scenarios.json), run with the custom `--index-path`, and expect exit 1 naming that file.

## 2. Minor: the test is PlantUML-coupled
`expect(pass.status).toBe(0)` fails locally when there is no PlantUML service, so the dangling, base and refusal steps never run under local vitest. The `_links ... (index: v2/data/index.json)` stdout assertion already comes first. Drop the `status 0` assertion, or move it after the other steps, or gate it on the PlantUML-mode check the file already uses. That way the remaining steps run without the service. The dangling and base steps assert exit 1, which PlantUML does not affect either way, so their assertions should name the specific message.

## Verified OK
The flag is parsed before `takeSiteFlags`. `..`, `C:\x`, empty and `//x` exit 2 (checked by hand). The base-prefixed path gets a helpful message. SCENARIO_INDEX_RELPATH is untouched. The route JSDoc is accurate. Test economy is fine: one extended case.
