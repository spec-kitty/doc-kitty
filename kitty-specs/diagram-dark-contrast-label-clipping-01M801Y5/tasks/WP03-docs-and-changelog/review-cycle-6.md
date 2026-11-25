---
affected_files: []
cycle_number: 6
mission_slug: diagram-dark-contrast-label-clipping-01M801Y5
reproduction_command:
reviewed_at: '2026-11-25T08:24:26Z'
reviewer_agent: claude::reviewer-renata
wp_id: WP03
---

# WP03 review, cycle 6: changes requested

Reviewer: claude::reviewer-renata (Tier R, independent).

Reviewed:
- Docs: mission-branch mirror 93cacc2 (coordination branch 231b4a0, docs identical).
- Code: lane-b da18b73. Mermaid 11.17.1 (source read from the published 11.17.1 package).

Probe: `mermaid.min.js` 11.17.1 in Chromium with the toolkit's `BUILD_MERMAID_CONFIG` values (`theme: base`, `securityLevel: strict`, `secure` plus `fontFamily`, `fontFamily` set to the Arial stack). The page body font was Georgia. I read the computed `font-family` of every `<text>`.

## Cycle-5 fixes (verified)

| Fix | Result |
| --- | --- |
| Issue 1: "about 9 px" removed; the clip now grows with the label, to about a tenth of its width, until Mermaid wraps | PASS. Matches the cycle-5 data: 3.6/38.3, 14.3/173.4, 18.0/163.7 and 22.0/196.6 px are 8–11 %. |
| Issue 2: sequence keys "have no effect", because Mermaid 11.17.1 replaces them with the top-level `fontFamily`; #458 described as defence in depth | PASS. `sequenceDiagram-*.mjs` calls `setConf(getConfig2())` with the full config, then sets `conf.actorFontFamily = conf.noteFontFamily = conf.messageFontFamily = cnf.fontFamily`. Probe: with all three keys set to `serif`, every actor, message and note is drawn in the Arial stack. |
| 370 fragment: the "not dropped yet" sentence is removed | PASS |
| 369 fragment: the non-sentence is removed | PASS |
| N6: `owned_files` and `create_intent` list `370-diagram-label-font.md` | PASS |

## Blocking finding

**Issue 1: the new sentence "Labels drawn as SVG text, such as sequence diagram labels, keep Mermaid's own sizing; Mermaid draws them in the same stack" is false for C4 diagrams.**

- The sentence covers every SVG-text label, with sequence labels given only as an example. C4 labels are SVG text too (no `foreignObject`), and they are not drawn in the toolkit stack.
- Cause: C4's renderer is set up from the `c4` sub-config alone (`init: ({ c4 }) => setConf(c4)` and `setConf(diagObj.db.getConfig())`, which returns `getConfig().c4`). Its `if (cnf?.fontFamily)` override reads `c4.fontFamily`, which the toolkit never sets, so the top-level `fontFamily` never reaches it. Every `c4.*FontFamily` default is `"Open Sans", sans-serif`. `elementFontStyles` also writes `c4[<type>FontFamily]` into CSS.
- Probe results:
  - A plain `C4Context` (Person, System, Rel): every label is drawn in `"Open Sans", sans-serif`, and none is in the Arial stack.
  - The same diagram with `%%{init: {'c4': {'personFontFamily':'serif','systemFontFamily':'serif'}}}%%`: the person and system labels are drawn in `serif`. The author key is not dropped (the `secure` list matches only the literal `fontFamily`) and it takes effect.
- Fix, in `docs/architecture/diagrams.md` (*Font*, and if needed *Author font*):
  - Scope the "same stack" claim to sequence diagram labels. Do not state it for SVG-text labels in general.
  - State, or at least do not contradict, that C4 labels use Mermaid's C4 font (`"Open Sans", sans-serif`) and that an author's `c4` font keys still apply.
  - Point the C4 keys to an issue: #458 if it is widened, or #412 (author fonts).
  - Keep the changelog fragments free of any C4 claim. They currently make none, so they need no change.

## For the dispatcher (not a WP03 task)

- The #458 correcting comment (issuecomment-7156878618) says: "C4 diagrams do the same for their `personFontFamily`, `systemFontFamily` and `messageFontFamily`." This is false on 11.17.1, for the reason above.
- C4 font keys are a live author-font path, so for C4, #458 is not "defence in depth".
- The comment needs a follow-up correction, and #458's scope may need to include the `c4` keys.

## Non-blocking

- N7: the 93cacc2 trailer still names a model (`Co-Authored-By: Claude Opus 5.5`). This is the same class as N5, 5819de9 and 8587911, so it goes to R24. Use `Co-Authored-By: Claude <noreply@anthropic.com>` from now on.
- Deferred to R24, not re-raised: N2, N4, and the 5819de9 and 8587911 trailers.

## Checks (93cacc2 docs)

| Check | Result |
| --- | --- |
| `markdownlint-cli2`, 3 files | 0 issues |
| `validate:changelog` | OK, 3 fragments |
| `validate:docs` | 210 files valid, 4 pre-existing description-length warnings |
| Prettier | Not counted. It already fails at the WP base. |

## Anti-pattern checklist

| # | Item | Result |
| --- | --- | --- |
| 1 | Dead code | N/A (docs-only) |
| 2 | Synthetic fixture | N/A |
| 3 | Silent empty return | N/A |
| 4 | FR coverage | FAIL (FR-007: the docs make a wrong claim about the label font for C4; see Issue 1) |
| 5 | Frozen surface | PASS |
| 6 | Locked decision | PASS |
| 7 | Shared-file ownership | PASS (N6 resolved: WP03 now owns the 370 fragment) |
| 8 | Production fragility | N/A |
