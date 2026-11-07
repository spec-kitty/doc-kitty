---
section: Added
---

- **A group's title can be the link to its index page (#290).** Set `sidebar: { titleIsIndex: true }` and a generated sidebar group's label links to its index page, with no "Overview" entry below it, and a separate chevron opens and closes the group. A group with no index page keeps its plain toggle, and previous and next links are unchanged. The option is off by default, and with it off Starlight's own sidebar renders as before. It cannot be set together with `sidebar.indexLabel`. A sidebar you write yourself is not changed.
