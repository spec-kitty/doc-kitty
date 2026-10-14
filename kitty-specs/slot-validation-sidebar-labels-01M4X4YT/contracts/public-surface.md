# Public surface changes

What this mission changes for a consuming site or theme author.

## Theme (`@spec-kitty/doc-toolkit` theme layer)

| Surface | Before | After |
|---|---|---|
| `DkSlotName` | type-only union of 16 names | derived from `DK_SLOT_NAMES`; same 16 names |
| `DK_SLOT_NAMES` | absent | new export from `src/lib/theme.ts`: `readonly` tuple of the 16 names |
| `resolveTheme(theme)` / `defineDocKittyIntegrations({ theme })` with an unknown slot key in any layer | accepted; slot ignored | throws `Error`: `DocKittyTheme "<name>" fills an unknown slot "<key>". Valid slot names: …` |
| … with a `slots` value that is not an object | `Object.keys` over it; garbage keys | throws `Error`: `DocKittyTheme "<name>".slots must be an object …` |

Breaking for a site whose theme names an unknown slot (ADR-0052). Such a site
was already rendering the stock component.

## Sidebar (generated sidebar only; a consumer-supplied `sidebar` is untouched)

| Situation | Before | After |
|---|---|---|
| Nested folder whose only published page is its index | group holding one link with the same name | that link, in the folder's place among the subgroups |
| Index entry first in a group, label equal to the group label | repeats the label | reads `Overview` (`INDEX_ENTRY_LABEL`, new export of `route-shaping.ts`) |
| … and another link in the group already reads `Overview` | n/a | index keeps its own label |
| Prev/next link to a relabelled index | n/a | page title, not `Overview` |
| Top-level section groups | unchanged | unchanged (never collapsed) |

No change to routes, the sitemap, feeds, `llms.txt` or the agent API.
