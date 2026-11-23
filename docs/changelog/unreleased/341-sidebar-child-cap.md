---
section: Added
---

- **A sidebar child cap keeps large hubs out of every page's sidebar (#341).**
  Before, every page of a folder was listed in every page's sidebar, so a hub
  with hundreds of pages put hundreds of links on each page. Now, a hub (a folder whose
  index page has `kind: Hub`) with more pages than its cap (default 50) shows its overview link and one "N pages"
  entry, marked current on every page below the hub, and prev/next follow the
  hub's order. The cap is on by default, so an existing hub with more than 50
  pages is capped when you upgrade; set a higher cap to keep it expanded. Set the cap with `sidebar.childCap` in the site config, on a section in
  `sections.yaml`, or with `sidebar_child_cap` on a hub; label the entry with
  `sidebar.cappedLabel` or the `dockitty.sidebar.cappedEntry` UI string. Page
  generators can use `cappedChildHidden` from `@spec-kitty/doc-toolkit/child-cap`.
  See [Cap large sidebar groups](docs/guides/sidebar-child-cap.md) and
  [ADR-0084](docs/adr/0084-sidebar-child-cap.md).
