---
section: Changed
---

- **Build-mode diagrams name the Playwright version they need (#314).**
  Before, the consumer guide said build mode needs "Playwright" but not which
  package or version, so a site had to find out that it needs `playwright` at
  the toolkit's own version. Now the toolkit declares `playwright` as an
  optional peer pinned to that version (1.62.1), and the guide shows the
  install. A site that does not render diagrams in build mode installs nothing
  new. A site that does gets a peer warning when its `playwright` drifts from
  the toolkit's.
