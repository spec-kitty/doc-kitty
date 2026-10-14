# Contract: how `dockitty-check-links` gets index names

## Sourcing (per strict root)

1. Find `astro.config.mjs`, `astro.config.ts` or `astro.config.js` in the root's
   parent folder (existing lookup, `check-links.mjs:106`).
2. If found: delete `DK_INDEX_BASENAME` from the environment, evaluate the config
   with Vite `runnerImport` (Vite resolved from the site's `astro` package), then
   read `DK_INDEX_BASENAME`.
3. Otherwise, or when the variable stays unset: the default `['README']`.

The check prints exactly one source line per strict root, to stdout, before its
findings:

```
index names: README,index (from example/astro.config.mjs)
index names: README (default; no astro.config.* next to docs)
index names: README (default; example/astro.config.mjs does not call defineDocKittyIntegrations)
index names: index (from --index-basename)
```

## `--index-basename`

| Config value | Flag | Result |
|--------------|------|--------|
| none | none | default, source "default" |
| set | none | config value |
| none | given | flag value, source "--index-basename" |
| set | same set of names, in any order | config value (the config's order wins); passes |
| set | different | exit 2 before any check runs |

Mismatch message (stderr, exit 2):

```
[dk-check-links] --index-basename index does not match the site's index names
README,index (from example/astro.config.mjs). Remove the flag, or change
indexBasename in example/astro.config.mjs.
```

The comparison is order-insensitive (operator decision `01M4WENQAJN2S0N7WXR12F7YY4`):
`index,README` matches a config of `README,index`. The check always uses the
config's order, because the first name decides generated page names
(`generatedIndexBasename`), so a reordered flag never changes behaviour.

## Config load failure

A config that throws: exit 2 with
`[dk-check-links] could not load example/astro.config.mjs: <error message>`.
The check does not fall back to the default, because a silent default is the
problem FR-007 removes.

## Removed

`DEFAULT_CHECK_INDEX_BASENAMES = ['README', 'index']` (`check-links.mjs:88`).
The help text for `--index-basename` changes to say the value is read from the
site config and the flag is only for sites without one.
