---
affected_files: []
cycle_number: 5
mission_slug: diagram-dark-contrast-label-clipping-01M801Y5
reproduction_command:
reviewed_at: '2026-11-25T08:17:28Z'
reviewer_agent: claude::reviewer-renata
wp_id: WP03
---

# WP03 review, cycle 5: changes requested

Reviewer: claude::reviewer-renata (Tier R, independent).

Reviewed:
- Docs: mission-branch mirror 8587911. It is byte-identical in these three files to the implementer's unpushed local main 08b038c.
- Code: lane-b da18b73 (WP02, approved). Mermaid 11.17.1.

Evidence comes from a probe, not from prose. I rendered each case through the real build path in Chromium: `@beoe/rehype-mermaid` with `BUILD_MERMAID_OPTS`, then `pinDiagramLabelFont`. In the page, the body font was Georgia.

## What N3 and N1 got right (verified)

| Doc claim | Probe result |
| --- | --- |
| `%%{init}%%` `fontFamily` (top level) is neither shown nor measured | Dropped. No serif in the SVG. Labels are measured and shown in the Arial stack, with 0 px overflow. |
| `themeVariables.fontFamily` is dropped | Dropped (`sanitize` recurses into objects, keyed on the literal `fontFamily`) |
| Front-matter `config.fontFamily` is dropped | Dropped (front-matter config goes through the same `addDirective` → `sanitize`) |
| Every other directive value is kept | `fontSize: '20px'` in the same directive survives, and labels render at 20 px |
| The init-font exception is gone | Gone in all three files |
| `themeCSS` fonts are kept as author CSS, beside `classDef`/`style` | Kept. A serif `themeCSS` rule stays in the SVG `<style>`. The label is measured in serif and shown in Arial, so it clips. |
| `classDef`/`style` font is kept | Kept (serif `!important` wins over the pin) |
| Links: #412 and #458; securing `themeCSS` stays out of scope | Present. Nothing proposes securing `themeCSS`. |

## Blocking findings

**Issue 1: "a serif `themeCSS` font clips a long label by about 9 px" understates the effect.**
- 9 px is one sample: a 148.0 px box against 157.1 px of content, from the cycle-4/5 probe.
- How much a label clips depends on its length, so 9 px is neither typical nor a ceiling. With `themeCSS: '.nodeLabel, .nodeLabel * { font-family: serif; }'`, the build path gives:

  | Label | Box (serif measurement) | Shown (Arial stack) | Clipped |
  | --- | --- | --- | --- |
  | `Done` | 34.7 px | 38.3 px | 3.6 px |
  | `Producer registry lookup` | 159.1 px | 173.4 px | 14.3 px |
  | `Operator machine gate` | 145.7 px | 163.7 px | 18.0 px |
  | `Resolve the pack catalogue` | 174.6 px | 196.6 px | 22.0 px |

- So it is roughly a tenth of the label's width, up to about 20 px just before Mermaid wraps at 200 px. A reader who sees "about 9 px" would expect a small, fixed loss.
- Fix in `docs/architecture/diagrams.md` (*Author font*): describe the effect in proportion, without the single number. For example: "a serif `themeCSS` font can clip a label by about a tenth of its width (up to about 20 px)". Or say only that it "can clip the end of a label".
- The changelog fragments don't quote the number, so they need no change for this issue.

**Issue 2: the sequence-font wording suggests the keys still change the font. In the build they do not.**
- It is true that Mermaid's `sanitize` does not remove `actorFontFamily`, `noteFontFamily` or `messageFontFamily`. But Mermaid 11.17.1's sequence renderer overwrites all three with the top-level `fontFamily` at render time (`sequenceDiagram-*.mjs`, `setConf`):

  ```js
  if (cnf.fontFamily) {
    conf.actorFontFamily = conf.noteFontFamily = conf.messageFontFamily = cnf.fontFamily;
  }
  ```

- The toolkit always sets the top-level `fontFamily` to the Arial stack, and an author cannot change it because it is now `secure`.
- Probe: `%%{init: {'sequence': {'actorFontFamily':'serif','messageFontFamily':'serif','noteFontFamily':'serif'}}}%%`. Every actor, message and note `<text>` was drawn in the Arial stack, and no serif reached the SVG.
- So in the build these keys have no visible effect. Three pieces of text imply otherwise:
  - `diagrams.md`: "are not dropped yet; see #458".
  - The 370 fragment: "The sequence diagram font keys are not dropped yet (#458)". In a changelog, adopters will read this as "my sequence fonts still apply".
  - The 369 fragment: "Sequence diagram font keys are #458." This is also not a sentence.
- Fix:
  - In `diagrams.md`, say what happens: sequence labels are SVG text in the toolkit stack, because Mermaid replaces the sequence font keys with the diagram font. Keep a pointer to #458 as hardening, not as a live gap.
  - In the 370 fragment, drop the sentence or rephrase it the same way.
  - In the 369 fragment, drop the sentence or make it a full sentence with the same meaning.
- I'll ask the dispatcher to correct #458's premise ("They do bypass the toolkit's single label font"). Editing #458 is not a WP03 task.

## Non-blocking

- N5: the 8587911 trailer names a model (`Co-Authored-By: Claude Opus 5.5`). This is the same class as the 5819de9 trailer, which is already deferred to R24. Use `Co-Authored-By: Claude <noreply@anthropic.com>` on the next commit.
- N6: `docs/changelog/unreleased/370-diagram-label-font.md` is edited only by WP03, but WP03's `owned_files` doesn't list it. Note this for the merge record.
- Deferred to R24, not re-raised: N2 (the `MERMAID_DEFAULT_SECURE` "replaces the list" comment), N4 (`expect.soft` edge count) and the 5819de9 trailer.

## Checks (mission-branch docs)

| Check | Result |
| --- | --- |
| `markdownlint-cli2` on the 3 files | 0 issues |
| `validate:changelog` | OK (3 fragments) |
| `validate:docs` | 210 files valid, 4 pre-existing description-length warnings |
| `validate:links` | 1846 references resolve |
| Prettier (`prettier@3.6.2 --check diagrams.md`) | Fails at WP base f647a36 and at 8587911. The repo has no Prettier dependency or config. Most remaining diffs (the `` ```mermaid `` code span and table padding) predate WP03. The `*Font.*` → `_Font._` emphasis diffs come from WP03's own lines, but markdownlint passes them. Not counted. |

## Anti-pattern checklist

| # | Item | Result |
| --- | --- | --- |
| 1 | Dead code | N/A (docs-only WP) |
| 2 | Synthetic fixture | N/A |
| 3 | Silent empty return | N/A |
| 4 | FR coverage | PASS (FR-007 docs present, C-001 respected) |
| 5 | Frozen surface | PASS |
| 6 | Locked decision | PASS |
| 7 | Shared-file ownership | PASS (see N6) |
| 8 | Production fragility | N/A |
