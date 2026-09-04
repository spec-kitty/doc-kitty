# Contracts — Test-Guard Hardening

No API endpoints or external event shapes. The mission's only code "contract" is:

- `src/lib/hub-children.mjs` — `selectHubChildren(entries, currentSlug, order)`: the pure, importable Hub child-selection (self-exclusion ∧ parent-of-current ∧ `isPublished`, then section-rank→title sort) that `Hub.astro` calls. Enforced by `src/tests/hub-children.test.ts` (mutation-true: removing the `isPublished` clause reds it).

#54 is a `src/vitest.config.ts` scheduling change (no contract surface).
