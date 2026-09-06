# Contract: feed and collection ordering (#85)

```ts
// src/lib/metadata.ts
export function compareSlug(a: string, b: string): number
// the ONE slug comparator: locale-independent, ascending, total for unique slugs

export function sortBySlug(entries: DocEntry[]): DocEntry[]
// non-mutating copy ordered by slug asc; the baseline collectDocEntries applies

export function rankForFeed(entries: DocEntry[]): DocEntry[]
// published only; ORDER: updatedMillis desc, then slug asc (locale-independent)

// src/lib/routes/shared.ts
export async function collectDocEntries(): Promise<DocEntry[]>
// ORDER: slug asc (via metadata.ts's sortBySlug), regardless of the Astro
// collection's insertion order
```

- `rankForFeed`'s comparator is TOTAL: for any two distinct published entries
  it returns a non-zero result. A shuffled input ranks identically.
- `collectDocEntries` returns entries sorted by slug. Consumers may rely on
  that as a stable baseline but MUST still sort by their own total key when
  they need a different order.
- Acceptance: unit shuffle test; two clean builds hash-identical; pre/post
  corpus diff confined to `rss.xml` item order.
