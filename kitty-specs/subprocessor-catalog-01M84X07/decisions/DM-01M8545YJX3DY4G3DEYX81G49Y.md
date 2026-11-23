# Decision Moment `01M8545YJX3DY4G3DEYX81G49Y`

- **Mission:** `subprocessor-catalog-01M84X07`
- **Origin flow:** `plan`
- **Slot key:** `plan.architecture.build-failure-point`
- **Input key:** `build_failure_point`
- **Status:** `resolved`
- **Created:** `2026-11-23T21:14:51.357253+00:00`
- **Resolved:** `2026-11-23T22:25:56.651434+00:00`
- **Opened by:** `cli`
- **Other answer:** `false`

## Question

Where does an invalid sub-processor catalog fail the build? (A) In a new doc-kitty:subprocessors integration at astro:config:setup. It reads the file once, validates it with the shared bare-Node core (the same core validate-catalog.mjs imports) against the bibliography and measures catalogs, and throws one aggregate error before any page renders. It injects /api/subprocessors.json and /subprocessors.xml only when the file exists (gherkin precedent), so served-surface detection drives the api/index.json links. (B) Lazily, when the routes render. Simpler, but the error comes late and a missing route cannot be told apart from a failed one.

## Options

- A: fail at config setup in a file-gated integration (recommended)
- B: fail when the route renders
- Other

## Final answer

A: fail at astro:config:setup in a new file-gated doc-kitty:subprocessors integration; validate once with the shared bare-Node core; one aggregate error before rendering; routes injected only when the file exists. Engineering alignment confirmed as written (pure core + bare-Node loader, bibliography/measures ids passed in, embedded ISO alpha-2 list, RSS reuses rss.ts helpers, WP01-WP05 with WP05 gated on #445). Decider: operator ('as recommended', relayed verbatim by dispatcher 2026-11-23).

## Rationale

_(none)_

## Change log

- `2026-11-23T21:14:51.357253+00:00` - opened
- `2026-11-23T22:25:56.651434+00:00` - resolved (final_answer="A: fail at astro:config:setup in a new file-gated doc-kitty:subprocessors integration; validate once with the shared bare-Node core; one aggregate error before rendering; routes injected only when the file exists. Engineering alignment confirmed as written (pure core + bare-Node loader, bibliography/measures ids passed in, embedded ISO alpha-2 list, RSS reuses rss.ts helpers, WP01-WP05 with WP05 gated on #445). Decider: operator ('as recommended', relayed verbatim by dispatcher 2026-11-23).")
