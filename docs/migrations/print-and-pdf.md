---
title: Print and PDF output
description: How to turn the opt-in print layer on, the routes and URLs the PDF feature reserves, and how to turn the PDFs on.
doc_status: active
updated: 2026-11-25T00:00:00Z
type: Migration
kind: How-To
authors:
  - process:claude-code
tags: [migration, print, pdf]
related:
  - guides/printing-and-pdf
  - adr/0081-print-and-pdf-output-from-built-html-via-chromium
---

# Print and PDF output

No setting is needed to upgrade, and nothing breaks: a site that changes no
setting builds exactly what it built before. This page lists what the print
layer changes once you turn it on, and what the PDF feature reserves. The
decision is in
[ADR-0081](../adr/0081-print-and-pdf-output-from-built-html-via-chromium.md).

## Turn the print layer on

Add `print: true` to `defineDocKittyIntegrations`. New sites start with it, and
`printControl: true` or any PDF turns it on as well. Once it is on:

- **Every page prints differently.** A printed page leaves out the site chrome,
  prints light from the dark theme, and shows the address of each external
  link. A theme that had its own print rules should check them: the print
  layer's rules for the hidden chrome and the white page use `!important`. See
  [Change how a page prints](../guides/printing-and-pdf.md#change-how-a-page-prints).
- **Every in-frame page loads one more small script and its print rules.** The
  out-of-frame deck route does not.

## What the PDF feature reserves

These only come into play when a section or the site turns PDFs on:

- `/print/` and `/print/<section>/`. A docs folder named `print` makes the
  build fail with a named error while PDFs are on. Rename the folder, or leave
  PDFs off.
- `/pdf/<section>.pdf` and `/pdf/site.pdf`. The name `site` is reserved, so a
  section with the id `site` cannot have a PDF of its own.
- `pdf` as a key in `docs/_meta/sections.yaml`. An earlier toolkit ignored it
  silently. Now an invalid value is an advisory warning.

## Turn the PDFs on

Add `pdf: true` to a section in `sections.yaml`, or set
`defineDocKittyIntegrations({ pdf: { sections: true, site: true } })`. Then
print after the build with `dockitty-pdf`. The steps are in
[Printing and PDF](../guides/printing-and-pdf.md#publish-section-pdfs).
