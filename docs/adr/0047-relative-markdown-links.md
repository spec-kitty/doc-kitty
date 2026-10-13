---
title: "ADR-0047: Relative Markdown links are rewritten at build"
description: The build rewrites a relative .md or .mdx link between pages to the target's route, so one link works on GitHub and on the site; amends ADR-0037.
doc_status: active
updated: 2026-10-13
type: ADR
kind: ADR
authors:
  - stijn@sddevelopment.be
related:
  - adr/0037-base-aware-link-fail-closed-gate
  - adr/0038-decks-markua-capable
  - adr/0002-readme-as-index
  - adr/0035-vocabulary-core-consolidation
  - guides/consumer-setup
---

# ADR-0047: Relative Markdown links are rewritten at build

## Status

**Accepted** — 2026-10-13. Introduced by the generated-page-and-link-integrity
mission (issue #131). **Amends [ADR-0037](./0037-base-aware-link-fail-closed-gate.md)**
in three places, listed below. ADR-0037 is left as written, as ADR-0038 left
ADR-0030.

What this ADR amends in ADR-0037:

- **Decision 1, the "Hand-authored content links" bullet**, which sets
  root-absolute routes as the authoring form. That form stays valid. It is no
  longer the only one.
- **Option A**, the rejection of `.md`-relative authoring. The evidence behind
  the rejection still holds. The conclusion no longer does.
- **The `check-links` paragraph in Decision 2**, which scoped the source check's
  relative-link rules to `example/docs` only. It also said a `.md`-relative link
  "fails outright" there. That is reversed: on a strict root, which includes
  `example/docs`, a `.md` link to a published page now passes.

What stands: the base seam (`withBase` and the base-absolute rehype pass), and
the built-output gate (`assert-no-broken-links`) as the authority on whether a
link works.

## Context

ADR-0037 rejected `.md`-relative authoring because Astro does not rewrite such
a link. A rendered `href="x.md"` 404s on the live site. That finding is
correct and still holds. The ADR never weighed the option of the toolkit doing
the rewrite itself.

Adoption showed what the rule costs. The first consumer rewrote 61 links by
hand. Root-absolute routes such as `/guides/setup/` also break the file when a
reader opens it on GitHub, where `.md`-relative links are the working
convention. An author had to pick between the repository view and the built
site.

## Decision

1. **Both link forms are accepted.** A root-absolute route works as before. A
   relative link to another page's `.md` or `.mdx` file is now rewritten to that
   page's route when the site is built.
2. **One resolution rule.** `resolveRelativeDocLink` in `vocabulary-core.mjs`
   decides, and both consumers call it: the build's remark plugin and the
   source check (`dockitty-check-links`). They give the same answer when the check
   runs with `--strict`, the site's index names and the site's draft setting.
   - The link resolves relative to the folder of the file that holds it.
   - Only a path ending in `.md` or `.mdx` is considered. Query and fragment are
     kept as written. The path is URL-decoded before lookup, and the route is
     encoded again.
   - The target must be a published page in the route table. The table comes from
     the same index-name rule the loader uses. A file named with one of the site's
     index names collapses to its folder's route. A nested `index.md` is served at
     its folder's route even when `index` is not one of the site's index names,
     because Starlight serves an id ending in `/index` there.
   - The route table is built from one shared walk of the docs tree
     (`src/lib/docs-walk.mjs`). The walk skips `log.md` and any path with a
     dot-prefixed segment: a dot-folder, or a file whose name starts with `.`.
     Astro's glob loader does not load those files, so a route for them would be a
     route the site never emits. Such a file has no route, and a link to it is not
     rewritten.
   - Anything else returns `null` and the link is left exactly as written: a file
     that is not a page, a path outside the docs root, a draft that is not
     published, a path that leaves the root and re-enters, a malformed `%` escape.
     The built-link gate then reports it, which keeps that gate the authority.
3. **Where it runs.** A remark plugin (`relative-md-links.ts`) visits `link` and
   `definition` nodes, so inline and reference-style links are both covered. The
   source file's path comes from the Markdown file being rendered. The plugin
   applies the base path itself, and the base-absolute rehype pass leaves an href
   that already starts with the base alone.
4. **What it does not touch.** Raw HTML anchors and images are not rewritten. The
   agent page API returns a page's links as written.
5. **The route table travels as plain data** in the plugin options. Astro keys its
   content cache on the configuration, so a renamed or re-drafted target changes
   the options and the next build re-renders the pages that link to it.
6. **The source check has two modes.** A root is strict when `--strict` is given,
   and always for the toolkit's own `example/docs` site root. Every other root is
   non-strict.
   - **A non-strict root** is a repository's docs folder read as files, as on
     GitHub. It behaves as in 0.2.0. A relative link, a reference-style
     definition or a `related:` ref passes when the file or folder it names
     exists. A missing target is dangling. Nothing else is reported, and draft
     status is not consulted. The one addition is that reference-style
     definitions (`[label]: target`) are checked too; footnote definitions are
     not links. If an Astro config file sits next to the root, the check prints
     one note that the folder looks like a built site and that `--strict` makes
     the check agree with the built-link gate. The note does not change the exit
     code.
   - **A strict root** is a tree built as a site. A relative `.md` or `.mdx` link
     passes exactly when the build would rewrite it to a published page. The check
     also reports a link to a file that is not a published page (for example
     `log.md`), a path that goes up out of the docs root and comes back in, a link
     to an existing file outside the docs tree, a malformed `%` escape, a folder
     link whose folder has no index page, a bare relative link with no extension,
     and, when drafts are not published, a link to a draft page. A folder
     link is answered from the same route table as `.md` links. A `related:` ref
     is matched against page ids, as the build does, so `x/index` names an
     `index.md` that is not a section index and `x` does not. A root-absolute link
     is checked only for a draft target; whether its route exists is left to the
     built-link gate. Lookup is case-sensitive, as in the build.
   - **Flags.** `--strict`; `--index-basename <name[,name…]>`, which assumes
     `README,index` when absent and exits 2 for a name that is not a plain file
     name; and `--help`. Unknown options and the `--name=value` form exit 2.
   - **Output.** The failure summary reads "N link problem(s) in M file(s); F
     file(s) scanned, C reference(s) checked."

## Consequences

### Positive

- One link works on GitHub and on the built site. An adopter does not rewrite
  links to routes by hand.
- The build and the source check call one function. They give the same answer
  when the check runs with `--strict`, the site's index names and the site's
  draft setting.
- A link the rewrite cannot resolve still reaches the built-link gate unchanged,
  so no broken link is hidden by the rewrite.
- No new dependency.

### Negative

- A root checked with `--strict` reports links that the 0.2.0 check passed on a
  plain root: a relative `.md` link that does not lead to a published page, a path
  that leaves the docs root and comes back, a link to a file outside the tree, a
  malformed `%` escape, a folder with no index page, a draft target and a bare
  extensionless link. A site that adds `--strict` should expect new reports. A
  non-strict root differs from 0.2.0 only in checking reference-style
  definitions.
- A site that builds its docs has to pass `--strict` to make the source check
  agree with the built-link gate. Without it the check reads the folder as files.
- Index names are now stated in three places: site config, content config, and
  `--index-basename`. They must agree.
- A rename shows in the local dev server only after a restart. The route table is
  built when the configuration loads.

### Risks

- **`.mdx` coverage is thin.** One test covers a hand-built `.mdx` file. That
  `.mdx` pages inherit the plugin list is established by reading the framework
  source, not by a build.
- **Other surfaces still build a page address as `/<id>/`.** This predates the
  change and is not fixed here. The Hub layout, RSS, `llms.txt`, related links,
  one metadata helper, the on-this-page block
  (`src/components/slots/OnThisPage.astro`) and the scenario index route
  (`src/lib/routes/scenario-index.ts`) do it. The sidebar's index detection also
  does not know that a nested `index.md` is served at its folder route. For an id ending in `/index` they point at a
  route Starlight does not serve. The shared route rule in this change mirrors
  Starlight, and these surfaces have not moved to it yet.
- **Two files in one folder can share a route.** `x/README.md` and `x/index.md`
  both map to `/x/` on a site whose only index name is `README`, and no collision
  is reported. A route counts as a draft route only when no published file
  resolves to it.

## Alternatives considered

### Option A: keep root-absolute links only (ADR-0037 as written)

Rejected. It leaves every adopter to rewrite its links by hand, 61 in the first
consumer, and breaks the GitHub view of every cross-link.

### Option B: rewrite in the rehype pass

Rejected. At the rehype stage a raw HTML anchor looks like any other anchor, so
the pass would rewrite it. It would also mix a second concern into the
base-prefix pass. The remark stage sees `link` and `definition` nodes, which
covers reference-style links and leaves HTML alone.

### Option C: ask authors to write relative links and leave the source check unchanged

Rejected. The source check would keep passing links that the build cannot
rewrite, such as a link to `log.md`, and the failure would surface only in the
built-link gate. The two-mode rule keeps the GitHub reading of a plain docs
folder and gives a built site the strict answer.

### Option D: rewrite raw HTML anchors too

Left out. An author who writes an HTML anchor chose that form.

## References

- [ADR-0037](./0037-base-aware-link-fail-closed-gate.md): base seam and the built-link gate.
- [ADR-0038](./0038-decks-markua-capable.md): the amending precedent followed here.
- [ADR-0002](./0002-readme-as-index.md): `README` as the section index.
- [ADR-0035](./0035-vocabulary-core-consolidation.md): the shared vocabulary core.
- [Consumer setup](../guides/consumer-setup.md): the adopter-facing description.
