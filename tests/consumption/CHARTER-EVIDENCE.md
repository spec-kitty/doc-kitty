# Documentation Charter — clean-room & non-regression evidence (WP05 / T027)

Mission `documentation-charter-01M2FEXM`, WP05. This note records the portability
proof (SC-003: NFR-001 zero Spec Kitty runtime coupling + NFR-002 non-regression)
so a reviewer can check it without re-deriving it, plus the two wiring boundaries
that remain as documented fast-follows.

Reproduce locally (env: `pnpm install --offline --frozen-lockfile` at the repo root
first; the lockfile must stay clean):

```
( cd src && ./node_modules/.bin/vitest run --root ../tests/consumption \
    charter-governance charter-cleanroom )
```

In CI the same suite runs in the **Consumption test** workflow's
`Run packaging-gap self-test (WP05)` step (`( cd src && ./node_modules/.bin/vitest
run --root ../tests/consumption )`), alongside the pack-and-install clean-room
orchestrator (`run-consumption-test.mjs`).

## NFR-001 — zero Spec Kitty in the packed tarball (`charter-cleanroom.test.ts`, T025)

- The toolkit is **packed and extracted** (`npm pack` → `tar -xzf`, no install) and
  **every** shipped file is scanned. Result: **zero** Spec Kitty couplings.
- The guard is PRECISE, not a substring grep. The tarball legitimately ships a
  self-contained **`spec-kitty` brand theme** (`themes/spec-kitty/**`,
  `specKittyTheme`, the wordmark "Spec Kitty") and comments that literally read
  "no `` @spec-kitty/* ``". The guard matches only import/require **statement forms**
  whose specifier is a `spec-kitty` package, plus the `DoctrineService` identifier —
  so the brand theme and prose stay clean while a real coupling is caught.
- The packed `package.json` declares **no** `spec-kitty` / `doctrine` dependency
  (deps/devDeps/peerDeps/optionalDeps).
- The shipped gate resolves a charter with **no Spec Kitty on PATH** (PATH reduced to
  the Node binary dir; `SPEC_KITTY_*` / `KITTIFY_*` env stripped) — exit 0.

**Guard-bites proof (the guard is not vacuous).**
1. `charter-cleanroom.test.ts` → *"the guard BITES"* plants every forbidden form
   (`import … 'spec-kitty'`, `import 'spec-kitty/…'`, `require('@spec-kitty/…')`,
   dynamic `import('spec_kitty')`, `DoctrineService`) and asserts each is flagged,
   while the brand-theme import, the `@commondocs-kitty/toolkit/schema` import, the
   wordmark, the asset URL and the "no `` @spec-kitty/* ``" comment stay clean.
2. **Whole-tarball plant-and-revert (manual, WP05):** a real
   `import { DoctrineService } from 'spec-kitty';` was prepended to the shipped
   `src/index.ts`; the *"no shipped file imports Spec Kitty"* test went **RED**,
   naming `index.ts` with hits `["import spec-kitty", "DoctrineService"]`; the plant
   was then reverted (`git checkout -- src/index.ts`) and the suite returned green.

## NFR-002 — non-regression (`charter-cleanroom.test.ts` T026 + dogfood)

- A **legacy-only** adopter (a `_meta/sections.yaml`, no `charter.yaml`) resolves
  governance to the **canonical shipped defaults**, asserted against both the
  committed `charter-fixtures/legacy-clean/` fixture and the real
  `consumer-fixture/docs`: `legalStatuses === STATUSES`,
  `requiredFields.required === CANONICAL_REQUIRED`, every axis source `default`/
  `legacy`, `sourceMeta.fromCharter === false`. The legacy-clean root passes the
  shipped gate with no charter tooling.
- **Dogfood (T023):** doc-kitty's own tree gained `docs/_meta/charter.yaml`
  mirroring the shipped defaults (identity vocabulary, no added status, no relaxed
  field). `node src/scripts/validate-frontmatter.mjs docs` is **byte-identical** to
  the pre-charter baseline (130 files valid, 4 warnings, 0 failures — `diff`
  identical). `_meta/vocabulary.yaml` and `_meta/sections.yaml` were kept in place,
  so exactly one build-time deprecation notice is emitted (expected during the
  migration window). The gate runs with `emitDeprecation:false`, so `validate:docs`
  prints no notice and is unchanged.

## Governance axes proven end-to-end (`charter-governance.test.ts`, T024)

The `charter-fixtures/adopter/` root authors one `_meta/charter.yaml`; each axis is a
DIFFERENTIAL against the canonical (no-charter) baseline so it genuinely bites:

| Axis | Under the charter | Canonical baseline (differential) |
|---|---|---|
| forbidden `type: Feature` | gate **fails** — "forbidden by the vocabulary override" | only warns "path suggests" |
| added `doc_status: reviewed` | clean (no legal-set warning) | warns "not in the legal set" |
| relaxed `description` (missing) | passes | **fails** — "`description`: required" |
| `title` floor (missing) | **fails** — "`title`: required" | **fails** (floor can't be relaxed) |

`reviewed` is a genuine new status — canonical `STATUSES` already include
`deprecated`, so adding `reviewed` is not a silent no-op dedup. The gate exercised is
proven byte-identical to the packed tarball's `scripts/validate-frontmatter.mjs` (and
its two `lib/` deps) by `assertShippedGateParity()`.

## Charter-aware wiring — completed in this branch

Two seams that WP05's clean-room proof first flagged as follow-ups were wired later
in the same branch and are now shipped end-to-end:

1. **Sections axis → build routes (#98, `4bd826c`).** Every build-output route —
   `llms-txt.ts`, `agent-index.ts`, `rss.ts`, `Hub.astro`, and `config.ts` — plus
   `schema.ts` now resolves the section registry through the charter-aware
   `resolveSectionRegistry` (`charter → legacy sections.yaml → default`). A consumer
   that declares its sections only in `_meta/charter.yaml` gets them into the feeds,
   the agent index, the Hub grid, and the sidebar/sitemap — not just type-derivation.

2. **Standalone-gate forbidden-term resolver (#99, `68e72d5`).** The bare-Node gate
   (`validate-frontmatter.mjs`) now reads the **type/kind** forbidden-check from
   `resolveGovernance().resolveType`/`resolveKind` — the same resolver the Astro build
   consumes — alongside the already-wired statuses and required-fields axes. A `type`
   forbidden ONLY in `_meta/charter.yaml` now fails the gate; no legacy
   `_meta/vocabulary.yaml` mirror is required. (A charter-only regression guard for
   this path lives in the charter test suite.)

**Remaining boundary (future mission).** The gate's *section-default* `type`/`subtype`
derivation still reads the legacy `_meta/sections.yaml` (`loadSectionTypes`/
`loadSectionSubtypes`), not `resolveGovernance().sections`. This is advisory
(warn-not-fail), and doc-kitty's own charter omits the `sections` axis, so it does not
affect the shipped build; a charter-only *malformed* `sections.entries` still fails
closed at the Astro build (`normalizeSectionEntries`), just not at the gate. Wiring the
gate's section derivation onto the charter without duplicating the entry normalizer
(which would regress the single-source parity twin) is left to a future mission.
