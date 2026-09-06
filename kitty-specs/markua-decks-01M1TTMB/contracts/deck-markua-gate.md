# Contract: Deck-Markua a11y/behaviour gate

Backs FR-007 (fixture) and FR-008 (gate); SC-001..003, NFR-001/NFR-004.

## Fixture — `example/docs/presentations/markua-deck.md`

- `kind: Presentation`, filed under `presentations/` so it routes out-of-frame to `DeckLayout`.
- Frontmatter carries a `hero_image` (to exercise the hero-exclusion path).
- Slides exercise the representative subset on **non-title** slides:
  - a `W>` line-prefix aside (→ `dk-callout--warning` or mapped variant),
  - an `{aside}…{/aside}` wrapper fully within one slide,
  - a `{…}` attribute list targeting a slide element (e.g. `{.dk-…}` on a paragraph adjacent to a `###`),
  - a body Markua figure `![caption](image){…}`.
- The fixture is published (part of the example build) so `assert:artifacts`/`assert:no-broken-links` cover its route.

## Route registration — `tests/a11y/routes.ts`

- Add `ROUTES.markuaDeck = ` `${BASE}/presentations/markua-deck/` (out-of-frame deck shell — NOT the in-frame `markuaShowcase`).
- Add an `AXE_PAGES` entry using the `'deck'` shell so the enumerated axe lane covers it.

## Gate — `tests/a11y/deck-markua.spec.ts` (Playwright + `@axe-core/playwright`)

Harness mirrors `tests/a11y/deck.interaction.spec.ts`: preview at `http://localhost:4321/doc-kitty/`, chromium (`/usr/bin/chromium`), both light and dark colour schemes. Assertions:

- **G1 (callout renders)**: the `W>`/`{aside}` slide shows a `.dk-callout` styled aside on the correct slide `<section>`.
- **G2 (figure wraps, hero intact)**: the body figure slide contains `figure.dk-figure > img[alt] + figcaption`; the **title slide** hero `<img>` has a non-empty `alt` and **no** `<figcaption>`.
- **G3 (attributes applied)**: the `{…}`-targeted element carries its attribute (class/id) and no literal `{…}` text is present.
- **G4 (no boundary swallowed)**: the deck's slide `<section>` count/structure matches the expected authored slide count (markers did not merge or drop a slide).
- **G5 (axe clean)**: zero axe violations (roles, accessible names, `image-alt`) in **both** colour schemes, pre- and post-reveal-enhancement (mirroring the existing IX-3b SSR + enhanced scans).

## Determinism (NFR-004)

- Runs under the repo's CI-serial invocation; no reliance on parallel-only ordering.
- `example/dist` MUST be rebuilt before artifact/link asserts (vitest mutates it; a killed run can leave a partial dist).
