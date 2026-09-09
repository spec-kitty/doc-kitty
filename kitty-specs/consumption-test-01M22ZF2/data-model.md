# Data Model: Consumption Test + Consumer-Layer Proof

This mission has no runtime domain data. The "entities" are the build-time and
CI artifacts and their invariants.

## E-01 — Consumer fixture site

- **Represents**: a net-new docsite that an external adopter could reproduce.
- **Key attributes**: `package.json` with `"@commondocs-kitty/toolkit": "file:./toolkit.tgz"`
  + pinned peers (astro/starlight/sitemap); committed `pnpm-lock.yaml`;
  `astro.config.mjs`; `src/content.config.ts`; `src/pages/*` route endpoints;
  `docs/**` slice; `.contextive/definitions.yaml`; `url-baseline.txt`.
- **Relationships**: consumes **E-04** (tarball); applies **E-02** (theme); carries
  **E-03** (book slice).
- **Invariants**:
  - **INV-1 (tarball-only, non-fakeable)**: the fixture is its own pnpm workspace root
    (own empty `pnpm-workspace.yaml`) and installs with `--ignore-workspace`;
    `realpath(node_modules/@commondocs-kitty/toolkit)` is inside the fixture, not a
    symlink, not under repo `src/`, version `0.1.0`; **0** repo-relative toolkit
    imports (grep); and the build succeeds with repo `src/` unresolvable. A bare
    "resolves under node_modules" check is insufficient — a workspace symlink to
    `src/` satisfies it. (NFR-001, contract C-0)
  - **INV-2 (base match)**: `base` in `astro.config.mjs` equals the docs loader `base`.
  - **INV-3 (peers local)**: astro/starlight/sitemap install at the fixture, not
    inherited from the monorepo root.

## E-02 — Editorial/press consumer theme

- **Represents**: the third theme layer (consumer) proving the merge at N=2.
- **Shape**: `DocKittyTheme { name, extends: specKittyTheme, tokens: Record<string,string>,
  customCss: string[] }` + `press.css`.
- **Relationships**: `extends` the spec-kitty brand (**E-04**-shipped) → default layer
  prepended by the resolver.
- **Invariants**:
  - **INV-4**: `tokens` keys are `--dk-*` only; a `--sl-*` key is forbidden (throws).
  - **INV-5**: mode-varying colour lives in `press.css` (`:root` + `:root[data-theme='dark']`),
    never in the object `tokens` map.
  - **INV-6**: `customCss` layers after the brand; overrides rely on source order at
    plain specificity.

## E-03 — Representative book slice

- **Represents**: the ars-rethorica content the fixture renders.
- **Key attributes**: Hub/Explanation/Persona/Glossary `kind` pages; `glossary_context:
  rhetoric`; `external_references` citing `_meta/bibliography.yaml` ids; CC-BY-SA-4.0
  attribution in `about-and-license.md`.
- **Invariants**:
  - **INV-7**: `type: Reference` produces a **warning** (Kind-not-DocType), never a gate
    failure — the fixture tolerates it.
  - **INV-8**: every `external_references` id exists in `_meta/bibliography.yaml`.
  - **INV-9**: glossary pages are **generated** from `.contextive/definitions.yaml` at
    build — not hand-edited.

## E-04 — Toolkit tarball

- **Represents**: `npm pack` output of `@commondocs-kitty/toolkit@0.1.0` — the sole
  channel through which the fixture obtains the toolkit.
- **Key attributes**: ships `index.ts, lib, scripts, components, layouts, themes, assets,
  styles` per the `files` allowlist; raw `.ts`/`.astro`/`.css` (no compiled dist).
- **Invariants**:
  - **INV-10 (allowlist sufficiency)**: every **statically-imported** path the fixture
    resolves (an `exports`-mapped `.ts`/`.astro`/`.css`/statically-imported `.svg`)
    comes from the tarball; a missing one fails the build closed (Node/Vite
    `ERR_MODULE_NOT_FOUND`). **Carve-out**: the favicon is resolved lazily at
    `astro:build:done` (`src/lib/favicon.ts`) and a missing favicon **warns without
    failing** — so `favicon.svg` omission is caught by the favicon-output presence
    check (contract C-3), not by the module-resolution path.
  - **INV-11 (zero bloat)**: fixture/theme add **0** files to this tarball.

## E-05 — Consumption-test workflow + orchestration

- **Represents**: `consumption-test.yml` + `run-consumption-test.mjs` (shared by CI/local).
- **Sequence** (see contracts): pack → normalize `toolkit.tgz` → install (frozen) →
  `astro build` → four portable gates + `assert-consumer-artifacts.mjs`.
- **Invariants**:
  - **INV-12 (fail-closed)**: any packaging gap or unresolved export → non-zero exit with
    an identifying message.
  - **INV-13 (budget)**: ≤ 8 min on the standard runner excluding cache-cold install.
  - **INV-14 (no PlantUML/Chromium)**: no `services:`, no `@beoe` cache, no `playwright install`.

## E-06 — Packaging-gap self-test fixture

- **Represents**: the crafted input proving INV-10/INV-12 (remove an allowlisted file →
  detection).
- **Invariant**: **INV-15** — realized as a focused Vitest test against a crafted fixture,
  never a permanently-red standing CI gate (mirrors the redirect-coverage failure-mode tests).
