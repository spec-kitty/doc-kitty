---
title: Publish OpenAPI reference pages
description: Build versioned API reference pages from OpenAPI 3.x or Swagger 2.0 files, folders, archives or pinned URLs, and publish each raw document with a checksum.
doc_status: active
updated: 2026-11-08T00:00:00Z
type: Guide
kind: How-To
tags: [openapi, api-reference, configuration, consumer, security]
authors:
  - human:stijn
related:
  - guides/consumer-setup
  - adr/0049-openapi-reference-via-existing-integration
  - adr/0078-openapi-surface-matrix
  - adr/0050-route-collisions-and-single-index-setting
  - adr/0060-markdown-processor-unified-for-astro-7
---

# Publish OpenAPI reference pages

**Audience.** A site owner who has an OpenAPI definition and wants API reference
pages in the docsite, plus a stable link to the raw document.

The `openapi` option builds one set of reference pages for each version of your
API. It also publishes the raw document with a checksum: a single-file input
byte for byte, a multi-file input as the bundle the build makes of it
(§4a has the full list). The
pages render inside the normal DocKitty frame: header, sidebar, table of
contents and footer. They are static HTML. There is no request console and no
browser fetch.

A version's input is a local root file plus the files its relative `$ref`s
reach, a matched file from an archive glob, or a pinned `https` URL. Swagger
2.0 documents are accepted; the original bytes are published and any
conversion happens in memory only.

The option is off unless you set it. A site that does not set it installs and
builds as before.

## 1. Install the two optional peers

The renderer is `starlight-openapi`. It needs `@astrojs/markdown-satteri`. Both
are optional peers of the toolkit, pinned to exact versions. Add them to your
project:

```sh
pnpm add --save-exact starlight-openapi@0.27.0 @astrojs/markdown-satteri@0.4.4
```

`@astrojs/markdown-satteri` is already in your install tree through Starlight.
The top-level install records it as your own dependency, so the version stays
fixed. The toolkit never imports either package. Your `astro.config` does.

## 2. Configure the option

Import the renderer, and pass it as `renderer`. List one entry per version.

```js
// astro.config.mjs
import { defineConfig } from 'astro/config';
import { defineDocKittyIntegrations } from '@spec-kitty/doc-toolkit/config';
import starlightOpenAPI from 'starlight-openapi';

export default defineConfig({
  integrations: defineDocKittyIntegrations({
    // …your other options
    openapi: {
      renderer: starlightOpenAPI,
      section: 'reference/api', // optional, this is the default
      specs: [
        { path: 'openapi/v1-2-0.yaml', label: 'v1-2-0', released: true },
        { path: 'openapi/main.yaml', label: 'main', released: false },
      ],
    },
  }),
});
```

| Field | Meaning |
| --- | --- |
| `renderer` | Required. The `starlight-openapi` plugin factory that you imported. |
| `section` | Optional. Where the pages live. Default `reference/api`. Use lowercase segments of `a-z`, `0-9`, `_` and `-` — no dots, exactly like a label. The `api/` root is reserved for the agent API. |
| `specs[].path` | A local definition, relative to the project root. It must end in `.yaml`, `.yml` or `.json`. Either `path` or `url`, never both. |
| `specs[].url` | A remote definition. `https:` only, and it requires `sha256`. At most five redirects are followed; the digest is of the final bytes. |
| `specs[].sha256` | 64 lowercase hex. Required with `url`. With `path` it is an optional pin, verified when the file is read. |
| `specs[].label` | The version name. It becomes part of the address. Labels must be unique, ignoring case. |
| `specs[].released` | Required, `true` or `false`. An unreleased version carries the "unreleased" badge. |
| `archive.glob` | Optional. A glob, relative to the project root, never containing `..`. Each matched file becomes one version. At most 200 matches. |
| `archive.labelPattern` | Required with `archive`. A regular expression with exactly one capturing group, applied to each matched file name to derive the label. |
| `archive.released` | Optional, default `true`. The `released` flag every archive-derived version gets. |
| `llmsOperations` | Optional, default `false`. When `true`, `llms.txt` lists one line per operation under each version's line. |
| `offline` | Optional, default from `DOCKITTY_OFFLINE=1`. When `true`, no network request is made: the remote cache is used, or the build fails closed. |

A label may use `a-z`, `0-9`, `_` and `-` (after lower-casing) — **not** a dot.
The renderer drops dots from routes, so a label like `v1.1` would advertise an
address the site does not serve. Write `v1-1`.

An archive of tagged releases, appended after the explicit `specs` in
path order:

```js
openapi: {
  renderer: starlightOpenAPI,
  specs: [{ path: 'openapi/main.yaml', label: 'main', released: false }],
  archive: { glob: 'openapi/v1-*.yaml', labelPattern: '(v1-\\d+)' },
},
```

A pinned remote URL:

```js
openapi: {
  renderer: starlightOpenAPI,
  specs: [
    {
      url: 'https://api.example.test/openapi.json',
      sha256: 'a3f2…64 hex digits…9c',
      label: 'v2',
      released: true,
    },
  ],
},
```

The file must be one self-contained OpenAPI 3.0 or 3.1 document, a Swagger 2.0
document, or a folder of files whose relative `$ref`s stay inside it. A
Swagger 2.0 document and a remote (pinned URL) document must be
self-contained: every `$ref` must start with `#`. An external ref is refused
with `Swagger 2.0 / remote specs must be self-contained; inline the ref or
bundle the document locally`.

## 3. Use the stable addresses

Each version publishes three things, and appears once in the agent surfaces.
Treat these addresses as a contract: other tools can link to them.

| Address | What it is |
| --- | --- |
| `<base>/<section>/<label>/` | The reference pages. |
| `<base>/<section>/<label>/openapi.<ext>` | Your raw document: byte-identical to a single-file input, the bundle of a multi-file input. |
| `<base>/<section>/<label>/openapi.<ext>.sha256` | Its checksum, in `sha256sum` format. |
| One record in `<base>/api/index.json` and `<base>/api/pages/<section>/<label>.json` | The version's agent entry: `released`, `rawDocumentUrl` and `sha256`. |

`<ext>` is the extension of your input file. For the example above, `main`
publishes at `/reference/api/main/openapi.yaml`.

To check a download, fetch both files into one folder and run:

```sh
sha256sum -c openapi.yaml.sha256
# openapi.yaml: OK
```

## 4. What the pages show

- Each version's pages carry a **version switcher**: a dropdown of every
  version, marking the current one and unreleased ones. From an operation page
  it targets the same operation in the other version when that version has it,
  else that version's overview. It is plain links, so it works without
  scripts.
- An unreleased version shows a text badge that reads "unreleased". Its pages
  are built and served, but held back from the sitemap and from site search.
- `llms.txt` has one line for each version. An unreleased version ends with
  "(unreleased)". With `llmsOperations: true`, each version's line is followed
  by one line per operation, indented two spaces: `- METHOD /path: summary`.
- Each version has one entry in the agent API and the content graph, released
  or not, carrying the same `sha256` as the published checksum.
- Released operation pages are individual search results, findable by summary,
  method and path.

## 4a. Where the published bytes come from

- A **single file** publishes its own bytes.
- A **multi-file definition** (relative `$ref`s across local files) is bundled
  into one document: the published `openapi.<ext>` is the bundle, and its
  bytes match **no single source file**. The checksum covers the bundle.
  `$ref` targets must stay inside the definition's folder.
- A **Swagger 2.0** document publishes its original bytes; conversion to what
  the renderer needs happens in memory only.
- A **remote URL** is fetched at most once per build, after at most five
  redirects, with a 30-second timeout and a 10 MB cap. The response's sha256
  must equal the pin, or the build fails. The fetched bytes are cached under
  `node_modules/.cache/doc-kitty/openapi/`, keyed by the digest: an offline
  build (`offline: true` or `DOCKITTY_OFFLINE=1`) makes no request and uses
  the cache, or fails closed with a `[dk-openapi]` error when no valid cached
  copy exists. A corrupted cache entry is fetched again online and fails
  offline.

Theming comes from the `--dk-*` tokens, so branding applies to these pages as it
does to the rest of the site. The renderer's own stylesheet is not loaded.
DocKitty's `dk-openapi.css` loads only when you set the `openapi` option.

## 5. Fix a build error

Every error starts with `[dk-openapi]`. Where it applies, it names the entry by
index and label, and the file. A failing build publishes nothing.

| Error says | Fix |
| --- | --- |
| `"renderer" is required: add import starlightOpenAPI from 'starlight-openapi' …` | Add the import to `astro.config` and pass `renderer: starlightOpenAPI`. |
| `"specs" must list at least one version` | Add at least one entry to `specs`, or set `archive`. |
| `"path" is required`, `the file must end in .yaml, .yml or .json`, or `the match must end in .yaml, .yml or .json` | Give each entry a path to a `.yaml`, `.yml` or `.json` file, or a `url`. |
| `cannot read the file` | Check the path, that the entry is a regular file, and the file permissions. |
| `the file is empty` | Put the document in the file. An empty file never replaces published output. |
| `cannot parse as YAML or JSON` | Fix the syntax error the message quotes. |
| `not OpenAPI 3.0, 3.1 or Swagger 2.0` | Convert the document to OpenAPI 3.x or Swagger 2.0. |
| a `$ref` error (`is not a relative file reference`, `escapes the definition folder`, `cannot resolve the $ref`, …) | Keep `$ref` values inside the definition's folder, as relative file paths. |
| `"label" is required`, `label may use only …`, `label may not contain "."`, or `duplicate label` | Give each version a unique label of `a-z`, `0-9`, `_` and `-` — no dots. |
| `"released" is required and must be true or false` | Set `released: true` or `released: false`. |
| `each "/"-separated segment must be non-empty and use only a-z, 0-9, "_" and "-"`, `a segment may not contain "."`, or `"api/" is reserved` | Choose a section that follows the rule in the table above. |
| `https is required`, `userinfo is not allowed`, or `sha256 is required for a remote spec` | Use an `https:` URL with no user and password, and pin its sha256. |
| `the url must end in .yaml, .yml or .json` | Point the `url` at a `.yaml`, `.yml` or `.json` document. |
| `sha256 mismatch` | The response no longer hashes to the pin. Update the pin, or investigate the change. |
| `redirects: more than 5`, `timeout: remote fetch exceeded 30 seconds`, or `10 MB limit exceeded` | The remote document is unreachable or too large. Serve it within the limits, or use a local file. |
| `offline mode: no valid cached remote spec at …` | Fetch once online to fill the cache, or unset offline mode. |
| `no files match the archive glob`, `no files match the label pattern`, `empty label: labelPattern captured nothing`, `labelPattern must compile` / `must have exactly one capturing group`, `the derived label … contains "."`, or `archive glob must be relative to the site root and stay inside it` | Fix the `archive.glob` (site-root-relative, at most 200 matches) or its `labelPattern` (one capturing group that yields a non-empty, route-safe label). |
| `an authored file is at the path the raw document is published to` | Move or remove the file, or change the label or section. |
| A route collision reported under [ADR-0050](../adr/0050-route-collisions-and-single-index-setting.md) | You have a page at a route the reference pages use. Move the page or change the section. |

## 6. Allow the inline code in your content security policy

The pinned renderer adds a little inline code to its pages. If your site sends a
strict `Content-Security-Policy` header, allow exactly these two hashes. Code
samples are off, so no other inline code is added.

| Where | Addition | Hash |
| --- | --- | --- |
| Every operation page | One inline module script | `sha256-28IjJBwKnS9sgb0aB8YXgnUhJmV3Az7aJiw6QBthXmo=` |
| Each version's overview page | One `style` attribute | `sha256-XlpZgcpFaLbPrgzm4PHCiD/OJXhR+DZxGuVpy2P4Cq0=` |

```text
script-src 'self' 'sha256-28IjJBwKnS9sgb0aB8YXgnUhJmV3Az7aJiw6QBthXmo=';
style-src-attr 'unsafe-hashes' 'sha256-XlpZgcpFaLbPrgzm4PHCiD/OJXhR+DZxGuVpy2P4Cq0=';
```

A hash for a `style` attribute only matches when you also allow
`'unsafe-hashes'`. If you cannot manage hashes, `'unsafe-inline'` is the
alternative, but it also allows every other inline script and style.

The hashes change only when the pinned `starlight-openapi` version changes.
This page lists the hashes for `0.27.0`. The rest of the site adds no inline
code, and the API pages load nothing from another origin. The pages make no
request on the reader's behalf.

## Known limits

These are the limits of this version. [ADR-0078](../adr/0078-openapi-surface-matrix.md)
records the surface decisions and the follow-ups.

- **Descriptions bypass some checks.** The renderer converts the Markdown in your
  spec's descriptions. The glossary autolinker and the relative-link rewrite do
  not see it. The built-page link check does: broken in-scope links and
  `javascript:`, `data:` and `vbscript:` links fail the build.
  ([#257](https://github.com/spec-kitty/doc-kitty/issues/257))
- **Deliberate exclusions.** The pages are not in RSS or Atom feeds, and the
  frontmatter gate does not cover them (they carry no frontmatter; the spec
  input is validated instead). ([#257](https://github.com/spec-kitty/doc-kitty/issues/257))
- **Schemas are inlined.** Component schemas appear inside the operations that
  use them. There is no heading for each schema.
- **Bundled bytes.** A multi-file definition publishes the bundle, whose bytes
  match no single source file. Keep the source of truth and the pin in step.
- **Remote input bounds.** At most five redirects, a 30-second timeout and a
  10 MB cap per fetch. Private and intranet hosts are allowed: the input is
  trusted like your Markdown, and integrity comes from the sha256 pin.
- **Raw files in `public/`.** An `openapi.<ext>` file in `public/` with a
  matching `.sha256` beside it counts as generated output. DocKitty may replace
  or prune it, and the build prints a `[dk-openapi] removed …` warning for each
  file it prunes. Do not author files at those names.

## See also

- [ADR-0049: OpenAPI reference pages through an existing integration](../adr/0049-openapi-reference-via-existing-integration.md),
  including its addendum with the spike result, the content-security waiver and
  the supply-chain check.
- [ADR-0078: The OpenAPI surface matrix](../adr/0078-openapi-surface-matrix.md):
  the synthetic entry shape, which surfaces carry the reference, the input
  contract and the trust model.
- [OpenAPI pages](../architecture/openapi-pages.md) for how it is built.
- [Consumer setup](./consumer-setup.md) for the rest of the site config.
