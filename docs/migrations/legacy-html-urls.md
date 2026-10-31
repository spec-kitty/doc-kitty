---
title: Keeping .html URLs when moving from DocFX
description: How a site that published .html URLs (DocFX, Sphinx, Jekyll) moves to DocKitty's directory URLs and keeps every old URL working, at the domain root or under a base path.
doc_status: active
updated: 2026-10-31T00:00:00Z
type: Migration
kind: How-To
authors:
  - process:doc-kitty
tags: [migration, redirects, docfx, github-pages]
related:
  - adr/0068-legacy-html-redirects-as-flat-stubs
  - adr/0034-redirect-coverage-gate
  - guides/consumer-setup
---

# Keeping .html URLs when moving from DocFX

This guide is for a site whose published URLs end in `.html`, for example
`/guides/how-to/accept-and-merge.html`. DocKitty serves the same page at
`/guides/how-to/accept-and-merge/`. Follow the steps in order. When you are
done, every old URL leads to its new page, and CI fails if one stops working.

The toolkit writes each old URL as a small file at the old path,
`dist/guides/how-to/accept-and-merge.html`. The file sends the browser on to
the new page. It is marked `noindex`, carries a canonical link to the new page,
and is not listed in the sitemap, `llms.txt` or the agent API. Any static host
serves it, GitHub Pages included. The reasons are in
[ADR-0068](../adr/0068-legacy-html-redirects-as-flat-stubs.md).

## 1. Capture the old site's URLs before you switch

Commit the list of URLs the old site publishes, one per line, without the
domain. Do this while the old site is still live. It is the baseline the gate
checks against, so it must not be generated from the new build.

```text
# url-baseline.txt: the URLs docs.example.org published before the move
/index.html
/guides/index.html
/guides/how-to/accept-and-merge.html
/reference/cli.html
```

For a DocFX site, the paths in its `sitemap.xml` or `xrefmap.yml` make a good
start. Add the old redirect stubs the site already serves.

## 2. Generate the redirect map

```sh
pnpm exec dockitty-generate-legacy-redirects \
  url-baseline.txt --overrides legacy-overrides.json --out legacy-redirects.json
```

Each `.html` URL is mapped by rule:

| Old URL | New URL |
|---------|---------|
| `/x.html` | `/x/` |
| `/x/index.html` | `/x/` |
| `/index.html` | `/` |

Put the pages the rule gets wrong in `legacy-overrides.json`, in the same
`{ "old": "new" }` shape. These are pages that moved or were merged into
another page. Their entries win over the rule. URLs in the list that do not
end in `.html` are reported and left out; cover them with Astro's `redirects`
as usual.

Review `legacy-redirects.json` and commit it. Re-run the command whenever you
change the overrides; the output is sorted, so the diff shows only what
changed.

## 3. Pass the map to the toolkit

```js
// astro.config.mjs
import { readFileSync } from 'node:fs';
import { defineConfig } from 'astro/config';
import { defineDocKittyIntegrations } from '@spec-kitty/doc-toolkit/config';

const legacyHtmlRedirects = JSON.parse(
  readFileSync(new URL('./legacy-redirects.json', import.meta.url), 'utf8'),
);

export default defineConfig({
  site: 'https://docs.example.org',
  // A custom domain or user site: no `base`. A project site: base: '/<repo>'.
  integrations: defineDocKittyIntegrations({
    title: 'Example docs',
    legacyHtmlRedirects,
  }),
});
```

Write sources and targets without the base. The toolkit adds the base to each
target, so the same map works at the domain root and under `/<repo>`.

Do not put `.html` keys in Astro's own `redirects`. Astro writes them as a
folder (`dist/x.html/index.html`) and can replace a live page, so the build
fails and names the keys. Move them to `legacyHtmlRedirects`.

The build log says how many stubs it wrote:

```text
[doc-kitty:legacy-html-redirects] wrote 412 legacy .html redirect stub(s); 37 index.html URL(s) are served by their own page
```

An `/x/index.html` entry needs no file while `/x/` is a page: the host already
serves that page at `/x/index.html`.

The build fails if a file is already at an old path, for example an asset you
copied into `public/`. It also fails when the map has a loop. A chain such as
`/a.html -> /b.html -> /c/` is shortened to one step.

`astro dev` answers each old URL with a redirect, so you can try the map
before you build.

## 4. Gate it in CI

Run the redirect-coverage gate after the build:

```sh
pnpm exec dockitty-check-redirect-coverage url-baseline.txt dist
```

For each URL in the baseline, the gate looks for the file a static host serves
for it. For `/x.html` that is `dist/x.html`, never a folder. The gate follows
the redirect chain to a live page. It fails on:

- a URL with no page and no stub;
- a stub whose target is missing;
- any stub in `dist/`, baselined or not, that leads nowhere.

If your deployment builds with `DK_PUBLISH_DRAFTS=off`, give the gate both
maps so an old URL into a draft is reported as unpublished, not as lost:

```sh
pnpm exec dockitty-check-redirect-coverage url-baseline.txt dist --docs docs \
  --declared-redirects redirects.json --declared-redirects legacy-redirects.json
```

## 5. Check after the first deploy

Open a few old URLs on the live site, at least one `x.html` and one
`x/index.html`. Each should show the new page, with the new URL in the address
bar. A search engine treats the stub as a permanent move. It sees a 0-second
refresh and a canonical link, not an HTTP 301, so expect the index to update
over a few weeks.
