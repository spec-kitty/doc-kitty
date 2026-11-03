---
affected_files: []
cycle_number: 1
mission_slug: plantuml-external-opt-in-01M6F052
reproduction_command:
reviewed_at: '2026-11-02T22:37:11Z'
reviewer_agent: claude::reviewer-renata
wp_id: WP04
---

**Issue 1 (blocking): the internet-mode notice omits `--service-container <container>`.**
- `src/lib/config.ts`, `plantumlExternalNotice` (the `resolution.mode === 'internet'` branch, ~line 536): the internet text ends at `--canary-port 18091`. The WP prompt (T019 internet bullet, T021 case 5) and the authoritative contract on the planning branch (`feat/268-plantuml-external-opt-in:kitty-specs/plantuml-external-opt-in-01M6F052/contracts/opt-in-setting.md` line 58, analyze fix A1) both require `... --canary-port 18091 --service-container <container>`. Internet mode is verified by reading the service profile through `docker inspect` (decision 01M6F4BRKQ4E9H9Z41BYZH37MC), so a copied command without the container cannot verify it. Note: the lane's copy of `contracts/opt-in-setting.md` is the pre-A1 version and is out of date. Follow the planning branch and the WP prompt.
- `src/tests/plantuml-allow-external-config.test.ts`, test "internet from the environment warns and omits --service-container" (~line 95): it pins the wrong text and asserts `not.toContain('--service-container')`.
- Done looks like this: both branches append ` --service-container <container>`, which you can hoist into the shared `verify` string. The test is renamed, its expected string ends with `--canary-port 18091 --service-container <container>`, and it asserts `toContain('--service-container <container>')`. The `diagrams` off suffix still comes after it.

**Issue 2 (DoD evidence): unset-path build silence.**
- The DoD line is `pnpm build 2>&1 | grep dk-plantuml` on the example site with no opt-in, which must print nothing (grep exits 1). The handoff notes prove this with a child config-load, which covers the only emitting code path. On resubmission, run the literal DoD command and report the grep exit code.

**Verified OK (no change needed):** the option is typed and documented, and `diagrams` stays a boolean. Validation is eager and throws the WP03 messages for site and environment values. The handoff is always published, sandbox included, and the build never reads it. `INTERNAL_ENV_NAMES` and the header table both list it, and `clearInternalEnv` clears it. A forged inherited RESOLVED value is cleared by `clearInternalEnv` at the start of the define call and deleted from the env before the child is spawned in `site-config-eval`. `site-config-eval` returns `plantumlAllowExternal` (an object, or null). The literal `--astro-config <path>` is present. The lane diff has no mode changes. The one-line edit to `draft-publication.test.ts` is justified: the new handoff is republished at define time, so the #167 invariant list must name it. Vitest on 3 files: 144 passed. Eslint on the changed files: clean.
