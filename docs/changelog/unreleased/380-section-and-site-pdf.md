---
section: Added
---

- **Sections and the whole site can be published as PDFs (#380, #381, #382).**
  Before, a site had no way to offer a section, or the whole site, as one
  document. Now `pdf: true` on a section in `sections.yaml`, or
  `defineDocKittyIntegrations({ pdf: { sections, site, exclude } })`, adds a
  print document at `/print/<section>/` or `/print/`, rendered through the
  site's own pipeline behind a cover page. `dockitty-pdf` prints these to
  `dist/pdf/<name>.pdf` with the Playwright Chromium the toolkit already uses.
  The PDFs are tagged and outlined, and two prints give the same bytes.
  `dockitty-assert-pdf` and `dockitty-assert-pdf-determinism` check them. Slide
  decks, OpenAPI pages and template pages are never included. See
  [ADR-0081](docs/adr/0081-print-and-pdf-output-from-built-html-via-chromium.md).
