# Contract: docs-index neutral owner (#90)

```ts
// src/lib/docs-index.ts  (the neutral owner shared by routes AND components)
export async function collectDocEntries(opts?: { withBody?: boolean }): Promise<DocEntry[]>
export function buildDocsIndex(entries: DocEntry[]): DocsIndex
```

- `collectDocEntries` and `buildDocsIndex` are defined ONCE here; `routes/shared.ts`
  keeps only the docs-root resolver and the feed URL/XML helpers (`absolute`,
  `xmlEscape`). Routes and the slot components both import the derivation here.
- `collectDocEntries()` returns entries slug-ascending (#85 baseline). `withBody`
  is opt-in: omitted by default (shape `{slug,data}`, byte-identical to every
  pre-#90 caller); `true` carries `body` (absent → `''`). `DocEntry.body?: string`
  is additive.
- Acceptance: `example/dist` byte-identical to a pre-change build; `Hub.astro`
  has no inline `getCollection('docs').map` and calls
  `collectDocEntries({ withBody: true })`; the shuffle + withBody unit tests pass.
