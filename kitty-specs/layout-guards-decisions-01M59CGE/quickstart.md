# Quickstart: Layout guards and decisions

How to run each guard locally and watch it fail first. Screenshot baselines are
never written locally (C-001); use `--update-snapshots` only inside the CI baseline
workflow.

## Build both dists

```bash
pnpm install --frozen-lockfile
pnpm build:a11y                                   # example/dist, drafts on
DK_PUBLISH_DRAFTS=off DK_OUTDIR=dist-nodrafts pnpm build  # example/dist-nodrafts
```

## Unit and build guards

```bash
pnpm test -- src/tests/stock-header-stamp.test.ts       # stamp (no build)
pnpm test -- src/tests/config-invariants.test.ts        # six carriers, switch off by default
pnpm test -- src/tests/draft-publication-build.test.ts  # determinism (builds)
pnpm fixture:stock-header                               # regenerate fixture and stamp
```

## Playwright guards

```bash
pnpm test:a11y -- tests/a11y/layout-geometry.spec.ts --project light
pnpm test:a11y -- --project published-light
```

On a machine whose Playwright browser build differs from the pinned one, point
`launchOptions.executablePath` at a local Chromium through a config that is not
committed. Geometry checks still run; screenshot checks may differ.

## Fail-first proofs

| Guard | Mutation that must turn it red |
| --- | --- |
| Determinism | Change one byte of a copied surface file inside the test |
| Stamp | Edit `starlight` in the stamp to another version |
| Reveal at first paint | Move the reveal back to `DOMContentLoaded` |
| Search tracks column | Remove the header track rule |
| Toggle clearance | Remove the collapsed-pane end padding |
| Target size | Inject `.right-sidebar-panel a{min-block-size:0;min-height:0;padding-block:0}` |
| No-sidebar recentre | Inject `--sl-content-margin-inline: auto 0` on the pane in the simulation |
| Server draft check | Serve `example/dist` with `DK_A11Y_EXPECT_DRAFTS=off` |
| Membership | Serve a drafts-on dist to the published projects with the check bypassed |
