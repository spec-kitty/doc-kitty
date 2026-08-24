# Issue Matrix — Slide Decks (slide-decks-01M0T72Y)

Maps GitHub issues referenced in this mission's scope to a review verdict.

| issue | verdict | evidence_ref |
| --- | --- | --- |
| #3883 | verified-already-fixed | research.md D-05/D-08 — reveal.js upstream issue #3883 (Vite/Rolldown directive ordering); the build-time pre-render architecture renders directive attributes static before JS, so `astro build` is immune. No doc-kitty change required. |

## Notes

- **#3883 is an upstream reveal.js issue**, not a doc-kitty tracker issue. It is
  referenced twice in `research.md` only to record that the chosen out-of-frame
  pre-render architecture (deck rendered via a `prerender = true` route, directives
  resolved at build time in mdast) is **immune** to it. The mission does not fix
  #3883; it verifies its own build is unaffected — hence `verified-already-fixed`.
- This matrix was authored during WP03 review because the per-WP `approved`
  transition requires it and it had not been scaffolded by `finalize-tasks`.
