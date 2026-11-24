---
affected_files: []
cycle_number: 1
mission_slug: operating-model-templates-01M84X0R
reproduction_command:
reviewed_at: '2026-11-23T23:26:03Z'
reviewer_agent: claude::reviewer-renata
wp_id: WP02
---

# WP02 review: changes requested (claude::reviewer-renata)

Reviewed lane `kitty/mission-operating-model-templates-01M84X0R-lane-a` @ e0c53a62 (red 9a55716c).

## Blocking

**B1. `pnpm lint` fails on the new test file.** CI runs `pnpm lint` (`.github/workflows/ci.yml:104`). `eslint src` reports 2 errors, both in this WP:
```
src/tests/role-kind.test.ts
  75:20  error  '_omit' is assigned a value but never used  @typescript-eslint/no-unused-vars
  82:19  error  '_omit' is assigned a value but never used  @typescript-eslint/no-unused-vars
```
The config does not exempt `_`-prefixed names. Fix by building the variant without destructuring, e.g. `const data = persona(); delete data.goals;` (same for `role`), then re-run `pnpm lint`.

## Non-blocking

**N1. Vacuous test.** "the build schema accepts a Role page" passes at the red commit too: the build schema's `kind` is an open `z.string()` (`schema.ts:212`), so it accepts any kind. It pins leniency, not the Role kind. Either rename it to say so ("the build schema stays lenient for a Role page") or drop it. (It is one of the 5 tests that are green at red; the 6/11 red count is otherwise as claimed.)

## Checked and fine

- Red-first: at 9a55716c, 6 of the 11 role-kind tests fail (canonical kind, valid passes, no role, empty responsibilities, blank responsibility, blank role), plus the 16-kind pin in vocabulary-core.test.ts.
- Mutation: removing the Role block turns the 4 rule tests red; removing 'Role' from KINDS is covered by the red run.
- Persona byte-identity: the gate run on 12 Persona variants (valid, missing / blank / non-string role, missing / empty / blank / string goals, mixed responsibilities, bare page, draft) gives identical `problems` at 673e311 and e0c53a6.
- Role rule: blank or numeric `role`, whitespace-only entries, a string or missing `responsibilities` are each rejected; a Role page with `goals` is accepted, and so is one without.
- KINDS consumers: the gate's unknown-kind warning reads KINDS; `schema.ts` derives `Kind`, which `theme.ts` uses only as `Partial<Record<Kind, string>>`; no exhaustive kind switch, icon map or snapshot elsewhere. The build schema accepts the kind (open string).
- `pnpm test` green: src 4530/4530 (231 files), mcp 181/181 (23 files). `pnpm typecheck` exits 0. `src` `tsc --noEmit` has 57 errors, identical at red, so they are pre-existing and out of scope.
- Hygiene: the lane commits touch only the 7 owned files; the `pnpm install` chmods (13 scripts) and the `pnpm test` glossary restamps (4 pages, #398) are not committed.
