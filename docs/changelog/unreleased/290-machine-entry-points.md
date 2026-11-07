---
section: Added
---

- **The footer links the site's machine entry points on every page.** Before, an agent had to know the paths of `llms.txt`, the agent API and the rest. Now a `Machine-readable` group lists each one the site serves, with or without a theme, and never one it doesn't. Set `footer: { machineEntryPoints: false }` to remove the group, or `{ label: '...' }` to rename it. The `<head>` RSS and `llms.txt` links follow what the site serves too, so a site with no `rss.xml` route no longer advertises one. A site that sets `starlight.head` now gets these links too, where its entries used to replace the toolkit's `head`; if it added its own RSS alternate, the page now has two.
