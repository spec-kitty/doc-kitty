---
title: Authoring a document
description: Create a page that satisfies the Common Docs — Kitty Variation.
doc_status: active
updated: 2026-08-21
type: Guide
kind: How-To
tags: [authoring, workflow]
related:
  - context/convention
  - adr/0033-flexible-section-identity
  - adr/0034-redirect-coverage-gate
---

# Authoring a document

1. **Pick the section.** Choose the Common Docs section the page belongs to
   (`context`, `architecture`, `guides`, …). A directory's landing page is its
   `README.md`.

2. **Scaffold it** with compliant frontmatter:

   ```sh
   node src/scripts/new-doc.mjs guides/deployment --title "Deployment"
   ```

   `type` is inferred from the path; override with `--type`. Use `--section` for
   a section `README.md`.

3. **Fill in metadata.** Required: `title`, `description`, `status`, `updated`,
   `type`. Add optional fields (`tags`, `related`, `authors`, `agent`, …) only
   when there's a real value. See [the convention](../context/convention.md).

4. **Validate:**

   ```sh
   node src/scripts/validate-frontmatter.mjs docs
   ```

   CI runs the same gate.

5. **Preview** with `pnpm --filter example dev` and confirm the page renders
   where you expect (a `README.md` maps to its directory route).

## Using an `index.md`-indexed tree

A directory's landing page is its `README.md` by default. If your tree already
names section indexes `index.md`, set the `indexBasename` loader option to
`"index"` instead of renaming every file — matching is case-insensitive and
`README` stays the default so an unconfigured tree is unaffected. Every
index-detecting surface (the loader, the validator, the link checker, the
scaffolder, `new-doc.mjs`) honours the configured basename. See
[ADR-0033](../adr/0033-flexible-section-identity.md) and the
[convention](../context/convention.md#2-kitty-twists).

## Renaming a section folder

Renaming a section folder — including a sub-path type such as
`plans/features` → `plans/missions` — is a data edit, not a code edit:

1. Rename the folder and update its `id` in `docs/_meta/sections.yaml`.
2. For a sub-path type rename, add or update the section's `subtypes` list
   (`match` the sub-path segment, declare its `type`).
3. Add a redirect entry (below) for every URL the rename orphans, and capture
   or update the URL baseline before merging.

No derivation code changes. See [ADR-0033](../adr/0033-flexible-section-identity.md)
and the [section registry](../architecture/section-registry.md).

## Keeping old URLs resolving after a migration

If you are migrating from a host that preserved different URLs (or renaming a
section per above), prove the old URLs still work before you ship:

1. **Commit a URL baseline** — the list of old URLs that must keep resolving,
   captured before the change.
2. **Declare a redirect** from each old URL to its new location, via Astro's
   native `redirects` config.
3. **Run the coverage gate:**

   ```sh
   node src/scripts/check-redirect-coverage.mjs <baseline-file> <dist-dir>
   ```

   It fails and names any baselined URL with neither a live page nor a redirect
   whose target resolves (a redirect to a dead page is a failure, not a pass).
   CI runs the same gate. See [ADR-0034](../adr/0034-redirect-coverage-gate.md).
