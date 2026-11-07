# Contract: per-page Atom entry

**Route**: `/api/pages/<slug>.atom.xml`, injected and prerendered.
**Media type**: `application/atom+xml;type=entry`.

```xml
<?xml version="1.0" encoding="utf-8"?>
<entry xmlns="http://www.w3.org/2005/Atom" xml:base="{absolute page URL}">
  <id>{absolute page URL}</id>
  <title>{title}</title>
  <updated>{RFC 3339 from the page's feed date}</updated>
  <author><name>{site title}</name></author>
  <link rel="alternate" type="text/html" href="{absolute page URL}"/>
  <summary>{description}</summary>
  <content type="html">{escaped rendered HTML}</content>
</entry>
```

Rules:

- Emitted only for a published page with a feed date, on a site that sets `site`. With no `site` there are no entries and no Atom links, and the build warns once naming `site`: an `id` must be a stable absolute IRI, and a localhost one is false.
- Same input gives identical bytes.
- `summary` is left out when there is no description.
- `<content>` is left out when the page has no rendered HTML (an `.mdx` page). The `alternate` link keeps the entry valid under RFC 4287, which asks for it when there is no content. MDX pages have no Atom content.
- An Astro image placeholder (`<img __ASTRO_IMAGE_="...">`, no `src`) is replaced by its HTML-escaped `alt` text, or removed with no alt. The optimised image isn't resolved. A real `<img src>` is kept.
- Characters XML 1.0 forbids (C0 controls except tab, LF and CR, U+FFFE, U+FFFF, unpaired surrogates) are removed from every field, so the document is well-formed. The shared `xmlEscape` does this, so RSS gets it too.
- `id` is the absolute page URL, so it changes when the domain, `base` or slug changes.
- Section `feeds` don't filter these entries, matching `/api/pages/<slug>.json`.
- `type=entry` is guaranteed in the link. A static host sets the response header from the file extension.
