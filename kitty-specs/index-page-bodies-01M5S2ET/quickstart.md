# Quickstart: verify #238

```sh
cd src && ./node_modules/.bin/vitest run tests/okf-export.test.ts tests/okf-export-links.test.ts
```

Expected: the new overview-page rows pass, the unbased snapshot is unchanged, and `checkOkfBundle` reports no violations on the overview fixture.
