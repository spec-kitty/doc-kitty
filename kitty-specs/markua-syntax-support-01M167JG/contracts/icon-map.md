# Contract: icon map (Font Awesome → Starlight seed map)

The curated Font Awesome → Starlight name map that resolves `{icon: fa-name}` on a
callout, plus the graceful-drop behaviour for an unmapped name. Lives in
`src/lib/markua/icon-map.ts` with a pure lookup that vitest covers.

## Entry shape

```ts
interface IconMapEntry {
  fa: string;        // the `fa-…` name an author writes, e.g. "fa-lightbulb"
  starlight: string; // the Starlight <Icon> name it maps to
}
```

- The map is a lookup keyed by the `fa` name; `lookup(fa)` returns the Starlight
  name or `undefined`.
- Author input is the `fa-` prefixed name (Markua's Font Awesome convention);
  a value with no `fa-` prefix is treated as unmapped.

## Initial curated seed set

A small, sensible starting set covering the common callout icons. The map is
designed to grow (spec assumption); Starlight target names are verified against the
pinned Starlight `<Icon>` set during implementation, and any that has no Starlight
equivalent is left out of the seed rather than guessed.

| Font Awesome (`fa`) | Starlight (`starlight`) | Typical use |
|---------------------|-------------------------|-------------|
| `fa-lightbulb` | `rocket` | tip / idea |
| `fa-info-circle` | `information` | information |
| `fa-exclamation-triangle` | `warning` | warning |
| `fa-exclamation-circle` | `error` | error |
| `fa-check` | `approve-check` | done / success |
| `fa-times` | `close` | not / removed |
| `fa-question-circle` | `question` | question |
| `fa-comments` | `comment` | discussion |
| `fa-pencil` | `pencil` | exercise / edit |
| `fa-star` | `star` | highlight |
| `fa-flag` | `flag` | note / marker |
| `fa-bookmark` | `bookmark` | reference |
| `fa-book` | `open-book` | reading |
| `fa-code` | `seti:code` | code note |
| `fa-terminal` | `seti:shell` | command |
| `fa-cog` | `setting` | configuration |
| `fa-clock` | `clock` | timing |
| `fa-user` | `user` | persona / role |

> The exact Starlight target names are confirmed against the `@astrojs/starlight`
> `0.32.6` icon set in IC-05; where a listed target is not a real Starlight icon it
> is corrected or the row is dropped (never shipped pointing at a non-existent icon).
> ~18 seed rows; the count is not load-bearing, the graceful-drop behaviour is.

## Resolution and graceful drop

- **Mapped** (`{icon: fa-lightbulb}` with a seed entry): the callout renders with
  the mapped Starlight icon (US4 sc.1).
- **Unmapped** (`{icon: fa-obscure-name}` with no entry): the callout **still
  renders, without an icon**, and the build emits a **warning naming the unmapped
  `fa-` name**; the build exits 0 (US4 sc.2, FR-010, NFR-002). The page is never
  failed over an unknown icon.
- **No `{icon:}`**: the callout renders without an icon (no warning).

## Placement on the two callout targets

- **Theme callout** (`aside`/`discussion`/`question`/`exercise`/`center`/`generic`):
  the resolved Starlight icon name is emitted as the `dk-callout__icon` child of WP04's
  callout hast (`<aside class="dk-callout …">`, `callout-mapping.md` — **not** an
  `.astro` component; the four-carrier `components` lock forecloses that). The callout
  hast schema carries the icon from the start, so this concern adds only `icon-map.ts` +
  its lookup, not new plumbing in the callout plugin or `theme.css`.
- **Starlight-mapped class** (`tip`/`warning`/`error`/`information`): Starlight's
  `remarkAsides` **discards a directive's attributes** when it rebuilds the aside, so
  an icon cannot ride the native aside. Therefore a mapped-class callout that carries
  `{icon: …}` (**or `{#id}`**) **routes to the theme-callout hast**
  (`dk-callout--{mapped-name}` fallback variant) instead of the native aside, so the
  attribute survives. This is the same attribute-routing rule the
  callout-mapping contract pins; icons are P3 (cosmetic) and a mapped callout with no
  attribute keeps the native-aside path.

## Guarantees

- The build **never fails** on an icon (mapped, unmapped, or malformed) — NFR-002.
- The lookup is pure and deterministic; the seed set and the graceful-drop path each
  have a vitest case (mapped-hit, unmapped-miss-with-warning).
