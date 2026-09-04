# Tasks: Internal link integrity

**Mission**: link-integrity-01M1PSEH · **Branch**: `fix/link-integrity` · **Merge target**: `main` (PR)
**Spec**: [spec.md](./spec.md) · **Plan**: [plan.md](./plan.md) · **Research**: [research.md](./research.md)

## Subtask Index

| ID | Description | WP | Parallel |
|----|-------------|----|----------|
| T001 | Thread `base` into glossary remark plugins; one base-aware term-URL builder shared by autolink/`:term`/preview | WP01 | |
| T002 | Block-form glossary anchors in generate.ts (no literal `{#}`; id = intended anchor) (#63) | WP01 | |
| T003 | Add `src/lib/with-base.ts` component base helper | WP01 | |
| T004 | Route `metadata.ts routeFor` + Related.astro + Audience.astro through `withBase` | WP01 | |
| T005 | OnThisPage.astro — section links via `withBase`, glossary links via the shared glossary builder | WP01 | |
| T006 | Re-author `example/docs` internal links to `./target.md` (confirmed offenders) | WP01 | |
| T007 | Tests: glossary base+anchor unit + component/authored link resolution assertion | WP01 | |
| T008 | Build; verify 0 base-less internal hrefs + 0 relative-404 in `example/dist` | WP01 | |
| T009 | `assert-no-broken-links.mjs` — base-aware, URL-resolved dist walk asserting targets exist (#62) | WP02 | |
| T010 | Tighten `check-links.mjs`: fail root-absolute + extensionless-relative internal doc links (#62) | WP02 | |
| T011 | Wire `assert:no-broken-links` into package.json + CI; prove RED on pre-fix dist, GREEN after WP01 | WP02 | |
| T012 | ADR/convention note + dated changelog fragment | WP02 | |

## Work Packages

### WP01 — Internal links resolve (#61 + #63)
- **Goal**: every glossary, component, and authored internal link is base-prefixed and resolves; glossary anchors resolve.
- **Priority**: P1
- **Independent test**: `pnpm clean && pnpm build`; 0 base-less internal hrefs and 0 relative-child 404s in `example/dist`; glossary headings have no literal `{#}` and term `#anchor`s match ids.
- **Subtasks**: T001–T008
- **Dependencies**: none
- **Est. prompt size**: ~500 lines
- **Risks**: keep glossary autolink/`:term`/preview URL shape single-sourced; don't double-prefix in Astro components; leave external/anchor/directory-index-relative links untouched.

### WP02 — Fail-closed link gate + docs (#62)
- **Goal**: a base-aware dist link gate + tightened source gate catch link 404s; documented.
- **Priority**: P1
- **Independent test**: the new gate is RED on the pre-fix `dist` and GREEN after WP01; source gate fails on a root-absolute/extensionless-relative internal doc link.
- **Subtasks**: T009–T012
- **Dependencies**: WP01
- **Est. prompt size**: ~220 lines
- **Risks**: false positives on external/mailto/anchor/directory-index links; must model trailing-slash URL semantics, not the filesystem.

## MVP
WP01 delivers all user-facing link fixes; WP02 is the durable guard + docs.
