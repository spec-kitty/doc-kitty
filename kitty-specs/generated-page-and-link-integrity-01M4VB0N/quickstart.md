# Quickstart: checking this mission

Run single test files from the package directory. Do not run `pnpm install` or `pnpm exec` in this checkout.

```sh
cd src
./node_modules/.bin/vitest run tests/index-basename.test.ts          # route rule
./node_modules/.bin/vitest run tests/gherkin-generate.test.ts        # #122 guard
./node_modules/.bin/vitest run tests/gherkin-check-cli.test.ts       # --allow-empty, --check
./node_modules/.bin/vitest run tests/glossary-generate.test.ts       # #129 file name and prune
./node_modules/.bin/vitest run tests/check-links-tightened.test.ts   # source check
```

Build-level checks (example artifacts, built-link gate, a11y, consumer proof) need a PlantUML server and run in CI on the draft PR: `build-example`, `a11y` and the Consumption test workflow.

What to look for by hand in the consumer proof's built output:

- `/consumer-fixture/glossary/` exists and lists the contexts; a term link lands on a context page.
- A page that links `../x/y.md#z` in source shows `href="/consumer-fixture/x/y/#z"`.
