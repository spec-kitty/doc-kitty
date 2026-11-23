---
affected_files: []
cycle_number: 1
mission_slug: large-hubs-sidebar-child-cap-01M81KGV
reproduction_command:
reviewed_at: '2026-11-23T07:42:47Z'
reviewer_agent: claude::reviewer-renata
wp_id: WP01
---

# WP01 review, cycle 1: changes requested

Reviewer: claude::reviewer-renata. Lane head reviewed: 0340feb.

## Blocking

### B1: the site options are validated and then dropped (T003 not done)

`splitSidebarOption` now returns `childCap` and `cappedLabel`, but the only caller,
`src/lib/config.ts:622`, destructures just `starlightSidebar`, `indexLabel` and `chrome`.
The two values are discarded. The `routeShaping` object at `src/lib/config.ts:792-799`
does not carry them.

T003 asks for both values to be added to the `routeShaping` options object in
`defineDocKittyIntegrations`. The two optional fields go on `RouteShapingOptions` as a
recorded out-of-map edit, coordinated with WP02.

WP02 cannot close this gap. Its owned files are `integrations/route-shaping.ts`,
`route-shaping-module.d.ts` and `hub-caps-data.test.ts`, and none of them is `config.ts`.
WP02 also reads `options.childCap` and serialises `cappedLabel` "when the site set it",
so it depends on this wiring. As the lane stands, `sidebar: { childCap: 5 }` passes
validation and has no effect (FR-001, site level).

Fix:
- Destructure `childCap` and `cappedLabel` at `config.ts:622`.
- Add `...(childCap !== undefined ? { childCap } : {})` and
  `...(cappedLabel !== undefined ? { cappedLabel } : {})` to `routeShaping`.
- Add `childCap?: number; cappedLabel?: string;` to `RouteShapingOptions` in
  `src/lib/integrations/route-shaping.ts`. This is a recorded out-of-map edit, so note
  it in the commit.
- Add a red-first test that `defineDocKittyIntegrations({ sidebar: { childCap: 7, cappedLabel: 'x {count}' } })`
  passes both values to the route-shaping options. An unset option must leave the
  object unchanged, so that NFR-002 byte-identity is not disturbed.

## Non-blocking

- N1: in `src/tests/route-shaping.test.ts:14`, the new import sits above the `vitest`
  import and the file's header block of imports. Move it next to the other `../lib`
  imports.
- N2: the commit trailers on df6695c and 0340feb name a model. The dispatch rules for
  this mission say no model names in commits. Drop that from future commits.

## Verified (no action needed)

- Targeted tests: `vitest run tests/child-cap.test.ts tests/chrome-options.test.ts tests/route-shaping.test.ts`
  gives 125/125, of which 18 are in child-cap.
- Fast suite: 4051/4051 (192 files). `pnpm lint` and `pnpm typecheck` are clean.
- Cap edge cases. `isChildCap`, the `docKittyFields` schema and the standalone gate
  (`frontmatterSchema`, zod 4.6.7) agree on every value probed: 0, -1, 1.5, '10', 1e20,
  2^53, Infinity, NaN and null are rejected, and 10 is accepted. zod 4 `.int()` is a
  safe-integer check, so it agrees with `isChildCap`.
- Precedence: `??` runs hub, then section, then site, then 50. Every value is validated
  where it is read, so 0 can never reach the `??` chain.
- Section errors name the file and the section id. Site errors name `sidebar.childCap`
  and `sidebar.cappedLabel`.
- The two out-of-map test edits are justified. One updates the pinned unknown-key
  message; the other adds the new UI string to the injected translations. Both are
  additive and pin the new state exactly, so neither masks a regression.
