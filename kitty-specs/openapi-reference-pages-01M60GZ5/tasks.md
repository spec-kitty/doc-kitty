# Tasks: OpenAPI reference pages

## Subtask Index

| ID | Description | WP | Parallel |
|----|-------------|----|----------|
| T001 | Fixtures example/openapi/v1.yaml and main.yaml (OpenAPI 3.1) | WP01 | |
| T002 | Pin optional peers under DIRECTIVE_051 with evidence | WP01 | |
| T003 | Spike the C-006 criteria (10 verdicts) | WP01 | |
| T004 | ADR-0049 addendum + index | WP01 | |
| T005 | Red-first validation tests for every fail-closed case | WP02 | |
| T006 | normaliseOpenApiOptions (pure) | WP02 | |
| T007 | Dynamic-import peer loader + no-static-import guard | WP02 | |
| T008 | Option in config.ts, Starlight plugin entries, sidebar, collisions, example config | WP03 | |
| T009 | Version links + unreleased badge | WP03 | |
| T010 | --dk-* theming of plugin markup (both modes) | WP03 | |
| T019 | A11y (light/dark) + JS-off static check | WP03 | |
| T011 | Raw document + sha256 sidecar + generated-page rules | WP04 | |
| T012 | llms.txt lines, sitemap, search, pin-test updates | WP04 | |
| T013 | Build asserts, determinism, NFR-004 pass/fail | WP04 | |
| T014 | Consumption arm without the renderer (byte compare) | WP05 | [P] |
| T015 | Consumption arm with the renderer + missing-peer error | WP05 | [P] |
| T016 | How-to with contract, errors, CSP note, limits | WP06 | [P] |
| T017 | NOTICE entries | WP06 | [P] |
| T018 | CHANGELOG [Unreleased] Added entry | WP06 | [P] |

## WP01: Spike starlight-openapi and record the ADR-0049 addendum

**Prompt**: [tasks/WP01-spike-and-adr.md](tasks/WP01-spike-and-adr.md)
**Dependencies**: none

T001 Fixtures (WP01)
T002 Pin optional peers under DIRECTIVE_051 (WP01)
T003 Spike the C-006 criteria (WP01)
T004 ADR-0049 addendum + index (WP01)

## WP02: Validation core and peer loader

**Prompt**: [tasks/WP02-option-and-validation.md](tasks/WP02-option-and-validation.md)
**Dependencies**: Depends on WP01

T005 Red-first validation tests (WP02)
T006 normaliseOpenApiOptions (WP02)
T007 Peer loader + no-static-import guard (WP02)

## WP03: Render the reference pages: wiring, chrome, theming, a11y

**Prompt**: [tasks/WP03-rendering-and-chrome.md](tasks/WP03-rendering-and-chrome.md)
**Dependencies**: Depends on WP02

T008 Option, plugin entries, sidebar, collisions, example config (WP03)
T009 Version links + unreleased badge (WP03)
T010 Theming (WP03)
T019 A11y + static-only (WP03)

## WP04: Publish the raw document, llms.txt lines and build asserts

**Prompt**: [tasks/WP04-raw-document-and-asserts.md](tasks/WP04-raw-document-and-asserts.md)
**Dependencies**: Depends on WP03

T011 Raw document + sha256 + generated-page rules (WP04)
T012 llms.txt, sitemap, search, pin tests (WP04)
T013 Asserts, determinism, NFR-004 (WP04)

## WP05: Consumption test: without and with the renderer

**Prompt**: [tasks/WP05-consumption-test.md](tasks/WP05-consumption-test.md)
**Dependencies**: Depends on WP04

T014 Arm without the renderer (WP05)
T015 Arm with the renderer (WP05)

## WP06: How-to, NOTICE and CHANGELOG

**Prompt**: [tasks/WP06-docs-and-notice.md](tasks/WP06-docs-and-notice.md)
**Dependencies**: Depends on WP04, WP05

T016 How-to (WP06)
T017 NOTICE (WP06)
T018 CHANGELOG (WP06)

## Sequencing

WP01, WP02, WP03 and WP04 run in that order, then WP05, then WP06.

WP01 is a gate. A failed C-006 criterion stops the mission for an operator decision, and its lane is abandoned.
