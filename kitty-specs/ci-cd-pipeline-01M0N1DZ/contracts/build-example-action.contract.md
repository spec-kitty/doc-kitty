# Contract — `.github/actions/build-example` composite action

**Owner**: WP03. **Consumers**: WP04 build-example job, WP05 deploy job.

## Interface
- **Inputs**: `node-version` (default `22`), `working-directory` (default `.`).
- **Assumes**: the caller has already run `actions/checkout` (composite actions do
  not self-checkout). Both consuming jobs MUST include a checkout step before
  `uses: ./.github/actions/build-example`.
- **Does**: enable corepack → `actions/setup-node@<sha>` (Node 22 + pnpm cache) →
  `pnpm install --frozen-lockfile` → `pnpm build`.
- **Produces**: the built site at `example/dist/`.

## Scope boundary (resolves the assert-location question)
- The composite is the **pure build definition** (spec.md "Build definition"
  entity). It does **NOT** run artifact assertions.
- Artifact assertions (`pnpm assert:artifacts example/dist`) run as a step in the
  **build-example job (WP04)**, after the composite — so the PR gate asserts, and
  **deploy (WP05) reuses the build without inheriting the PR-gate assertion** (a
  legitimate content-count change must not fail the mainline publish).

## Acceptance (maps to spec)
- FR-015 (deploy reuses the build definition), FR-010/FR-011 (assertions in the PR
  build lane), SC-007.
