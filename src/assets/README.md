# Doc Kitty toolkit assets

Ships shared static assets consumed by the chrome carriers and layouts (exported
via `@commondocs-kitty/toolkit/assets/*`). Kept as a tracked directory so the
`./assets/*` package export always resolves.

- `social-default.png` — the neutral site-default share card (1200×630). The
  `Head` carrier (`components/slots/HeadShare.astro`) imports it directly as the
  terminal fallback for `og:image` / `twitter:image` when a page sets neither
  `social_thumb` nor `hero_image`. Consumed via a package-relative import, not
  the `./assets/*` export, so the optimized-image pipeline processes it.
