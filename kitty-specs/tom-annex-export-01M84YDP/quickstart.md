# Quickstart: the evidence index

> **Evidence index, not the contractual annex.** Not legal advice. ⚖ marks
> counsel items.

## 1. Classify pages (ADR-0080, already shipped)

```yaml
tom_classification:
  - measure: events-logging
    note: Audit events are kept for 13 months.
  - measure: incident-response
    scope: organisation
```

## 2. Build

```bash
pnpm --filter example build
```

When a published page is classified, `dist/api/tom-annex.json` exists and
`dist/api/index.json` has `_links.tomAnnex`. With no classified pages, neither
appears.

## 3. Optional: snapshot and hub page (after ADR-0087)

```bash
node src/scripts/tom-annex.mjs --dist example/dist \
  --snapshot example/docs/_meta/tom-annex.snapshot.json \
  --hub example/docs/context/evidence-index/index.md
node src/scripts/tom-annex.mjs --dist example/dist \
  --snapshot example/docs/_meta/tom-annex.snapshot.json \
  --hub example/docs/context/evidence-index/index.md --check
```

`--check` prints `doc-kitty-tom-annex <verdict> <path>` for each file that is not
`ok`. It exits 0 when everything is clean, 1 on drift and 2 on a usage error.

## 4. Verify

```bash
pnpm test
pnpm assert:artifacts   # node src/scripts/assert-build-artifacts.mjs example/dist
```
