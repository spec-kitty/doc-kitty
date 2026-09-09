# Contract: Consumption Test

Defines the observable behavior of the consumption test — the sequence, the
fail-closed semantics, and the artifact checks. Authoritative for IC-04/05/06/07.
Revised post-plan-squad (2026-09-09): workspace isolation made non-fakeable; the
agent-API key corrected to the shipped `pages[]`; the favicon warn-path carved out
of the fail-closed claim; a theme-token verifier added.

## C-0 — Fixture workspace isolation (NON-FAKEABLE; the mission's core proof)

The fixture lives at `tests/consumption/consumer-fixture/`, nested under the repo's
`pnpm-workspace.yaml`. pnpm resolves its workspace root by walking **up** from the
cwd, so a naive `pnpm install` inside the fixture would join the repo workspace,
render the fixture lockfile inert, and can symlink `@commondocs-kitty/toolkit → ../../../src`
— building against source while every "resolves under node_modules" check passes.
That would make the whole test a false green. Therefore:

1. The fixture MUST be its **own** workspace root — ship
   `tests/consumption/consumer-fixture/pnpm-workspace.yaml` (empty `packages: []`)
   **and** install with `--ignore-workspace`. (Belt and suspenders; either alone is
   fragile.)
2. After install, assert **all** of:
   - `realpath(<fixture>/node_modules/@commondocs-kitty/toolkit)` is **inside the
     fixture directory** and **NOT** under the repo `src/`;
   - that path is **not a symlink**;
   - the toolkit's `package.json` version there is exactly the packed `0.1.0`.
3. The build (C-1 step 4) additionally runs with the repo `src/` made **unresolvable**
   to the fixture (e.g. the orchestrator temporarily renames `src/` and restores it in
   a `finally`, or builds a copied-out fixture with an isolated store). A green build
   with the toolkit source hidden is the SC-001 proof — the `../src` grep alone is not.

## C-1 — Orchestration sequence (`run-consumption-test.mjs`)

Inputs: repo root. Steps, in order; any non-zero step aborts with a non-zero exit:

1. **Pack**: `npm pack` in `src/` → normalize output to
   `tests/consumption/consumer-fixture/toolkit.tgz` (stable name).
2. **Install (isolated, per C-0)**: in the fixture, `pnpm install --frozen-lockfile
   --ignore-workspace` resolving `@commondocs-kitty/toolkit` from `file:./toolkit.tgz`
   plus pinned peers. No registry fetch of the toolkit.
3. **Resolution assertion (C-0 step 2)**: realpath-inside-fixture, not-a-symlink,
   version `0.1.0`, plus the `../src` grep (INV-1). Fail closed on any miss.
4. **Build (source-hidden, C-0 step 3)**: `astro build` in the fixture with `src/`
   unresolvable → `dist/` + `rss.xml`, `llms.txt`, `sitemap*.xml`, `api/index.json`,
   `api/pages/*.json`, `api/bibliography.json`.
5. **Gates** (all must pass), invoked from the installed package
   (`node_modules/@commondocs-kitty/toolkit/scripts/*.mjs`):
   - `validate-frontmatter.mjs <fixture>/docs --index-basename README,index`
     (exit 0; `type: Reference` warnings tolerated).
   - `check-links.mjs <fixture>/docs` — see C-7 (runs in base-relative/looser mode).
   - `check-redirect-coverage.mjs <fixture>/url-baseline.txt <fixture>/dist`
   - `assert-no-broken-links.mjs <fixture>/dist [--base <base>]` — the fully-portable
     strict built-link check that complements the looser `check-links` (C-7).
   - `assert-consumer-artifacts.mjs <fixture>/dist` (C-3).
6. **Theme assertion**: `assert-consumer-theme.mjs <fixture>/dist` (C-6).

Exit 0 iff every step passes.

## C-2 — Fail-closed semantics (INV-12) — scoped to statically-imported modules

A "packaging gap" that MUST fail closed is any of:

- a **statically-imported** file the fixture resolves through an `exports` subpath
  (a `.ts`/`.astro`/`.css`/statically-imported `.svg`) is **absent from the tarball**
  (`files` allowlist omission) → Node/Vite raises `ERR_MODULE_NOT_FOUND` at build;
- an `exports` subpath the fixture uses is **undeclared or mis-targeted**;
- a peer the toolkit requires is unresolved at the fixture.

Each MUST surface as a **non-zero exit** from step 2 or 4 with a message naming the
unresolved specifier.

**Known carve-out (verified):** the favicon is resolved lazily at `astro:build:done`
by `src/lib/favicon.ts`; a missing favicon file **warns and the build still succeeds**
(by design — "a missing brand mark must not take down an otherwise healthy build").
So a `favicon.svg` allowlist omission does NOT fail the build via the module path.
C-3 therefore adds a **favicon-output presence check** so that specific omission is
still caught; and the C-4 self-test MUST target a statically-imported module, never the
favicon. SC-004 is scoped accordingly (statically-imported modules + the favicon
output check), not "literally any file".

## C-3 — Consumer artifact check (`assert-consumer-artifacts.mjs <dist>`)

Consumer-owned, corpus-agnostic (asserts shape/presence, never corpus counts). Uses a
real stack-based XML well-formedness scanner (not a regex). Asserts, against `dist/`:

- `rss.xml` — exists, non-empty, well-formed XML, a `<channel>` with ≥1 `<item>`.
- `llms.txt` — exists, non-empty, first line a top-level `#` title.
- `sitemap-index.xml` (or `sitemap-0.xml`) — exists, well-formed, ≥1 `<loc>`.
- `api/index.json` — exists, valid JSON; top-level key is **`pages`** (the shipped
  `agent-index.ts` route emits `pages[]`, NOT `entries[]`); `version === '2'`;
  `count === pages.length`; and every `pages[]` record carries the required keys
  `slug, route, section, title, doc_status, kind` (plus `related[]`/`audience[]`
  where applicable). (Corpus-agnostic: shape + invariants, no fixed counts.)
- `api/bibliography.json` — exists, valid JSON, `records[]` each with `id/title/url`.
- **favicon output** — the built site emits a favicon asset (referenced `<link
  rel="icon">` target exists in `dist/`); closes the favicon warn-path hole (C-2).

Exit non-zero with a per-assertion message on any failure.

## C-4 — Packaging-gap self-test (`consumption-gap.test.ts`, INV-15) — two-arm

A focused Vitest test against a **crafted copy** of the fixture, asserting BOTH arms:

1. **Positive control**: the unmodified crafted fixture builds **green** (proves the
   test harness itself is sound — not always-failing).
2. **Fail-closed**: after removing **one file the fixture genuinely imports** that is
   **actually in the toolkit `files` allowlist** and **statically imported** (derive it
   from the real fixture imports ∩ real packed file list — NOT a hand-invented path,
   and NOT the favicon), the build fails with a message **naming that specifier**.

It constructs and tears down its own fixture (no standing red gate), mirroring
`src/tests/redirect-coverage.test.ts`.

## C-5 — Workflow contract (`consumption-test.yml`, INV-13/INV-14)

- Triggers: pull requests touching `src/**`, `tests/consumption/**`, or the workflow
  itself (via `.github/filters.yml` or `paths:`), plus `workflow_dispatch`.
- Runner: `ubuntu-latest`. Setup: `corepack enable` → `actions/setup-node` (node 22,
  `cache: pnpm`, SHA-pinned) → run `run-consumption-test.mjs`.
- **No** `services: plantuml`, **no** `@beoe` cache, **no** `playwright install`.
- Completes in ≤ 8 min excluding cache-cold install.

## C-6 — Consumer-theme verifier (`assert-consumer-theme.mjs <dist>`, SC-003)

Corpus-agnostic proof that the CONSUMER layer won (not the default/brand). Against the
fixture's emitted token sheet in `dist/` (the `:root` catalog written by
`emitTokenSheet`): for each of **≥5 named `--dk-*` tokens** the press theme sets
(e.g. an accent, a display font, a heading colour, a surface, a radius/space token),
assert the emitted `:root` value **equals the press value** AND **differs from the
toolkit default** for that key (and, where the brand sets it, from the brand value).
`press === default` is a FAIL (it would not prove the consumer layer overrode
anything). For any token the press theme sets as mode-varying, assert both the `:root`
and `:root[data-theme='dark']` declarations carry the press value (the dark block has
specificity 0,2,0 and out-ranks a bare `:root` — see research D4). Exit non-zero with a
per-token message on any failure.
