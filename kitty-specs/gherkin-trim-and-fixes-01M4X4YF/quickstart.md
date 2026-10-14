# Quickstart: verify the mission

```sh
corepack enable && pnpm install --frozen-lockfile
pnpm test && pnpm lint && pnpm typecheck && pnpm validate && pnpm validate:features
pnpm build:a11y && pnpm assert:artifacts && pnpm test:a11y
```

Manual checks:

1. `@WIP` warning: tag a scratch feature `@WIP` and run
   `node src/scripts/generate-feature-pages.mjs --root <site> --sources features --check`;
   the output names `@wip`.
2. Draft hub: tag `example/features/hr/request-leave.feature` `@wip`, run
   `pnpm generate:features`, then `pnpm build:a11y`; `behaviour/hr/README.md` has
   `doc_status: draft` and the build prints no "Add an index page" warning for
   `behaviour/hr`. Revert both.
3. Titles: the example's `hr` hub reads "HR".
4. Scenario index: delete `example/src/pages/api/scenarios.json.ts` and build;
   the build fails naming the route. Restore it.
