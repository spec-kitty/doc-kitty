# Pre-merge review squad — M1 PR #5

**Point-cut**: pre-merge (architectural gate) · **Squad** (read-only, profile-loaded):
reviewer-renata (correctness/fidelity), architect-alphonso (upgrade/seams),
debugger-debbie (edge cases). Alphonso: safe to merge (0 HIGH). Renata + Debbie:
not-yet, 3 HIGH each. The CI is green — every finding is a **latent bug, a live
bug CI's pinned assertions missed, or a fakeable/vacuous gate**.

## Confirmed findings + disposition (deduped across lenses)

### Must-fix

1. **[HIGH — renata, LIVE] Hub renders draft children.** `Hub.astro` child query gates
   on parentage only, no `isPublished`. `example/docs/adr/README.md` (kind: Hub) links
   its draft child `adr/template` in the built `/adr/` Hub — violates INV-1 / US3.
   CI missed it (chrome assertion pins the `context` Hub, no draft child). → filter Hub
   children through `isPublished`; add an assertion that the ADR Hub does not link
   `adr/template`.
2. **[HIGH — renata+debbie] Parity test is tautological.** `schema-validator-parity.test.ts`
   imports both arms from `validate-frontmatter.mjs` (and `validate()` calls
   `frontmatterSchema` internally) — never imports `schema.ts`. NFR-005 unmet. → import
   the real `schema.ts` extend object as the independent second arm over the fixtures.
3. **[HIGH — renata] `schema.ts` `type` is a hard enum.** `z.enum(DOC_TYPES)` fails the
   build on a non-canonical `type`, but the contract says unknown `type` is **advisory**
   (warn, never fail) — lanes disagree (build red vs doc-sanity warn), violates
   FR-003/NFR-005. → `type: z.string().optional()` in `schema.ts`.
4. **[HIGH — debbie] Sitemap filter unanchored `endsWith`.** A top-level draft
   `overview.md` (route `/overview/`) would drop published `/architecture/overview/`
   (over-exclusion). → match the full pathname against `base + route` exactly (anchored).
5. **[HIGH — debbie] Pagefind assertion vacuous.** Its markers are the child pages' own
   descriptions, present in the children's own fragments regardless of the Hub — a
   `<nav>` regression would still pass. → assert Hub-only content / scope to the
   `/context/` fragment.
6. **[HIGH/MED — debbie+renata] `assert-chrome` status enum drifted.**
   `['active,draft,review,deprecated,archived']` invents `review`/`archived`, omits
   `superseded`. → import the canonical `STATUSES`.

### Should-fix

7. **[MED — renata] `schema.ts` missing `description.max(180)`** — contract requires the
   180 upper bound in both validators. → add `.max(DESCRIPTION_MAX)`.
8. **[MED — debbie] `resource .url()` ts↔mjs divergence** — `schema.ts` `.url()` vs mjs
   plain string; a non-URL `resource` passes validate but fails build. → align both
   (relax `schema.ts` to `z.string()` + a real parity test now catches future drift).
9. **[MED — debbie] AA `≥24px` / `:focus-visible` OR'd across all sheets** (incl.
   Starlight's) — vacuous NFR-001 coverage. → scope the grep to the dk chrome selectors.

### Low / follow-up

10. **[LOW — debbie+renata] `toAgentRecord` defaults `doc_status` to `'active'`** vs
    `isPublished`'s `'draft'`. → default to `'draft'`.
11. **[LOW — alphonso] `kind-layouts.ts` stale "ships EMPTY" header** now that WP04
    registered `Hub`. → rewrite the header to the shipped state.
12. **[LOW — debbie] `matchGlobKey` ambiguity silent drop** / **[LOW — alphonso]
    cascade-order assertion** / **unresolved `hero_image.src` diagnostic** → follow-up
    issues (deferred; not merge-blocking).

## Structural root cause (renata + debbie converge)

Derived constants — status labels, the ts↔mjs schema, marker strings — are
**hand-mirrored with no structural parity binding**, so edits drift them silently
(DIRECTIVE_043: close by construction). Fixes 2/3/6/7/8 collectively make the two
validators share/verify one contract and bind the gate's constants to the canonical
source.

## Confirmed sound (squad concessions)

`doc_status` rename complete (no stray `data.status`; 404 decoy + ADR `## Status`
intact); Starlight 0.30→0.32.6 upgrade sound in both workspaces, NFR-006 holds, no
0.32 breaking change unadapted; all three ADR-0013 seams intact, no M2/M3 code leaked;
`check-links` object-form integrity correct; the og:image three-distinct + token-catalog
completeness + bridge assertions genuinely bind to built output; the `role="navigation"`
Pagefind deviation is sound.
