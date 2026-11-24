# Quickstart: print and PDF output

```sh
pnpm install
# local PlantUML: any self-hosted server on :8091 (see the consumer guide)
DK_PUBLISH_DRAFTS=off DK_OUTDIR=dist-nodrafts pnpm build
node src/scripts/assert-build-artifacts.mjs example/dist-nodrafts
SOURCE_DATE_EPOCH=1767225600 node src/scripts/dockitty-pdf.mjs --dist example/dist-nodrafts --base /doc-kitty
node src/scripts/assert-pdf-artifacts.mjs example/dist-nodrafts
SOURCE_DATE_EPOCH=1767225600 node src/scripts/assert-pdf-determinism.mjs example/dist-nodrafts --base /doc-kitty
pnpm --filter @spec-kitty/doc-toolkit exec vitest run print pdf sections
npx playwright test tests/a11y/print.spec.ts tests/a11y/print-control.spec.ts
```

Open `example/dist-nodrafts/pdf/architecture.pdf`: a cover, a table of contents, one page per sheet, light in every case.
