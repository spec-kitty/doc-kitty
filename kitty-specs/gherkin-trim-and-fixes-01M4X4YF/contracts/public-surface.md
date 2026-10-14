# Public surface changes

## `defineDocKittyIntegrations({ gherkin })`

New optional key `titles` (object form, with `sources` only):

```js
gherkin: {
  sources: ['features'],
  titles: { hr: 'HR', 'shipping/edi': 'EDI messages' },
}
```

Errors (`[dk-gherkin]`, build stops):

- `gherkin.titles must be an object mapping a source-relative directory to a title; got …`
- `gherkin.titles key "<key>" must be a directory path relative to a source (/ separators; no '.', '..' or empty segment, leading '/', drive letter, scheme or '\')`
- `gherkin.titles["<key>"] must be a non-blank string; got …`
- `gherkin.titles only applies to generated pages; set gherkin.sources as well, or drop gherkin.titles`

Warning: `[dk-gherkin] gherkin.titles key "<key>" matches no source directory with a feature; ignored`

## `generate-feature-pages.mjs` / `dockitty-generate-feature-pages`

New repeatable flag `--titles <dir>=<title>`. Errors name `--titles`.

## Generated pages

- Hubs for directories with no published feature are generated with `doc_status: draft`.
- Hub titles follow `titles`.

## Build

- `astro build` of a site with `gherkin.sources` fails with
  `[dk-gherkin] llms.txt advertises /api/scenarios.json, but the build has no api/scenarios.json. …`
  when the route is not mounted.

## Warnings

- `[dk-gherkin] <file>:<line>:<col> tag @WIP is not the @wip status shorthand (tags are case-sensitive); did you mean @wip? It stays an ordinary tag`
