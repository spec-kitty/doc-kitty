---
section: Added
---

- **Every published, dated page gets an Atom entry at `/api/pages/<id>.atom.xml`.** Before, a page had only a JSON record. Now the toolkit injects the route on every site, with nothing to mount, and builds a deterministic Atom entry document with the page's rendered HTML. A draft or a page with no `updated` or `generated.at` date gets none. Set `pageFormats: { atom: false }` to turn it off. A static host picks the response `Content-Type` from the `.xml` extension, so `type=entry` is guaranteed only in the link that points at the entry. A site with no `site` gets no entries and no Atom links, with one build warning, because an Atom `id` must be a stable absolute IRI. An `.mdx` page's entry has no `<content>`, a local image becomes its alt text, and characters XML 1.0 forbids are removed from Atom and RSS output. The `id` changes when the domain, `base` or slug changes.
