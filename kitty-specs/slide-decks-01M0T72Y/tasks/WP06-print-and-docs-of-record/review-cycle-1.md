---
affected_files: []
cycle_number: 1
mission_slug: slide-decks-01M0T72Y
reproduction_command:
reviewed_at: '2026-08-24T18:33:42Z'
reviewer_agent: user
wp_id: WP06
---

# WP06 review — lexical-larry (terminology + doc accuracy lens)

## Verdict: changes requested (one terminology finding)

Almost everything is correct. ADR-0012 (T027) is a clean Status-pointer-only
amendment: the Decision/Consequences body is byte-unchanged, only the frontmatter
(`updated`, `related: adr/0021`) and a one-line Status note pointing to ADR-0021's
path+kind amendment were added. All resolved questions in `slide-decks.md` (T026)
carry the correct decisions and correctly-resolving links (ADR-0021/0022), and
doc-sanity passes on both owned files (markdownlint 0 issues; all internal links
resolve). One canonical-term conflation must be fixed before this lands in the
design of record.

## Issue 1 (blocking): `###` labeled "Vertical stacks" contradicts the canon and the doc's own body

`docs/architecture/slide-decks.md`, "Resolved questions" section, first bullet
(line 154):

> **Vertical stacks (`###`) ship in v1.** Down-navigation stacks are part of the
> first renderer...

This binds `###` directly to **vertical stack**. The mission's Domain Language
canon (`spec.md`) separates these two terms explicitly and warns they are not
interchangeable:

> - **vertical slide** — an **inner** `<section>` created by a `###`.
> - **vertical stack** — the **outer** `<section>` containing **only** inner
>   vertical slides, produced when a `##` has `###` children. `###` produces a
>   vertical *slide*; the *stack* is the container (**not the same term**).

So `###` produces a **vertical slide**; a **vertical stack** is the container that
forms when a `##` has `###` children — `###` is not the switch for the stack.

This also contradicts the document's own body and the ADR it points to, which are
both canon-correct:

- `slide-decks.md` line 57 (unedited): "A level-3 heading (`###`) starts a
  **vertical** slide stacked under the current horizontal one."
- `ADR-0012` Decision 2 (unchanged): "`##` starts a horizontal slide, `###` a
  vertical slide."

The result is a self-contradiction inside the same file: the splitting-convention
section says `###` = vertical slide, while the resolved-questions bullet says
`###` = vertical stack.

### Fix (one line)

Relabel the bullet so `###` binds to the canonical **vertical slide**, and keep
the stack as the container it forms. For example:

> **Vertical slides (`###`) — and the vertical stacks they form — ship in v1.**
> Down-navigation is part of the first renderer, not deferred; the heading-driven
> convention above is the shipped behaviour.

(Any phrasing works as long as `(###)` is attached to "vertical slide," not
"vertical stack.")

## Everything else verified PASS
- T027 / ADR-0012: Status-pointer-only; Decision & Consequences body byte-unchanged (immutable-ADR discipline held). PASS
- `--dk-*` → `--r-*` mapping resolved, scoped to `.reveal`, per-file `deck:` override deferred (ADR-0022). PASS
- reveal.js pinned `6.0.1` + smoke-check upgrade cadence (ADR-0022). PASS
- Pagefind = build-time assertion via `data-pagefind-body` / `data-pagefind-ignore`. PASS
- "What a deck is": "anywhere" corrected to path+kind, `Presentation` under `presentations/` routes out-of-frame, elsewhere is a hard build error (matches ADR-0021). PASS
- deck / Presentation / presentations/ / deck route / out-of-frame / enhance / authoring-vs-navigation-controls terminology: canon-consistent in the edited text. PASS
- doc-sanity on owned files: markdownlint 0 issues; validate:links all resolve; validate:docs does not flag either owned file (the ADR-0021 description failure is pre-existing and not WP06-owned). PASS

Anti-pattern checklist: 1 Dead code N/A · 2 Synthetic-fixture N/A · 3 Silent empty
return N/A · 4 FR coverage N/A (docs WP; FR-020 code half shipped in WP01/WP04) ·
5 Frozen surface PASS (ADR-0012 Decision body untouched) · 6 Locked decision PASS ·
7 Shared-file ownership PASS (two owned files only) · 8 Production fragility N/A.
