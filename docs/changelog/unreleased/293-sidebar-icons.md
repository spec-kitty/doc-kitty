---
section: Added
---

- **Pages and sections can show an icon in the sidebar (#293).** Set `sidebar.icon` on a page, or `icon` on a section in `sections.yaml` or a charter's `sections.entries`, to `fa-<name>` for Font Awesome's solid set or to the name of a Starlight built-in. A group takes its section's icon, or else its index page's. Only the icons you use reach the output, as inline SVG hidden from assistive technology, with no font file and no external request, and a page showing a Font Awesome icon carries one CC BY 4.0 licence comment. An unknown name fails the build and `validate-frontmatter`, naming the page or section. A site with no icons is unchanged. A sidebar you write yourself takes no icons, and the build warns once if any are authored.
