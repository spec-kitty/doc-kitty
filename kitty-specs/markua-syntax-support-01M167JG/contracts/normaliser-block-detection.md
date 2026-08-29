# Contract: normaliser block-detection rules (pinned)

These are the block-detection rules FR-013 requires the ADR to pin. They are the
authoritative specification of how the normaliser recognises a Markua line-prefix
run or a `{aside}`/`{blurb}` wrapper, where such a block ends, and how it avoids
consuming adjacent CommonMark. [ADR-0030](../../../docs/adr/0030-markua-preprocess-to-directive.md)
ratifies the approach and references this file for the rules.

> **Back-link note (for the ADR landing WP).** The ADR was drafted in this
> `contracts/` directory and has since landed at
> `docs/adr/0030-markua-preprocess-to-directive.md` (Accepted); the link above was
> repointed to that path when the WP landed it.

The rules are stated at the **line** level (the normaliser's unit of work) but
**implemented at the mdast level** — the ratified route (research D-02). The
normaliser runs as a remark plugin over the parsed mdast, reading paragraph and code
node values and reconstructing line text from them. A key consequence: **fence and
blockquote safety fall out for free**, because CommonMark has already classified the
tree — a fenced `>` is inside a `code` node and a real `> quote` is a `blockquote`
node, so **only** Markua line-prefix paragraphs and wrapper-marker paragraphs are ever
candidates for conversion. The vitest matrix (below) exercises the rules before any
renderer exists.

## Line classification

The normaliser scans lines top to bottom, tracking one piece of state: whether it
is **inside a fenced code block**. A line is one of:

- **Fence toggle** — a line matching ` ``` ` or `~~~` (an opening or closing code
  fence, per CommonMark). It flips the inside-fence state. While inside a fence,
  **no other rule fires** — every line is passed through verbatim.
- **Line-prefix line** — outside a fence, a line matching `^([A-Z])>(\s|$)` where
  the capture is one of the recognised letters `A B C D E I Q T W X`. The letter
  selects the construct (aside for `A`; the callout class for the rest; generic for
  `B`). A letter outside that set (e.g. `Z>`) is **not** a Markua line and is left
  as text.
- **Wrapper open** — outside a fence, a line whose trimmed content is `{aside}` or
  `{blurb, class: <name>}` (or `{blurb}` for a generic blurb). Optional whitespace
  inside the braces is tolerated.
- **Wrapper close** — outside a fence, a line whose trimmed content is `{/aside}`
  or `{/blurb}`.
- **Ordinary line** — anything else.

## Line-prefix run recognition and termination

- A **run** starts at the first line-prefix line of a given family and extends
  across consecutive lines that are **either** a line-prefix line of the same family
  **or** a bare prefix marker on its own (`A>` with nothing after it — a blank line
  *within* the aside, per the Markua multi-paragraph form).
- The run **ends** at the first line that is neither of those: an ordinary line, a
  blank line with no prefix, a wrapper marker, a fence toggle, or end of input.
- Mixing families does not extend a run: an `A>` line does not continue a `W>` run.
  A new family starts a new run.
- **Inner content**: the prefix (`X>` and the single following space, if present) is
  stripped from every line of the run, and the remaining lines are joined into the
  block's inner Markdown. That inner Markdown is compiled normally — so
  `A> # A Longer Aside` yields a real heading inside the aside, and a fenced code
  block written inside an `A>` run is preserved.
- **Output**: one `remark-directive` container for the run — `:::aside` for `A`, or
  `:::<class>` for a callout family (the class resolved via
  [`callout-mapping.md`](./callout-mapping.md)) — wrapping the compiled inner content.

## Wrapper recognition, balance, and nesting

- A **wrapper** opens on a `{aside}` / `{blurb…}` line and closes on the matching
  `{/aside}` / `{/blurb}` line. The body is every line in between.
- Wrappers are **nestable**. The normaliser tracks an open-count **per wrapper type**;
  an inner `{aside}` inside an outer `{aside}` increments the count, and the outer
  block closes only on the `{/aside}` that returns the count to zero (balanced
  matching, not first-close-wins).
- `{blurb, class: <name>}` carries its class onto the emitted directive; `{blurb}`
  with no class is the generic blurb.
- **Body compilation**: the wrapper body is compiled as normal Markdown (it may
  itself contain line-prefix runs, images, nested wrappers, and fenced code), then
  wrapped in the container directive for the wrapper's type/class.
- **Attribute list above a wrapper open**: a `{#id}` or `{class: …}` attribute-list
  line **immediately above** a `{aside}` / `{blurb}` open line attaches to the
  **emitted container directive** for that wrapper — it is not stranded as a preceding
  paragraph. The normaliser consumes the wrapper open/close lines into the container;
  the attribute-list plugin (running on the mdast) then finds the attribute list
  immediately preceding that container and writes the id/class onto it. The ordering
  is pinned (normaliser produces the container first, attribute-list plugin runs after
  on the same tree) so the id/class lands on the container, not on a sibling. See
  [`attribute-list-plugin.md`](./attribute-list-plugin.md).
- **Unbalanced degradation**: a wrapper open with no matching close (or a stray
  `{/aside}` / `{/blurb}` with no open) does **not** break the page. The unmatched
  marker line is left as **literal text** and the surrounding content renders
  normally (FR-012, NFR-002). The normaliser never throws.

## Avoiding adjacent CommonMark (US1 sc.5, edge cases)

- **A real blockquote is never consumed.** A CommonMark blockquote begins with `>`
  at line start (`> text`), which does not match `^([A-Z])>`; the normaliser leaves
  it untouched, and — on the mdast seam — it has already parsed to a `blockquote`
  node, so it is never even a candidate.
- **A fenced code block containing `>` is never consumed.** Because fence toggles
  flip the inside-fence state and suppress every other rule while inside, a `W>` or a
  `>` line inside a fence stays verbatim code. This holds whether the fence sits
  adjacent to a callout run or *inside* an aside/blurb body.
- **A line-prefix look-alike in prose is left alone** when it is not at line start
  (the rule anchors on `^`), so `see W> in the manual` mid-sentence is ordinary text.

## Three-way callout redundancy (FR-004)

The three input forms for a class normalise to **one** directive per class before
rendering, so their output is identical:

| Input form | Example (warning) | Normalised |
|------------|-------------------|------------|
| shorthand | `W> Be careful.` | `:::caution` … `:::` |
| `{class:}` + `B>` | `{class: warning}`<br>`B> Be careful.` | `:::caution` … `:::` |
| `{blurb, class:}` | `{blurb, class: warning}`<br>`Be careful.`<br>`{/blurb}` | `:::caution` … `:::` |

- The `{class: <name>}` line immediately **above** a `B>` line (or a `B>` run)
  supplies the class for that block; the `B>` run's content is the body.
- A `{class: <name>}` with no `B>` beneath it attaches, like any attribute list, to
  the following block (see [`attribute-list-plugin.md`](./attribute-list-plugin.md)).
- Attributes an author may add to a callout (`{icon: …}`, `{#id}`) are carried onto
  the emitted directive as directive attributes and consumed downstream.

## Test matrix (non-fakeable)

Named vitest cases the normaliser must pass. These are chosen so they cannot be
satisfied by a shallow implementation.

| Case | Input | Assertion |
|------|-------|-----------|
| `fence-suppresses-line-prefix` | a fenced code block whose body contains a line **`W> not a warning`** | the fenced block is passed through **byte-identical** and **no `:::caution` is emitted** (a bare `>` inside a fence proves nothing — the trigger is a letter-prefix, so the fence must suppress an actual line-prefix line) |
| `unterminated-fence-at-EOF` | an opening ` ``` ` fence with no closing fence, followed by `W>` lines to end of input | `insideFence` does **not** unwind at EOF; the trailing `W>` lines stay inside the (unterminated) code and are **not** converted to `:::caution` |
| `adjacent-blockquote` | a real `> quote` block directly beside an `A>` run | the blockquote is untouched (a `blockquote` node), the `A>` run becomes `:::aside` |
| `fence-inside-aside` | an `{aside}` wrapper whose body holds a fenced block containing `>` | aside boundaries correct, code block intact (US1 sc.5) |
| `blank-line-run` | `A> # Heading` / `A>` / `A> para` | one aside; the internal heading survives; the blank `A>` line does not end the run |
| `three-way-equivalence` | `W>` · `{class: warning}`+`B>` · `{blurb, class: warning}` | all three emit the identical `caution` container (FR-004) |
| `nested-wrapper` | `{aside}` containing `{aside}…{/aside}` | balanced close matching; outer closes only at count zero |
| `unbalanced-degrades` | `{aside}` with no `{/aside}` | the marker line stays as literal text; no throw; build unaffected |
| `attr-above-wrapper` | `{#note}` immediately above `{aside}` | `note` id lands on the container directive (H) |

## Guarantees

- The normaliser is **total**: every input produces valid output; no input throws or
  fails the build.
- A page containing **no** line-prefix line and **no** wrapper marker is passed
  through unchanged (FR-011 — byte-identical base rendering).
- Detection is **fence-safe** and **blockquote-safe** by the rules above; these are the
  load-bearing correctness claims, each locked by a named case in the matrix — in
  particular `fence-suppresses-line-prefix` (a letter-prefix inside a fence, not a
  bare `>`) and `unterminated-fence-at-EOF`.
