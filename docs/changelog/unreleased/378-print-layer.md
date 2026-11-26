---
section: Added
---

- **Pages print cleanly, and dark mode prints light, with `print: true` (#378).**
  Before, a reader in dark mode printed a near-black page, with the header bar,
  lightbox buttons and machine-readable links on it. Now an opt-in print layer
  hides the screen chrome, keeps the page title, status and metadata band,
  prints on white, fits diagrams to the sheet, wraps code, and prints the
  address of external links. A `beforeprint` hook switches to light mode for the
  print, and a print-only fallback generated from the theme covers browsers that
  print without the event. `printControl` and any PDF turn the layer on too, and
  the starter configuration for new sites sets `print: true`. A site that sets
  none of these builds exactly what it built before. A theme overrides any rule,
  including the A4 paper size. See
  [Printing and PDF](docs/guides/printing-and-pdf.md).
