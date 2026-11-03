---
affected_files: []
cycle_number: 1
mission_slug: plantuml-external-opt-in-01M6F052
reproduction_command:
reviewed_at: '2026-11-02T22:25:06Z'
reviewer_agent: claude::reviewer-renata
wp_id: WP03
---

# WP03 review, cycle 1: changes requested

The resolver, validation and tests are solid: 51/51 pass, eslint is clean, there are no tsc errors in the touched files, the module imports from a scratch dir with no node_modules, and E1-E7 each assert their label, reason and `accepted:`. The `;` / `; ;` deviation (text containing `;` is parsed as a list, so it reports "an empty allowlist is not sandbox") is **accepted**. It matches contracts/opt-in-setting.md (that reason's trigger is "`[]`, `;`") and data-model E2 (env `;` or `; ;`). E5 still holds, because blank or whitespace-only input returns undefined first. Two blocking issues and one test gap remain.

**Issue 1 (blocking): edits outside owned_files**
- Where: commit fef349a ("chore(WP03): commit lane deliverables for review").
- What is wrong: it flips 11 files under `src/scripts/*.mjs` from 100644 to 100755. These are exactly the `bin` targets in `src/package.json`. `pnpm install` chmods bin targets in the worktree, and the lane auto-commit picked them up. The modes on `main`, the feature branch and the mission branch are all 100644. These files are not in owned_files and no rationale is recorded.
- What done looks like: restore the modes in the lane (for example `git update-index --chmod=-x src/scripts/*.mjs`, or `git checkout kitty/mission-plantuml-external-opt-in-01M6F052 -- src/scripts` then commit). `git diff kitty/mission-plantuml-external-opt-in-01M6F052..HEAD --summary` must then show no mode changes. To stop it recurring, consider `git config core.fileMode false` in the lane worktree.

**Issue 2 (blocking): `describeDeclared` names the environment source inconsistently in internet mode**
- Where: src/lib/plantuml-external.mjs, `describeDeclared`. The internet branch uses `resolution.source` instead of `where`.
- What is wrong: `describeDeclared(resolvePlantumlAllowExternal({ env: 'internet' }))` returns `internet (from environment)`, but an env allowlist returns `allowlist (from environment DK_PLANTUML_ALLOW_EXTERNAL): ...`. contracts/opt-in-setting.md, "Build notice", says `<source>` is `environment DK_PLANTUML_ALLOW_EXTERNAL` or `site configuration` for **both** the allowlist and the internet notice. WP04 T-step says "reuse the label from `describeDeclared`; do not re-derive". As written, WP04 and WP11 would print the wrong internet-from-env line. The `where` variable is already computed and simply unused in that branch.
- What done looks like: `internet (from environment DK_PLANTUML_ALLOW_EXTERNAL)` for env-sourced internet, with `internet (from site configuration)` unchanged.

**Issue 3 (test gap, fix with Issue 2)**
- Where: src/tests/plantuml-external-setting.test.ts, `describe('describeDeclared')`.
- What is wrong: no test covers internet from the environment, which is why Issue 2 went unnoticed.
- What done looks like: add that row, asserting the exact string.
- Optional while you are there: the WP prompt asks the bare-host rows to assert both `must end with "/"` and `also allows "http://host.evil.com"`. Today each row asserts only one of the two (for example `host and port` checks only MUST_END). Asserting both in every E3 row would follow the prompt literally.

No other findings:
- Exports: exactly the six names.
- C-006: the guard works.
- `@`: checked before URL parsing, and userinfo reports `contains "@"`.
- `internet`: lowercase only, with the hint for both sources.
- Site value: still validated when the env wins (tested).
- Entries: kept raw.
- Module scope: no knowledge of canaries, docker or Astro.

Note: the full `vitest run` reports 9 failing files, all build-lane tests (draft-publication-build, mcp perf lane, and others) that need an example build. None of them touch this module. They are environmental and not attributable to WP03.
