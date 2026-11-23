---
section: Added
---

- **A sidebar child cap keeps large hubs out of every page's sidebar (#341).**
  Before, every page of a folder was listed in every page's sidebar, so a hub
  with hundreds of pages put hundreds of links on each page. Now a hub with more
  pages than its cap (default 50) shows its overview link and one "N pages"
  entry, marked current on the hub's pages, and prev/next follow the hub's
  order. Set the cap with `sidebar.childCap` in the site config, on a section in
  `sections.yaml`, or with `sidebar_child_cap` on a hub; label the entry with
  `sidebar.cappedLabel` or the `dockitty.sidebar.cappedEntry` UI string. Page
  generators can use `cappedChildHidden` from `@spec-kitty/doc-toolkit/child-cap`.
  See [Cap large sidebar groups](docs/guides/sidebar-child-cap.md).
