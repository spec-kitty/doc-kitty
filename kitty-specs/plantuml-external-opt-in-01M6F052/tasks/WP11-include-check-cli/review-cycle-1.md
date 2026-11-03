---
affected_files: []
cycle_number: 1
mission_slug: plantuml-external-opt-in-01M6F052
reproduction_command:
reviewed_at: '2026-11-02T23:05:47Z'
reviewer_agent: claude::reviewer-renata
wp_id: WP11
---

# WP11 review, cycle 1: changes requested

Everything else checks out (details at the end). Two fixes are needed, both in `src/scripts/assert-plantuml-no-remote-include.mjs`, which this WP owns.

## Issue 1 (blocking): the "could not evaluate" refusal names a flag this CLI does not have

- **Where:** `src/scripts/assert-plantuml-no-remote-include.mjs:111`: `console.error(err instanceof ConfigEvalError ? evalRefusal(err, NAME) : ...)`.
- **What is wrong:** `evalRefusal` (`site-config-eval.mjs:187-191`) was written for the gates that have `--env-dir`. It always ends `Fix the config, or pass --env-dir <dir|false> to skip evaluation.` The include check has no `--env-dir`. If the user follows the hint, they get `unknown or incomplete argument: --env-dir` (exit 2). Observed output with an unevaluable config:
  `assert-plantuml-no-remote-include: could not evaluate /tmp/.../astro.config.mjs (Cannot find module 'astro/package.json' ...). Fix the config, or pass --env-dir <dir|false> to skip evaluation.`
  The contract (`contracts/include-check-cli.md`, "Other stable substrings") pins only the substring `could not evaluate <path>`. It says the message reuses `evalRefusal`, but it does not require the `--env-dir` hint.
- **What done looks like:**
  - Build the line in the CLI and keep the contracted prefix. For example, using `shown`, which `site-config-eval.mjs` already exports from the same dynamic import:
    `${NAME}: could not evaluate ${shown(err.configPath)} (${err.reason}). Fix the config; --astro-config needs the site's astro installed.`
    Do not change `site-config-eval.mjs`: WP11 does not own it, and the other gates depend on its text.
  - Exit code stays 2.
  - Add a test with a positive control on the same fixture. The output contains `could not evaluate <path>` and does not contain `--env-dir`. A config that throws, or a config in a directory without `astro`, is enough.
  - Ask the orchestrator to amend the contract row to read "`could not evaluate <path>` (the `evalRefusal` prefix; the hint names no `--env-dir`, which this CLI does not have)". The reviewer cannot edit planning artifacts.

## Issue 2 (should fix with issue 1): `--astro-config` without installed dependencies crashes with exit 1, not 2

- **Where:** `assert-plantuml-no-remote-include.mjs:102`: `await import('./site-config-eval.mjs')`.
- **What is wrong:** C-006 means this CLI runs before `pnpm install`. Run it from a copy of `src/scripts` and `src/lib` with no `node_modules` and `--astro-config <any>`. The dynamic import throws `ERR_MODULE_NOT_FOUND: Cannot find package 'gray-matter'`, which is uncaught: a Node stack trace and exit 1. The contract reserves exit 1 for a failed verification and gives exit 2 for "`--astro-config` missing or not evaluable".
- **What done looks like:** wrap the dynamic import. On failure, print one line, `${NAME}: --astro-config needs the toolkit's dependencies installed (<err.message first line>)` (or similar), and exit 2. Add a test for it if it is cheap. A temp copy of `scripts/` and `lib/` with no `node_modules` reproduces it.

## Verified OK (no action)

- **Tests:** `vitest run` of the service-config, golden, include-guard, mode-check and fake-docker tests: 132/132 passed, exit 0.
- **Full suite:** `pnpm test` with `pnpm` on PATH: 3465/3465 passed. `pnpm lint` (eslint + tsc): exit 0.
- **Fixture:** `inspect-capture.json` is byte-identical to `spike/inspect-capture.json`.
- **No R8 fixture:** `scripts/fixtures/plantuml-remote-include-modes/` is absent.
- **Goldens:** the WP02 goldens are untouched by 62b119e and pass. Unset mode prints no new line on a pass. With a container and a SANDBOX profile, the output is unchanged. ALLOWLIST or absent profile gives exit 1 with the contracted `opt-in unset (sandbox), but …` text.
- **C-006:** a copy of `src/scripts` and `src/lib` with no `node_modules`, and the strict fake docker on PATH, loads and runs correctly on the unset path and the env-allowlist path.
- **End-to-end allowlist:** a fake PlantUML plus the strict fake docker gives exit 0 and the exact line `assert-plantuml-no-remote-include: verdict: declared allowlist, observed allowlist`. Each half-removal flips it to exit 1 with its contracted substring: allowed refused; denied fetched; denied probe unreachable; profile INTERNET; missing entry; empty item.
- **Missing container:** allowlist and internet runs without `--service-container` give exit 1 with the contracted messages and the verdict `observed no class`.
- **Forged handoff:** a forged `DK_PLANTUML_ALLOW_EXTERNAL_RESOLVED` is ignored, with and without `--astro-config` (child env scrubbed; `export default {}` → sandbox/default). `grep _RESOLVED` finds nothing in the CLI.
- **Exit 2 cases:** `--canary-port 0` and a missing `--astro-config` file both exit 2.
- **Docker argv:** both commands use exactly the strict argv shapes. `node:child_process` is used only by the service-config module and the unset path's existing import.
