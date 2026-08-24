# Post-merge adversarial review squad — M6 Slide Decks

Four independent lenses audited the MERGED code on `feat/slide-decks` (not the
planning docs): fidelity/coverage (reviewer-renata), architecture/ADR-realization
(architect-alphonso), correctness bug-hunt (debugger-debbie, verified by running the
real transform), and security (injection/supply-chain/CSP). Verdicts: the mission is
structurally sound and faithfully realizes both ADRs; findings below were all
remediated in one pass (commit `fix(m6): remediate post-merge review findings`).

## Findings and disposition

| ID | Lens | Sev | Finding | Disposition |
|----|------|-----|---------|-------------|
| S-01 | security | MAJOR | Directive allowlist was **warn-only** — `on*` handlers injected as-is → stored XSS in static output; allowlist gave false assurance | **fixed** — allowlist is load-bearing: `on*` + remote-background denied, unknown attrs dropped (not applied); + tests |
| F-01 | fidelity | MAJOR | Title slide read `hero_image` as a **string**; the contract is an object `{src,alt}` → hero image silently dropped (FR-003 partial); masking test used an invalid shape | **fixed** — reads `hero_image?.src/.alt`; test corrected; showcase deck ships a real `hero_image` exercising it end-to-end |
| B-01 | bug-hunt | MAJOR | Headingless `---`→stack left inner slide #1 with **no accessible name** (`aria-label` stuck on the wrapper) | **fixed** — `openInner` migrates the section's `hProperties` (aria-label + attrs) to inner #1, clears the wrapper; + test |
| B-02 | bug-hunt | MINOR | `aria-label "Slide N"` off-by-one once a stack precedes a headingless slide (**shipped wrong** in the showcase deck: "Slide 4" reached as #5) | **fixed** — labels from a navigable-slide counter; showcase now correctly "Slide 5"; + test |
| B-03 | bug-hunt | MINOR | A misspelled directive **name** (`.slyde`) was silently swallowed, no warning (FR-008 gap) | **fixed** — `<!-- .word: … -->` shape recognized; unknown name warns + consumed; + test |
| B-04 | bug-hunt | MINOR | `.slide` attrs on a `##` that becomes a stack landed on the wrapper → background bled across the whole stack | **fixed** — falls out of the B-01 `hProperties` migration; + test |
| B-05 | bug-hunt | MINOR | A leading `.element` silently mutated the frontmatter-**synthesized** title node | **fixed** — `lastBlock` reset after the title slide so a leading `.element` warns/skips; + test |
| S-02 | security | MINOR | `data-background-iframe`/remote-URL backgrounds embed arbitrary off-origin content | **fixed** — remote-content background attrs denied (local kept); + test |
| A-01 | architecture | MAJOR (doc) | ADR-0022 D4/D5 said the `--dk-*→--r-*` map is `.reveal`-scoped with a belt-and-suspenders guard; code correctly puts it at `:root` (reveal paints on `body`), and that guard doesn't exist | **fixed** — ADR-0022 D4/D5 amended to `:root` + route-import isolation as the sole guard |
| A-02 / B-06 | arch / bug | MINOR | Route filtered `kind`-only; a misfiled deck could mis-route if the validator gate is bypassed | **fixed** — `getStaticPaths` also requires `entry.id.startsWith('presentations/')` |
| A-03 | architecture | MINOR | BA-3 hardcodes slug pins (parity only transitive) | **fixed** — new `deck-slug.test.ts` imports the SSOT helper and asserts route↔generator parity |
| A-04 | architecture | MINOR (doc) | DeckLayout comment said draft ignore is "on document root"; it's on `<body>` | **fixed** — comment corrected |
| F-02 | fidelity | MINOR | Overview `?print-pdf` link was a hand-authored README bullet (the "hand-kept manifest" FR-014 forbids) | **fixed** — Hub auto-emits the print link per Presentation child; README bullet removed |
| F-03 | fidelity | MINOR | `DocType` union omitted `'Presentation'` | **fixed** — added |
| — | bug-hunt | note | `initDeck()` had no `.catch` (unhandled rejection) | **fixed** — `.catch` → console.warn; fallback still shows slides |
| F-04 | fidelity | note | Deck has no `prefers-color-scheme` dark fallback (light-only for real users) | **accepted / out-of-scope** — this is a site-wide M2 theme behavior (doc pages are also light-by-default); a deck-only fix would make the deck inconsistent with the frame. Track as a separate site-theme improvement. |
| — | security | INFO | Supply chain (reveal 6.0.1 pinned + integrity, no lifecycle scripts, self-hosted, `@types` absent), reveal config (no remote channel), frontmatter escaping — all **verified clean** | no action |

## Post-remediation gates (all green)

- code-quality: typecheck 0 errors, lint clean, **145** unit tests (was 131; +14 regression tests for the above).
- doc-sanity: validate:docs/example/links + markdownlint.
- build-example: `assert:artifacts` PASS (BA-1..BA-10), counts unchanged.
- a11y: **22/22** in `playwright:v1.62.1-noble` — deck axe both modes, hero image + corrected slide structure.

No contested finding was dropped; F-04 is the one accepted-with-rationale item.
