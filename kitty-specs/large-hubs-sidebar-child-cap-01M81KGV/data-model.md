# Data model: Large hubs: sidebar child cap

## Settings (inputs)

| Where | Key | Type | Validation |
|---|---|---|---|
| Site config | `sidebar.childCap` | positive integer | throws `[dk-config] sidebar.childCap must be a positive whole number` |
| Site config | `sidebar.cappedLabel` | non-empty string, may hold `{count}` | throws on blank or non-string |
| `sections.yaml` / charter `sections.entries` | `sidebar.childCap` on an entry | positive integer | throws `<src>: section "<id>" sidebar.childCap must be a positive whole number` |
| Hub index frontmatter | `sidebar_child_cap` | positive integer | schema (zod `int().positive()`) and `validate-frontmatter` |

`sidebar.childCap` and `sidebar.cappedLabel` join `indexLabel`, `collapsed`, `titleIsIndex` in the object form of `sidebar`; the unknown-key error lists them.

## Resolution

`resolveChildCap({ hub, section, site })` → first defined of hub, section, site, else `DEFAULT_CHILD_CAP` (50).

## HubCap (build-time, per hub over its cap)

```ts
interface HubCap {
  cap: number;          // resolved cap
  count: number;        // selectHubChildren(...).length
  children: { slug: string; label: string }[]; // hub order; label = sidebar.label ?? title
}
```

Serialised in `virtual:doc-kitty/route-shaping` as `hubCaps: Array<[dir, HubCap]>`, sorted by `dir` (code unit). Hubs at or under their cap are not emitted. `cappedLabel?: string` carries the site option.

## Capped entry (shaped sidebar)

A Starlight link entry: `{ type: 'link', label: <resolved label>, href: <hub index href>, isCurrent, badge: undefined, attrs: {}, dkCappedHub: <dir> }`. `isCurrent` is true when the current page is a descendant of `<dir>` (not the hub itself).

## Invariants

- A capped group holds exactly its index link and its capped entry.
- At most one sidebar entry is current.
- `hubCaps` empty ⇒ `shapeSidebar`, pagination, relabelling and icons behave exactly as before.
