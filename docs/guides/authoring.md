---
title: Authoring a document
description: Create a page that satisfies DocKitty.
doc_status: active
updated: 2026-10-13
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

## How your pages appear in the sidebar

The sidebar is generated from your pages. You steer it with frontmatter; you do
not maintain a navigation file.

- **A nested folder becomes a group, labelled by its index page.** The label is
  the index page's `sidebar.label` if it has one, otherwise its `title`. Give
  every folder an index page (`README.md`, or `index.md` if your tree uses that
  basename). A folder without one is labelled from its name (`book-one` becomes
  "Book one") and the build prints a `[dk-sidebar]` notice naming the folder.
- **Order sibling folders with `sidebar.order` on their index pages.** Lower
  numbers come first. Folders without an order follow, alphabetically by label.

  ```yaml
  # handbook/operations/index.md
  title: "Part two: Operations"
  sidebar:
    order: 2
  ```

- **Within a group the order is always: the index page, then the other pages,
  then the sub-folders.** Pages keep the order Starlight gives them (their own
  `sidebar.order`, then alphabetical). Because pages always come before
  sub-folders, `sidebar.order` cannot place a page between two sub-folders, or a
  sub-folder above a page. If you need that reading order, make the page a
  folder with its own index, or move it into one of the folders.
- **Top-level groups** come from the section registry
  (`docs/_meta/sections.yaml`): their label and order are set there, not by an
  index page.
- **A page with no `##` or `###` heading gets no "On this page" rail.** Its
  outline would hold a single "Overview" link, so the rail is left out and the
  text uses the width.
- **A draft page is not listed** unless the site is built with drafts on. See
  [Draft publication](./draft-publication.md).

A site that passes its own `sidebar` to `defineDocKittyIntegrations` (or through
the `starlight` option) gets exactly the sidebar it wrote: none of the labelling
or ordering above is applied to it.

Known limitation: the groups of generated glossary contexts are labelled with the
context id (for example `shipping`), because their index pages are generated
with the id as title.

## Using an `index.md`-indexed tree

A directory's landing page is its `README.md` by default. If your tree already
names section indexes `index.md`, set the `indexBasename` loader option to
`"index"` instead of renaming every file — matching is case-insensitive and
`README` stays the default so an unconfigured tree is unaffected. Every
index-detecting surface (the loader, the validator, the scaffolder,
`new-doc.mjs`) honours the configured basename; the link checker accepts either
basename unconditionally. See
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
3. **Run the coverage gate** against the built output:

   ```sh
   # A build with drafts published (DK_PUBLISH_DRAFTS=on)
   DK_PUBLISH_DRAFTS=on pnpm exec dockitty-check-redirect-coverage <baseline-file> <dist-dir>

   # A build without drafts (the default)
   pnpm exec dockitty-check-redirect-coverage <baseline-file> <dist-dir> \
     --docs <docs-dir> --index-basename README,index \
     --declared-redirects <redirects.json>
   ```

   The gate resolves `DK_PUBLISH_DRAFTS` the way the build does: the process
   environment, then the env files of the site, then `off`. Its first line
   states the value, where it came from, the site directory and the mode, for
   example `DK_PUBLISH_DRAFTS=off (from: default; site root: .; mode:
   production)`. Compare it with the `[dk-drafts]` line of the build. Two
   optional flags steer it:

   - `--site-root <dir>` names the directory that holds `astro.config.*` and
     the env files. Without it the gate uses the nearest such directory above
     `<dist-dir>`, or the working directory when there is none. Pass it when
     the build output is outside the site directory.
   - `--mode <mode>` names the env-file mode, `production` by default. Pass
     `--mode development` to check against what `astro dev` reads.

   It fails and names any baselined URL with neither a live page nor a redirect
   whose target resolves (a redirect to a dead page is a failure, not a pass).
   CI runs the same gate. See [ADR-0034](../adr/0034-redirect-coverage-gate.md).

   With drafts off, a redirect that ends at a draft page has no stub, so its old
   URL returns 404 until the page is published. The gate accepts that case and
   lists each such URL as *unpublished*, but only when it can prove it: `--docs`
   gives the tree it reads `doc_status` from, and `--declared-redirects` gives
   the old-URL-to-route map (a JSON object, or a `_redirects` text file; targets
   without the site base). Leave either flag out and the gate fails those URLs
   and names the missing flag. `--index-basename` is only needed when your
   section indexes are not all named `README`. See
   [Draft publication](./draft-publication.md).

   If a package script already names a directory, a directory you add is
   appended and the gate checks the script's own.
