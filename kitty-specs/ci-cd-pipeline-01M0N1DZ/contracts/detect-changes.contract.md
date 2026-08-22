# Contract — `detect-changes` job

**Consumers**: code-quality, doc-sanity, build-example, deploy, ci-ok.

## Inputs
- The PR diff (base = merge target) or push diff (base = previous mainline commit).
- The binding change-surface map (spec.md § "Change-surface map").

## Outputs (job outputs, all string `'true'`/`'false'`)
- `workflows`, `code`, `example_content`, `repo_docs`, `ignored`
- `run_code_quality`, `run_doc_sanity`, `run_build_example`

## Rules
1. First-match precedence: workflows → code → example_content → repo_docs → ignored.
2. A single file matching multiple filters resolves to its highest-precedence group.
3. `run_*` derivations per [data-model.md](../data-model.md).
4. The job **always runs** (no trigger-level path filtering).

## Acceptance (maps to spec)
- FR-005, FR-006, C-006; US2.4 (workflows→all), US2.6 (overlap precedence), US2.7 (ignored-only still runs).

## Failure mode
- If the job errors, downstream lanes skip and `ci-ok` must go red (see ci-ok contract).
