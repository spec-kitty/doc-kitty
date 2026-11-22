# Contract: producer registry (`src/lib/producers.mjs`)

```js
createProducerRegistry(entries) → Registry
Registry.ids(role?) → string[]               // registration order
Registry.get(id) → Producer | undefined
Registry.producerOfStamp(by) → string | undefined   // ownership producers, versioned stamp
Registry.ownerOfPage(relPath, data, { scopes?: Record<id, OwnershipScope> }) → string | undefined
inScope(scope, relPath, kind) → boolean
PRODUCER_REGISTRY                            // gherkin, glossary (ownership), scaffold (provenance)
```

Invariants: ids are unique; a provenance producer has no scope and never owns a page; `ownerOfPage` returns the first registered producer that owns the page; registering is pure (no fs).
