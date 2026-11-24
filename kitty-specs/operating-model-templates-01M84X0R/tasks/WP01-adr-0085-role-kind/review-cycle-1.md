---
affected_files: []
cycle_number: 1
mission_slug: operating-model-templates-01M84X0R
reproduction_command:
reviewed_at: '2026-11-23T23:25:54Z'
reviewer_agent: claude::reviewer-renata
wp_id: WP01
---

# WP01 review: changes requested (claude::reviewer-renata)

Reviewed `feat/402-operating-model-templates` @ bb214e68 (commit bb214e6, the real diff; the WP review range on the coordination branch holds only status commits).

## Blocking

**B1. ADR-0085 is self-accepted.** `docs/adr/0085-role-kind.md` § Status reads "Accepted on 2026-11-23, by operator ruling ... (Decision Moments 01M84X1Q21P9HN21KNN9PFSNN6 and 01M84X1TXTTJM09B0G0YN2G9BM)". Only the operator accepts an ADR. Those Decision Moments record the operator's ruling on the *decision content* (Role is a kind; role + responsibilities required, goals optional). Neither records the operator accepting ADR-0085 as a document. No acceptance record is cited in the ADR or elsewhere.
Fix: set the status to `**Proposed**, 2026-11-23.` (precedent: ADR-0083), and keep the sentence citing the two Decision Moments as the basis of the decision. The operator moves it to Accepted.
Note: the WP01 prompt (T001 step 1 and the DoD "is Accepted") told the implementer to write Accepted. The defect is in the plan, not the implementer's reading of it; the prompt and DoD should be corrected too.

## Non-blocking (fix in the same pass)

**N1. ADR overstates who reads `KINDS`.** Decision 1 says the list "lives in one place, `src/lib/vocabulary-core.mjs`, which the build schema, the frontmatter gate and the stub tools all read". Against the WP02 code (e0c53a6):
- the gate reads it (`validate-frontmatter.mjs:647`, unknown-kind warning);
- the build schema only re-exports it and derives the `Kind` type (`schema.ts:70-72`); the `kind` field itself is an open `z.string()` (`schema.ts:212`), so the schema accepts any kind, Role or not;
- the stub tools (`new-doc.mjs`, `scaffold.mjs`) do not import `KINDS` at all.
Suggest: "The list lives in one place, `src/lib/vocabulary-core.mjs`. The frontmatter gate reads it to warn on an unknown kind; the build schema keeps `kind` an open string." Adjust Positive consequence 2 to match ("the gate and the tools agree without a second list").

## Checked and fine

- Role vs Persona: clear in the ADR Context, Alternatives A, and the new metadata-model paragraph.
- Kind lists: convention.md and metadata-model.md each list the 16 entries of `KINDS` at e0c53a6, in order. Schematic was indeed missing from convention.md (present in KINDS since ADR-0067) and is now added correctly.
- ADR number: 0085 is free on main (main has 0080, 0082, 0083, 0084); the ADR index `docs/adr/README.md` is untouched, as the rules require (bot-regenerated).
- No policy wording or legal claims.
- `pnpm validate:docs` ✓ (212 files, 4 pre-existing warnings), `validate:links` ✓ (1885 refs), `validate:adr-ids` ✓ (82 unique), markdownlint 0 issues on the 3 files.
