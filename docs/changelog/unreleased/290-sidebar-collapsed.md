---
section: Changed
---

- **Generated sidebar groups start closed (#290).** Before, the groups of the generated sidebar were open on every page, apart from any a site had set to collapse, such as the generated API groups. Now each starts closed, except the groups on the path to the current page, which Starlight opens by itself. Set `sidebar: { collapsed: false }` to keep the old sidebar exactly. A sidebar you write yourself is not changed.
