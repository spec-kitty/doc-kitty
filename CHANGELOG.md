# Changelog

All notable changes to `@spec-kitty/doc-toolkit` are recorded here. The format
follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and the project
adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

The next release is `0.3.0`, because the Breaking entries below change what an
existing site's build does, and under `0.x` the minor number marks a breaking
release, as it did for `0.2.0`.

### 💥 Breaking

- **The build stops when no source yields a Gherkin feature and generated pages
  exist (#122).** Before, a source directory that was not checked out, such as an
  uninitialised git submodule, made the build warn and delete every generated
  page. Now `generateFeaturePages` throws before any write and removes nothing.
  A site that relied on empty sources pruning its pages must set
  `gherkin.allowEmpty: true`, or pass `--allow-empty` to
  `dockitty-generate-feature-pages`, for the build that should delete them.
  `--check` is unchanged.
- **Generated glossary pages take your site's index name, and the build stops in
  three cases it did not before (#129).** Before, the generator always wrote
  `glossary/index.md`, and it wrote through an authored file or a symbolic link.
  Now the pages are named `index` when your `indexBasename` lists it, and
  otherwise with your first index name. On a site that does not list `index`,
  `glossary/index.md` becomes `glossary/README.md`, and likewise for each context
  folder. A site that commits its generated pages commits the rename. The build now
  stops, names the path and writes nothing when a file you wrote or a symbolic link
  sits where a generated page goes, when `glossary/` or a context folder is a
  symbolic link, and when an index name is not a plain file name (one path
  segment: no `/` or `\`, no leading `.`, no surrounding whitespace), or is empty
  or `log`.
- **`docKittyDocsLoader` rejects a custom `pattern` (#133).** Before, a narrowed
  `pattern` changed which pages were built but not the route table the link
  rewrite uses, so a relative `.md` link could be rewritten to a page that was
  never built. Now the loader throws when `pattern` is anything but the default.
  Leave `pattern` unset; to keep a file out of the site, move it out of the docs
  folder or name it `log.md`.
- **Move `indexBasename` from `docKittyDocsLoader` to `defineDocKittyIntegrations`
  in `astro.config.*` (#136).** Before, you could set index names in three places
  (the integration, the loader and the `--index-basename` flag), and they could
  disagree. Now the integration is the only place, and the loader picks the value
  up from it. If the loader still sets `indexBasename` to a different value, the
  build stops and shows both values. Once the names are on the integration, you
  can delete the loader option.
- **Remove `--index-basename` from your CI scripts: the DocKitty commands now
  read index names from `astro.config.*`, and `dockitty-check-links` defaults to
  `README` (#136).** Before, `dockitty-check-links` treated both `README` and
  `index` as index names while the build used only `README`. Now
  `dockitty-check-links`, `dockitty-validate-frontmatter`,
  `dockitty-check-redirect-coverage`, `dockitty-generate-feature-pages`,
  `dockitty-new-doc` and `dockitty-scaffold` read your site config, which adds
  about one second per run. Each command prints the index names it used and where
  they came from. When no config sits next to the docs folder, the command warns
  and uses `README`; pass `--astro-config <path>` if your config lives elsewhere.
  A path that does not exist or cannot be loaded exits 2. If you keep the
  `--index-basename` flag, it must list the same names as the config (order and
  letter case do not matter), or the command exits 2.
- **Keep one file per page address: two files served at the same address now stop
  the build (#135).** Before, a folder with both `README.md` and `index.md` built
  with a warning and one of them became an ordinary page. `page.md` next to
  `page.mdx`, or two pages whose names differ only in letter case, went unnoticed.
  Now the build, `dockitty-check-links --strict` (exit 1) and
  `dockitty-validate-frontmatter` stop and name the files, the address and a fix.
  Drafts count too. Names that differ only in case count because they overwrite
  each other on macOS and Windows. Rename or remove all but one file in each group.
- **Move pages you want published out of `_meta/` (#138).** Before, Markdown at any
  depth under a `_meta/` folder, and files named `_meta.md` or `_meta.mdx`, were
  built and linked like any page. Now they are not published, and
  `dockitty-check-links --strict` skips them. The YAML registry files in `_meta/`
  still load, and `dockitty-validate-frontmatter` still checks the Markdown there.
- **`dockitty-new-doc --section` and `dockitty-scaffold` now create your first index
  name (#136).** Before, a site with index names `['index', 'README']` could get a
  `README.md`. Now it gets `index.md`. An `--index-basename` value that is not one
  of your index names exits 2.
- **Rename any Gherkin file called `index.feature` (#137).** Before, it was accepted
  unless your index names included `index`, and its generated page then collided
  with the folder's landing page. Now the build stops on it whatever your index
  names are.
- **If your site sets `gherkin: { sources }`, your ```` ```gherkin ```` fences now
  render as structured scenarios** instead of code blocks. Add `raw` to a fence
  (```` ```gherkin raw ````) to keep it as code, or set `fences: false` to keep
  every authored page as it was. Sites without the `gherkin` option are
  unaffected.
- **On such a site a `::gherkin{…}` line is now an include**; it used to print as
  literal text. It reads files from the folders in `includeRoots` (default:
  `sources`), and a line whose file is outside them, missing or not a `.feature`
  file now fails the build.
- **An unknown key in the `gherkin` option is now a config error** instead of
  being ignored.
- **Generated feature pages show quoted step arguments as code**
  (`"insufficient space"` becomes a code span, quotes kept), in step text and in
  data-table and Examples cells, so a regenerated page
  differs from the committed one: run the generator once, or the `--check` gate
  reports the drift. See Changed.

### Changed

- **`dockitty-check-links` now checks reference-style link definitions, and
  names a bad option (#131).** Before, a dangling
  `[label]: target` line passed. Now it is reported like an inline link. An
  unknown option, the `--name=value` form and an `--index-basename` value that is
  not a plain file name still exit with status 2, but the command now stops before
  scanning and names the option; before, it read the option as a docs folder and
  reported that it could not read it. The failure summary reads
  "N link problem(s) in M file(s); F file(s) scanned, C reference(s) checked."
- **Quoted step arguments are code, on generated pages and in fences and
  includes alike.** A double-quoted argument such as `"spec-kitty init --force"`
  renders as inline code with its quotes, so the page's typography no longer curls
  the quotes or turns `--` into a dash, and the value copies exactly. A quoted
  argument in a data-table or Examples cell is code too. Text outside quotes is
  still typeset, and a quoted argument is no longer glossary-linked.
- **A broken in-page fence or include fails the build.** A Gherkin syntax error,
  or an include whose file, scenario or tag is not found, stops `astro build`
  with one `[dk-gherkin] <page>:<line>` error listing every broken page, instead
  of building the page empty. Building again fails the same way until you fix it.

### Added

- **Relative Markdown links between pages are rewritten to routes at build
  (#131).** Before, `[setup](./setup.md)` rendered as a link to a `.md` path that
  404s on the live site, so authors wrote root-absolute routes that break on
  GitHub. Now a relative `.md` or `.mdx` link to a published page becomes that
  page's route, with your `base` applied, and the same link works on GitHub. A
  link that does not resolve is left as written and reported by
  `dockitty-assert-no-broken-links`. Raw HTML anchors are not rewritten. After a
  rename, restart the dev server. See [ADR-0047](docs/adr/0047-relative-markdown-links.md).
- **`gherkin.allowEmpty` and `--allow-empty`.** They let the build, and
  `dockitty-generate-feature-pages`, remove the generated pages when no source
  yields a feature. Off by default. See the Breaking entry above and
  [ADR-0048](docs/adr/0048-generated-page-names-and-empty-sources.md).
- **`--strict` and `--index-basename` on `dockitty-check-links` (#131).**
  Without `--strict`, a root is read as files, as on GitHub, and the check is the
  one 0.2.0 ran. With `--strict`, a root is read as a built site: a relative
  `.md` link passes only when the build would rewrite it to a published page. It
  also reports a link to a file that is not a page (for example `log.md`), a path
  that leaves the docs root and comes back, a link to a file outside the docs
  tree, a malformed `%` escape, a folder link with no index page, a bare relative
  link with no extension, and, with `DK_PUBLISH_DRAFTS=off`, a link to a draft.
  A `related:` ref is matched against page ids, as the build does, so a page
  `x/index.md` that is not a section index is `x/index`, not `x`.
  A site built with the toolkit should pass `--strict`; `example/docs` is always
  strict. When an Astro config sits next to a root that is not strict, the command
  prints one note suggesting `--strict`, and the exit code is unchanged.
  The command reads your site's index names from `astro.config.*`; see the
  Breaking entry on `--index-basename` above. `--help` lists the options.
- **`--help` on `dockitty-generate-feature-pages`.** It prints the flags and exits
  with status 0.
- **Gherkin in any page** ([ADR-0051](docs/adr/0051-gherkin-in-any-page.md)). Set
  `gherkin: true` and a ```` ```gherkin ```` fence on any docs page renders as a
  structured scenario: the feature and scenarios as headings that nest under the
  page's outline, steps as a bulleted list with the keyword in bold, data tables
  and Examples as tables, doc strings as code blocks, and `#` comments hidden. A
  fence may hold a whole feature, scenarios without a `Feature:` line, or bare
  steps. Inside a list, quote or aside the headings become `role="heading"`
  paragraphs, so they stay out of "On this page". Slide decks keep fences as code,
  and generated feature pages are left as generated.
- **Include a `.feature` file from your repository with `::gherkin{src="…"}`**:
  the whole file, one scenario with `scenario="<exact name>"`, or the scenarios
  and Examples rows that carry any of `tags="@a @b"` (inherited tags count). Each
  include ends in a source line naming the file, linked with `sourceUrlPrefix`.
  Includes need `gherkin.includeRoots` (or `sources`): they may only read regular
  files of at most 1 MiB inside those folders, and `gherkin: true` alone turns on
  fences only. A page that includes a file is re-rendered when the file changes,
  in a build and in the dev server.
- **The `gherkin` option accepts `true`** (fences only, no generated pages) and
  the object form gains `fences` (default `true`) and `includeRoots`. `sources`
  is now optional: it is what turns on generated pages and the `behaviour`
  section.
- **The agent page payload expands includes.** `/api/pages/<slug>.json` has each
  include as Markdown in place of the directive, and lists them under
  `includes: [{ src, scenario?, tags? }]`.

### Fixed

- **Feeds, `llms.txt`, the agent API, related links, the Hub, the scenario index and
  the on-this-page block now link a folder's `index.md` at the address the site
  serves (#134).** Before, `guide/index.md` was listed as `/guide/index/`, an
  address the site does not serve, and the site's root page as `/index/`. Now they
  use `/guide/` and `/`. If you read the agent API, the `route` field changes for
  those pages.
- **The sidebar uses a folder's `index.md` to label its group (#138).** Before, on a
  site whose only index name is `README`, the site served `index.md` at the folder
  address, but the sidebar did not use it as the group's label. Now it does.
- **A glossary term inside a reference-style link no longer gets a second link
  (#139).** Before, the term in `[the term][ref]`, or in a `[ref]: …` definition,
  could be turned into a link inside the link. Now the glossary leaves both alone.
- **`dockitty-check-links --strict` checks only files the build publishes.** Before,
  it also read `log.md`, files in dot-folders and files under `_meta`. Now it skips
  them.
- **Generated glossary pages are section indexes on the default index name
  (#129).** Before, the generator always wrote `glossary/index.md`. On a site whose
  only index name is `README`, Starlight still served that hub at `/glossary/`,
  but the toolkit saw its id as `glossary/index`: links it built pointed at
  `/glossary/index/`, the Hub layout found no children and the sidebar did not
  treat the page as the folder's index. Now the pages are named `index` when your
  `indexBasename` lists it, and otherwise with your first index name. Sites that
  list `index` keep their output.
- **Stale generated glossary pages are removed on upgrade, when they are the
  generator's own output (#129).** When the index name changes, an old hub or
  context page is deleted only if its bytes are identical to the page the generator
  just wrote there. A default-settings site whose 0.2.0 build left
  `glossary/index.md` pages gets them removed without a message when the glossary
  source is unchanged. If the source changed between the two builds, the old pages
  whose content changed are kept, and the build warns for each: delete them. A page with the generator's
  keys and different content is kept with a warning, and so is a page with the
  generator's `kind` and different keys.
- **The sitemap's entry for the site root has one form on a site with a base
  path.** `@astrojs/sitemap` wrote it with or without a trailing slash depending
  on the order pages were built in, so two builds of the same tree could differ.
  It is now always written without the trailing slash, the form a build emits
  when the root page comes first.
- **The baseline workflow no longer fails after pushing the regenerated
  baselines.** This repository does not let GitHub Actions create pull requests,
  so `update-a11y-baselines.yml` now warns and puts a link in the run summary
  that opens the pull request in one click. Its `target_branch` input defaults
  to `main` instead of a branch that was merged long ago. (#117)
- **A failed Chromium download no longer fails the example build on its own.**
  The shared build action caches the browser, keyed on the Playwright version,
  and retries the download with a pause when the cache is cold. (#117)
- **A deploy run now says whether it published.** `deploy.yml` writes a run
  summary: the commit it deployed, or that the push changed no deployable path
  and which commit the latest Pages deployment holds. (#117)

### Known limitations

- Step text in a fence or an include is not glossary-linked (#113).
- A ```` ```gherkin ```` fence that holds only prose, a table or `Examples:` stops
  the build (mark it `raw`); one that holds only comments stays a code block.
  Steps under a `Feature:` line with no `Scenario:` render as its description,
  with a warning.
- `tags` is an any-of list, not a tag expression: `and`, `or`, `not` and
  parentheses are refused.
- Includes in `.mdx` pages are not expanded in the agent payload.
- Re-rendering pages when an included file changes relies on Astro 5 loader
  internals and is to be re-checked for Astro 7 (#119).


## [0.2.0] — 2026-10-13

**Read this before upgrading: set `DK_PUBLISH_DRAFTS=off` in the build that
deploys your live site.** This release adds that setting. Its default is `on`:
draft pages are built and listed, as in 0.1.1, and are now also marked `noindex`
and left out of site search. A page is a draft when its frontmatter says
`doc_status: draft` **or has no `doc_status` at all**. A deployment that does
not set `off` publishes its drafts as `noindex` pages:

```sh
DK_PUBLISH_DRAFTS=off astro build
```

Before you set `off`, give every live page a status other than `draft`, such as
`doc_status: active`. A page with no `doc_status` counts as a draft, so `off`
would leave it out of the build.

The version is `0.2.0` because the layout, sidebar and redirect-gate changes
below are breaking, and under `0.x` the minor number marks a breaking release.

### 💥 Breaking

Each item is described in full under Changed.

- **Pages with `doc_status: draft` or no `doc_status` are now `noindex` and left
  out of site search.** Give every live page a non-draft status such as
  `doc_status: active` to keep it indexed. With `DK_PUBLISH_DRAFTS=off` those
  pages are not built at all.
- **A theme that sets `dk:site-header` now replaces the stock header.** The slot
  name was already valid in 0.1.1 but did nothing. Now the theme's component
  replaces the header, including search and the theme select, so it has to
  supply them.
- **The redirect-coverage gate has new flags and a new failure.** With drafts
  off it needs `--docs` and `--declared-redirects` to accept an old URL that
  leads to a draft, and it fails on any redirect stub that leads to a missing
  page.
- **Sidebar group labels and order change.** Groups take their index page's
  title and `sidebar.order`.
- **A page with no `h2` or `h3` loses its "On this page" rail.**
- **The page frame is full width by default.** Set `--dk-width-frame` for a
  capped frame.
- **The reading column is narrower between 1152px and 1344px viewports**: 528px
  at 1152px (was 600px) and 656px at 1280px (was 664px).

### Changed

- **Draft pages and pages with no `doc_status` are marked `noindex` and left
  out of site search.** They are still built and listed in the sidebar, as in
  0.1.1. What is new: each carries `<meta name="robots" content="noindex">` and
  has no record in the search index. A site that never set `doc_status` builds
  the same pages as before, and every one of them except the root page is now
  `noindex` and unsearchable. Give a page a status other than `draft` (for
  example `doc_status: active`) to make it indexable and searchable again. The
  sitemap, feeds, `llms.txt` and the agent index never listed drafts and still
  do not. The site's root page is never a draft and never `noindex`.

  The marker follows the page's status, not the setting described under Added:
  a draft is `noindex` whenever it is rendered, also on a site that does not
  load its docs through `docKittyDocsLoader`.
- **This project's example site publishes its Plans section and the footnotes
  showcase.** `/plans/`, the two mission pages and
  `/guides/markua-footnotes-showcase/` were drafts and are now
  `doc_status: active`; `/plans/missions/` is a new
  index page. All five are in the sitemap, the feed, `llms.txt`, the agent index
  and site search (67 published pages, was 56: those five and the six generated
  behaviour pages). The
  published site is built with `DK_PUBLISH_DRAFTS=off`. That build leaves out
  the five remaining drafts (`/adr/template/`,
  `/behaviour/shipping/track-consignment/`, `/context/audience/draft-persona/`,
  `/guides/markua-footnotes-malformed/`, `/presentations/draft-preview/`), and every baselined old URL resolves on it,
  `/plans/features/mission-alpha/` and `/plans/features/mission-beta/` included.
- **The page frame is full width by default.** The frame (sidebar, reading
  pane and "On this page" rail) spans the viewport. Before, it was meant to be
  capped at 90rem on wide screens. To get a capped, centred frame, set
  `--dk-width-frame` (see Added). Decision and measurements:
  [ADR-0045](docs/adr/0045-frame-width-token.md).
- **The "On this page" rail has a fixed width**, equal to the sidebar width
  (18rem by default), at every viewport from 72rem. The reading pane takes the
  rest of the frame; its column is at most 720px. Between 72rem and 84rem
  (1152-1344px) the reading column is narrower than before: 528px at 1152px (was
  600px) and 656px at 1280px (was 664px). From 1600px it is 720px (was 552px).
- **Rail links meet the 24px target size**, so a long outline is taller than
  before. A page that set `tableOfContents: false` to pass a target-size check
  can show its outline again.
- **The rail's collapse toggle moved.** Expanded, it is centred on the rail's
  inner edge; collapsed, it sits at the frame's end edge. In keyboard order it
  now comes directly before the outline links (before, it was reached after the
  page footer), and it names the region it controls
  (`aria-controls="dk-toc-panel"`). A reader's stored collapse preference is
  kept.
- **Sidebar groups are labelled and ordered from their index pages.** A nested
  folder's group shows its index page's title (or `sidebar.label`) instead of
  the folder name, sibling groups follow the index pages' `sidebar.order` and
  then their labels, and each section's index page is the first entry of its
  group. In every group, links come before sub-groups, so `sidebar.order` cannot
  place a page between two groups. Previous/next links follow the new order.
  A folder with no titled index page gets a readable label from its name and a
  `[dk-sidebar]` build notice. A `sidebar` you supply yourself is not touched,
  and your own `starlight.routeMiddleware` runs after the toolkit's. See
  [Authoring](docs/guides/authoring.md#how-your-pages-appear-in-the-sidebar).
- **The current page's sidebar entry is scrolled into view** when a page loads.
- **A page with no `h2` or `h3` heading has no "On this page" rail.** Its
  outline would hold one link, so the rail and its toggle are left out and the
  text uses the width (27 pages on the example site's default build, 26 with
  `DK_PUBLISH_DRAFTS=off`; three of each are the generated behaviour hubs).
- **Desktop "On this page" links get a 24px minimum target** (WCAG 2.5.8, axe
  `target-size`) — `toc-rail.css` now gives every desktop TOC link
  `min-height: 24px` (flex-centred). Starlight's own links were about 23px tall,
  which a densely nested TOC (a generated feature page's Rule → Scenario entries)
  fails. This applies to **every** site with a TOC, whether or not it uses the
  `gherkin` option, so visual baselines of pages with a TOC shift slightly;
  regenerate them with the "Update a11y baselines" workflow
  (`update-a11y-baselines.yml`).
- **The redirect-coverage gate reads the draft setting.** With drafts off, pass
  `dockitty-check-redirect-coverage` the flags `--docs <docs-dir>` and
  `--declared-redirects <map-file>` so it can report an old URL that leads to a
  draft as unpublished instead of failing it; without them the failure message
  names the missing flag. It now also fails on any redirect stub in the output
  that leads to a missing page.
- **The gates resolve the draft setting the way the build does.**
  `dockitty-check-redirect-coverage` and `dockitty-check-links` read
  `DK_PUBLISH_DRAFTS` from the process environment, then from the site's env
  files, then fall back to `on`, and print one line with the value, its source,
  the site directory and the mode. `--site-root <dir>` names the site (default:
  the nearest directory with an Astro config above the checked directory, else
  the working directory) and `--mode <mode>` the env-file mode (default
  `production`).

### Added

- **`--dk-width-frame`** — a token that caps the page frame, for example
  `:root { --dk-width-frame: 90rem; }`. Default `100%`; a length or a
  percentage. A capped frame is centred, and the sidebar, the header content and
  the rail sit at its edges. It is a registered property, so an invalid value
  behaves as `100%`. Set it on `:root`. On a very wide screen the default leaves
  the sidebar and the rail far apart, so such a site may want a cap. See
  [Cap the page width](docs/guides/consumer-setup.md#cap-the-page-width).
- **`DK_PUBLISH_DRAFTS`** — `on` or `off` (default `on`), read from the process
  environment and then from the site's env files (`.env`, `.env.local`,
  `.env.<mode>`, `.env.<mode>.local`; later wins; mode is `development` for
  `astro dev` and `production` otherwise). Any other value stops the build with
  a message naming the setting and the accepted values. **Set `off` in the build
  that deploys your live site**, in the deploy job's environment or in a
  committed `.env.production`.

  With `off`, a draft page is not written, is not in any sidebar or the search
  index, and returns 404. If a redirect in your `redirects` config ends at a
  draft page, its stub is removed at the end of the build, the old URL returns
  404 until the page is published, and the build warns once, naming each one.
  With `on`, drafts are built, listed and marked `noindex`; the build log says
  so, and when nothing set the value it adds how to turn drafts off. Filtering
  happens in `docKittyDocsLoader`; a site that loads its `docs` collection
  another way builds its drafts with `off` too and gets a warning at the end of
  the build. See [Draft publication](docs/guides/draft-publication.md).
- **A theme can replace the site header** through the `dk:site-header` slot. The
  component renders once inside Starlight's `<header class="header">`, in place
  of the stock header. Starlight keeps the skip link and the mobile menu toggle;
  the theme supplies the site title, search, social icons, theme select and
  language select it still wants. A theme that sets no such slot gets the stock
  header, with unchanged markup. See [Theme header](docs/guides/theme-header.md)
  and [ADR-0044](docs/adr/0044-header-carrier.md), which makes `Header` the
  fifth toolkit-owned carrier.
- **`@spec-kitty/doc-toolkit/route-middleware`** — the package export the
  integration registers as Starlight route middleware. You do not import it
  yourself. The `./config` export also gains `routeShapingIntegration`,
  `draftPublicationIntegration`, `routeShapingSource`, `ROUTE_MIDDLEWARE`,
  `ROUTE_SHAPING_MODULE_ID` and `RouteShapingOptions`, `./schema` gains
  `applyDraftPolicy`, and the package root gains `isDraftEntry`. These are
  internal seams the toolkit's own tests use. They are not supported API and
  may change without notice.
- **Gherkin `.feature` files can be published as documentation**
  ([ADR-0046](docs/adr/0046-gherkin-feature-pages.md)). A new opt-in `gherkin` option on
  `defineDocKittyIntegrations` (`{ sources, section?, sourceRoot?, sourceUrlPrefix? }`) parses every
  `.feature` under `sources` once with `@cucumber/gherkin` and generates one
  `kind: Specification` page per feature, plus a hub per directory holding a
  published (non-draft) feature, into
  `<docsDir>/<section>/` (default `behaviour`) when the build starts. The pages
  are ordinary collection files, so the sidebar, sitemap, RSS, `llms.txt`, the
  agent API and glossary auto-linking pick them up. Feature-level
  `@dk:<key>=<value>` tags map to frontmatter (`glossary_context`, `doc_status`,
  `audience`, `related` missions and ADRs, `updated`, `glossary_autolink`,
  `agent.priority`); `@wip`/`@deprecated` set the status and other tags pass
  through to `tags`. Output is deterministic (`generated.at` is a source content
  hash), only changed files are rewritten, and stale generated pages are pruned.
  These stop the build: an authored file in the generated section (a symlink
  counts, and so does a symlinked section folder); two features that would
  produce the same page; a feature whose file name produces `log` or an index
  name such as `README`; a syntax error or a missing source directory; and, for
  the scenario index below, a page whose `.feature` source is missing or has
  changed since generation. An index basename with a path separator or a leading
  dot is refused. A draft feature (`@wip`, `@dk:status=draft`) still gets its
  page but is never listed in a hub, and a directory holding only drafts gets no
  hub at all. A `@dk:status` the generator cannot use (a typo in the case, no
  value, or two tags that disagree) makes the page a draft and warns, so a page
  you meant to hide does not go live. The example site lists its feature pages in
  its RSS feed; a generated page has no date unless the feature carries
  `@dk:updated=<date>`. With the option
  unset the build output is unchanged apart from the TOC target-size CSS under
  **Changed**. See the
  [consumer setup guide](docs/guides/consumer-setup.md#optional-gherkin-feature-pages).
- **`Specification` is a new `kind` and `type` value.** Any page may use it; the
  generated feature pages do.
- **`dockitty-generate-feature-pages`** — a new package binary (and
  `@spec-kitty/doc-toolkit/scripts/generate-feature-pages.mjs`) that regenerates
  the feature pages without a build, or with `--check` exits 1 listing every
  added, changed, stale or authored path, so CI can fail when committed pages
  drift from their `.feature` sources. Its flags mirror the `gherkin` option.
- **A scenario index for agents** — a new `scenarioIndexRoute` export from
  `@spec-kitty/doc-toolkit/routes`, mounted at `/api/scenarios.json`, lists every
  published, agent-discoverable generated feature page with its rules, scenarios
  (anchors taken from the rendered headings), tags, steps and examples tables,
  re-parsed from the `.feature` source. Pass it the same `sourceRoot` and
  `sourceUrlPrefix` as the `gherkin` option. `llmsTxtRoute` adds one
  `Scenario index: <url>` line only when at least one such page exists, so a site
  without published feature pages gets a byte-identical `llms.txt`. Mount the
  route whenever `gherkin` is on, or `llms.txt` links to a page that does not
  exist.
- **`validate-frontmatter` recognises Gherkin feature pages by their
  `generated.by: "doc-kitty/gherkin"` stamp**, wherever they live, and exempts them
  from `type` and, when they carry none, `updated`. The glossary codegen writes no
  stamp, so its pages are still recognised by the existing `glossary/` path rule.
- **New dependencies:** `@cucumber/gherkin` `42.0.1` and `@cucumber/messages`
  `34.2.1`, exact-pinned. They are installed for every consumer, with the preset
  on or off.

### Fixed

- **Dead gutter on wide screens.** At 1600, 1920 and 2560px the frame shrank to
  1056px while the sidebar and header stayed at the viewport edge, leaving a gap
  of 272, 432 and 752px between the sidebar and the content. The gap is 0px at
  all three widths.
- **Reading column that shrank as the window grew.** It was 664px at 1280px and
  552px from 1600px. From 72rem (1152px) up, the reading column does not get
  narrower as the viewport grows (528, 656, 720, 720, 720px at the five measured
  widths).
- **Mis-anchored collapse toggle.** It sat 24px to 616px away from the rail edge
  depending on the viewport, over article text at 1152px and 1280px and inside
  the rail from 1600px. It is on the rail edge at every desktop width, in both
  states, under a capped frame and right-to-left.
- **Raw folder names in the sidebar.** Five authored groups on the example site
  were labelled `audience`, `missions`, `book-one`, `book-two`, `book-three`, the
  books in alphabetical order. They now carry their titles in the declared
  order.
- **`pnpm typecheck` aborted after a test run** (exit 134) because `astro check`
  walked the test builds under `example/dist-*`. Those directories are excluded.
- **The install docs now authenticate correctly under pnpm** — the README and the
  consumer-setup guide told consumers to put
  `//npm.pkg.github.com/:_authToken=${GITHUB_TOKEN}` in a project-root `.npmrc`,
  but pnpm does not expand `${ENV_VAR}` in a credential read from a project file,
  so the token was silently ignored and `pnpm add @spec-kitty/doc-toolkit` failed
  with `401 Unauthorized`. The guidance now keeps only the scope→registry mapping
  in the project `.npmrc` and puts the token in the user-level `~/.npmrc` (or
  `pnpm config set`), where pnpm expands it.

### Known limitations

- **Three generated sidebar groups keep a raw id as label.** The groups for
  generated glossary contexts (`hr`, `rhetoric`, `shipping` on the example site)
  are still labelled with the context id, because their index pages are
  generated with the id as title. Five of the eight raw labels are fixed; these
  three need a follow-up.
- **Each section's index page repeats the group's label as its first entry.**
  The group and its first link carry the same text.
- **The sidebar can jump on a slowly loading page.** The script that scrolls the
  current entry into view runs on `DOMContentLoaded`. On a page that streams in
  slowly the sidebar can paint at the top first and then move.
- **Slot names are checked by TypeScript only.** A misspelt slot name in a
  plain-JavaScript theme is ignored without a message. This was already true of
  every slot.
- **A `Header` passed through Starlight's `components` option is discarded**, as
  overrides of the other carriers always were. Use the `dk:site-header` slot.
- **Re-centring the collapsed layout on a page with a rail and no sidebar is
  verified by simulation only.** No page shape in Starlight 0.32 produces that
  combination.
- **Redirect withholding matches exact route strings.** With
  `DK_PUBLISH_DRAFTS=off`, a redirect whose target is written as `/Draft/` or
  `/draft/index.html`, or whose key is dynamic, is not withheld. The
  redirect-coverage gate's dead-stub check catches the stub that results.
- **A hand-written `sidebar` item whose `slug:` points at a draft** builds with
  drafts on and fails the build with `DK_PUBLISH_DRAFTS=off`. Remove the item,
  or publish the page, before you turn drafts off.
- **A deployment that does not set `DK_PUBLISH_DRAFTS=off` publishes its
  drafts.** They are `noindex`, which asks search engines not to list them; it
  is not access control.
- **The Playwright lane of this repository needs a build with drafts.** That is
  the default; `pnpm build:a11y` states `DK_PUBLISH_DRAFTS=on`, so it gives the
  right build even when your shell sets `off`.

## [0.1.1] — 2026-10-10

**The first published version**, as `@spec-kitty/doc-toolkit` on the
[GitHub Packages](https://docs.github.com/en/packages/working-with-a-github-packages-registry/working-with-the-npm-registry)
npm registry (`npm.pkg.github.com`). `0.1.0` was tagged under the previous name
(`@commondocs-kitty/toolkit`) and was never published to any registry, so `0.1.1`
is the first installable release. The rename below is breaking only for anyone who
built from a source checkout; no registry consumer exists under either name.
Installing from GitHub Packages needs a GitHub token with `read:packages` — see
[consumer setup](docs/guides/consumer-setup.md). (The heading date is the
release-prep date; the [releasing runbook](docs/ops/releasing.md) has you update it
to the tag date.)

### 💥 Breaking

- **The project is now DocKitty and the package is `@spec-kitty/doc-toolkit`**
  (`#105`) — the toolkit was renamed from `@commondocs-kitty/toolkit` to
  `@spec-kitty/doc-toolkit`, and the product name from "Common Docs — Kitty
  Variation" to **DocKitty**. Adopters must update their dependency and every
  `@commondocs-kitty/toolkit/*` import to `@spec-kitty/doc-toolkit/*` (the
  subpath exports are otherwise unchanged). The package has not been published to
  any registry, so there are no released consumers to migrate. Publishing under the
  `@spec-kitty` scope refines the zero-Spec-Kitty-coupling invariant (NFR-001):
  the toolkit still carries no Spec Kitty *runtime* coupling, but its own
  self-reference is no longer treated as coupling — see
  [ADR-0043](docs/adr/0043-toolkit-package-scope-and-self-reference.md). The
  agent-API's `generatedFrom` field in `/api/index.json` also changed from
  `common-docs-kitty` to `doc-kitty`; an agent that branched on the old value
  should update (the payload `version` stays `2`, as the shape is unchanged).

### Added

- **GitHub Packages release workflow** — `.github/workflows/release.yml`
  publishes the toolkit to the GitHub Packages npm registry
  (`npm.pkg.github.com`) when a `v<version>` tag is pushed. A read-only `verify`
  job fails closed unless the tag equals `src/package.json` `version`, the tagged
  commit is on `main`, and the CHANGELOG has a section for it. It re-runs
  typecheck, lint, unit tests, and the clean-room consumption test with its
  self-test, then packs the tarball. A separate `publish` job — the only one with
  `packages: write` — installs nothing and publishes that tarball with the run's
  built-in `GITHUB_TOKEN`, so no external publish secret is needed. Prerelease
  versions publish under the `next` dist-tag. A manual dispatch is a dry-run
  rehearsal and never publishes, even on a tag ref. The runbook is
  [`docs/ops/releasing.md`](docs/ops/releasing.md).
- **The docs gates ship as package binaries** — `dockitty-validate-frontmatter`,
  `dockitty-check-links`, `dockitty-assert-no-broken-links`,
  `dockitty-check-redirect-coverage`, `dockitty-validate-catalog`,
  `dockitty-new-doc`, and `dockitty-scaffold`, so an adopter runs
  `pnpm exec dockitty-check-links docs`. The scripts are also exported as
  `@spec-kitty/doc-toolkit/scripts/*`.
- **Attribution for the upstream Common Docs specification** (`#105`) — DocKitty
  is based on the **Common Docs** convention created by **Christopher Skene**. A
  new root `NOTICE` reproduces the upstream MIT notice (spec v1.2, © Christopher
  Skene) and ships inside the package; the README gains an **Accreditation**
  section, and the convention doc credits the Common Docs specification to
  Christopher Skene alongside the DocKitty variation.
- **One `_meta/charter.yaml` now governs a docsite's whole convention** (M7;
  `#100`, closes `#98`, `#99`) — the `type`/`kind` vocabulary, the `doc_status`
  set, the sections/IA registry, and the required-field set used to be spread
  across separate `_meta/*.yaml` files, with a couple of knobs hardcoded in the
  toolkit. A consumer can now author a single optional charter, resolved natively
  by doc-kitty with **no Spec Kitty runtime dependency**, under a documented
  per-axis `default → consumer` precedence. Existing `_meta/*.yaml` files are
  still honored (with a one-shot deprecation notice), so current consumers keep
  working unchanged; a charter-only consumer is now governed end-to-end — the
  frontmatter gate and every build output (`llms.txt`, the agent-API, `rss.xml`,
  the Hub grid, and the sidebar/sitemap) resolve through the charter. `doc_status`
  is extend-only (the canonical statuses stay reserved) and the required-field set
  keeps a non-removable `title` floor; a malformed charter fails closed. See
  [ADR-0042](docs/adr/0042-native-documentation-charter.md) and the consumer
  charter reference + migration guide.

### Changed

- **Package metadata for publishing** — `src/package.json` gains `repository`
  (with `directory: src`, which GitHub Packages uses to link the package to this
  repository), `homepage`, `bugs`, and `keywords`, and `publishConfig` now pins
  the GitHub Packages registry (`registry: https://npm.pkg.github.com`) next to
  `access: public`, so a stray `npm publish` cannot reach the public npm registry.
- **The consumption harness reads the expected version from `src/package.json`**
  instead of hardcoding `0.1.0`, and accepts both the npm ≤ 11 (array) and npm 12
  (object) shapes of `npm pack --json` output.
- **The toolkit's runtime imports are declared dependencies** — `unified`,
  `remark-parse`, `remark-gfm`, `remark-directive`, and `remark-smartypants` are
  imported by shipped code (`lib/config.ts`, `lib/remark/markua-normalise.ts`,
  `lib/glossary/page-processor.ts`) but were only devDependencies or not
  declared at all, so a non-hoisted install (`hoist: false`) failed with
  `MODULE_NOT_FOUND`. They are now `dependencies`, and a new unit test
  (`src/tests/package-runtime-deps.test.ts`) fails when a shipped file imports
  an undeclared package.
- **The consumption test pins the toolkit tarball's integrity at run time** —
  packed tarballs are not byte-identical across machines, so the committed
  fixture lockfile's hash for the local `toolkit.tgz` failed on CI with
  `ERR_PNPM_TARBALL_INTEGRITY`. Before each frozen install, the harness now
  rewrites that one entry to the sha512 of the tarball it just packed and
  restores the file afterwards. Every registry integrity stays frozen.
- **Consumer setup guide** — a new first step covers authenticating to GitHub
  Packages (the `.npmrc` scope mapping and a `read:packages` token), since the
  registry serves no npm package anonymously. The prerequisite is now Node ≥ 22,
  matching the package's `engines` (it said Node ≥ 20), the pinned-release example
  names `0.1.1`, and the install step no longer calls `@astrojs/sitemap` a peer (it
  is a regular dependency of the toolkit). The root `README` gains a matching
  install-from-GitHub-Packages section.

### Fixed

- **The docs gates no longer exit 0 without running when started through a
  symlink** — the scripts ran their CLI only when `import.meta.url` equalled
  `process.argv[1]`. Installed behind pnpm's `node_modules` symlink or a `.bin`
  shim, argv keeps the symlink path, so
  `node node_modules/@spec-kitty/doc-toolkit/scripts/validate-frontmatter.mjs`
  did nothing and reported success. The guard now compares real paths.
- **The on-demand "Update a11y baselines" workflow can regenerate baselines for
  branches whose example includes the PlantUML demonstrator** (`#106`) — its
  `regenerate` job runs inside the pinned Playwright container and builds the
  example in BUILD diagram-render mode, but declared no PlantUML render server, so
  the build-mode PlantUML assertion aborted the job before it reached the
  detect/commit/PR steps. The job now carries `ci.yml`'s `build-example` render
  setup (a `plantuml/plantuml-server:jetty` service reached by its Docker-network
  name `http://plantuml:8080/svg/`, deterministic BUILD render env, a
  wait-for-ready step, and `@beoe` Mermaid render-cache parity).

## [0.1.0] — 2026-09-09

First tagged release (tagged as `@commondocs-kitty/toolkit` / "Common Docs —
Kitty Variation"; the project was renamed to **DocKitty** afterward — see
[0.1.1]). Collects the delivered MVP of the DocKitty toolkit:
point it at a documentation tree that follows the convention
and get a Starlight docsite plus `sitemap.xml`, `rss.xml`, `llms.txt`, and a JSON
agent-API out of the box. See [`docs/plans/roadmap.md`](docs/plans/roadmap.md) for
the feature-by-feature status and the decision records under
[`docs/adr/`](docs/adr/) for the reasoning.

### Added

- **Common Docs rendering** — the README-as-index loader renders a repo-root
  `docs/` tree; `README.md` (or `index.md`) is the section index and carries
  frontmatter.
- **Metadata model + chrome** (M1) — the first-class frontmatter contract
  (`doc_status`, `type`, `kind`, `audience`, `related`, …) that drives navigation,
  feeds, and the agent-API (ADR-0005/0009).
- **Generators** — `rss.xml`, `llms.txt`, generated `sitemap.xml`, and an enriched
  HATEOAS agent-API (`_links`, enriched `related[]`/`audience[]`).
- **Component system + swappable theme** (M2) — per-kind layouts (Default, Hub,
  Persona, Deck) and a pure `default → brand → consumer` token-theme merge
  (ADR-0008/0011/0013).
- **Audience + related + external references** (M3) — audience targeting, rendered
  relationships, and an external-reference catalog.
- **Slide decks** (M6) — static reveal.js decks on an out-of-frame route.
- **Diagrams** (M5 → #13) — client-side Mermaid and build-time static-SVG Mermaid
  (`@beoe`) + PlantUML (self-hosted service), dual-mode and self-contained; theming
  via `--dk-diagram-*` (ADR-0040).
- **Glossary + Contextive** (M4) — multi-context autolinking, hover preview, the
  `:term` directive, and an On-this-page block.
- **Markua syntax support** (subset) — preprocess-to-directive pipeline, callouts,
  and opt-in first-class footnotes (ADR-0030, ADR-0041) — a Markua-clean source for
  a future Leanpub export path.
- **Example corpus** — the ars-rethorica showcase (Introduction, Preamble, Book I
  15 chapters, Book II/III landings, a generated rhetoric glossary, two reader
  personas).
- **Packaging** — published as `@spec-kitty/doc-toolkit` with an `exports` map,
  a `files` allowlist, and `astro`/`@astrojs/starlight` peer dependencies;
  workspace-split from `example/`.

### Adoption enablers (spec-kitty proving ground, #37–#44)

- `index.md` accepted as a section index alongside `README.md` (#37).
- `type`/`kind` optional, `type` derivable from the section registry (#38).
- `durable` added to the `doc_status` enum (#39).
- Overridable `type`/`kind` vocabulary (#40).
- Tolerate `adr/<era>/NNNN-` era-partitioned ADR paths (#41).
- First-class redirect-coverage gate for migrating adopters —
  `check-redirect-coverage.mjs` (#42).
- MIT LICENSE (#43).
- Doc-honesty fixes across the index, `AGENTS.md`, and `README` (#44).

### Known limitations

- Reuse is proven at **N=1** — only the spec-kitty brand theme is instantiated; the
  `consumer` theme layer is a contract, not yet a demonstrated second consumer. A
  dedicated consumption-test workflow is scoped to close this.
- Repository portals (mission-status, QA, ticketing) are design-only.
- Build-time PlantUML rendering requires a PlantUML service (provided in CI); a
  local build without it skips PlantUML figures.

[Unreleased]: https://github.com/spec-kitty/doc-kitty/compare/v0.2.0...HEAD
[0.2.0]: https://github.com/spec-kitty/doc-kitty/compare/v0.1.1...v0.2.0
[0.1.1]: https://github.com/spec-kitty/doc-kitty/compare/v0.1.0...v0.1.1
[0.1.0]: https://github.com/spec-kitty/doc-kitty/releases/tag/v0.1.0
