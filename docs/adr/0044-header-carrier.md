---
title: "ADR-0044: Header is the fifth carrier; a theme replaces the site header through dk:site-header"
description: The Starlight components map grows from four carriers to five. The Header carrier renders a theme's dk:site-header component in place of the stock header.
doc_status: active
updated: 2026-10-13
type: ADR
kind: ADR
authors:
  - stijn@sddevelopment.be
related:
  - adr/0013-m1-chrome-substrate-single-layer
  - adr/0015-m2-slot-resolution-and-components-map-seam
  - adr/0045-frame-width-token
  - architecture/theming
  - guides/theme-header
---

# ADR-0044: Header is the fifth carrier; a theme replaces the site header through `dk:site-header`

## Status

Accepted (2026-10-13).

Supersedes in part: the "exactly four carriers" clause of
[ADR-0013](./0013-m1-chrome-substrate-single-layer.md) (decision 3 and the
extension points) and of
[ADR-0015](./0015-m2-slot-resolution-and-components-map-seam.md) (decision 3),
and the places that restate it:
[ADR-0017](./0017-m3-content-block-rendering-seam.md) (decision 4 and its risk
mitigation) and [ADR-0030](./0030-markua-preprocess-to-directive.md)
(decision 4). It is the separate record that ADR-0015 decision 4 said the first pass-through
wrapper would take. Everything else in the four records stands.

## Context

The toolkit registers a fixed set of its own components in Starlight's
`components` map. These are the *carriers*. Until this record there were four:
`Head`, `PageTitle`, `MarkdownContent` and `Footer`. A theme never writes that
map. It names `dk:` slots, and each carrier renders the theme's component at the
slots it hosts. ADR-0013 and ADR-0015 locked the map at four so that:

- a theme cannot depend on Starlight's component names, so a Starlight rename is
  fixed in the carriers and not in every theme;
- the map is the same with or without a theme, so adding a theme cannot change
  which components Starlight replaces;
- a consumer's `starlight.components` escape hatch cannot add an override the
  toolkit does not know about (the map is applied after the consumer's values).

The slot name `dk:site-header` has been part of the theme types since the theme
layer shipped, as a declared pass-through. No carrier read it, so a theme that
set it got nothing. A theme could restyle the stock header through `logo`,
`title` and CSS, but it could not replace it, for example with a brand bar that
holds a product switcher.

ADR-0015 decision 4 anticipated this: pass-through slots that map onto
non-carrier Starlight components would be delivered later by toolkit-owned
wrapper components, "and it takes its own record then".

## Decision

1. **The `components` map holds exactly five carriers**: `Head`, `PageTitle`,
   `MarkdownContent`, `Footer` and `Header`. The invariant keeps its shape: a
   fixed set, owned by the toolkit, identical with or without a theme, applied
   after the consumer's escape hatch.
2. **`Header` hosts one slot, `dk:site-header`, and replaces instead of
   composing.** When a theme supplies a component for the slot, the carrier
   renders that component and not Starlight's header. When no theme supplies
   one, it renders Starlight's header. `Footer` composes around its default
   because the article footer must survive a brand band; a site has one header,
   so this carrier is either/or.
3. **The carrier adds nothing of its own.** No wrapper element, no
   `data-dk-slot` marker, no attribute, no text node. Starlight's page frame
   already wraps whatever the carrier renders in `<header class="header">`.
4. **No further carrier is added without a new record.** The other pass-through
   names (`dk:site-title`, `dk:social-links`, `dk:announcement`, `dk:toc`,
   `dk:toc-mobile`, `dk:pagination`, `dk:last-updated`, `dk:edit-link`) stay
   declared and unrendered.

A theme declares the header as a slot value: a package-export specifier when the
theme ships as a package, or an absolute path when the component lives in the
site.

```ts
slots: { 'dk:site-header': '@your-scope/docs-theme/SiteHeader.astro' }
```

## Consequences

### What a replacement header gets

Measured against Starlight 0.32.6.

- It renders once, inside Starlight's own `<header class="header">`. That
  element belongs to Starlight's page frame, so the component must not emit a
  `<header>` of its own. It inherits the positioning, height and padding of
  `header.header`, including the inline padding the toolkit adds when the frame
  is capped ([ADR-0045](./0045-frame-width-token.md)).
- The framework keeps two things that are rendered outside the header: the skip
  link, and on pages with a sidebar the mobile menu toggle. A replacement header
  supplies neither.

### What a replacement header gives up

Everything the stock header drew. A theme supplies what it still wants: the site
title and logo, search, the social icons, the theme select and the language
select. Each is available from Starlight's published component exports. The
[theme header guide](../guides/theme-header.md) shows how and says what a reader
loses when each is left out.

### Without a theme header nothing changes

A site whose theme sets no `dk:site-header` gets the stock header. The header
block of every framed page is compared, in a test, with the block captured from
the build before the carrier existed. Only Astro's scoped-class hashes are
normalised, because they encode the checkout path.

### Known limitations

- **A consumer's own `Header` override is still discarded.** A `Header` passed
  through `starlight.components` is dropped, as overrides of the other four
  carriers always were. This is not a behaviour change. The supported route to a
  custom header is the theme slot.
- **Slot names are checked by TypeScript only.** A theme written in plain
  JavaScript with a misspelt slot name (`dk:site-heaer`) is accepted and the slot
  is ignored without a message. This has always been true of every slot.
- **A theme header is still coupled to Starlight's component paths.** The recipe
  in [Theme header](../guides/theme-header.md) imports `SiteTitle`, `Search` and
  `ThemeSelect` straight from `@astrojs/starlight/components/`, so a Starlight
  release that moves those files breaks the theme. Re-exporting the parts from
  the toolkit would remove the coupling; no issue tracks it yet. Issue #119 (the
  move to Astro 7 and Starlight 0.41) is where a path change would first show.
- **The carrier emits no marker**, so the built-output gate that proves the other
  four carriers are live cannot see this one. Its tests compare header markup
  instead.

## Alternatives considered

- **Leave it to the consumer's escape hatch.** Let a site pass its own `Header`
  through `starlight.components`. Rejected: the map would differ between sites,
  a theme could not carry a header, and the theme would be coupled to
  Starlight's component name, which is what the carrier set exists to prevent.
- **Sub-slots inside the stock header** (a slot each for the title, the search
  box and the right-hand group). Rejected for now: it needs a toolkit copy of
  Starlight's header markup and layout CSS, which is a larger surface to keep in
  step with Starlight than one replace-or-default branch. A theme that wants the
  stock parts can import them into its own header.
- **Compose around the stock header**, as `Footer` does. Rejected: two headers,
  or a band above the header, changes the height that Starlight's sidebar and
  rail offsets are computed from.
