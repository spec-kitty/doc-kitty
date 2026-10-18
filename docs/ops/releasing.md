---
title: Releasing the toolkit to GitHub Packages
description: How a maintainer publishes @spec-kitty/doc-toolkit to the GitHub Packages npm registry by pushing a version tag, and why it needs no publish secret.
doc_status: active
updated: 2026-10-11T00:00:00Z
type: Operations
kind: How-To
authors:
  - human:stijn
tags: [release, github-packages, ops, github-actions]
related:
  - ops/ci-cd
  - guides/consumer-setup
---

# Releasing the toolkit to GitHub Packages

For a maintainer. The toolkit package in `src/` (`@spec-kitty/doc-toolkit`) is
published to the **GitHub Packages npm registry** (`npm.pkg.github.com`) by the
release workflow, `.github/workflows/release.yml`, when you push a `v<version>`
tag. This page covers the one-time setup and the steps for each release.

## Why GitHub Packages, and what it costs

The package is distributed through GitHub Packages rather than the public npm
registry. The trade-off:

- **Publishing needs no external secret.** The workflow authenticates with the
  run's built-in `GITHUB_TOKEN`, scoped by `permissions: packages: write` on the
  `publish` job only. There is no `NPM_TOKEN` to create or rotate.
- **Installing needs a token.** GitHub Packages does not serve npm packages
  anonymously, even public ones. Every consumer — and every CI job — authenticates
  with a GitHub token that has `read:packages`. The
  [consumer setup guide](/guides/consumer-setup/) covers the `.npmrc` they need.

GitHub's own reference is
[Working with the npm registry](https://docs.github.com/en/packages/working-with-a-github-packages-registry/working-with-the-npm-registry).

## One-time setup

1. **Scope matches the owner.** GitHub Packages requires the package scope to
   match the repository owner, and the `repository` field in `src/package.json`
   to point at this repository — both link the package to `spec-kitty/doc-kitty`
   and let it inherit the repo's visibility and permissions. `@spec-kitty` already
   matches. Change the `repository` field only if the repository moves.
2. **No publish secret.** Nothing to add. `GITHUB_TOKEN` is injected into every
   run; the workflow widens it to `packages: write` for the `publish` job alone,
   and fork PRs never trigger the release workflow.
3. **Confirm visibility after the first publish.** `--access public` is an
   npm-CLI flag that GitHub Packages does not use to set visibility — a package
   can be created private on its first publish. After the first release, open the
   package on the repository's
   [Packages page](https://github.com/spec-kitty/doc-kitty/packages) and, if it is
   private, set it to public there. This is a one-time check; later releases keep
   the visibility you set.

`publishConfig` in `src/package.json` pins the registry
(`https://npm.pkg.github.com`) and `access: public`, so a stray `npm publish` from
a checkout cannot go to the public npm registry by mistake.

## Cutting a release

1. **Bump the version.** Set `version` in `src/package.json`. Under `0.x`, use
   the minor number for breaking changes and the patch number for everything else.
2. **Resync the consumption fixture.** A version bump changes the packed
   tarball, so regenerate the fixture lockfile:
   `DK_CONSUMPTION_BOOTSTRAP=1 node tests/consumption/scripts/run-consumption-test.mjs`.
   Commit the resulting `tests/consumption/consumer-fixture/pnpm-lock.yaml` change,
   which should touch only the toolkit's `integrity` and `version` lines.
3. **Update the CHANGELOG.** Move the `[Unreleased]` entries under a
   `## [<version>] — <date>` heading and add the compare link at the bottom. The
   workflow fails if the heading is missing.
4. **Merge through a PR** with `ci-ok` and the consumption test green.
5. **Rehearse (optional).** Run the *Release* workflow manually from the Actions
   tab. A manual run executes every gate plus `npm publish --dry-run` and never
   publishes.
6. **Tag and push** the merged commit on `main`:

   ```sh
   git tag -a v<version> -m "v<version>"
   git push origin v<version>
   ```

   The workflow checks that the tag equals `src/package.json` `version`, re-runs
   typecheck, lint, unit tests, and the clean-room consumption test with its
   self-test, then publishes the verified tarball to GitHub Packages with
   `GITHUB_TOKEN`. A prerelease version (one with a `-`, e.g. `0.2.0-rc.1`)
   publishes under the `next` dist-tag so `latest` never moves to it.
7. **Verify** on the repository's
   [Packages page](https://github.com/spec-kitty/doc-kitty/packages) (or with an
   authenticated `npm view @spec-kitty/doc-toolkit@<version>` against the GitHub
   Packages registry), then create the GitHub release for the tag with the
   CHANGELOG section as its notes.

## When a release fails

- **Tag/version mismatch.** Delete the tag (`git push origin :v<version>`), fix
  the version on `main` through a PR, and tag again.
- **A gate fails.** Nothing was published. Fix forward through a PR and tag the
  fixed commit. Delete and recreate the tag only when no publish happened.
- **Published by mistake.** A published version number cannot be reused. Delete
  the bad version from the repository's Packages page and release the next patch
  instead.
