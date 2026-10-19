---
title: Site release history and install guide
description: "The site's changelog now shows every release, there is an install guide for 0.4.0, and the Markua showcase no longer requests a missing image."
doc_status: active
updated: 2026-10-19T00:00:00Z
type: Changelog
kind: Changelog
authors:
  - human:stijn
tags: [changelog, install, docs-site, links]
related:
  - guides/consumer-setup
  - migrations/0.3-to-0.4
---

# 2026-10-19 — Site release history and install guide

A reader of the example site can now see what shipped and how to install it. Three
fixes make that so.

- **The changelog shows every release
  ([#192](https://github.com/spec-kitty/doc-kitty/issues/192)).** The site's
  changelog stopped at v0.1.0 while the toolkit shipped 0.4.0. It now renders the
  repository's `CHANGELOG.md` at build time, so there is no second copy to keep in
  sync. `pnpm assert:changelog` fails the build when a release is missing from the
  page.
- **There is an install guide for 0.4.0
  ([#193](https://github.com/spec-kitty/doc-kitty/issues/193)).** Getting started
  used to show repository-internal commands. `/guides/install/` now covers the Node
  floor, the peers, the GitHub Packages setup and the first build, and links the
  [0.3 to 0.4 migration guide](../migrations/0.3-to-0.4.md). See also
  [Consumer setup](../guides/consumer-setup.md).
- **The Markua showcase no longer requests a missing image
  ([#194](https://github.com/spec-kitty/doc-kitty/issues/194)).** It loaded
  `https://example.com/mac.jpg`, which does not exist. It now loads the site's own
  image, and `dockitty-assert-no-broken-links --no-external-images` fails a built
  page that loads an image from another host.
