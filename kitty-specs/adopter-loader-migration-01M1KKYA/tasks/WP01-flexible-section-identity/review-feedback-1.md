# WP01 Review — Changes Requested (round 1)

Reviewer: reviewer-renata. Verdict: **Reject** (one blocking issue). The substance
of this WP is strong — parity twins, FR-003 surface coverage, subtypes derivation
order, and the NFR-003 no-op are all genuinely correct and verified (see
"Verified good" below). The reject is for a single, cheap-to-fix dead-code defect
that the review contract's anti-pattern checklist treats as blocking. Fix it and
re-submit; nothing else needs to change.

---

## BLOCKER 1 — Dead exported function `loadSectionIds` (anti-pattern checklist item 1)

`src/scripts/validate-frontmatter.mjs:321` exports `loadSectionIds(docsRoot)`.
It has **zero callers anywhere** — not in production, not in tests:

```
$ grep -rn "loadSectionIds" src example --include='*.mjs' --include='*.ts' --include='*.astro'
src/scripts/validate-frontmatter.mjs:321:export function loadSectionIds(docsRoot) {   # definition only
```

Contrast its sibling `loadSectionSubtypes`, which `run()` calls at line 692.
`loadSectionIds` was evidently written to feed `knownSectionIds` into `run()`, but
that wiring was (correctly — see "Judgment calls upheld" below) omitted, leaving
the loader orphaned. The mjs `validate()` `knownSectionIds` *option* is fine — it
is exercised by `section-rename.test.ts` (which builds the set inline via
`new Set(reg.map(...))`, not via `loadSectionIds`). Only the disk-loader helper is
dead.

The review contract's anti-pattern checklist, item 1: "every new public function …
has at least one live caller from production code, excluding tests … Zero production
hits means dead code" — and "A FAIL on any item blocks approval." This is a
clean FAIL.

**Fix (pick one):**
- **Preferred:** delete `loadSectionIds` (the ~12-line body + its doc comment).
  Its intended consumer was deliberately not built, so it is YAGNI. This also
  tidies the loose end noted in Observation A below.
- If you believe a near-term scoped-rename gate will wire it, that caller belongs
  in *this* WP (DIRECTIVE_046 complete-scope) — otherwise it is speculative and
  should be removed now and re-added with its caller later.

This lives in the parity-critical twin that WP02/03/04 will sit alongside, so it is
worth keeping that file free of orphaned exports before the dependents build on it.

---

## Verified good (no action needed — recorded so the fixes above stay surgical)

- **Parity (NFR-001) — the crown jewel is real.** Ran the full suite locally
  (`vitest run`): 684/684 green, incl. 113 in the four WP01 files. The extended
  parity tests exercise the *new* cases, not just the old ones: basename detection
  under both the default and an opted-in `['README','index']` set, root-index
  verdict, both-index collision (`detectIndexCollisions` ≡ `resolveIndexEntries.collisions`),
  and the registry-`subtypes` derivation with the built-in table intact as fallback.
  The mjs twin faithfully mirrors the TS logic.
- **FR-003 every surface honoured.** Loader id/slug, `routes/shared.ts` `docsRoot`,
  `routes/llms-txt.ts`, the `.mjs` gate + root-index exemption (`isRootIndex`),
  `check-links.mjs`, `scaffold.mjs`, `new-doc.mjs` all thread/honour the basename.
  The two "no code change needed" claims both check out:
  - `deck/deck-slug.ts` is genuinely basename-agnostic — it operates on the
    content loader's already-resolved `entry.id`; the per-surface test proves it.
  - `assert-build-artifacts.mjs` has **no** generic index-detection path — its only
    README logic is a concrete assertion that `example/docs/adr/README.md` is served
    at `/adr/` (a section that stays README under C-001). Nothing there rejects an
    `index.md` page. (Coordination note for WP04 — see Observation B.)
- **FR-005 / E-06 order.** `expectedDocType`/`expectedType` consult registry
  `subtypes` → built-in table → section default, in that order; the built-in table
  still fires for `plans/features → Feature` when no registry rule is present
  (doc-kitty's own tree = no-op). Verified in both twins.
- **NFR-003 no-op — proven byte-identical.** Diffed the base-branch validator
  against HEAD over the real corpus and the example: `docs` → IDENTICAL output
  (109 files, same 4 warnings), `example/docs` → IDENTICAL output (31 files, same 6
  warnings). No new "unregistered id" or collision warnings on today's corpus. The
  TS `expectedTypeForPath` default-warn is public-API-only (`index.ts`); it is not
  on doc-kitty's own build/gate path, so it cannot regress the corpus.
- **`indexBasename: string | string[]`** correctly normalized; the M2 array form
  collapses both conventions in one run (tested).
- **Collision (FR-004/E-05)** is deterministic (config-rank then path sort) and
  identical across both twins.
- **Scope/frozen.** Changes stay within `owned_files` + mission artifacts; no frozen
  surface touched; no unrelated edits.

## Judgment calls upheld (do NOT "fix" these — they are correct as-is)

- **US2-AS5 not wired into the default CLI gate.** Sound. Wiring `knownSectionIds`
  into `run()` would manufacture false-positive warnings on doc-kitty's own
  long-standing unregistered folders (`ops`, `glossary-demo`, …) that ADR-0004
  tolerates — an NFR-003 regression in spirit. The capability is implemented and
  tested on both twins and surfaced via the TS public API default-warn. Accept.
- **`assert-build-artifacts.mjs` unchanged in WP01.** Correct; the `index.md`
  artifact assertion belongs to WP04 when the example gains an `index.md` section.

## Observations (non-blocking; your call)

- **A. Twin warning asymmetry.** The TS `expectedTypeForPath` warns-by-default on
  an unregistered id when a registry is present, while the mjs `run()` gate stays
  silent (knownSectionIds unwired). This is not an NFR-001 violation (parity pins
  the derived *type*, not the advisory warning) and follows from the sound US2-AS5
  disposition. Deleting `loadSectionIds` per BLOCKER 1 cleanly closes this loose end.
- **B. WP04 coordination.** `assert-build-artifacts.mjs` is in WP01's `owned_files`
  but the `index.md`-served artifact assertion will need to be added by WP04 (which
  owns `example/docs/**`). Flag this in the WP04 handoff so the surface is not
  assumed already done on either side (the partial-adoption trap the mission warns
  about).

---

### Re-submit checklist
- [ ] Remove the dead `loadSectionIds` export (BLOCKER 1).
- [ ] `vitest run` still green (should be unaffected — no test references it).
