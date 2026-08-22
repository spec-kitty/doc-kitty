# Quickstart — Path-Scoped CI/CD Pipeline

## Local green (Node 22)

```bash
corepack enable            # pnpm 11 via packageManager
pnpm install               # first run creates pnpm-lock.yaml — commit it
pnpm test                  # toolkit Vitest units
pnpm build                 # astro build the example → example/dist/
node src/scripts/assert-build-artifacts.mjs example/dist   # build-integration assertions
pnpm --filter @commondocs-kitty/toolkit typecheck          # type gate
```

A frozen install (what CI runs) must also pass, and must fail on a drifted lockfile:

```bash
pnpm install --frozen-lockfile
```

## Doc sanity locally

```bash
node src/scripts/validate-frontmatter.mjs docs
node src/scripts/validate-frontmatter.mjs example/docs
pnpm dlx markdownlint-cli2 "**/*.md"
vale docs example/docs
```

## Verifying lane selection (during E2E)

Open throwaway PRs and confirm the required `ci-ok` check and lane conclusions:

| PR touches | Lanes that run | ci-ok |
|---|---|---|
| `docs/**` only | doc-sanity | green |
| `src/**` only | code-quality + build-example + doc-sanity | green |
| `example/docs/**` only | doc-sanity + build-example | green |
| `.github/workflows/**` | all | green |
| `research/**` only | none (detect-changes + ci-ok still run) | green, mergeable |
| an injected type error / bad frontmatter / missing artifact | the relevant lane | **red** |

## Activating the gate (repo admin, out-of-band — FR-022)

CI does not become a gate until branch protection requires it:

1. Settings → Branches → add a rule for `main`.
2. Require status checks to pass; select **`ci-ok`** (and only `ci-ok`).
3. Enable Pages: Settings → Pages → Source = GitHub Actions.

See `docs/ops/ci-cd.md` for the full operating note.
