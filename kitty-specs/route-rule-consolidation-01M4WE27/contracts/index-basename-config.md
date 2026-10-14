# Contract: the `indexBasename` setting

## Integration option (the one place to set it)

```ts
defineDocKittyIntegrations({
  indexBasename: ['README', 'index'], // string | string[]; default 'README'
  // ...
});
```

- Every entry must pass `isPlainIndexName`; a bad entry throws
  `[dk-config] indexBasename ...` when the config is evaluated (today this check
  runs only when `gherkin` is set).
- On every call the normalised list is written to
  `process.env.DK_INDEX_BASENAME` as JSON. The variable is internal; adopters do
  not set it. A later call overwrites an earlier one (same rule as `DK_DOCS_ROOT`).

## Loader behaviour (`docKittyDocsLoader`)

Read at load time (first `resolveIds()` call), not at construction.

| Loader option | `DK_INDEX_BASENAME` | Names used |
|---------------|---------------------|------------|
| omitted | set | published value |
| omitted | unset (no integration, unit tests) | `['README']` |
| given | unset | loader value |
| given, equal after normalisation | set | that value |
| given, different | set | build error |

Mismatch error:

```
[dk-loader] indexBasename ["index"] passed to docKittyDocsLoader does not match
indexBasename ["README","index"] set in defineDocKittyIntegrations. Remove the
option from docKittyDocsLoader in content.config.ts; the loader reads it from
the integration.
```

## Compatibility

- Sites that set the same value in both places: build unchanged; the loader
  option can be removed at leisure.
- Sites that set it only in the loader (the integration then uses `README`):
  today the integration and loader disagree silently; after this change the
  build fails with the message above. This is a Breaking changelog entry.
- Sites that set it nowhere: unchanged.
