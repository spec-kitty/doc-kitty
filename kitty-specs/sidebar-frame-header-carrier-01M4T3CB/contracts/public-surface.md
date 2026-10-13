# Public surface contract

This mission adds three consumer-facing surfaces. Each is covered from the packed tarball (C-006).

## 1. Frame-width token

```css
:root { --dk-width-frame: 90rem; } /* opt-in cap; default is 100% */
```

- Accepts a length or a percentage.
- An invalid value behaves as `100%`.
- With a cap smaller than the viewport, the frame is centred and the left sidebar, header content and rail sit at the frame's edges.

## 2. Draft-publication setting

```
DK_PUBLISH_DRAFTS=on   # drafts built, listed, marked noindex
DK_PUBLISH_DRAFTS=off  # default: drafts not emitted anywhere
```

- Read from the process environment, then from the site's env files.
- Any other value stops the build: the message names `DK_PUBLISH_DRAFTS` and the values `on` and `off`.
- Sitemap, feeds, `llms.txt` and the agent index never list drafts.

## 3. Header slot

A theme may supply a component for the `dk:site-header` slot. The toolkit renders it once, inside the framework's own `<header class="header">` element, with no wrapper.

A replacement header:

- must not emit its own `<header>` element; it inherits the framework header's position, height and padding
- keeps the skip link and, on pages with a sidebar, the mobile menu control, because the framework renders both outside the header component
- loses the site title and logo, search, social links, theme switch and language switch, and supplies whichever of those it wants

With no component supplied, header markup is byte-identical to a build before this mission.

*Corrected during implementation: the first version of this contract listed the skip link and mobile menu control as the theme's responsibility.*

## Unchanged

- Storage key `dk-toc-collapsed` and root attribute `data-toc-collapsed`.
- A consumer's own `sidebar` configuration and framework escape hatch take precedence.
- Advertised framework peer ranges.
