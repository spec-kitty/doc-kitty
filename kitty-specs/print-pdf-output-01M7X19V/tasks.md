# Tasks: Print and PDF output

**Mission**: print-pdf-output-01M7X19V · **Branch**: `feat/print-pdf-output` (planning, base and merge target)
**Inputs**: [spec.md](./spec.md), [plan.md](./plan.md), [research.md](./research.md), [data-model.md](./data-model.md), [contracts/](./contracts/)

Topology is `single_branch`: the WPs run in order on `feat/print-pdf-output`. `src/lib/config.ts` is owned by WP02; WP03, WP05 and WP06 make small, recorded out-of-map edits to it in sequence, never in parallel.

## Subtask Index

| ID | Description | WP | Parallel |
|----|-------------|----|----------|
| T001 | `src/styles/print.css`: chrome hiding, surfaces, breaks, link URLs, diagrams, tabs, `@page` | WP01 | |
| T002 | `emitPrintTokenSheet` + `virtual:doc-kitty/print-tokens.css` | WP01 | [P] |
| T003 | `print.client.ts` force-light hook, loaded from `PageTitle.astro` | WP01 | |
| T004 | Client diagram render publishes `data-dk-diagram-theme` | WP01 | [P] |
| T005 | Fold the lightbox print rule; chrome-baseline normaliser for print rules | WP01 | |
| T006 | Unit tests: print-token emitter, print.css contract | WP01 | |
| T007 | Playwright print-media spec, both themes | WP01 | |
| T008 | `pdf` key in `sections.ts` and `vocabulary-loader.mjs` | WP02 | |
| T009 | `src/lib/pdf-options.ts`: validate, resolve, `DK_PDF_OPTIONS` reader | WP02 | |
| T010 | `defineDocKittyIntegrations({ pdf })` wiring and handoff | WP02 | |
| T011 | Unit tests for the key, the option and resolution order | WP02 | |
| T012 | ADR-0081 | WP02 | [P] |
| T013 | `print/order.ts`: reading order and exclusion filter | WP03 | [P] |
| T014 | `print/rewrite.ts`: ids, links, heading demotion | WP03 | [P] |
| T015 | Injected `/print/` route, cover and page components | WP03 | |
| T016 | Route integration: injection, sitemap predicate, collision check, `print/manifest.json` | WP03 | |
| T017 | Build gate assertions for print routes | WP03 | |
| T018 | Example opt-in (`sections.yaml`, `astro.config.mjs`) | WP03 | |
| T019 | Unit tests for order, rewrite and route integration | WP03 | |
| T020 | `pdf-inspect.mjs`: minimal PDF reader | WP04 | [P] |
| T021 | `pdf-postprocess.mjs`: date pinning and producer stamp | WP04 | [P] |
| T022 | `dockitty-pdf.mjs` CLI | WP04 | |
| T023 | `assert-pdf-artifacts.mjs` gate | WP04 | |
| T024 | `assert-pdf-determinism.mjs` | WP04 | |
| T025 | Unit tests for inspect, post-pass, CLI arguments, gate | WP04 | |
| T026 | `served-surfaces` `pdf` record | WP05 | |
| T027 | Link check accepts expected `/pdf/` targets | WP05 | |
| T028 | `pdf` CI lane (advisory) | WP05 | |
| T029 | Deploy prints and publishes PDFs | WP05 | |
| T030 | Workflow-shape tests | WP05 | |
| T031 | `chromeOptions.printControl` | WP06 | |
| T032 | `PrintControl.astro` and its placement | WP06 | |
| T033 | Playwright control spec (a11y, both themes) and a fixture dist option | WP06 | |
| T034 | Guide `docs/guides/printing-and-pdf.md` | WP07 | [P] |
| T035 | Configuration reference, section-registry page, migration note | WP07 | [P] |
| T036 | CI/CD docs (`docs/architecture/ci-cd-pipeline.md`, `docs/ops/ci-cd.md`) | WP07 | [P] |
| T037 | Changelog fragments | WP07 | [P] |

## WP01 – Print layer (#378)

**Prompt**: [tasks/WP01-print-layer.md](./tasks/WP01-print-layer.md) · **Priority**: P1 · **Depends on**: none
**Goal**: every page prints clean and light in either theme. **Independent test**: print-media Playwright spec on the built example.

T001 print.css (WP01)
T002 print-token emitter and virtual module (WP01)
T003 force-light hook (WP01)
T004 diagram completion signal (WP01)
T005 lightbox rule fold, chrome-baseline normaliser (WP01)
T006 unit tests (WP01)
T007 Playwright print spec (WP01)

Risks: the chrome-baseline CSS golden; brand CSS-file tokens unknown to the emitter (documented limit).

## WP02 – ADR-0081 and the `pdf` configuration (#382)

**Prompt**: [tasks/WP02-pdf-config-and-adr.md](./tasks/WP02-pdf-config-and-adr.md) · **Priority**: P2 · **Depends on**: none

T008 sections key (WP02)
T009 pdf-options module (WP02)
T010 config wiring (WP02)
T011 unit tests (WP02)
T012 ADR-0081 (WP02)

## WP03 – Section and whole-site print routes (#380)

**Prompt**: [tasks/WP03-print-routes.md](./tasks/WP03-print-routes.md) · **Priority**: P2 · **Depends on**: WP01, WP02

T013 order (WP03)
T014 rewrite (WP03)
T015 route and components (WP03)
T016 route integration (WP03)
T017 build gate (WP03)
T018 example opt-in (WP03)
T019 unit tests (WP03)

## WP04 – `dockitty-pdf`, post-pass, gate, determinism (#381: #392–#395)

**Prompt**: [tasks/WP04-pdf-cli-and-gates.md](./tasks/WP04-pdf-cli-and-gates.md) · **Priority**: P2 · **Depends on**: WP03

T020 inspect (WP04)
T021 post-pass (WP04)
T022 CLI (WP04)
T023 gate (WP04)
T024 determinism (WP04)
T025 unit tests (WP04)

## WP05 – CI lane, deploy, served surfaces (#396, #397)

**Prompt**: [tasks/WP05-ci-deploy-surfaces.md](./tasks/WP05-ci-deploy-surfaces.md) · **Priority**: P2 · **Depends on**: WP04

T026 served surfaces (WP05)
T027 link check (WP05)
T028 CI lane (WP05)
T029 deploy (WP05)
T030 workflow tests (WP05)

## WP06 – Print control (#379)

**Prompt**: [tasks/WP06-print-control.md](./tasks/WP06-print-control.md) · **Priority**: P2 · **Depends on**: WP05

T031 option (WP06)
T032 component (WP06)
T033 a11y spec (WP06)

## WP07 – Documentation and changelog

**Prompt**: [tasks/WP07-docs-and-changelog.md](./tasks/WP07-docs-and-changelog.md) · **Priority**: P2 · **Depends on**: WP06

T034 guide (WP07)
T035 config reference, registry page, migration (WP07)
T036 CI/CD docs (WP07)
T037 changelog fragments (WP07)

## MVP

WP01 alone fixes the P1 defect (dark prints black) for every site.
