---
section: Documentation
---

- **The setup guide says how to write redirect targets for a site at the domain
  root (#261).** Before, a config that built its Astro `redirects` targets as
  `` `${BASE}${to}` `` with `BASE = '/'` produced `//new/`, which a browser reads as
  a link to another host. The guide now says to use `''` at the root or strip the
  trailing slash, and the example config strips it.
