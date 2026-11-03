---
work_package_id: WP10
title: 'Documentation and records: guide, ADR-0074, diagrams.md, changelog fragment'
dependencies:
- WP01
- WP08
- WP11
requirement_refs:
- FR-008
- FR-009
- FR-010
- C-002
- FR-007
- C-001
planning_base_branch: feat/268-plantuml-external-opt-in
merge_target_branch: feat/268-plantuml-external-opt-in
branch_strategy: Planning artifacts for this mission were generated on feat/268-plantuml-external-opt-in. During /spec-kitty.implement this WP may branch from a dependency-specific base, but completed changes must merge back into feat/268-plantuml-external-opt-in unless the human explicitly redirects the landing branch.
base_branch: kitty/mission-plantuml-external-opt-in-01M6F052
base_commit: 362ca3cbaf6032424dfe843fdbb081483e0651d7
created_at: '2026-11-02T23:21:49.776124+00:00'
subtasks:
- T050
- T051
- T052
- T053
- T054
- T055
- T056
history:
- timestamp: '2026-11-02T22:00:00Z'
  agent: planner-priti
  action: Prompt generated via /spec-kitty.tasks
agent_profile: architect-alphonso
authoritative_surface: docs/adr/0074-plantuml-external-include-opt-in.md
create_intent:
- docs/adr/0074-plantuml-external-include-opt-in.md
- docs/changelog/unreleased/268-plantuml-external-include-opt-in.md
- src/tests/plantuml-opt-in-docs.test.ts
- src/tests/fixtures/plantuml-opt-in-docs/recommended-sandbox-block.yml
- src/tests/fixtures/plantuml-opt-in-docs/recommended-sandbox-run.sh
execution_mode: code_change
model: sonnet
owned_files:
- docs/guides/consumer-setup.md
- docs/adr/0074-plantuml-external-include-opt-in.md
- docs/architecture/diagrams.md
- docs/architecture/ci-cd-pipeline.md
- docs/ops/ci-cd.md
- docs/changelog/unreleased/268-plantuml-external-include-opt-in.md
- src/tests/plantuml-opt-in-docs.test.ts
- src/tests/fixtures/plantuml-opt-in-docs/**
role: implementer
tags: []
tracker_refs: []
---

# Work Package Prompt: WP10 – Documentation and records: guide, ADR-0074, diagrams.md, changelog fragment

## ⚡ Do This First: Load Agent Profile

Before reading further or touching anything, load your assigned profile:

- Use the `/spk-charter-profile-load` skill with `architect-alphonso`, or run
  `spec-kitty agent profile show architect-alphonso`.
- Then load the action context: `spec-kitty charter context --action implement --json`.

## Objective

Write the documentation and the decision record for the opt-in, and the tests that assert their content:

1. Guide subsection **"Allowing external includes"** in `docs/guides/consumer-setup.md`, beside "Run the PlantUML service hardened" (FR-008). The recommended SANDBOX block stays byte-identical (FR-007, C-001).
2. **ADR-0074** `docs/adr/0074-plantuml-external-include-opt-in.md` (FR-009). File only: **never** edit the index table in `docs/adr/README.md` (a bot regenerates it after merge).
3. `docs/architecture/diagrams.md`: one sentence in the "pinned and sandboxed" bullet linking ADR-0074 and the new guide subsection.
4. Lane lists in `docs/architecture/ci-cd-pipeline.md` and `docs/ops/ci-cd.md` gain `plantuml-allowlist`.
5. Changelog fragment `docs/changelog/unreleased/268-plantuml-external-include-opt-in.md` (FR-010, C-002). **Never** edit `CHANGELOG.md`.
6. `src/tests/plantuml-opt-in-docs.test.ts`: all prose-asserting tests (existence plus required substrings, not wording).

## Context

- quickstart.md: the outline of the guide subsection (steps 1–5 and internet mode). Use it as the source; adapt voice to the guide.
- contracts/opt-in-setting.md (names, shapes, precedence, no env off-switch, notice, mapping to the service, "Inspectable services only"); contracts/include-check-cli.md (flags, verdict line).
- spec.md FR-008 (required topics list), FR-009 (ADR contents), FR-010, Limits (every bullet), Out of Scope.
- research.md R9 (ADR content list, including squad finding 15 deferred option), R1 (why a top-level option, not `diagrams.plantuml.allowExternal`), R5 (lane block).
- WP01 addendum (spike results: redirect, trimming, `!import`) and WP08's actual `plantuml-allowlist` service block in `.github/workflows/ci.yml` — the guide's GitHub Actions allowlist block must equal it except the declared entry.
- `docs/adr/template.md` and a recent ADR (e.g. `docs/adr/0072-parallel-landing-without-shared-files.md`) for frontmatter and structure; required frontmatter: `title`, `description`, `doc_status`, `updated`, `kind` (AGENTS.md).
- `docs/changelog/unreleased/README.md`: fragment format (`section:` only key; one `- ` bullet with bold lead naming the issue; "Before, … Now, …"; repo-root-relative links; no headings).
- `docs/guides/consumer-setup.md:949-1000`: the hardened block and the existing include-check recipe.
- `docs/architecture/diagrams.md:157-171`: the sandbox decision.
- Writing style: sentence-case headings, no AI tells; Vale runs in doc-sanity.

## Branch Strategy

- Planning branch and final merge target: `feat/268-plantuml-external-opt-in`.
- Execution worktrees are allocated per computed lane from `lanes.json`; work in the worktree `spec-kitty agent action implement` gives you.
- ADR number: 0074 was free on the branch and `origin/main` at plan time. Before writing, re-check `ls docs/adr/` on the base and `gh pr list --state open` (read-only) for an in-flight 0074; if taken, use the next free number and update every reference (this prompt, the changelog fragment, the guide, `diagrams.md`, the test, and WP03's / WP04's code comments are not yours: note it for the orchestrator).
- WP01 is orchestrator-run; its evidence (research.md addendum, `spike/`) is committed to `feat/268-plantuml-external-opt-in` before this lane starts, so it is visible in this worktree.

## Subtasks

### T050 – Freeze the recommended block, test skeleton

**Purpose**: the "recommended SANDBOX block unchanged" ratchet must be captured **before** the guide is edited.

**Steps**:
1. Copy the two recommended blocks (the YAML `services:` block and the `docker run` block, `consumer-setup.md:953-969`) verbatim into `src/tests/fixtures/plantuml-opt-in-docs/recommended-sandbox-block.yml` (YAML) and `src/tests/fixtures/plantuml-opt-in-docs/recommended-sandbox-run.sh` (shell).
2. Create `src/tests/plantuml-opt-in-docs.test.ts` with the first test: the guide contains both committed blocks byte for byte. Commit; it passes on today's guide.

### T051 – Guide subsection

**Steps**: add `### Allowing external includes` (match the heading level of "Run the PlantUML service hardened") right after the hardened section. Cover, in this order, every FR-008 topic:
1. When you need it: URL includes only; bundled `!include <C4/...>` needs no opt-in.
2. Declare it: `plantumlAllowExternal: ['https://…/']` in `docKitty({...})`, or `DK_PLANTUML_ALLOW_EXTERNAL` (environment wins); the three values; lowercase `internet`.
3. The prefix rule and why entries end in `/` (`http://host` also allows `http://host.evil.com`); no `;` inside an entry; **no `@`** (PlantUML never matches an entry containing `@`, spike F5); write the service's entries **exactly as declared** (the check compares raw strings, though PlantUML itself trims, lowercases and drops `:80` / `:443`); an empty item in `PLANTUML_ALLOWLIST_URL` (`;http://…`) allows every URL and fails the check (spike F2).
4. Run the service in allowlist mode: the GitHub Actions block (equal to WP08's lane block, with an example entry in place of `http://dk-canary:18091/dk-declared/`) and the `docker run` block; `PLANTUML_ALLOWLIST_URL` and its `;` separator; the canary entry `http://dk-canary:18091/dk-canary/allowed/` needed where the check runs; `--add-host dk-canary:host-gateway`.
5. Verify: the full command with `--astro-config`, `--canary-host dk-canary --canary-port 18091`, `--service-container`; the verdict line; `--print-declared`. Always pass `--astro-config` (Limits).
6. **Inspectable services only** (decisions `01M6F21EKGBG5HF8XA2YFC517K`, `01M6F4BRKQ4E9H9Z41BYZH37MC`): Kubernetes, a plain jar or a remote server cannot pass allowlist **or internet** mode; an operator-asserted allowlist is a follow-up.
7. Trade-offs: requests reach those URLs; builds depend on them; allowlist and internet modes also relax local-file reads; internet mode can reach internal networks and cloud metadata endpoints; redirects (state what the spike found).
8. Internet mode: the value, the service profile, the warnings on every run; verification reads the container's `PLANTUML_SECURITY_PROFILE` (must be `INTERNET`) and needs `--service-container`; a real internet-mode service refuses the check's private canary, so the canary lines are information only and the check does not prove the service reaches the internet (spike F1).
9a. Redirects: the pinned image did not follow a redirect from an allowed entry to a non-allowed URL in the spike (F3); the check still fails if one is followed.
9. Turn it off: remove the site option and unset the env; return the service to SANDBOX; **there is no environment off-switch** (`DK_PLANTUML_ALLOW_EXTERNAL=""` is unset, so the site value still applies).
10. The unset-mode check and its limits (decision `01M6F4XFDPJ6XFBYM5HM65G1AM`): with `--service-container`, the check now requires the service's profile to be `SANDBOX` even when the opt-in is unset, and fails otherwise (absent = the image default `INTERNET`) — **a behaviour change**: a service named by `--service-container` whose profile is not `SANDBOX` used to pass. Without the container, a service left in allowlist mode is caught only with `--canary-host dk-canary --canary-port 18091`, and a real internet-mode service or one allowlisting only other entries looks sandboxed. Recommend always passing `--service-container`.
Do not touch the recommended blocks or the existing recipe text above the new subsection.

### T052 – ADR-0074

**Steps**: create `docs/adr/0074-plantuml-external-include-opt-in.md` from `docs/adr/template.md`, Status **Accepted**, dated 2026-11-02, linking #268, #256, #251 and ADR-0072 where relevant. Content (asserted by T055):
- Spike findings recorded in the ADR: internet mode is verified by the container's profile because a real INTERNET service refuses the private canary (D5 `01M6F4BRKQ4E9H9Z41BYZH37MC`); empty service-allowlist items fail (D6 `01M6F4BVDASAREW2NVH23727CW`); raw entry comparison is deliberately stricter than PlantUML's normalization.
- Context: #256 / #251 hardening; the decision lived only in `docs/architecture/diagrams.md`; consumers #6100 / #6916.
- Decision: sandbox stays the default; the opt-in `plantumlAllowExternal` / `DK_PLANTUML_ALLOW_EXTERNAL` with exactly three values (unset, allowlist, `internet`); **the environment wins**, a new rule, not a `DK_PLANTUML_SERVER_URL` precedent; the toolkit declares and verifies, never configures the service (C-003); why a top-level option instead of `diagrams.plantuml.allowExternal` (R1).
- What the include check proves per mode, and **what it cannot prove**: every spec Limits bullet, including the `--astro-config` limit (site-config-only value without the flag passes as unset) and the D4 limit (allowlist needs `docker inspect`).
- Alternatives considered (R1, R2 table summary, R5).
- Deferred: failing a build whose internet mode comes only from the environment (squad finding 15); an operator-asserted `--service-allowlist-url` (follow-up).
- Consequences: a new CI lane, **unconditional** (not path-scoped) because SC-004 asks for the real-service proof on every run — the recorded exception to ADR-0007; the inventory test; unset mode with `--service-container` now requires `SANDBOX` (decision `01M6F4XFDPJ6XFBYM5HM65G1AM`).

### T053 – Architecture and ops pointers

**Steps**:
1. `docs/architecture/diagrams.md`: in the "The PlantUML service is pinned and sandboxed" bullet, add one sentence: sandbox stays the default; an operator may opt into allowlist or internet mode (link `../adr/0074-plantuml-external-include-opt-in.md` and the guide anchor). Bump `updated:`.
2. `docs/architecture/ci-cd-pipeline.md` and `docs/ops/ci-cd.md`: wherever lanes are listed or counted, add `plantuml-allowlist` with one line on what it proves; keep counts consistent with `ci.yml`'s header (WP08). Bump `updated:`.

### T054 – Changelog fragment

**Steps**: create `docs/changelog/unreleased/268-plantuml-external-include-opt-in.md`:
```markdown
---
section: Added
---

- **Operators can let PlantUML fetch declared remote includes (#268).** Before, every URL include failed the build under the hardened `SANDBOX` service. Now `plantumlAllowExternal` (or `DK_PLANTUML_ALLOW_EXTERNAL`) accepts exactly three values: unset (sandbox, the default, unchanged), a list of URL prefixes (allowlist mode), or `internet`. The build prints which entries were declared, and `dockitty-assert-plantuml-no-remote-include` verifies the running service matches. Given `--service-container`, the check now also fails a service whose `PLANTUML_SECURITY_PROFILE` is not `SANDBOX` when the opt-in is unset (a missing value counts as the image default, `INTERNET`): a service set up that way passed before. See [ADR-0074](docs/adr/0074-plantuml-external-include-opt-in.md) and [Allowing external includes](docs/guides/consumer-setup.md#allowing-external-includes).
```
Wrap to the repo's line length like other fragments. Run `pnpm validate:changelog`.

### T055 – Prose assertions

**Steps**: extend `src/tests/plantuml-opt-in-docs.test.ts`:
1. Guide: the `Allowing external includes` heading exists; its GitHub Actions allowlist block, after replacing its declared entry with `http://dk-canary:18091/dk-declared/`, equals the `plantuml-allowlist` service block extracted from `.github/workflows/ci.yml` (same image, ports, options, env) — FR-008 "the same block the CI lane runs".
2. Guide subsection contains: `PLANTUML_ALLOWLIST_URL`, `;`, `end with`, `host.evil.com`, `dk-canary:18091/dk-canary/allowed/`, `<C4/`, `local-file` (or `local file`), `internal networks`, `cloud metadata`, `redirect`, `docker inspect`, `--astro-config`, `off-switch` (or "no environment off-switch"), `internet`, `@`, `exactly as declared`, `PLANTUML_SECURITY_PROFILE`, `empty`.
3. ADR-0074 exists, frontmatter has the required fields, and it contains: `sandbox` + `default`, the three values (`plantumlAllowExternal`, `DK_PLANTUML_ALLOW_EXTERNAL`, `internet`), `environment wins` (or "environment value wins"), `--astro-config`, `docker inspect`, `cannot prove` (a limits heading), `--service-allowlist-url`, `unconditional` (why the lane is not path-scoped: SC-004, ADR-0007 exception; analyze A19), `SANDBOX` (unset mode with a container).
4. Fragment: `section: Added`; contains `plantumlAllowExternal`, `DK_PLANTUML_ALLOW_EXTERNAL`, `internet`, `default`, `(#268)`, `--service-container`, `SANDBOX`.
5. `diagrams.md` links `0074-plantuml-external-include-opt-in.md`.
6. `docs/adr/README.md` table is **not** edited by this WP (assert nothing here; reviewer checks the diff).

### T056 – Docs gates

**Steps**: run `pnpm validate:docs`, `pnpm validate:links`, `pnpm validate:changelog`, `pnpm validate:adr-ids`, `pnpm lint`, and Vale if available locally (doc-sanity lane otherwise). Fix every finding in owned files.

## Test Strategy

Prose tests assert existence and required substrings, not wording (DIRECTIVE_041). The block-equality test ties the guide to the real lane, so the guide cannot drift from what CI runs. The recommended-block ratchet is captured before edits (T050).

## Definition of Done

- [ ] Guide subsection passes the required-substring list in `plantuml-opt-in-docs.test.ts` (T055 item 2: `PLANTUML_ALLOWLIST_URL`, `;`, `end with`, `host.evil.com`, `dk-canary:18091/dk-canary/allowed/`, `<C4/`, local file reads, `internal networks`, `cloud metadata`, `redirect`, `docker inspect`, `--astro-config`, the no-off-switch statement, `internet`) and the block-equality test (T055 item 1); recommended blocks byte-identical (T050).
- [ ] ADR-0074 file exists with all required content; index table untouched.
- [ ] `diagrams.md`, `ci-cd-pipeline.md`, `ops/ci-cd.md` updated.
- [ ] Fragment present and valid; `CHANGELOG.md` untouched.
- [ ] `plantuml-opt-in-docs.test.ts` green; all docs gates pass.
- [ ] **Mission-level gate** (this is the last WP): the full `pnpm test` and `pnpm lint` pass on the merged lane state.

## Risks

- Editing the recommended SANDBOX block (C-001) — the ratchet test catches it.
- Writing the ADR before WP11's messages / flags and WP08's block are final — this WP depends on both (and on WP01 for the spike's redirect and trimming findings).
- ADR number collision with a parallel PR — re-check before writing.

## Reviewer Guidance

- Check `git diff docs/adr/README.md CHANGELOG.md` is empty.
- Check the guide's allowlist block against `ci.yml`.
- Read the ADR's limits section against spec Limits bullet by bullet.

## Requirement trace

| Requirement | Subtask |
|---|---|
| FR-008 guide subsection | T051, T055.1–2 |
| FR-009 ADR + diagrams.md | T052, T053, T055.3, T055.5 |
| FR-010 fragment | T054, T055.4 |
| C-002 fragment, never CHANGELOG.md | T054, T056 |
| FR-007 / C-001 recommended block unchanged | T050 |

## Implement command

```bash
spec-kitty agent action implement WP10 --agent claude --mission plantuml-external-opt-in-01M6F052
```
