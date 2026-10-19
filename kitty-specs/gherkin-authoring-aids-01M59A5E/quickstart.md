# Quickstart: verify the mission locally

```bash
corepack enable && pnpm install
pnpm test                       # Vitest unit suites (red first, then green)
pnpm validate:features          # drift gate with --default-glossary-context flags
pnpm --filter example build     # build; check the log
pnpm test:a11y                  # axe + geometry lanes, incl. feature pages
```

## What to check

1. **#197.** The built HR page (`/behaviour/hr/request-leave/`) links "policy"
   to the HR glossary entry, and the build log has no unresolved-collision line
   for that page. The shipping pages still carry `glossary_context: "shipping"`,
   with no tag in their `.feature` files.
2. **#196.** With `lint.imperativeSteps: true` in the example, the build log
   shows **0** imperative-step warnings. Then add `When I click "Book"` to a
   scratch feature and confirm one warning and an unchanged exit code. Revert
   afterwards.
3. **#198.** `/behaviour/shipping/book-consignment/` shows the Specification
   card (tags and source link), with the results summary still in the body only. The `@wip`
   `/behaviour/shipping/track-consignment/` and any authored draft page show the
   draft notice. Active pages do not.
4. **Dormancy.** With both new options removed from the example config, and the
   shipping tags restored, `pnpm validate:features` reports no drift against
   `main`'s pages.
