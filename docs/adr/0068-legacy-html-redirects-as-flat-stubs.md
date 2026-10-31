---
title: "ADR-0068: Legacy .html URLs redirect through flat stub files"
description: Old .html URLs keep working through a flat meta-refresh file at each old path, written after the build and checked by the redirect-coverage gate.
doc_status: active
updated: 2026-10-31T00:00:00Z
type: ADR
kind: ADR
authors:
  - process:doc-kitty
related:
  - adr/0034-redirect-coverage-gate
  - adr/0037-base-aware-link-fail-closed-gate
  - migrations/legacy-html-urls
---

# ADR-0068: Legacy .html URLs redirect through flat stub files

## Status

Accepted

## Context

`docs.spec-kitty.ai` moves from DocFX to DocKitty
(spec-kitty/spec-kitty#6100). It is a GitHub Pages site on a custom domain,
served at the domain root (`base: '/'`). About 830 of its published URLs end in
`.html` (`/guides/how-to/missions/accept-and-merge.html`). Under DocKitty they
become directory URLs (`/guides/how-to/missions/accept-and-merge/`). Every old
URL must keep working (issue #249).

[ADR-0034](./0034-redirect-coverage-gate.md) uses Astro's `redirects` to emit
redirects, and its gate maps a URL to `<dist>/<path>/index.html`. Nobody had
checked what Astro does with a key that ends in `.html`. A spike built a
minimal Astro 7 site at base `/` and at base `/proj`, with `redirects` keyed
on `/a/b.html`, `/c.html`, `/a/index.html` and `/a/b/index.html`:

- `/a/b.html` was written as the folder `dist/a/b.html/index.html`. The same
  happened at both bases.
- `/a/b/index.html`, where `/a/b/` is a live page, produced
  `dist/a/b/index.html/index.html`. The live page's `dist/a/b/index.html` became
  a folder, so the page was gone. The build reported no error.
- The stub's `Redirecting from` text records `/a/b.html/`, with a trailing
  slash.

GitHub Pages answers a request for `/a/b.html` with the file at `a/b.html`. With
the folder form, there is no such file. The page could only be reached if the
host answered with a redirect to `/a/b.html/`. No test can show that
GitHub Pages does this, and the behaviour is not documented. Other static hosts
differ.

Switching to `build.format: 'file'` keeps `.html` URLs for every page. The
toolkit's gates and routes assume the directory format, so that is not
supported either.

## Decision

1. **Legacy `.html` redirects are a toolkit option, not an Astro redirect.**
   `defineDocKittyIntegrations({ legacyHtmlRedirects: { '/a/b.html': '/a/b/' } })`.
   Sources and targets are site paths without the base, as in `redirects.json`.
   A target may be an absolute URL.
2. **Each one is a flat file at the old path.** In `astro:build:done` the
   toolkit writes `<dist>/a/b.html`. This is the file every static host serves
   for that exact URL, with no host redirect involved. Its markup is Astro's own
   redirect page: a 0-second meta refresh, `noindex`, a canonical link to the
   target (`site` + base + target), and a fallback link. The base is added to
   the target, so the same map works at `/` and under a base path. Because the
   file is written after every route and the sitemap have been generated, it is
   not in the sitemap, `llms.txt` or the agent API.
3. **Chains in the map are flattened**: `/a.html -> /b.html -> /c/` is written
   as `/a.html -> /c/`. A loop fails the build. A chain that leaves the map,
   into a directory redirect, is followed by the gate.
4. **`/x/index.html` needs no file while `/x/` is a page.** The host already
   serves the page at that URL. The entry is accepted and logged as served by
   its page, so the mechanical map can list it. When `/x/` is no longer a page,
   the stub is written at `dist/x/index.html` and also redirects `/x/`.
5. **Nothing is overwritten.** If a file or folder already exists at a source
   path, the build fails and names it. Examples are a page, an asset from
   `public/`, or an Astro stub.
6. **Astro `redirects` keys that end in `.html` fail the build.** The error
   names the keys and this option. This is because of the page the spike lost.
7. **Drafts.** With `DK_PUBLISH_DRAFTS` off, an entry whose target is a draft
   page is left out and named in the build log, as for a directory redirect.
   The old URL returns 404 until the target is published.
8. **The redirect-coverage gate reads `.html` URLs as files.** A baselined
   `/a/b.html` resolves to `<dist>/a/b.html`, never to a folder. The dead-stub
   walk finds flat stubs as well. Chains are followed across both kinds of
   redirect, and a dead target fails the gate. An Astro folder-form stub does
   not cover the URL, and the verdict names it.
   `--declared-redirects` may be given more than once, so the gate can read the
   directory map and the legacy map together.
9. **A helper writes the mechanical map.**
   `generate-legacy-redirects.mjs <baseline>` maps `/x.html` to `/x/`,
   `/x/index.html` to `/x/` and `/index.html` to `/`. It reads the committed
   list of the old site's URLs, and `--overrides` covers pages that moved.
10. **`astro dev` answers each legacy URL with a 302**, so the map can be tried
    without a build.

## Consequences

- An old `.html` URL gives a 200 with the stub, then one meta refresh to the
  page. This holds on any static host, without depending on GitHub Pages
  behaviour that is not documented.
- A meta refresh is not an HTTP 301. Search engines treat a 0-second refresh
  with a canonical link as a permanent move, but more slowly. GitHub Pages
  cannot send a 301 for a path, so this is the best a Pages site can do.
- A site that had Astro `redirects` keyed on `.html` now fails to build until
  it moves those keys to `legacyHtmlRedirects`. Before this change, that output
  was either unproven or broke the page.
- The URL baseline of ADR-0034 can now hold `.html` URLs. A migrating site
  commits the old site's URL list as its baseline before the move.

## Alternatives considered

- **Prove the folder form works on GitHub Pages and document it.** Only a test
  against the real host could prove it, and that would tie the toolkit to one
  host's undocumented behaviour. The `/x/index.html` case would still lose the
  page. Rejected.
- **`build.format: 'file'`.** This keeps `.html` URLs for every page, but the
  site would not have the directory URLs it is moving to. The toolkit's gates do
  not support that format. Rejected.
- **Rewrite Astro's folder output to flat files after the build.** This would
  depend on Astro's output shape, and Astro would already have replaced the
  `/x/index.html` page before the rewrite ran. Rejected.
