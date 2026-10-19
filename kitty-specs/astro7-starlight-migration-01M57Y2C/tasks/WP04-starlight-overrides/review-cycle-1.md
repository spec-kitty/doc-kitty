---
affected_files: []
cycle_number: 1
mission_slug: astro7-starlight-migration-01M57Y2C
reproduction_command:
reviewed_at: '2026-10-18T20:47:58Z'
reviewer_agent: reviewer-renata
wp_id: WP04
---

**Issue 1 (blocking): 16 sidebar-shape pins left red by WP04's own correct B3 change.**
`src/tests/sections.test.ts`, `src/tests/section-rename.test.ts` and `src/tests/gherkin-integration.test.ts` (16 failures) assert the removed `{ label, autogenerate }` group shape. B3 changed that shape in `src/lib/sections.ts` in this WP. WP06's `owned_files` are `tests/a11y/**`, remark-version-pin, example-adopter, url baselines and consumption tests. It does not own these files, and its T021 "pins" are remark/example/URL pins, not registry sidebar pins. Under the WP03 precedent, a test pin broken by a WP's own correct change, with no owning WP, belongs to that WP. Fix: update those 16 assertions to the `items: [{ autogenerate }]` shape, with a one-line reason, in this WP. Done when the three files are green.

**Non-blocking notes (no action needed for approval):**
- B17 (the empty i18n collection warning) can stay open for a later decision. The WP04 DoD is "carriers render; theme overrides still apply" and says nothing about build warnings. Record it in the PR or for WP08.
- B5 processedDirs: a consumer list that already contains docsDir gives a duplicate entry. This is harmless, but you could dedupe it.
- B9 toggle fix: sound. The listener is attached once and only acts on `newState === 'open'`.
- B19 CSS: scoped to `.sl-markdown-content` plus the dk-* classes, and excludes `.not-content`. No leak found. The second rule hardcodes `1.25rem`; prefer a named token or comment that it mirrors Starlight's value.
- `tests/a11y/starlight-layer-parity.spec.ts` sits in WP06-owned `tests/a11y/**`. Tell WP06 about it. ESLint ignores that path.
- `sidebar-build-html` fails to build because of the `Fragment` redeclaration (B6, owned by WP05). That failure is expected.
