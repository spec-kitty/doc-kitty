# Contract: Deck ↔ Markua composition

Authoritative behavioural contract for how the Markua passes compose with `deckSplit` on a `kind: Presentation` page. Backs FR-001..FR-006 and the FR-003 ordering assertion.

## C-COMPOSE-01 — Ordering is pinned

- The effective remark order is `remarkDirective → markuaNormalise → markuaAttributes → markuaCallouts → [glossary] → remarkAsides → deckSplit`.
- An automated assertion (extending/beside `deck-guard.test.ts`) MUST fail loudly if any Markua content pass is registered **after** `deckSplit`, mirroring the existing `remarkAsides`-order lock.

## C-COMPOSE-02 — Non-crossing markers preserve slide structure

- Given a deck body whose Markua markers do **not** straddle a `##`/`###`/`---` boundary, running the full Markua remark chain then `deckSplit` MUST yield the **same** `deckSection` count and nesting as `deckSplit` alone on the marker-free equivalent (INV-3).
- The compiled aside/callout/figure nodes attach **inside** the slide they were authored in (they are "any other node" to `deckSplit`).

## C-COMPOSE-03 — Wrappers may not cross a boundary

- An `{aside}`/`{blurb}` wrapper on a deck MUST terminate at the first slide-boundary node (heading depth 2 or 3, or `thematicBreak` — matching `deckSplit`'s own rule exactly; a depth-1 `#` is not a boundary) that would otherwise fall inside its body.
- On termination the transform MUST emit a build warning via `file.message` and MUST leave the boundary node in `root.children` (INV-1). The build MUST NOT fail.

## C-COMPOSE-04 — Callouts render as `dk-callout` on decks

- On a deck, `markuaCallouts` MUST emit the self-contained `dk-callout` hast for every mapped/line-prefix callout (never the native `starlight-aside` path), so the callout is styled by the `dk-components.css` the deck route loads.
- The `<aside class="dk-callout …">` MUST expose an accessible name/role sufficient for zero axe violations (add an `aria-label`/role if the gate flags it).

## C-COMPOSE-05 — Figure wraps body images, never the hero

- `markuaFigure` MUST wrap each slide body `<img>` as `<figure class="dk-figure">` with a non-empty `<img alt>` and a `<figcaption>`.
- `markuaFigure` MUST skip the synthesized title-slide hero image (tagged `data-deck-hero`), leaving its `<img alt>` populated and adding no `<figcaption>` (INV-2).

## C-COMPOSE-06 — `markuaTocDemote` and off-deck corpus

- `markuaTocDemote` MUST remain a deck no-op (guarded).
- Every non-`Presentation` page MUST render byte-identically to pre-mission `main` (INV-4) — the change is additive on decks only.
