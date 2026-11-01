---
title: Publish OpenAPI reference pages
description: Build versioned API reference pages from OpenAPI 3.x files, and publish each raw file with a checksum. Covers install, config, addresses, errors, CSP hashes and limits.
doc_status: active
updated: 2026-10-31T00:00:00Z
type: Guide
kind: How-To
tags: [openapi, api-reference, configuration, consumer, security]
authors:
  - human:stijn
related:
  - guides/consumer-setup
  - adr/0049-openapi-reference-via-existing-integration
  - adr/0050-route-collisions-and-single-index-setting
  - adr/0060-markdown-processor-unified-for-astro-7
---

# Publish OpenAPI reference pages

**Audience.** A site owner who has an OpenAPI 3.0 or 3.1 file and wants
API reference pages in the docsite, plus a stable link to the raw file.

The `openapi` option builds one set of reference pages for each version of your
API. It also publishes the file you gave it, byte for byte, with a checksum.
The pages render inside the normal DocKitty frame: header, sidebar, table of
contents and footer. They are static HTML. There is no request console and no
browser fetch.

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
        { path: 'openapi/v1.2.0.yaml', label: 'v1.2.0', released: true },
        { path: 'openapi/main.yaml', label: 'main', released: false },
      ],
    },
  }),
});
```

| Field | Meaning |
| --- | --- |
| `renderer` | Required. The `starlight-openapi` plugin factory that you imported. |
| `section` | Optional. Where the pages live. Default `reference/api`. Use lowercase segments of `a-z`, `0-9`, `.`, `_` and `-`. The `api/` root is reserved for the agent API. |
| `specs[].path` | The OpenAPI file, relative to the project root. It must end in `.yaml`, `.yml` or `.json`. |
| `specs[].label` | The version name. It becomes part of the address. Labels must be unique, ignoring case. |
| `specs[].released` | Required, `true` or `false`. An unreleased version carries the "unreleased" badge. |

The file must be one self-contained OpenAPI 3.0 or 3.1 document.

## 3. Use the stable addresses

Each version publishes three things. Treat these addresses as a contract: other
tools can link to them.

| Address | What it is |
| --- | --- |
| `<base>/<section>/<label>/` | The reference pages. |
| `<base>/<section>/<label>/openapi.<ext>` | Your raw document, byte-identical to the input. |
| `<base>/<section>/<label>/openapi.<ext>.sha256` | Its checksum, in `sha256sum` format. |

`<ext>` is the extension of your input file. For the example above, `main`
publishes at `/reference/api/main/openapi.yaml`.

To check a download, fetch both files into one folder and run:

```sh
sha256sum -c openapi.yaml.sha256
# openapi.yaml: OK
```

## 4. What the pages show

- Each version's pages link to the other versions.
- An unreleased version shows a text badge that reads "unreleased".
- `llms.txt` has one line for each version. An unreleased version ends with
  "(unreleased)".
- The pages are in the sitemap and in site search.

Theming comes from the `--dk-*` tokens, so branding applies to these pages as it
does to the rest of the site. The renderer's own stylesheet is not loaded.
DocKitty's `dk-openapi.css` loads only when you set the `openapi` option.

## 5. Fix a build error

Every error starts with `[dk-openapi]`. Where it applies, it names the entry by
index and label, and the file. A failing build publishes nothing.

| Error says | Fix |
| --- | --- |
| `"renderer" is required: add import starlightOpenAPI from 'starlight-openapi' …` | Add the import to `astro.config` and pass `renderer: starlightOpenAPI`. |
| `"specs" must list at least one version` | Add at least one entry to `specs`. |
| `"path" is required`, or `the file must end in .yaml, .yml or .json` | Give each entry a path to a `.yaml`, `.yml` or `.json` file. |
| `cannot read the file`, or `not a file` | Check the path and the file permissions. |
| `the file is empty` | Put the document in the file. An empty file never replaces published output. |
| `cannot parse as YAML or JSON` | Fix the syntax error the message quotes. |
| `not OpenAPI 3.0 or 3.1`, or `Swagger 2 is not supported` | Convert the document to OpenAPI 3.x. |
| `references another file` | Bundle the document into one file. `$ref` values must stay inside it. |
| `"label" is required`, `label may use only …`, or `duplicate label` | Give each version a unique label of `a-z`, `0-9`, `.`, `_` and `-`. |
| `"released" is required and must be true or false` | Set `released: true` or `released: false`. |
| `section … must be …`, or `"api/" is reserved` | Choose a section that follows the rule in the table above. |
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

These are the limits of this version. [ADR-0049](../adr/0049-openapi-reference-via-existing-integration.md)
records them and the follow-ups, and issue #244 tracks the work.

- **Descriptions bypass some checks.** The renderer converts the Markdown in your
  spec's descriptions. The glossary autolinker, the relative-link rewrite and
  the link checks do not see it. ([#257](https://github.com/spec-kitty/doc-kitty/issues/257))
- **Not yet in every site surface.** The generated pages are not in the agent
  API or the content graph. The glossary autolinker and the frontmatter gate do
  not cover them. ([#257](https://github.com/spec-kitty/doc-kitty/issues/257))
- **One bundled file per version.** External and multi-file `$ref` values are
  rejected. Swagger 2 is not supported. ([#260](https://github.com/spec-kitty/doc-kitty/issues/260))
- **Schemas are inlined.** Component schemas appear inside the operations that
  use them. There is no heading for each schema.
- **Raw files in `public/`.** An `openapi.<ext>` file in `public/` with a
  matching `.sha256` beside it counts as generated output. DocKitty may replace
  or prune it. Do not author files at those names.

Planned follow-ups:

- Agent API, content graph, OKF, glossary autolinker, the frontmatter gate and
  Markdown in descriptions: ([#257](https://github.com/spec-kitty/doc-kitty/issues/257)).
- Per-operation search and an `llms.txt` summary of operations: ([#258](https://github.com/spec-kitty/doc-kitty/issues/258)).
- A version dropdown and an archive of older tagged versions: ([#259](https://github.com/spec-kitty/doc-kitty/issues/259)).
- Multi-file `$ref`, Swagger 2 and a remote URL as input: ([#260](https://github.com/spec-kitty/doc-kitty/issues/260)).

## See also

- [ADR-0049: OpenAPI reference pages through an existing integration](../adr/0049-openapi-reference-via-existing-integration.md),
  including its addendum with the spike result, the content-security waiver and
  the supply-chain check.
- [Consumer setup](./consumer-setup.md) for the rest of the site config.
