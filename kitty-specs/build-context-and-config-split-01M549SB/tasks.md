# Tasks: One owner for build state, a smaller config.ts, and an honest agent API

Mission `build-context-and-config-split-01M549SB`. Issues: #115, #103. The work package prompts in `tasks/` are authoritative; this file is the index. Subtask completion is recorded with `spec-kitty agent tasks mark-status`.

## Subtask Index

| ID | Description | WP | Parallel |
|----|-------------|----|----------|
| T001 | see `tasks/WP01-sitemap-doc-truth.md` | WP01 | |
| T002 | see `tasks/WP01-sitemap-doc-truth.md` | WP01 | |
| T003 | see `tasks/WP01-sitemap-doc-truth.md` | WP01 | |
| T004 | see `tasks/WP02-build-state-and-route-shaping-split.md` | WP02 | |
| T005 | see `tasks/WP02-build-state-and-route-shaping-split.md` | WP02 | |
| T006 | see `tasks/WP02-build-state-and-route-shaping-split.md` | WP02 | |
| T007 | see `tasks/WP02-build-state-and-route-shaping-split.md` | WP02 | |
| T008 | see `tasks/WP02-build-state-and-route-shaping-split.md` | WP02 | |
| T009 | see `tasks/WP03-diagrams-split.md` | WP03 | |
| T010 | see `tasks/WP03-diagrams-split.md` | WP03 | |
| T011 | see `tasks/WP04-gherkin-glossary-markua-split.md` | WP04 | |
| T012 | see `tasks/WP04-gherkin-glossary-markua-split.md` | WP04 | |
| T013 | see `tasks/WP04-gherkin-glossary-markua-split.md` | WP04 | |
| T014 | see `tasks/WP05-env-dir-and-mode.md` | WP05 | |
| T015 | see `tasks/WP05-env-dir-and-mode.md` | WP05 | |
| T016 | see `tasks/WP05-env-dir-and-mode.md` | WP05 | |
| T017 | see `tasks/WP05-env-dir-and-mode.md` | WP05 | |
| T018 | see `tasks/WP06-agent-api-links.md` | WP06 | |
| T019 | see `tasks/WP06-agent-api-links.md` | WP06 | |
| T020 | see `tasks/WP06-agent-api-links.md` | WP06 | |
| T021 | see `tasks/WP06-agent-api-links.md` | WP06 | |
| T022 | see `tasks/WP07-adr-docs-changelog.md` | WP07 | |
| T023 | see `tasks/WP07-adr-docs-changelog.md` | WP07 | |
| T024 | see `tasks/WP07-adr-docs-changelog.md` | WP07 | |
| T025 | see `tasks/WP07-adr-docs-changelog.md` | WP07 | |
| T026 | see `tasks/WP07-adr-docs-changelog.md` | WP07 | |

## Work Packages

### WP01 — #103: the docs name the real sitemap
Prompt: `tasks/WP01-sitemap-doc-truth.md`. Dependencies: none.
T001 (WP01)
T002 (WP01)
T003 (WP01)

### WP02 — One build-state owner; move route-shaping and draft-publication out of config.ts
Prompt: `tasks/WP02-build-state-and-route-shaping-split.md`. Dependencies: none.
T004 (WP02)
T005 (WP02)
T006 (WP02)
T007 (WP02)
T008 (WP02)

### WP03 — Move the diagram integrations out of config.ts
Prompt: `tasks/WP03-diagrams-split.md`. Dependencies: WP02.
T009 (WP03)
T010 (WP03)

### WP04 — Move Gherkin, glossary and Markua out of config.ts; one integration-name constant
Prompt: `tasks/WP04-gherkin-glossary-markua-split.md`. Dependencies: WP03.
T011 (WP04)
T012 (WP04)
T013 (WP04)

### WP05 — The env-file reader honours envDir and --mode
Prompt: `tasks/WP05-env-dir-and-mode.md`. Dependencies: WP02.
T014 (WP05)
T015 (WP05)
T016 (WP05)
T017 (WP05)

### WP06 — #103: _links in the agent-API index and per-page JSON
Prompt: `tasks/WP06-agent-api-links.md`. Dependencies: WP01.
T018 (WP06)
T019 (WP06)
T020 (WP06)
T021 (WP06)

### WP07 — ADR-0058, _links docs, "published" vocabulary, CHANGELOG and final gates
Prompt: `tasks/WP07-adr-docs-changelog.md`. Dependencies: WP01, WP02, WP03, WP04, WP05, WP06.
T022 (WP07)
T023 (WP07)
T024 (WP07)
T025 (WP07)
T026 (WP07)
