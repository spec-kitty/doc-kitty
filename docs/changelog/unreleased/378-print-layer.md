---
section: Added
---

- **Every page prints cleanly, and dark mode prints light (#378).** Before,
  a reader in dark mode printed a near-black page, with the header bar,
  lightbox buttons and machine-readable links on it. Now a print layer hides the screen
  chrome, keeps the page title, status and metadata band, prints on white,
  fits diagrams to the sheet, wraps code, and prints the address of external
  links. A `beforeprint` hook switches to light mode for the print, and a
  print-only fallback generated from the theme covers browsers that print
  without the event. A theme overrides any rule, including the A4 paper size.
  See [Printing and PDF](docs/guides/printing-and-pdf.md).
