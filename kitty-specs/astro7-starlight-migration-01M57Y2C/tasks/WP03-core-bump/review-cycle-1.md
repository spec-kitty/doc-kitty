---
affected_files: []
cycle_number: 1
mission_slug: astro7-starlight-migration-01M57Y2C
reproduction_command:
reviewed_at: '2026-10-18T19:22:19Z'
reviewer_agent: reviewer-renata
wp_id: WP03
---

# WP03 review 1 (reviewer-renata): changes requested

## Blocking

1. **Integration-order pin tests broken by WP03 and not updated.** Adding
   `markdownProcessorIntegration` at index 0 of `defineDocKittyIntegrations()`
   reds two fast-tier tests that no other WP owns (they are not caused by B3/B6):
   - `src/tests/glossary-config.test.ts` > "keeps the glossary-free named array byte-identical to the pinned baseline"
   - `src/tests/glossary-substrate-parity.test.ts` > "registers the full integration order (every seam before Starlight pinned)"
   Both receive an extra leading `"doc-kitty:markdown-processor"`. The handoff claim that all
   remaining failures map to other WPs is therefore wrong for these two.
   Fix: add `doc-kitty:markdown-processor` as the first element of both pinned baselines, with a
   comment citing ADR-0060. These pins are exactly the ordering guard the DoD ("plugin order
   unchanged") relies on; updating them turns them into the regression test for "processor is
   first" that WP03 currently lacks. Optionally add one focused unit test that calling the
   integration's `astro:config:setup` sets `markdown.processor` (so deleting the pin, or moving it
   after Starlight, goes red). Repro:
   `cd src && npx vitest run tests/glossary-config.test.ts tests/glossary-substrate-parity.test.ts`.

## Non-blocking (address or note in the handoff)

2. Behaviour change: a draft with a broken Gherkin fence now fails the build even when drafts
   are off (Astro 7 `glob()` rethrows before `store.set`, so the draft policy never runs). The
   renamed test pins this, which is fine, but call it out explicitly in the commit/handoff as an
   accepted consequence of decision 5 rather than leaving it implicit.
3. `npx tsc --noEmit -p src` shows 14 errors (`astro:content` / `import.meta.env` ambient types,
   `HastNode` in base-absolute-links tests), one in WP03-owned `src/lib/docs-index.ts`. Record
   whether these exist on the base or come from the bump (Astro 7 client types / `astro sync`),
   and who owns them.

## Verified OK

- Removal of the failed-render bookkeeping is correct: `astro@7.4.0`
  `dist/content/loaders/glob.js:148-151` logs then `throw error` before `store.set`. Replacement
  loader tests drive the real `glob()` and assert rejection + `store.has(id) === false`; not vacuous.
- Processor integration is first in the only integrations array (config.ts `return [`); no other
  `starlight()` call path in src/lib.
- Out-of-owned-list edits are justified: glossary `load.internal.ts` (Zod 4 compile fix, T012),
  loader/metadata/sitemap tests (T012/T013 red-first). `example/astro.config.mjs` is owned.
- Peer `astro >=7.2.10 <8` justified by Starlight 0.42.6's own peer.
- Example build red on sidebar `autogenerate` (B3, WP04) is acceptable per tasks.md: green build is
  WP05 T018; WP04 depends on WP03.
- eslint clean on changed files; targeted vitest otherwise green (loader, metadata, sitemap-order).
