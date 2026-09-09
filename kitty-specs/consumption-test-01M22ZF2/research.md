# Research: Consumption Test + Consumer-Layer Proof

Phase 0 decisions. Grounded in a brownfield seam-map reconnaissance of the toolkit
(`src/lib/theme.ts`, `src/lib/config.ts`, `src/scripts/*.mjs`, `themes/spec-kitty/*`,
`example/*`, `.github/workflows/*`, `example/docs/rhetoric/**`).

## D1 — Gate reuse is a split, not a blanket reuse

- **Decision**: Reuse the **four tarball-portable** gate scripts against the fixture
  output — `validate-frontmatter.mjs <root>`, `check-links.mjs <root…>`,
  `check-redirect-coverage.mjs <baseline> <dist>`, `assert-no-broken-links.mjs <dist>`
  — invoked from the installed package (`node_modules/@commondocs-kitty/toolkit/scripts/*.mjs`).
  Add **one small consumer-owned** `assert-consumer-artifacts.mjs` for feeds +
  agent-API presence and well-formedness.
- **Rationale**: `assert-build-artifacts.mjs` computes `REPO_ROOT = SCRIPT_DIR/../..`
  and reads `src/package.json`, `src/lib/config.ts`, `pnpm-lock.yaml`, and its
  assertions are hardwired to the `example` corpus (fixed counts, showcase strings,
  a `assert-chrome-artifacts.mjs` import). `assert-markua-builds.mjs` spawns
  `pnpm --filter example build`. Both break from an installed tarball and cannot
  validate an arbitrary consumer slice. Bending them would couple the fixture to the
  example corpus — the opposite of proving reuse.
- **Alternatives considered**: (a) generalize `assert-build-artifacts.mjs` to accept a
  corpus profile — larger blast radius on a shipped gate, deferred; (b) skip artifact
  assertions — rejected, FR-005/SC-002 require feed + agent-API verification.
- **Consequence**: C-004 is honored as "reuse where portable"; the new checker is
  deliberately small and consumer-owned (not shipped in the tarball).
- **Post-squad correction (debugger lens)**: the consumer artifact checker MUST assert
  the shipped agent-API shape — top-level key **`pages[]`** (NOT `entries[]`, which was
  a live bug in the first contract draft), `version === '2'`, `count === pages.length`,
  and per-page required keys `slug/route/section/title/doc_status/kind` — using a real
  XML scanner (not a regex). These are corpus-agnostic invariants that `assert-build-artifacts.mjs`
  pinned but the portable four do not cover; folding them back keeps the coverage the
  drop would otherwise lose. Contract C-3.

## D2 — Fixture placement: `tests/consumption/`, outside workspace and `src/`

- **Decision**: Place the fixture and its scripts under repo-root `tests/consumption/`.
- **Rationale**: `pnpm-workspace.yaml` lists **explicit** members (`src`, `example`)
  — a new top-level dir is neither symlinked nor built by root `pnpm install`, so the
  fixture genuinely installs the tarball rather than the workspace symlink (NFR-001).
  It is outside `src/`, so it never enters the toolkit tarball (`files` allowlist),
  satisfying NFR-003 (zero bloat). `tests/a11y/` already establishes `tests/` as a
  test-resource home.
- **Alternatives**: `src/tests/fixtures/consumer/` — inside the `src` workspace member,
  risks symlink resolution and confuses the "installed tarball" story; rejected.

## D3 — Install channel: `file:./toolkit.tgz` + committed fixture lockfile

- **Decision**: The orchestrator packs `src/` (`npm pack`), normalizes the versioned
  output to a stable `tests/consumption/consumer-fixture/toolkit.tgz`, and the fixture
  `package.json` declares `"@commondocs-kitty/toolkit": "file:./toolkit.tgz"` with a
  committed `pnpm-lock.yaml`.
- **Rationale**: Deterministic (NFR-004) and reproducible with no registry/secrets
  (C-002). The lockfile pins the peer tree; the toolkit is the exact packed `0.1.0`.
- **Alternatives**: registry publish + version install (needs token/publish — out of
  scope); git-ref install (bypasses the `files` allowlist — proves nothing). Both rejected.

## D4 — Editorial consumer theme: `extends: specKittyTheme`, tokens object + `press.css`

- **Decision**: `pressTheme: DocKittyTheme = { name:'press', extends: specKittyTheme,
  tokens: { /* --dk-* only */ }, customCss: ['./src/theme/press.css'] }`.
- **Rationale**: The merge flattens base→consumer and concatenates `customCss` in layer
  order; a consumer sheet loaded after the brand wins at plain specificity by source
  order. Mode-invariant `--dk-*` overrides go in the object `tokens` map; **mode-varying
  colours MUST live in `press.css`** with `:root` + `:root[data-theme='dark']` blocks,
  because `emitTokenSheet` stores one value per key. Never set a `--sl-*` key (throws,
  ADR-0011).
- **SC-003 target**: at least 5 `--dk-*` tokens (an accent, a display font, a heading
  colour, a surface, and a radius/spacing) render with press values in built output,
  **verified automatically** by `assert-consumer-theme.mjs` (contract C-6): each named
  token's emitted `:root` value equals the press value AND differs from the toolkit
  default (`press === default` fails — it wouldn't prove the consumer overrode).
- **Post-squad nuance (architect lens)**: use the **object** `tokens` form, not a
  string css-path — a string is pushed to `tokenSheets` and `@import`ed at the *top* of
  the generated sheet, where the later generated `:root` (brand+default) overrides it,
  inverting consumer precedence. Mode-invariant `--dk-*` win by source order at plain
  `:root` (0,1,0); but a **mode-varying** token set only in a bare `:root` of `press.css`
  is out-ranked *in dark mode* by `emitTokenSheet`'s `:root[data-theme='dark']` block
  (specificity 0,2,0) regardless of load order — so `press.css` MUST carry both `:root`
  and `:root[data-theme='dark']` for any mode-varying colour. Specificity, not source
  order, is decisive there.

## D5 — Avoid PlantUML/Chromium: diagram-free slice + `diagrams:false`

- **Decision**: The book slice carries **no** Mermaid/PlantUML fences; the fixture sets
  `diagrams:false` (default). The workflow copies only the Node/pnpm setup from `ci.yml`
  and omits the `services: plantuml` block, the `@beoe` cache, and `playwright install`.
- **Rationale**: C-003 (light CI) and NFR-002 (≤8 min). PlantUML build-render is the one
  thing that needs a service (the local test miss we already saw); excluding it keeps the
  consumption test a plain `install → astro build`.

## D6 — Book slice extent (representative, not whole)

- **Decision**: Introduction, Preamble, about-and-license (attribution), `rhetoric/index`
  + `book-one/index` (Hub kind), `book-one/chapter-01..03` (Markua + `glossary_context:
  rhetoric`), two personas (`context/audience/rhetoric-{student,practitioner}`), the
  `rhetoric` context of `.contextive/definitions.yaml`, and `_meta/{sections,bibliography}.yaml`.
- **Rationale**: Exercises per-kind layouts (Hub, Default/Explanation, Persona, Glossary),
  Markua (footnotes/callouts), native glossary (presence + autolink), and citations —
  the pillars in the spec — while holding the CI budget. Book II/III stubs excluded.
- **C-005**: `about-and-license.md` carries the CC-BY-SA-4.0 attribution (Freese 1926 /
  Perseus); it is copied verbatim so the fixture respects the source license.

## D7 — Fixture workspace isolation (post-squad BLOCKER, 2 lenses converged)

- **Decision**: The fixture is its **own** pnpm workspace root — it ships an empty
  `tests/consumption/consumer-fixture/pnpm-workspace.yaml` (`packages: []`) AND installs
  with `--ignore-workspace`. Resolution is asserted by `realpath` (inside the fixture,
  not a symlink, not under repo `src/`, version `0.1.0`), and the build runs with repo
  `src/` made unresolvable.
- **Rationale**: The reviewer and architect lenses independently found that because the
  fixture is nested under the repo `pnpm-workspace.yaml`, a plain `pnpm install` inside
  it walks up, joins the repo workspace, makes the committed fixture lockfile inert, and
  can symlink `@commondocs-kitty/toolkit → ../../../src`. Since the `files` allowlist
  ships raw source (no compiled dist), tarball and `src/` are near-identical, so neither
  a content check nor a "resolves under node_modules" check distinguishes them. The
  original D2 placement argument only covered the *root* install, not an install
  launched from inside the fixture — the real masking vector. Without D7 the entire
  proof (NFR-001/SC-001) is a false green.
- **Also closes**: the `sharp`/`@img` publicHoistPattern residual up-resolution leak
  (architect MINOR) — an isolated fixture root won't see the repo's hoisted `sharp`.

## D8 — Link gate runs in base-relative mode; complemented by assert-no-broken-links

- **Decision**: Accept that `check-links.mjs` runs the fixture in its looser
  (base-relative) mode — its stricter URL check is hardcoded to `SITE_ROOTS =
  ['example/docs']` — and rely on the fully-portable `assert-no-broken-links.mjs`
  (dist-based, arg-driven) for strict built-link integrity on the fixture. FR-005/SC-002
  are scoped accordingly; the adopter guide notes the non-parity.
- **Disposition**: `deferred_with_rationale`. Parameterizing `SITE_ROOTS` is a clean
  in-domain portability fix (DIRECTIVE_025) but edits a shipped script and widens scope;
  the dist-level strict check already covers the built-link regression class, so the
  looser source check is sufficient here. Filed as a possible follow-up, not in this
  mission.

## Supply-chain install safety (DIRECTIVE_051 / advisory)

- **No new third-party package** is introduced to the org: the fixture re-declares
  already-locked **peers** — `astro`, `@astrojs/starlight`, `@astrojs/sitemap` — at the
  same pinned versions already in the repo lockfile. The toolkit itself installs from a
  local `file:` tarball (no registry fetch).
- **Registry authenticity / freshness**: peers resolve from the existing pinned lockfile;
  no floating or `latest` ranges (NFR-004).
- **Lifecycle scripts**: the toolkit tarball ships **no** `pre/post-install` scripts.
  Build lifecycle scripts (`esbuild`, `sharp`) are already allow-listed in
  `pnpm-workspace.yaml`; the fixture install triggers no new lifecycle script.
- **Node**: 22 (Active LTS).
- **Posture**: advisory bar met — no unexamined dependency default. No security-impacting
  new-dependency decision was made, so no dedicated adversarial dependency challenge is
  required; the general brownfield squad below covers plan-level challenge.

## Adversarial evidence (brownfield point-cut)

A `brownfield` adversarial squad runs **post-plan** (and again pre-PR) per operator
direction. Contested findings and their disposition (`accepted` / `changed` /
`deferred_with_rationale`) are recorded here after each pass — no contested finding is
silently dropped (per `contracts/adversarial-evidence-contract.md`).

### Post-plan squad — dispositions

Squad: `architect-alphonso`, `debugger-debbie`, `reviewer-renata` (profile-loaded,
read-only). Two lenses converged independently on the workspace-isolation BLOCKER.

| # | Finding (lens) | Sev | Disposition |
|---|----------------|-----|-------------|
| 1 | Fixture nested under repo workspace → `pnpm install` joins workspace, lockfile inert, toolkit can symlink to `src/`; "resolves under node_modules" + `../src` grep are fakeable (reviewer + architect) | BLOCKER | **accepted** — D7: own `pnpm-workspace.yaml` + `--ignore-workspace` + realpath assertion + source-hidden build; spec NFR-001, contract C-0, IC-01 owns it |
| 2 | Contract asserted `api/index.json.entries[]` but shipped route emits `pages[]` — false-green/false-fail (debugger) | MAJOR | **accepted** — contract C-3 fixed to `pages[]` + `version==='2'` + `count===pages.length` + per-page required keys |
| 3 | favicon warn-not-throw → `favicon.svg` omission does not fail build; falsifies SC-004 "any file" (debugger) | MAJOR | **accepted** — SC-004/C-2 scoped to statically-imported modules; favicon-output check added to C-3; self-test must not target favicon |
| 4 | SC-003 "consumer theme won" had no automated verifier — manual only, and `press==default` would pass (reviewer) | MAJOR | **accepted** — `assert-consumer-theme.mjs` (C-6): token = press value ≠ default; IC-02 |
| 5 | Fail-closed self-test lacked positive control; could be green while always-failing; must remove a really-imported/allowlisted file (reviewer) | MAJOR | **accepted** — C-4 two-arm; IC-06 depends-on IC-01+IC-04 |
| 6 | No IC owned the workspace-isolation mechanism (architect) | MAJOR | **accepted** — assigned to IC-01, verified by IC-04 |
| 7 | `check-links` runs fixture in looser mode (hardcoded `SITE_ROOTS`); FR-005 over-claims parity (reviewer + architect) | MAJOR | **deferred_with_rationale** — D8: `assert-no-broken-links` covers strict dist links; documented; `SITE_ROOTS` param a follow-up |
| 8 | C-004/SC-002 said "existing assertions" but plan uses a new checker — spec-text drift (reviewer) | MINOR | **accepted** — spec C-004/SC-002/FR-005 wording amended |
| 9 | `sharp`/`@img` root-hoist residual up-resolution leak (architect) | MINOR | **accepted** — closed by D7 isolation; documented |
| 10 | Dark-mode specificity (0,2,0 vs 0,1,0) + string-`tokens` rejection rationale under-documented (architect) | MINOR | **accepted** — D4 + IC-02 risk expanded |
| 11 | SC-005 has no machine check that the guide avoids repo-internal paths (reviewer) | MINOR | **accepted** — IC-08 adds a `../src` lint on the guide |
| 12 | SC-004 universal wording stronger than a single-file test proves (reviewer); realpath check + XML-scanner bar + adopter check-links parity note (all lenses, NITs) | MINOR/NIT | **accepted** — folded into SC-004 scope, C-0/C-3, IC-08 |

No contested finding dropped. Conceded-clean by the squad: NFR-003 zero-bloat (fixture
outside `files`), the diagram-free slice (0 fences in the chosen files → NFR-002/C-003
safe), the D1 gate-reuse engineering judgment, and the supply-chain posture.
