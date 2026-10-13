---
title: Draft publication — keep drafts off the live site
description: How DK_PUBLISH_DRAFTS decides whether draft pages are built, where to set it for local work and for a deployment, and how to check that a deployment publishes none.
doc_status: active
updated: 2026-10-13
type: Guide
kind: How-To
tags: [drafts, deployment, configuration, consumer]
authors:
  - stijn@sddevelopment.be
related:
  - guides/consumer-setup
  - guides/authoring
  - adr/0005-frontmatter-doc-status-and-divio-type
---

# Draft publication — keep drafts off the live site

**Audience.** A site owner or the engineer who maintains the site's build and
deployment.

A build leaves draft pages out unless you turn them on. To see your drafts while
you write, set `DK_PUBLISH_DRAFTS=on` for your local dev server. To keep them off
the live site, do nothing: a deployment that never mentions the setting publishes
no drafts.

> **Changed in the release that added this setting.** Earlier versions built
> every draft page and listed it in the sidebar. If you relied on that, set
> `DK_PUBLISH_DRAFTS=on` in the environment of the build that should keep doing
> it.

## What counts as a draft

A page is a draft when its frontmatter says `doc_status: draft`, or has no
`doc_status` at all. Every other status (`active`, `deprecated`, `superseded`,
`durable`, and any status your charter adds) is published.

## The setting

| | |
|---|---|
| Name | `DK_PUBLISH_DRAFTS` |
| Values | `on` or `off`, in any letter case |
| Default | `off` |
| Empty or blank value | treated as not set |
| Any other value | the build stops, see [A mistyped value](#a-mistyped-value) |

## What each value does

| Surface | `off` (default) | `on` |
|---|---|---|
| The draft page itself | not built; its URL returns 404 | built |
| Sidebar entry | absent | listed |
| Search engines | nothing to index | page carries `<meta name="robots" content="noindex">` |
| Site search (Pagefind) | nothing to index | page is excluded from the search index |
| `sitemap-*.xml` | not listed | not listed |
| `rss.xml` | not listed | not listed |
| `llms.txt` | not listed | not listed |
| `api/index.json` (agent index) | not listed | not listed |
| `api/pages/<slug>.json` (per-page agent record) | not built | built |
| A redirect that ends at a draft | its stub is removed; the old URL returns 404 | works |

The four listing surfaces never include a draft, whatever the value.

Two consequences of `off` are easy to miss:

- **A section whose index page is a draft keeps its sidebar group** as long as it
  has a published page, labelled from the directory name. A section with no
  published page has no group.
- **A redirect to a draft stops working.** If your `redirects` send an old URL to
  a page that is still a draft, the toolkit removes that redirect's stub at the
  end of the build and warns once, naming each one:

  ```text
  [dk-drafts] 2 redirect(s) lead to a draft page, which is not built while
  DK_PUBLISH_DRAFTS is off. They are left out of the build, so these URLs return
  404 until the target is published: /old/a/ -> /new/a/, /old/b/ -> /new/b/
  ```

  A chain is followed to its end: `/old/ -> /renamed/ -> /draft/` removes both
  stubs. Publish the target, or accept the 404 until you do.

## Where to set it

The build reads the value from two places, in this order:

1. **The process environment.** Use this in CI and for a one-off build:

   ```sh
   DK_PUBLISH_DRAFTS=on astro build
   ```

2. **An env file in the site directory** (next to `astro.config.mjs`). Use this
   for local work. Four files are read, in this order, and a later file wins:
   `.env`, `.env.local`, `.env.<mode>`, `.env.<mode>.local`.

   **Mode is `development` for `astro dev` and `production` for everything
   else**: `astro build`, `astro preview` and the gates. So `.env.development`
   reaches the dev server only, and `.env.production` reaches every build.

   The process environment always wins over a file. Only keys that start with
   `DK_` are read from these files. The toolkit reads them with a small reader
   of its own; see [Known limits](#known-limits) for where it differs from the
   build tool's.

To preview drafts with the dev server and never build them, commit one file:

```sh
# .env.development
DK_PUBLISH_DRAFTS=on
```

`astro dev` reads it. `astro build` and `astro preview` do not, so your
deployment stays draft-free without any setting of its own, and so does a local
build or preview unless you run it with `DK_PUBLISH_DRAFTS=on`. The file holds no secret, so it is
safe to commit; check that your `.gitignore` does not exclude it.

The build prints the value it used and where it came from:

```text
[dk-drafts] DK_PUBLISH_DRAFTS=off (default): draft pages are not built.
[dk-drafts] DK_PUBLISH_DRAFTS=on (env file): draft pages are built, listed and marked noindex.
```

## A mistyped value

Any value other than `on` or `off` stops the build before a page is written:

```text
DK_PUBLISH_DRAFTS must be "on" or "off", but the process environment sets it to
"true". Use "on" to build draft pages (marked noindex) or "off" to leave them
out; "off" is the default.
```

The message names the source: `process environment` or `env file`.

## If your site does not use the toolkit's docs loader

Drafts are removed where the docs collection is loaded, by `docKittyDocsLoader`
from `@spec-kitty/doc-toolkit/schema` (step 4 of
[Consumer setup](./consumer-setup.md)). A site that loads its `docs` collection
some other way is not filtered. With the setting off, such a build still writes
its draft pages and ends with a warning:

```text
[dk-drafts] DK_PUBLISH_DRAFTS is off, but 3 draft page(s) were built: /a/, /b/,
/c/. Drafts are left out where the docs collection is loaded; use
docKittyDocsLoader() in content.config.ts for the setting to take effect.
```

Those pages do carry `noindex`. The marker follows the page, not the setting:
on such a site every rendered page without a `doc_status` is `noindex`, with
either value. The site's root page is the one exception and is never marked.
Switch to the toolkit's loader to leave drafts out, or give each page a status.

## The gates read the same value

`dockitty-check-links` and `dockitty-check-redirect-coverage` resolve the
setting exactly as the build does:
the process environment, then the env files of the site, then `off`. Each
prints one line with the result:

```text
redirect-coverage: DK_PUBLISH_DRAFTS=off (from: default; site root: .; mode: production)
```

Compare it with the `[dk-drafts]` line of the build. If the two differ, the
gate checked a build made with another value.

| Flag | Default | Use it when |
|---|---|---|
| `--site-root <dir>` | the nearest directory with an `astro.config.*` above the directory the gate checks, else the working directory | the docs tree or the build output is outside the site directory |
| `--mode <mode>` | `production` | you check against what `astro dev` reads (`--mode development`) |

## Check your deployment

1. Read the build log of the deployment. It must contain
   `DK_PUBLISH_DRAFTS=off` and must not contain `draft page(s) were built`.
2. Request a page you know is a draft on the live site. It must return 404.
3. If you keep a URL baseline, run the redirect-coverage gate against the built
   output. Its first line must name the value the build used. With drafts off,
   give it your docs tree and your declared redirects, so it can tell an old URL
   that leads to a draft from a lost redirect:

   ```sh
   pnpm exec dockitty-check-redirect-coverage url-baseline.txt dist \
     --docs docs --index-basename README,index \
     --declared-redirects redirects.json
   ```

   `redirects.json` is the map you pass to Astro's `redirects`, as old URL to new
   route without the site base. The gate lists each old URL that leads to a draft
   as *unpublished* and still passes. Without `--docs` or `--declared-redirects`
   it fails those URLs and names the missing flag.

Run each gate with the directory of the build you mean to check. If a package
script already names a directory, a directory you add is appended and the gate
checks the script's own.

## Known limits

- The per-page agent record `api/pages/<slug>.json` exists for a draft when the
  setting is on. It is not linked from the agent index.
- With the setting on, a draft is reachable by anyone who has its URL. `noindex`
  asks search engines not to list it; it is not access control.
- **The env-file reader is the toolkit's own, and smaller than the build
  tool's.** The build tool's loader cannot be imported from an installed copy
  of the package. The differences:
  - Mode is `development` for `astro dev` and `production` for everything else.
    `astro build --mode staging` therefore reads `.env.production`, not
    `.env.staging`. Set the variable in the process environment for such a
    build. (A gate can be told a mode with `--mode`.)
  - Vite's `envDir` option is ignored. The files are read from the site
    directory only.
  - Only keys that start with `DK_` are read.
  - Variables are not expanded (`DK_PUBLISH_DRAFTS=$OTHER` is read literally,
    and stops the build as a mistyped value), and quoting is simpler than
    Vite's: one pair of matching quotes around the whole value, no escapes and
    no multi-line values.
- **Redirect withholding works on static output only.** The toolkit removes a
  redirect's stub file from the build output. Under an adapter that emits
  host-level redirects, or under server-side rendering, there is no stub to
  remove, and a redirect that ends at a draft is not withheld: the old URL
  redirects to a page that returns 404.
- **`noindex` is decided per rendered page**, by its status alone. See
  [If your site does not use the toolkit's docs loader](#if-your-site-does-not-use-the-toolkits-docs-loader).
