---
affected_files: []
cycle_number: 2
mission_slug: operating-model-templates-01M84X0R
reproduction_command:
reviewed_at: '2026-11-24T00:06:38Z'
reviewer_agent: claude::reviewer-renata
wp_id: WP02
---

# WP02 review cycle 2: changes requested (claude::reviewer-renata)

Reviewed lane `kitty/mission-operating-model-templates-01M84X0R-lane-a` @ 93708471 (code tip 4a30c365; later commits touch kitty-specs only). Cycle-2 code delta vs e0c53a62 is `src/tests/role-kind.test.ts` only.

## Blocking

**B1. The cycle-1 lint fix mutates a shared, cached fixture object.** `persona()` returns `parse('persona/valid-persona.md')`, and `parse` calls `matter(str)` with no options. gray-matter caches by content and returns the *same* object on every call (checked: `matter(s).data === matter(s).data` → true). So `delete data.goals` (role-kind.test.ts:75-76) strips `goals` from every later `persona()` result, and `delete data.role` strips `role` too.
Effects:
- "a Persona without role still fails…" actually runs on a page missing both `role` and `goals`. It no longer isolates the role check.
- The file is order-dependent. `npx vitest run tests/role-kind.test.ts --sequence.shuffle --sequence.seed=2` (also seeds 3 and 8) fails "a valid Persona still passes". The same seeds pass at the cycle-1 commit e0c53a62, whose destructuring copied the object. So the regression comes from this fix.
Fix (verified): copy in the factory, `const persona = () => ({ ...parse('persona/valid-persona.md') });`. eslint is clean, and seeds 2, 3 and 8 give 11/11. A shallow copy is enough because only top-level keys are deleted. Consider the same copy in `validRole()` and `parse()` callers for safety; today they only spread, so they do not mutate.

## Checked and fine

- Cycle-1 B1: `pnpm lint` exits 0.
- Cycle-1 N1: the rename ("the build schema stays lenient for a Role page (kind is an open string there; the gate holds the rule)") now matches what the test checks.
- src/lib, src/scripts and fixtures are unchanged since e0c53a62, so the Persona byte-identity and Role-rule results from cycle 1 still hold.
- `pnpm test`: src 4530/4530 (231 files), mcp 181/181 (23 files). `pnpm typecheck` exits 0.
