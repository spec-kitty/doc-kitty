# Acceptance — Metadata model and chrome (M1)

Audience: the reviewer and merge operator deciding whether mission M1 is releasable.
This document maps each success criterion (SC-001…SC-006) to the concrete command
or assertion that proves it, records the observed result, and carries the WP05
anti-laziness evidence: per-class stub-and-confirm-fail for every chrome assertion
and a manual AA contrast checklist.

All commands run from the repository root on branch `feat/metadata-model-and-chrome`.
The build under test is `example/dist`, produced by `pnpm --filter example build`.

## Gate summary

| Lane | Command | Result |
|------|---------|--------|
| code-quality | `pnpm --filter @commondocs-kitty/toolkit test` | 45 passed (4 files) |
| code-quality | `pnpm lint` | exit 0 |
| code-quality | `pnpm --filter example typecheck` | 0 errors, 0 warnings, 0 hints (17 files) |
| doc-sanity | `node src/scripts/validate-frontmatter.mjs docs example/docs` | 86 valid, 8 advisory soft-min warnings, exit 0 |
| doc-sanity | `node src/scripts/check-links.mjs docs example/docs` | 425 references resolve across 86 files |
| doc-sanity | `npx markdownlint-cli2 "docs/**/*.md" "example/docs/**/*.md"` | 0 issues in 86 files |
| build-example | `pnpm --filter example build` | 14 pages built, pagefind indexed 13 pages |
| build-example | `node src/scripts/assert-build-artifacts.mjs example/dist` | PASS (7 base + 9 chrome checks) |

## Success criteria

### SC-001 — every page carries `doc_status` + `kind`, no legacy `status:`, scaffold conforms

Proof commands and observed results:

- `git grep -nE "^status:" -- 'docs/*.md' 'docs/**/*.md' 'example/docs/*.md' 'example/docs/**/*.md'`
  returns no matches (exit 1). No legacy key remains.
- `git grep -L "^doc_status:"` and `git grep -L "^kind:"` over the same
  depth-inclusive pathspecs list no files. Every page carries both fields.
- `docs/README.md` and `example/docs/README.md` checked by name each carry
  `doc_status` and `kind` (the bare `**/*.md` glob misses bundle roots).
- `node src/scripts/validate-frontmatter.mjs docs example/docs` reports 86 files
  valid, exit 0 (8 warnings are the advisory 50-char description soft-min, which
  exits zero by design — US1 scenario 5).

Result: MET.

### SC-002 — validator fails on contract violations, warns on open-vocabulary deviations

Proof: the schema-validator parity suite drives the standalone validator and the
build schema across a shared fixture corpus and asserts identical pass/fail per
fixture (FR-008/FR-009/NFR-005).

- `pnpm --filter @commondocs-kitty/toolkit test` → `schema-validator-parity.test.ts`
  16 tests passed; `metadata.test.ts` 13 passed; `agent-api.test.ts` 3 passed;
  `image-paths.test.ts` 13 passed. 45 total, 0 failures.

Result: MET (covered by the WP01/WP02 test corpus; WP05 re-ran it green).

### SC-003 — published pages render band + share metadata; carriers + token catalog + bridge present

Proof: `node src/scripts/assert-build-artifacts.mjs example/dist` (chrome module),
observed ok lines:

- metadata band rendered with text-labelled status "active" on
  `architecture/overview/index.html`.
- head share tags present: `og:title`, `og:description`, `og:image`,
  `og:image:alt`, `twitter:card=summary_large_image`, `twitter:image`, canonical.
- three distinct resolved `og:image` values across the hero / `social_thumb` /
  site-default demonstrators, each pinned to its expected source
  (`overview-hero`, `getting-started-share`, `social-default`).
- four carriers active: `dk-chrome` head marker, `dk:page-hero` host,
  `dk:metadata-band` host, and the Hub layout the `MarkdownContent` carrier resolves.
- token catalog: all 68 required `--dk-*` tokens declared in the emitted stylesheet.
- bridge: all 28 `--dk-* → --sl-*` assignments present.

Result: MET.

### SC-004 — Hub renders as a described-link list, in-frame, body in the Pagefind index

Proof:

- The Hub page (`example/dist/context/index.html`) renders `dk-hub__list`,
  `dk-hub__item`, `dk-hub__card`, `dk-hub__title`, `dk-hub__desc`, `dk-hub__kind`,
  and a `role="navigation"` landmark, visibly distinct from the prose layout.
- The chrome module decompresses every `dist/pagefind/fragment/*.pf_fragment`
  (gzip binary, decoded with `node:zlib`, string-searched, never JSON-parsed) and
  confirms the Hub url marker `/context/` plus the child descriptions
  "ubiquitous language" and "problem this example solves" are present.

Result: MET.

### SC-005 — agent index count 12, records carry `doc_status` + `kind`, draft absent everywhere

Proof: base assertions in `assert-build-artifacts.mjs`, observed ok lines:

- agent index valid JSON, expected shape, 12 entries (pinned
  `EXPECTED_INDEX_ENTRY_COUNT == 12`, `EXPECTED_PAGE_KEYS` includes `doc_status`
  and `kind`).
- sitemap: draft route `adr/template` absent, 12 page URLs (published set).
- the draft page is excluded from the agent index and RSS by the `doc_status`
  gate, and from the sitemap by the `@astrojs/sitemap` filter.

Result: MET.

### SC-006 — `ci-ok` green with no intermediate red boundary; branch mergeable

Proof: all three lanes pass locally (see Gate summary). WP01–WP04 landed the
atomic cutover before the chrome fanned out (C-010), so no work-package boundary
left `doc-sanity` or `build-example` red. The branch targets
`spec-kitty/doc-kitty` `main`; merge is gated only by branch protection.

Result: MET locally; remote `ci-ok` and branch protection are verified on the PR.

## Per-class stub-and-confirm-fail evidence (T027 anti-laziness)

Method: for each asserted class, `example/dist` is copied to a scratch directory,
ONE targeted stub is applied to the copy, and the WP05 assertion module runs
against the copy. The real `example/dist` is never mutated. A class is
non-fakeable only if the stub flips the gate red.

| # | Asserted class | Stub applied to the dist copy | Result | Failure message (verbatim) |
|---|----------------|-------------------------------|--------|-----------------------------|
| 1 | Metadata band (text label) | remove the `active` label text after the visually-hidden span | RED | `metadata band: status pill on architecture/overview/index.html carries no text label` |
| 2 | Optimized hero `<img>` | rewrite the hero `src` off `/_astro/` | RED | `page hero: no optimized <img> with a hashed /_astro/ src on architecture/overview/index.html` |
| 3 | Head share tags | delete the `og:title` meta | RED | `head share tags: og:title missing on architecture/overview/index.html (FR-014)` |
| 4 | Three-branch share image | break the site-default `og:image` source | RED | `share image: site-default page og:image should be the shipped default` |
| 5 | Four carriers | delete the `dk-chrome` head marker | RED | `carriers: Head carrier marker <meta name="dk-chrome"> absent (FR-011)` |
| 6 | Token-catalog completeness | drop one token (`--dk-radius-pill`) from the emitted CSS | RED | `token catalog: 1 required --dk-* token(s) not declared: --dk-radius-pill (FR-017 completeness)` |
| 7 | `--dk-* → --sl-*` bridge | drop one bridge assignment (`--sl-content-width`) | RED | `bridge: 1 --dk-* → --sl-* assignment(s) missing: --sl-content-width=var(--dk-width-content) (C-007)` |
| 8a | AA — `:focus-visible` | rename `:focus-visible` in the emitted CSS | RED | `accessibility: no :focus-visible rule in the emitted CSS (NFR-001)` |
| 8b | AA — `≥24px` target | knock every `min-height`/`min-width` below 24px | RED | `accessibility: no min-height/min-width ≥24px rule in the emitted CSS (NFR-001)` |
| 9 | Pagefind Hub body | re-gzip each fragment with the Hub markers removed | RED | `pagefind: Hub markers absent from the fragment index: "/context/", "ubiquitous language", "problem this example solves" (NFR-004 / SC-004)` |

Every class goes RED when stubbed; each restores to green against the real build.
The AA class carries two independent sub-rules (8a, 8b), each proven to fail on its
own. The gate is non-fakeable: a hand-written stub of any chrome element fails it.

## Manual AA contrast checklist (NFR-001 residual)

Computed WCAG 2.2 contrast ratios for every `--dk-*` state/`-bg` and status-pill
pair the chrome uses, in both modes. The status pill maps `active→success`,
`draft→warning`, `superseded→info`, and `deprecated`/unknown`→neutral`
(`src/components/slots/MetadataBand.astro`). Small-text threshold applied (≥4.5:1).

| Mode | Pair (foreground on background) | Hex | Ratio | ≥4.5:1 |
|------|--------------------------------|-----|-------|--------|
| light | status pill active→success | `#146c3a` on `#e4f4ea` | 5.69:1 | yes |
| light | status pill draft→warning | `#8a4b00` on `#fbecd2` | 5.84:1 | yes |
| light | status pill superseded→info | `#14539e` on `#e8f1fb` | 6.67:1 | yes |
| light | status pill deprecated/unknown→neutral | `#3f4650` on `#eceef2` | 8.21:1 | yes |
| light | state danger (asides) | `#b42318` on `#fbe9e7` | 5.61:1 | yes |
| light | band desc/updated: text-muted on bg | `#5a6069` on `#ffffff` | 6.34:1 | yes |
| light | body text on bg | `#3a4149` on `#ffffff` | 10.33:1 | yes |
| light | accent-text (links/titles) on bg | `#1d3d94` on `#ffffff` | 9.78:1 | yes |
| dark | status pill active→success | `#7fd6a3` on `#14301f` | 8.18:1 | yes |
| dark | status pill draft→warning | `#ecc16a` on `#33260c` | 8.71:1 | yes |
| dark | status pill superseded→info | `#9cc3f5` on `#16273f` | 8.26:1 | yes |
| dark | status pill deprecated/unknown→neutral | `#aab3c2` on `#232b3a` | 6.72:1 | yes |
| dark | state danger (asides) | `#f2a79c` on `#351613` | 8.45:1 | yes |
| dark | band desc/updated: text-muted on bg | `#9aa3b2` on `#131721` | 7.04:1 | yes |
| dark | body text on bg | `#c4cbd6` on `#131721` | 10.97:1 | yes |
| dark | accent-text (links/titles) on surface | `#a9c2f7` on `#131721` | 10.02:1 | yes |

Every pair clears 4.5:1; the minimum observed is 5.61:1. The `≥24px` interactive
target rule and the `:focus-visible` rule are grep-asserted in the emitted CSS by
the chrome module (classes 8a/8b above). Residual pixel-level checks are deferred
to Playwright in M2 (C-002).

## NFR-006 — no new heavy dependency (lockfile stability)

The mission base is `origin/main` (`480471d`), the point where
`feat/metadata-model-and-chrome` diverged. Manifest dependency diff vs that base:

- `example/package.json` and `src/package.json`: `@astrojs/starlight` moved
  `^0.30.0 → ^0.32.6`. This is an in-line upgrade of an already-shipping dependency,
  sanctioned by ADR-0014 (the carrier route-data API lives in Starlight 0.32).
- `src/package.json` adds `./components/*`, `./layouts/*`, `./assets/*` to the
  `exports`/`files` map (FR-025). These are export entries, not dependencies.

No new top-level runtime or build dependency entered any manifest. `pnpm-lock.yaml`
churn (Starlight and its transitive `expressive-code` line) is the resolved closure
of the sanctioned Starlight bump, not an added dependency. NFR-006 is satisfied:
the shipped dependency set stays Astro / Starlight / zod / gray-matter.

## Cutover invariant (C-010) and occurrence-map verification

- No legacy `^status:` key remains (depth-inclusive pathspecs).
- Every page carries `doc_status` and `kind`; both bundle-root READMEs confirmed
  by name.
- The `agent-page.ts` HTTP `status: 404` decoy is intact; the 16 ADR bodies keep
  their `## Status` section.
- Migrated frontmatter set: 85 files (72 docs + 13 example/docs). The tree total is
  now 86 because ADR-0014 was authored this mission (WP02, commit `acb496d`) as a
  born-conformant decision record — it carries `doc_status` and `kind` from the
  start and was never a `status:` migration. This is a documented delta from the
  occurrence-map's "85", not a migration miss.

## Deviations

1. Tree total is 86 files, not the occurrence-map's 85. ADR-0014 (Starlight-upgrade
   decision record) was added during the mission and is born-conformant. Recorded
   above; no action needed.

## PR readiness

The branch is ready to open a PR into `spec-kitty/doc-kitty` `main`. All three
`ci-ok` lanes pass locally, the chrome gate is non-fakeable, the AA checklist holds,
and the atomic-cutover invariant is verified. Remote `ci-ok` and branch protection
are the remaining merge gates, satisfied on the PR.
