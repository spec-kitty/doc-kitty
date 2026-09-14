# Research — Documentation Charter (M7 consolidation)

Phase 0 consolidated design decisions. This mission was pre-researched by a
three-lens squad (architecture / open-work / scope) whose verdict reshaped M7
to this consolidation slice; findings are folded in below rather than re-run.

## D-01 — Consolidated charter file name & format
- **Decision**: `<docsRoot>/_meta/charter.yaml` — a single authoritative YAML,
  paired with `docs/context/convention.md` as the human-readable narrative
  companion (the `charter.yaml` ↔ `charter.md` shape borrowed *conceptually*
  from Spec Kitty, not its runtime).
- **Rationale**: Mirrors the shipped `_meta/*.yaml` convention and the existing
  loader ergonomics; YAML parsing is already in-tree (no new dependency);
  `_meta/` is already the reserved meta directory excluded from the docs
  collection (ADR-0004 item 6).
- **Alternatives**: umbrella-over-existing-files (rejected by the user in favor
  of one absorbing file); a new bespoke format/extension (rejected — churn, and
  breaks the "plain `_meta/*.yaml` resolved by a small pure function" invariant).

## D-02 — Precedence & back-compat model
- **Decision**: **Per-axis ownership.** When `charter.yaml` declares an axis
  (vocabulary/types, vocabulary/kinds, statuses, sections, required-fields), it
  **fully owns** that axis; legacy `_meta/vocabulary.yaml` / `_meta/sections.yaml`
  are consulted only for axes the charter is silent on. Legacy-only consumers
  (no `charter.yaml`) behave exactly as today. When any legacy file is present a
  one-line **deprecation notice** points to the migration guide.
- **Rationale**: Avoids silent partial merges (a spec edge case) while
  guaranteeing the N=2 consumer (legacy-only) does not regress (NFR-002). Simple,
  deterministic, explainable (FR-002/FR-009).
- **Alternatives**: deep-merge legacy+charter per key (rejected — non-deterministic
  surprises, hard to explain); hard cutover ignoring legacy (rejected — regresses
  existing consumers).

## D-03 — doc_status override: extend-only, canonical reserved
- **Decision**: Add a `statuses` axis to `parseVocabulary`/`parseCharter` using
  the same `parseVocabularyAxis`/`makeAxisResolver` machinery as `types`/`kinds`,
  but constrained to **extend-only**: a consumer may add statuses; the canonical
  `STATUSES` tuple stays reserved and non-removable/non-forbiddable. The
  frontmatter status check validates against `canonical ∪ added`.
- **Rationale**: Consistent with the existing vocabulary axis (DRY); protects
  Hub draft-exclusion, feeds, and the `durable` throughline that depend on the
  canonical values (C-004). Resolved decision DM3 in specify.
- **Alternatives**: full-replace enum (rejected — a consumer could drop
  `draft`/`published` and silently break Hub/feeds).

## D-04 — Required-field policy with a floor
- **Decision**: The always-required frontmatter set becomes charter-configurable
  as a **relaxation list** (which non-floor fields may be optional), with `title`
  a hard floor that stays required regardless of charter (C-005). Enforcement
  lives in the one place that already owns contextual requiredness
  (`validate-frontmatter.mjs`) plus the Astro schema twin.
- **Rationale**: Meets the real adopter need (a corpus lacking `description`/
  `updated`) without letting pages become unrenderable. Every knob maps to a
  demonstrated need (C-002).
- **Alternatives**: fully free-form required set incl. `title` (rejected — breaks
  rendering); no configurability (rejected — leaves the hardcoded knob M7 named).

## D-05 — SECTION_ORDER reconciliation
- **Decision**: Keep the frozen `SECTION_ORDER` in `metadata.ts` as the **bare /
  no-registry fallback only**; when a charter or legacy registry is present, its
  order wins. One resolution path; the frozen list is the last-resort default so
  a registry-less consumer still gets the canonical order (FR-007).
- **Rationale**: Removes the "two sources of truth" ambiguity without regressing
  a consumer that authors nothing.
- **Alternatives**: delete the frozen fallback (rejected — a bare consumer loses
  canonical ordering); leave as-is (rejected — the ambiguity M7 named persists).

## D-06 — Native, not Spec Kitty engine (the fork)
- **Decision**: doc-kitty's documentation charter is **self-contained**: resolved
  by doc-kitty's own pure-core/fs-loader/gate triad with **zero** import of or
  dependency on Spec Kitty / DoctrineService. Recorded as a new/superseding ADR
  (FR-012, C-003).
- **Rationale**: The toolkit is a public consumer template; adopters do not run
  Spec Kitty. All three research lenses independently recommended native;
  ADR-0004 already rejected heavyweight external coupling. Borrow the *shape*
  (authoritative file + narrative companion + derived catalog, warn-not-fail),
  not the runtime.
- **Alternatives**: consume Spec Kitty's charter/doctrine engine (rejected —
  makes the headline governance feature unusable for its audience; heavy
  out-of-ecosystem dependency; inverts the portability goal).

## D-07 — Supply-chain / adversarial evidence
- **Decision**: **No dependency added, upgraded, or removed.** Directive 051 /
  supply-chain-install-safety tactic is **N/A** for this mission. No adversarial
  supply-chain challenge pass is required; recorded here so silence is not
  mistaken for an unexamined default.
- **Rationale**: All work reuses in-tree YAML/zod/Astro; the only new files are
  data (`charter.yaml`) and source that imports nothing new.
- **Contested findings**: none (no security-impacting dependency decision).

## Scope fences (carried from spec C-001/C-002)
- OUT: Layer-B qualitative doctrine (curated-not-wiki, one-concern-per-file,
  writing-quality/Vale) and any consumer-tunable strictness/enforcement engine.
  Warn-not-fail posture is retained.
