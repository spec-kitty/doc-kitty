# Tasks: Example content from ars-rethorica

Mission `ars-rethorica-example-01M204RR` · branch `feat/ars-rethorica-example`.
Source vendored at `kitty-specs/ars-rethorica-example-01M204RR/source-vendor/` (read from there — worktree-safe). Conversion rules: `contracts/conversion-transform.md`. Footnote contract: `contracts/footnote-feature.md`.

**Pre-agreed identifiers** (referenced across WPs before their owner lands — all soft/forward-safe):
- Glossary context name: `rhetoric` (WP07 authors it; content WPs set `glossary_context: rhetoric`).
- Persona slugs: `rhetoric-student`, `rhetoric-practitioner` (WP08 authors; content WPs may `audience:`-reference).
- Bibliography id: `freese-rhetoric-1926` (WP03 authors; content WPs cite via `external_references`).
- Section id/route: `rhetoric` → `/rhetoric/...`; books `book-one|book-two|book-three`; chapters `chapter-01`..`chapter-15`.

## Subtask Index

| ID | Description | WP | Parallel |
|----|-------------|----|----------|
| T001 | Footnote de-risking spike (GFM `[^^0_1]` behaviour, on/off) | WP01 | |
| T002 | `markua-footnotes.internal.ts` pure normaliser | WP01 | |
| T003 | `markua-footnotes.ts` plugin + register in config.ts | WP01 | |
| T004 | Unit tests `markua-footnotes.test.ts` | WP01 | |
| T005 | assert:markua footnote fixtures + ADR-0041 | WP01 | |
| T006 | Register `rhetoric` section in sections.yaml | WP02 | |
| T007 | Rhetoric hub `rhetoric/index.md` | WP02 | |
| T008 | Book I landing `book-one/index.md` | WP02 | |
| T009 | Book II & III landing-only pages | WP02 | |
| T010 | Verify section builds + nav | WP02 | |
| T011 | bibliography.yaml Freese/Perseus records | WP03 | |
| T012 | `about-and-license.md` (CC-BY-SA-4.0 + dual credit) | WP03 | |
| T013 | Convert Introduction → `introduction.md` | WP03 | |
| T014 | Convert Preamble → `preamble.md` (glossary extracted) | WP03 | |
| T015 | Convert chapter 1 | WP04 | [P] |
| T016 | Convert chapter 2 | WP04 | [P] |
| T017 | Convert chapter 3 | WP04 | [P] |
| T018 | Convert chapter 4 | WP04 | [P] |
| T019 | Convert chapter 5 | WP04 | [P] |
| T020 | Convert chapter 6 | WP05 | [P] |
| T021 | Convert chapter 7 | WP05 | [P] |
| T022 | Convert chapter 8 | WP05 | [P] |
| T023 | Convert chapter 9 | WP05 | [P] |
| T024 | Convert chapter 10 | WP05 | [P] |
| T025 | Convert chapter 11 | WP06 | [P] |
| T026 | Convert chapter 12 | WP06 | [P] |
| T027 | Convert chapter 13 | WP06 | [P] |
| T028 | Convert chapter 14 | WP06 | [P] |
| T029 | Convert chapter 15 | WP06 | [P] |
| T030 | `rhetoric` context in definitions.yaml (~10 terms) | WP07 | |
| T031 | Verify glossary page generates + autolinks | WP07 | |
| T032 | Reader persona `rhetoric-student` | WP08 | [P] |
| T033 | Reader persona `rhetoric-practitioner` | WP08 | [P] |
| T034 | Bump ratchet counts (compute exact delta) | WP09 | |
| T035 | Opt ~2 rhetoric routes into AXE_PAGES | WP09 | |
| T036 | Full gate suite run + fix lint/vale/link | WP09 | |
| T037 | Update feature doc_status + roadmap row + changelog | WP09 | |
| T038 | Final SC verification | WP09 | |

## Work Packages

### WP01 — Footnote Markua feature (IC-01)
- **Goal**: Ship `[^^N_M]` footnotes as a first-class opt-in Markua feature reusing remark-gfm; byte-identical when off; deck no-op; ADR-0041. **Spike first.**
- **Priority**: P1 (blocks content rendering). **Deps**: none.
- **Independent test**: preset-on footnote fixture renders footnote refs + notes list; preset-off byte-identical; vitest + assert:markua green.
- Subtasks: T001 T002 T003 T004 T005. Prompt: `tasks/WP01-footnote-markua-feature.md` (~330 lines).

### WP02 — Rhetoric section scaffold + hubs/landings (IC-03)
- **Goal**: Create `example/docs/rhetoric/` custom section, register it, author hub + Book I/II/III landings.
- **Priority**: P1. **Deps**: WP01.
- **Independent test**: build shows a Rhetoric sidebar group with book sub-groups; hub + landings resolve.
- Subtasks: T006 T007 T008 T009 T010. Prompt: `tasks/WP02-section-scaffold.md` (~240 lines).

### WP03 — Attribution + Introduction + Preamble (IC-06, IC-03)
- **Goal**: bibliography records, about/license page, converted Introduction + Preamble (glossary extracted, links generated glossary).
- **Priority**: P1. **Deps**: WP02.
- **Independent test**: about/license reachable; intro/preamble render with callouts + attribution.
- Subtasks: T011 T012 T013 T014. Prompt: `tasks/WP03-attribution-intro-preamble.md` (~260 lines).

### WP04 — Book I chapters 1–5 (IC-02, IC-03)
- **Goal**: Convert chapters 1–5 per the conversion contract (footnotes, callouts, degraded xrefs, frontmatter, CC-BY-SA notice).
- **Priority**: P1. **Deps**: WP03.
- Subtasks: T015–T019. Prompt: `tasks/WP04-book-one-ch1-5.md` (~240 lines).

### WP05 — Book I chapters 6–10 (IC-02, IC-03)
- **Deps**: WP03 (parallel with WP04/06). Subtasks: T020–T024. Prompt: `tasks/WP05-book-one-ch6-10.md`.

### WP06 — Book I chapters 11–15 (IC-02, IC-03)
- **Deps**: WP03 (parallel with WP04/05). Subtasks: T025–T029. Prompt: `tasks/WP06-book-one-ch11-15.md`.

### WP07 — Native glossary (IC-04)
- **Goal**: `rhetoric` Contextive context (~10 terms from the Preamble def-list); verify generated glossary page + autolink.
- **Priority**: P2. **Deps**: WP02. Subtasks: T030 T031. Prompt: `tasks/WP07-native-glossary.md` (~180 lines).

### WP08 — Reader personas (IC-05)
- **Goal**: Two constructed `kind: Persona` pages wired to the audience surface.
- **Priority**: P2. **Deps**: WP02. Subtasks: T032 T033. Prompt: `tasks/WP08-reader-personas.md` (~170 lines).

### WP09 — Integration, gates & rollout (IC-07)
- **Goal**: Ratchet bump, a11y route opt-in, full gate suite, feature-page/roadmap/changelog updates, final SC verification.
- **Priority**: P1 (closes the mission). **Deps**: WP01 WP02 WP03 WP04 WP05 WP06 WP07 WP08.
- Subtasks: T034–T038. Prompt: `tasks/WP09-integration-gates.md` (~230 lines).

## Dependency graph
```
WP01 → WP02 → WP03 → (WP04 ‖ WP05 ‖ WP06)
                WP02 → (WP07 ‖ WP08)
   all → WP09
```
MVP: WP01+WP02+WP03 (feature + section + framing + one readable path). Full value needs WP04–06 + WP09.
