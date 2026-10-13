---
title: Theme header — replace the site header from a theme
description: How a theme supplies its own site header through the dk:site-header slot, what Starlight keeps for it, and which parts of the stock header the replacement has to put back.
doc_status: active
updated: 2026-10-13
type: Guide
kind: How-To
tags: [theming, header, slots, consumer]
authors:
  - stijn@sddevelopment.be
related:
  - guides/consumer-setup
  - architecture/theming
  - adr/0044-header-carrier
---

# Theme header — replace the site header from a theme

**Audience.** A theme author, or a site owner with a consumer theme, who wants a
header that the stock one cannot be styled into: a brand bar, a product
switcher, a different arrangement.

If you only want a logo, a different title or different colours, you do not need
this. Set the theme's `assets.logo` and its `--dk-*` tokens and keep the stock
header.

**A site whose theme supplies no header is unaffected.** It renders Starlight's
stock header, with the same markup as before this extension point existed.

## 1. Write the header component

Write an Astro component. The toolkit renders it once per page, **inside**
Starlight's own `<header class="header">` element, with nothing wrapped around
it.

```astro
---
// src/theme/SiteHeader.astro
import SiteTitle from '@astrojs/starlight/components/SiteTitle.astro';
import Search from '@astrojs/starlight/components/Search.astro';
import ThemeSelect from '@astrojs/starlight/components/ThemeSelect.astro';
---
<div class="brand-header">
  <SiteTitle />
  <Search />
  <ThemeSelect />
</div>

<style>
  .brand-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--sl-nav-gap);
    height: 100%;
  }
</style>
```

Two rules follow from where it is rendered:

- **Do not emit a `<header>` element.** Starlight already provides it. A second
  one gives the page two banner landmarks.
- **Do not position or size the bar.** Your component inherits the position,
  height and padding of Starlight's `header.header`. Fill the height you are
  given (`height: 100%`) and lay out your content inside it.

## 2. Declare it in the theme

Add the component to the theme's `slots`, under the name `dk:site-header`. The
value is a module the build can import: a **package-export specifier** when the
theme ships as a package, or an **absolute path** when the component lives in
your site.

```ts
// src/theme/index.ts  (a consumer theme, component in the site)
import { fileURLToPath } from 'node:url';
import { specKittyTheme } from '@spec-kitty/doc-toolkit/themes/spec-kitty/index.ts';
import type { DocKittyOptions } from '@spec-kitty/doc-toolkit/config';

type DocKittyTheme = NonNullable<DocKittyOptions['theme']>;

export const myTheme: DocKittyTheme = {
  name: 'press',
  extends: specKittyTheme,
  slots: {
    'dk:site-header': fileURLToPath(new URL('./SiteHeader.astro', import.meta.url)),
  },
};
```

```ts
// a theme published as a package
slots: { 'dk:site-header': '@your-scope/docs-theme/SiteHeader.astro' },
```

Pass the theme to `defineDocKittyIntegrations({ theme: myTheme, … })` as in
[Consumer setup](./consumer-setup.md), step 3. Nothing else changes in your
configuration.

## 3. Put back what you still want

A replacement header gets **none** of what the stock header drew. Starlight
publishes each part as a component, so you can import the ones you want, as the
example above does.

| Part | Import | If you leave it out |
|---|---|---|
| Site title and logo | `@astrojs/starlight/components/SiteTitle.astro` | The header has no link back to the home page, and the theme's logo is not shown anywhere. |
| Search | `@astrojs/starlight/components/Search.astro` | Readers cannot search the site. The search index is still built; nothing opens it, and the keyboard shortcut does nothing. |
| Theme select | `@astrojs/starlight/components/ThemeSelect.astro` | Desktop readers cannot switch between light and dark. The page follows the operating-system setting, or the choice a returning reader stored earlier. |
| Social icons | `@astrojs/starlight/components/SocialIcons.astro` | The links from your `social` option are not shown on desktop. |
| Language select | `@astrojs/starlight/components/LanguageSelect.astro` | On a site with more than one locale, desktop readers cannot change language. On a single-locale site it renders nothing anyway. |

The last three are also drawn by Starlight at the foot of the mobile menu, on
pages that have a sidebar. That copy is outside the header and stays, so below
the 50rem breakpoint readers keep them whatever your header does.

## What Starlight keeps for you

Two things are rendered outside the header, so they survive a replacement and
your component supplies neither:

- **The skip link** to the main content. It stays the first focusable element of
  the page.
- **The mobile menu toggle**, on pages that have a sidebar. Below the 50rem
  breakpoint it still opens the sidebar, and the menu still ends with the social
  icons, the theme select and the language select.

## Header content and a capped frame

The header bar always spans the viewport, so its background and bottom border
reach both edges. When the site caps the page frame with `--dk-width-frame`, the
toolkit adds inline padding to `header.header` so that the header's **content**
lines up with the frame's edges. Your component is inside that padding and gets
this for free. Do not add your own centring or `max-width` to compensate. See
[Cap the page width](./consumer-setup.md#cap-the-page-width).

## Known limitations

- **Slot names are checked by TypeScript only.** In a theme written in plain
  JavaScript, a misspelt name such as `dk:site-heaer` is accepted and ignored
  without a message, and you get the stock header. Type the theme as shown above
  to have the name checked. This applies to every slot, not only this one.
- **A `Header` passed through Starlight's `components` option is discarded.**
  The toolkit owns that map. This was already the case before the slot existed.
  Use the slot.
- **The other header-related slot names are not rendered yet.** The theme types
  also declare `dk:site-title` and `dk:social-links`. Setting them has no
  effect. To change the title or the icons, replace the header and render your
  own.

## Check it

Build the site and open any page. The page has exactly one `<header>` element,
your component is inside it, and the skip link is still the first thing the Tab
key reaches. The toolkit's own consumption test builds a site with a theme
header from the published package and asserts the same three things on every
page.

The decision behind this extension point is
[ADR-0044](../adr/0044-header-carrier.md).
