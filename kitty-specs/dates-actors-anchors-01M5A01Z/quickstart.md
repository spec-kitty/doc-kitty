# Quickstart: verify the mission

```bash
pnpm install
pnpm test -- src/tests/vocabulary-core.test.ts src/tests/schema-validator-parity.test.ts \
  src/tests/okf-export.test.ts src/tests/single-h1.test.ts src/tests/metadata.test.ts
node src/scripts/validate-frontmatter.mjs src/tests/fixtures/old-forms   # exits 0
pnpm lint && pnpm test
pnpm build && cp -r example/dist /tmp/dist-a && pnpm build && diff -r /tmp/dist-a example/dist  # NFR-001
```

To check by hand:

- `updated: "1"` in any page makes `validate-frontmatter` fail. The message names
  `updated` and `YYYY-MM-DDTHH:MM:SSZ`.
- A page with `generated: {by: doc-kitty-scaffold/0.4.0, at: T1}` and `updated: T2`
  exports `generated.at: T2`, with `generated.by` set to the first author or the export
  process.
