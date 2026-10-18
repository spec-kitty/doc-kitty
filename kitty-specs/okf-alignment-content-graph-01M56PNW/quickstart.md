# Quickstart: verifying the mission locally

Run from the repo root. Use `pnpm clean` before an example build (cache trap), and run the bins directly rather than through `pnpm exec`.

## US1: metadata

```sh
node src/scripts/validate-frontmatter.mjs docs           # 0 date-only / email / okf_version warnings (NFR-003)
node src/scripts/validate-frontmatter.mjs example/docs   # same
cd src && npx vitest run tests/schema-validator-parity.test.ts tests/gherkin-feature-core.test.ts
node src/scripts/generate-feature-pages.mjs && git status --porcelain example/docs   # empty (NFR-001)
node src/scripts/scaffold.mjs /tmp/sk && grep -rL okf_version /tmp/sk/docs/**/README.md   # empty
```

To check that old forms still pass (NFR-004), validate a fixture with `updated: 2026-10-18` and an email author. It should exit 0 and print the warnings.

## US2: content graph

```sh
pnpm clean && pnpm --filter example build && cp example/dist/api/content-graph.json /tmp/g1.json
pnpm clean && pnpm --filter example build && cmp /tmp/g1.json example/dist/api/content-graph.json
node src/scripts/assert-build-artifacts.mjs example/dist   # walks _links.contentGraph
jq '._links.contentGraph' example/dist/api/index.json
jq '.edges[] | select(.source=="adr/0059-content-graph-and-okf-alignment")' example/dist/api/content-graph.json
```

Compare the edges with the page's rendered Related, Audience and References blocks (SC-001; automated in `content-graph.test.ts`).

## US3: export

```sh
ls example/dist/okf/index.md
node src/scripts/export-okf.mjs --graph example/dist/api/content-graph.json --docs example/docs --out /tmp/okf1 --check
node src/scripts/export-okf.mjs --graph example/dist/api/content-graph.json --docs example/docs --out /tmp/okf2
diff -r /tmp/okf1 /tmp/okf2                               # empty
diff -r /tmp/okf1 example/dist/okf                        # empty (CLI == build output)
```

## Consumption proof (NFR-005)

```sh
cd src && npx vitest run ../tests/consumption/consumption-gap.test.ts
```

## Build cost (NFR-006)

Time one example build on `main` and one on this branch. The difference should be ≤ 10%. Record it once in the WP evidence.
