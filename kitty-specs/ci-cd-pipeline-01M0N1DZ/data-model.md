# Phase 1 Data Model — Path-Scoped CI/CD Pipeline

There is no persistent application data model. The "entities" are the config and
state structures the pipeline manipulates. Documented here so the contracts and
tasks reference one canonical shape.

## Change group (classification result)

The output of `detect-changes`: one boolean per group, plus a derived
`any_ci` signal.

| Field | Type | Meaning |
|---|---|---|
| `workflows` | bool | `.github/workflows/**` changed → force all lanes |
| `code` | bool | toolkit/site code or build config changed |
| `example_content` | bool | deployed example content/assets changed |
| `repo_docs` | bool | non-deployed project docs changed |
| `ignored` | bool | only ignored paths changed |
| `run_code_quality` | bool | `code \|\| workflows` |
| `run_doc_sanity` | bool | `code \|\| example_content \|\| repo_docs \|\| workflows` |
| `run_build_example` | bool | `code \|\| example_content \|\| workflows` |
| `run_deploy` | bool | `run_build_example` (mainline push only) |

**Invariant**: first-match precedence workflows → code → example_content →
repo_docs → ignored. A file is counted in exactly one *primary* group even though
`dorny/paths-filter` may match it in several; the `run_*` signals are derived from
the primary-group booleans.

## Lane result (per job)

| Field | Type | Values |
|---|---|---|
| `result` | enum | `success` \| `failure` \| `cancelled` \| `skipped` |

**Rule**: `skipped` counts as non-blocking; `failure`/`cancelled` are blocking.

## ci-ok evaluation

| Input | Source |
|---|---|
| `detect-changes.result` | must be `success` |
| `code-quality.result` | pass if `success` or `skipped` |
| `doc-sanity.result` | pass if `success` or `skipped` |
| `build-example.result` | pass if `success` or `skipped` |

**Output**: `ci-ok` = green iff detect-changes succeeded AND no lane result is
`failure`/`cancelled`. Otherwise red.

## Build artifact set (assertion targets)

Asserted by `assert-build-artifacts.mjs` over `example/dist/`:

| Artifact | Assertion |
|---|---|
| `sitemap*.xml` | exists, non-empty, well-formed XML |
| `rss.xml` | exists, well-formed |
| `llms.txt` | exists, non-empty |
| agent index JSON (`/api/index.json`) | valid JSON, expected shape, expected entry count for today's example |
| README-as-index route | a section `README.md` rendered at its directory route |
| a known page | rendered HTML present |

## Deployment SHA marker

| Field | Type | Meaning |
|---|---|---|
| ref | git ref `smoke/last-run` | commit SHA of the last-smoked deployment |
| live SHA | Deployments API | newest **successful** `github-pages` deployment SHA |

**Rule**: nightly runs iff `live SHA != marker`; on completion, marker ← live SHA.
Missing marker ⇒ treat as changed (run once).

## Nightly report

| Field | Type | Meaning |
|---|---|---|
| summary | Step Summary | always written |
| artifacts | uploaded | Lighthouse HTML, link report |
| issue | GitHub issue | opened/updated **only** when a check fails its threshold |
