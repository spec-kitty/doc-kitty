---
title: Authoring a document
description: Create a page that satisfies DocKitty, write Gherkin behaviour specs that publish as Specification pages, and show scenarios in any page.
doc_status: active
updated: 2026-10-14
type: Guide
kind: How-To
tags: [authoring, workflow, gherkin, bdd]
related:
  - context/convention
  - adr/0033-flexible-section-identity
  - adr/0034-redirect-coverage-gate
  - adr/0046-gherkin-feature-pages
  - adr/0051-gherkin-in-any-page
  - architecture/gherkin-pages
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

- **A folder whose only page is its index is shown as that link, not as a
  group.** A group would open onto the same name again. The link keeps the
  folder's place among the sub-folders, so `sidebar.order` on its index still
  orders it. This applies to nested folders; a top-level section is always a
  group.
- **The index page reads "Overview" when its label repeats the group's.** The
  heading above already names the section ("Guides"), so its index entry reads
  "Overview" in place of "Guides" again. Previous and next links still use the
  page title. If another page in the group is already labelled "Overview", the
  index keeps its own label; give that page a `sidebar.label` to avoid the
  clash.
  A deliberate `sidebar.label` on the index page is treated the same way: when it
  equals the group's label (the group takes its label from that same page), it
  also reads "Overview". Give the index page a label that differs from its
  group's if you want it kept.
  The word "Overview" is English only for now; translating it is tracked in
  [#161](https://github.com/spec-kitty/doc-kitty/issues/161), so a site in another
  language shows "Overview" in the sidebar for now.
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
- **A draft page is listed** unless the site is built with
  `DK_PUBLISH_DRAFTS=off`, as a live deployment is. See
  [Draft publication](./draft-publication.md).

A site that passes its own `sidebar` to `defineDocKittyIntegrations` (or through
the `starlight` option) gets exactly the sidebar it wrote: none of the labelling
or ordering above is applied to it.

A generated glossary context is a folder with one page, so it is listed as a
link under the glossary. Its label is the context `name` from
`.contextive/definitions.yaml`; write the name as you want readers to see it.

## Using an `index.md`-indexed tree

A directory's landing page is its `README.md` by default. If your tree already
names section indexes `index.md`, set `indexBasename: ['index']` once, in
`defineDocKittyIntegrations` in `astro.config.mjs`, instead of renaming every file —
matching is case-insensitive and `README` stays the default so an unconfigured tree
is unaffected. Every index-detecting surface (the loader, the validator, the
scaffolder, `new-doc`, the link check) reads that one setting. Do not set it on the
loader. If a folder holds both a `README.md` and an `index.md`, the build stops and
names both files. See [ADR-0050](../adr/0050-route-collisions-and-single-index-setting.md),
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
   # A build with drafts published (the default)
   pnpm exec dockitty-check-redirect-coverage <baseline-file> <dist-dir>

   # A build without drafts (DK_PUBLISH_DRAFTS=off, as on the live site)
   DK_PUBLISH_DRAFTS=off pnpm exec dockitty-check-redirect-coverage <baseline-file> <dist-dir> \
     --docs <docs-dir> \
     --declared-redirects <redirects.json>
   ```

   The gate resolves `DK_PUBLISH_DRAFTS` the way the build does: the process
   environment, then the env files of the site, then `on`. Its first line
   states the value, where it came from, the site directory and the mode, for
   example `DK_PUBLISH_DRAFTS=on (from: default; site root: .; mode:
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
   and names the missing flag. The gate reads your index names from
   `astro.config.*`. See
   [Draft publication](./draft-publication.md).

   If a package script already names a directory, a directory you add is
   appended and the gate checks the script's own.

## Authoring behaviour specs

A site that turns on the `gherkin` option (see
[consumer setup](./consumer-setup.md#optional-gherkin-feature-pages)) publishes its
Gherkin `.feature` files as `kind: Specification` pages. You write the `.feature`
file; the toolkit writes the page. The design is in
[Gherkin feature pages](../architecture/gherkin-pages.md) and
[ADR-0046](../adr/0046-gherkin-feature-pages.md).

### Where the files live

`.feature` files stay where your test runner expects them, in the directories
listed in `gherkin.sources`. The example site keeps them in `example/features/`.
The directory layout carries over: `features/shipping/book-consignment.feature`
becomes `docs/behaviour/shipping/book-consignment.md` (`behaviour` is the default
section). Every directory with at least one published (non-draft) feature below
it gets a generated hub page. A directory holding only `@wip` or
`@dk:status=draft` features gets no hub, and its parent hub doesn't link it.

A feature's description is Markdown passthrough, so raw HTML in a description
lands on the page, on its hub entry and in the page's `description`. Names, steps
and table cells are escaped. Take `.feature` files only from sources you trust as
much as your docs.

Don't edit or add files under the generated section. Changes are overwritten on
the next run, and any file in that folder without the generator's
`generated.by` stamp fails the build, and so does a symlink. Some names fail
too:

- a feature file named like an index page (`README.feature`, or `index.feature`
  when the site accepts `index`);
- a feature file named `log.feature`, because `log.md` is the reserved change-log
  name the docs loader skips;
- a feature file next to a directory of the same name (`shipping.feature` beside
  `shipping/`), because the page and that directory's hub would share one URL
  (this fails even while the directory holds only drafts and has no hub yet);
- two sources that map to the same output path.

### Metadata tags

Gherkin has no frontmatter, so page metadata goes in **feature-level tags** in the
`@dk:<key>=<value>` namespace. Test runners ignore unknown tags, so they don't
change how the feature runs.

```gherkin raw
@dk:context=shipping @dk:persona=example-persona @dk:mission=mission-alpha
@dk:adr=1 @FR-003
Feature: Book a consignment
  As a shipper
  I want to book cargo onto a sailing
  So that my goods travel on a confirmed slot

  A booking reserves space on one sailing for one consignment.
```

| Tag | Becomes | Notes |
|-----|---------|-------|
| `@dk:context=<ctx>` | `glossary_context` | The glossary context used to resolve terms in the step text. At most one. |
| `@dk:status=<s>` | `doc_status` | Wins over `@wip` and `@deprecated`. The value must be a lower-case slug such as `active` or `in-review`; anything else warns and makes the page a draft, as do two `@dk:status` tags that disagree. A non-canonical slug passes through, and the frontmatter gate warns about it. |
| `@wip` | `doc_status: draft` | Draft pages are left out of the sitemap, feeds and agent API. |
| `@deprecated` | `doc_status: deprecated` | |
| *(none)* | `doc_status: active` | A committed feature is live behaviour. |
| `@dk:persona=<slug>` | an `audience` entry | Repeatable. The guidance text is the feature's `As a … I want … So that …` narrative, or a fixed sentence when there is none. The persona page must exist. |
| `@dk:mission=<slug>` | `related: plans/missions/<slug>` | Repeatable. The prefix comes from the registry's `Mission` subtype; with none it is `plans/` and the generator warns. |
| `@dk:adr=<n>` | `related: adr/<NNNN-…>` | Repeatable. `1` resolves to the `adr/0001-*.md` file. An unknown number stays `adr/<NNNN>` and fails the link gate. |
| `@dk:related=<slug>` | `related: <slug>` | Repeatable. Links any other page. |
| `@dk:updated=<YYYY-MM-DD>` | `updated` | Optional. Without it the page is exempt from `updated`. |
| `@dk:autolink=false` | `glossary_autolink: false` | Turns off glossary auto-linking for the page. |
| `@dk:priority=<0..1>` | `agent.priority` | Optional agent hint. |
| any other tag | `tags` | Passed through without the `@`, such as `@smoke` or `@FR-003`. |

`@dk:` values run to the end of the tag, after the first `=`. A misspelt key, a
missing value, a second copy of a single-valued key, or an invalid `updated`,
`priority` or `autolink` value is a build warning and is ignored. Every
`related` and `audience` target must resolve, through the same gates as
hand-written refs.

Only **feature** tags are metadata. Tags on a Rule, Scenario or Examples block,
`@dk:` ones included, are shown on the page as inline code.

Put a `@dk:context` on every feature. Without it, a step that uses a term defined
in more than one glossary context is left unlinked and logs a collision warning.
Across a large suite, that floods the build log.

### Feature pages in the RSS feed

The example site lists its feature pages (and their hubs) in `rss.xml`, because
its `behaviour` section feeds `rss` in `_meta/sections.yaml`. A generated page has
no date unless you give it one, so by default its feed item has no `<pubDate>` and
sorts after every dated item. A new `.feature` file shows up as one new undated
item. A new scenario in an existing feature changes nothing a subscriber sees. To
have subscribers notice added scenarios, tag the feature
`@dk:updated=<YYYY-MM-DD>` when you add them; the item then carries that date and
sorts by it. Draft (`@wip`) features stay out of the feed. A site that doesn't want
specs in its feed removes `rss` from the section's `feeds`.

### Write declarative scenarios

The page is read by people, not only run by the test suite. Describe behaviour in
domain terms, not user-interface mechanics:

```gherkin raw
# Reads well, and links glossary terms
When the shipper books the consignment onto the sailing
Then the booking is confirmed

# Reads badly once published
When I click "#book-button"
And I fill in "size" with "12"
```

Click paths and CSS selectors publish as they are written. Nothing checks for
them yet, so the style is the author's responsibility.

### What renders as written, and what as Markdown

- **Literal text.** Step text, feature, rule, scenario and examples names, and table
  cells are shown exactly as typed. Characters that would trigger Markdown,
  HTML, directives or Markua attributes are escaped, so `*`, `_`, `<tag>`,
  `[x]`, `~`, `{…}` and `word:name` appear literally. A URL, a `www.` host or an
  email address in step text stays plain text, not a link. Put links in a
  description instead.
- **Markdown.** Descriptions under a Feature, Rule, Scenario or Examples line are
  dedented and passed through as Markdown, so links, emphasis and lists work.
  This is the same trust level as any page in `docs/`.
- **Doc strings** become fenced code blocks, verbatim. The media type
  (`"""json`) is the fence language; without one it is `text`.
- **Quoted arguments** such as `"spec-kitty init --force"` render as inline code
  with their quotes, so the command or value is copied exactly as the step
  matches it. The same holds in data-table and Examples cells. Text outside quotes is typeset like the rest of the page, so a bare
  `--force` turns into a dash: quote it.
- **Outline placeholders** such as `<size>` render as inline code, and the
  outline is shown once with its examples table. It is not expanded per row.
- **Comments** (`# …`) aren't rendered.

The first sentence after the narrative becomes the page `description`. Keep it
under 180 characters; a longer one is truncated with a warning. Give scenarios
under the same parent distinct names: duplicates become duplicate headings, which
markdownlint rejects.

### Regenerating and the drift gate

Pages regenerate on every build and every dev-server start. Editing a watched
`.feature` restarts the dev server; a new file shows up after the next restart.
Without a build, regenerate with the generator script. In this repository that is:

```sh
pnpm generate:features
```

A consumer site runs the `dockitty-generate-feature-pages` binary with flags
matching its `gherkin` option. Commit the regenerated pages with the `.feature`
change. CI checks that they match:

```sh
pnpm validate:features
```

It fails, listing each added, changed, stale or authored path, when the committed
pages differ from what the sources produce.

The `gherkin raw` fences on this page show Gherkin source; see
[Gherkin in any page](#gherkin-in-any-page) for why they carry `raw`.

## Gherkin in any page

With the `gherkin` option on, Gherkin also renders inside ordinary pages
(`gherkin: true` turns on fences only; includes need `includeRoots` or `sources`): a ```` ```gherkin ```` fence becomes a structured
scenario, and a `::gherkin` directive includes a `.feature` file from the
repository. Both use the markup of a generated page: the feature title and each
scenario as headings, steps as a bulleted list with the keyword in bold, data
tables and Examples as tables, and doc strings as code blocks. `#` comments are
never shown. The example site's
[Scenarios in pages](https://spec-kitty.github.io/doc-kitty/guides/scenarios-in-pages/)
shows every case. The design is [ADR-0051](../adr/0051-gherkin-in-any-page.md).

### Fences

A fence may hold a whole feature or only part of one:

- **A whole feature** renders its title, tags, narrative, description, a scenario
  count and every scenario.
- **Scenarios without a `Feature:` line** render as if they sat in an untitled
  feature: no feature heading, just the scenarios.
- **Steps without a `Scenario:` line** render as a single step list with no
  heading, for prose that walks through one flow. The first line must be a step.

Add `raw` to the info string (```` ```gherkin raw ````) to keep a fence as a
highlighted code block, for example when the point is the syntax, the comments
or the `@dk:` tags, as in the fences above. A fence that holds nothing but
comments or blank lines also stays a code block. A fence that holds no scenario
or step at all, only prose, a table or `Examples:` with a table, stops the build:
it would render as nothing. Mark it `raw`.

Under a `Feature:` line, steps need a `Scenario:` line. Without one, Gherkin reads
them as the feature's description, so they render as a paragraph, and the build
warns when the feature has no scenario, background or rule at all. A description
that merely opens with a step keyword, such as a Dutch narrative `Als verlader
wil ik …`, does not warn.

Feature-level `@dk:` tags have no effect in a fence: the page's frontmatter is its
metadata. They are left out of the rendered tags, with a build warning.

### Includes

```md
::gherkin{src="features/shipping/book-consignment.feature"}
::gherkin{src="features/shipping/book-consignment.feature" scenario="Book cargo that fits"}
::gherkin{src="features/shipping/book-consignment.feature" tags="@smoke @edge"}
```

The directive is a leaf directive: two colons, on a line of its own. It takes
three attributes:

| Attribute | Meaning |
|-----------|---------|
| `src` | Required. The `.feature` file, relative to the project root (the directory the build runs in), with `/` separators. Its name must end in `.feature`. |
| `scenario` | One scenario or outline, by its exact, case-sensitive name. Scenarios inside a Rule count. An outline keeps all its Examples. |
| `tags` | Space-separated tags; a scenario or Examples row is kept when it carries **any** of them, counting the tags it inherits from its Feature, Rule and Examples block. The `@` is optional and matching is case-sensitive. An outline keeps only its matching Examples blocks. Tag expressions are not supported: `and`, `or`, `not` and parentheses stop the build. |

Without `scenario` or `tags`, the whole file renders, feature title and narrative
included. With either, the feature header is dropped, the Feature's Background
always stays, a Rule stays only when it still holds a selected scenario, and the
source line names the feature instead (`From Book a consignment, …`). Use one of
`scenario` and `tags`, not both. Every include ends in a source line naming the
file, linked when the site sets `sourceUrlPrefix`.

An include's `src` is a path relative to the project root (not to the page) and
must sit inside one of the site's `gherkin.includeRoots` (directories relative to
the project root; by default the `sources` directories, and none with
`gherkin: true`, which turns on fences only). Symbolic links are resolved first, so a link that
points outside every root is refused, even when its target does not exist. Feature-level `@dk:` tags in an included
file are dropped silently, because the same file may also feed a generated page.
Includes do not nest.

A `:gherkin` with a single colon in running text, such as `lang:gherkin`, is left
as text.

### Errors fail the build

A fence that does not parse, and any include that cannot be resolved, stops the
build with a `[dk-gherkin]` error naming the page, the line and the reference:

- a `src` that does not exist, is not a file, does not end in `.feature` or is
  larger than 1 MiB, a path outside `includeRoots`, or an absolute path, URL or
  backslash in `src`;
- an include root that does not exist, for an include whose `src` lies below it
  (other includes, and pages with no include, are unaffected);
- a `scenario` that matches nothing (the error lists the scenario names) or more
  than one scenario (it lists their lines), and `tags` that match nothing or that
  hold a tag expression (`and`, `or`, `not`, parentheses);
- a fence with no scenario or step in it (only prose, a table or Examples);
- `scenario` and `tags` together, an unknown attribute, a missing `src`, the
  container form `:::gherkin` or a text form with attributes (`:gherkin{…}`);
- a Gherkin syntax error in the fence or the included file, at its own line.

The build lists every broken page together at the end of `astro build` and exits
non-zero. In `astro dev` the error is logged and the page fails to render, and
nothing exits. A changed
scenario name or tag that an include depends on is therefore caught by the next
build.

### Headings and containers

The headings nest under the page's outline: a block's top heading is one level
below the heading it sits under (never above level 2, never below level 6), so a
fence under an `##` heading has an `###` feature title and `####` scenarios.
Inside a list item, a quote or an aside, the headings render as paragraphs with a
heading role, so they keep the reading order without entering the "On this page"
list. Two embeds of the same scenario on one page get heading ids with numbered
suffixes, so their anchors stay unique.

Step text is not glossary-linked in a fence or an include, unlike on a generated
page (#113). Text is typeset as in the rest of the page (curled quotes, dashes),
except quoted arguments in steps and table cells, which are code.

### Decks, generated pages and agents

- On a slide deck a ```` ```gherkin ```` fence stays a code block, and a
  `::gherkin` include is a build error.
- A generated behaviour page is left as the generator wrote it.
- The agent page payload (`/api/pages/<slug>.json`) carries each include
  expanded as Markdown in place of the directive, and lists them under
  `includes` as `{ src, scenario?, tags? }`, with `tags` as written in the
  attribute. Fences stay as fences in the Markdown. Includes in an `.mdx` page are
  not expanded there.
- Embedded scenarios are searchable with the rest of the page, but they are not
  listed in `/api/scenarios.json`, which covers generated pages only.
