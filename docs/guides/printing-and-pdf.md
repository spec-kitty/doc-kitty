---
title: Printing and PDF
description: What a doc-kitty page looks like on paper, how a theme changes it, and how a site publishes section and whole-site PDFs built in CI.
doc_status: active
updated: 2026-11-25T00:00:00Z
type: Guide
kind: How-To
authors:
  - process:claude-code
tags: [print, pdf, theme, ci, consumer]
related:
  - adr/0081-print-and-pdf-output-from-built-html-via-chromium
  - architecture/section-registry
  - guides/consumer-setup
  - ops/ci-cd
---

# Printing and PDF

**Audience.** A reader who prints a page, a theme author who changes how it
prints, and a site owner who publishes PDFs. The decision behind all of this is
[ADR-0081](../adr/0081-print-and-pdf-output-from-built-html-via-chromium.md).

## Print any page

A site turns the print layer on with one option. Readers then use the
browser's **Print** or **Save as PDF**.

```js
defineDocKittyIntegrations({
  print: true,
});
```

New sites start with it: the starter configuration in
[Consumer setup](./consumer-setup.md#3-astroconfigmjs--wire-the-integrations)
sets `print: true`. The print control and any PDF turn the layer on as well,
because both need it, so a site with either can leave `print` out. Setting
`print: false` next to them is a config error. A site that sets none of these
builds exactly what it built before the print layer existed, and prints as it
did before.

On paper a page keeps its title, its status and date, its metadata band and its
content. It leaves out the header bar, the sidebar, the table-of-contents rail,
search, the theme select, pagination, the lightbox buttons, code copy buttons,
the machine-readable links and the page formats.

The layout changes for paper too:

- The page background is white, and the content takes the full printable width.
  Asides, callouts, code blocks and diagrams keep their fills. Nothing else
  spends ink on a background.
- Each diagram fits the printable width, and is never taller than one sheet.
- Long code lines wrap. Headings stay with the text after them, and figures,
  asides, code blocks and table rows do not split across sheets.
- An external link prints its address after the link text. Internal and
  glossary links print no address.
- Closed disclosures, such as the metadata blocks, print open.

### Dark mode prints light

With the print layer on, a reader in dark mode still gets a light printout.
When the browser starts a print, the page switches to light mode, then switches
back afterwards. The reader's choice is never stored.

Some browsers print without telling the page. For them, a print-only fallback
sheet sets the light colour values. The site's theme generates that sheet, so
nobody restates a colour by hand.

There are two limits to know about:

- A brand that ships its per-mode colours in a CSS file, not in its `tokens`
  object, gets the default light palette on this fallback path. The page is
  still light, but the colours are not the brand's.
- A page with diagrams drawn in the browser (client mode) does not switch
  modes: a switch would redraw its diagrams, and a print could catch one
  halfway. The fallback sheet prints the page light, and those diagrams keep
  the colours they had when the print started. Build-mode diagrams follow the
  light colours every time.
  A client-mode diagram inside a closed disclosure or a hidden tab is drawn only
  once it is shown, so a browser print of it shows its source. The PDFs open
  everything first and draw every diagram.

## Change how a page prints

The print rules live in `@spec-kitty/doc-toolkit/styles/print.css`. A theme
overrides them with a later sheet in its `customCss`, as it overrides any other
rule ([ADR-0008](../adr/0008-swappable-theme-layer.md)).

- **Paper size.** The default is A4. To print on US Letter, add this rule:

  ```css
  @page {
    size: Letter;
  }
  ```

- **No addresses after links.** Turn the suffix off with this rule:

  ```css
  @media print {
    .sl-markdown-content a::after {
      content: none;
    }
  }
  ```

- **Hidden elements, the white page and the full width.** These rules use
  `!important` to beat Starlight's own layout rules, so an override must use
  `!important` too.

## Publish section PDFs

A section opts into its own PDF in `docs/_meta/sections.yaml`:

```yaml
sections:
  - id: architecture
    label: Architecture
    order: 20
    pdf: true
```

To give every section a PDF by default, set it in the integration. A
`pdf: false` on a section still wins.

```js
defineDocKittyIntegrations({
  pdf: { sections: true },
});
```

A site with PDFs must set `site` in `astro.config`, because the print documents
link to absolute site URLs. Without it, the build warns and builds no print
document.

Each section with a PDF gets a print document at `/print/<section>/`. It renders
every published page of the section, in reading order, behind a cover page. The
cover holds the site name, the section's label and purpose, the build date, the
section index and a table of contents. Each page starts on a new
sheet. A link to another page in the same document jumps inside it, and any
other link points at the live site.

Print documents are hidden from search engines, the site search and the
sitemap. `llms.txt`, the Agent-API, RSS and the OKF bundle never list them.

### What never goes in a PDF

Slide decks (`kind: Presentation`) and OpenAPI reference pages are never part
of a print document. Neither is a template page, such as the ADR template. You
can leave out more sections or page kinds:

```js
defineDocKittyIntegrations({
  pdf: { sections: true, exclude: { sections: ['changelog'], kinds: ['Persona'] } },
});
```

`exclude` only adds to that list. It cannot bring decks back.

## Publish one PDF of the whole site

```js
defineDocKittyIntegrations({
  pdf: { site: true },
});
```

The whole-site print document is `/print/`, and its PDF is `/pdf/site.pdf`. It
holds every section that is not excluded or omitted, whatever that section's own PDF setting.
The registered sections come first, then any folders with no registry entry,
then the appendix sections. A section takes its place in it through the `site`
setting of its `pdf` key. `main`, the default, prints it in the main body.
`appendix` moves it after the main body. `omit` leaves it out of the whole-site
PDF only. The `section` setting, its own PDF, is separate:

```yaml
  - id: rhetoric
    label: Rhetoric
    order: 45
    pdf: { section: true, site: appendix }
```

`site` names the whole-site PDF, so a section with the id `site` cannot have a
PDF of its own. The whole-site PDF prints the site as it is. It is not a book
format: it adds no chapters and no page-numbered index.

## Build the PDFs

The PDFs are printed from the built site, with the Chromium that Playwright
installs for build-mode diagrams. The `playwright` package is an optional peer
of the toolkit, so a site that does not render diagrams at build time installs
it first:

```sh
pnpm add -D playwright
npx playwright install chromium
```

Then build and print. `--base` is the site's base path, as in `astro.config`
(`/` for a site at the domain root).

```sh
pnpm build
SOURCE_DATE_EPOCH="$(git log -1 --format=%ct)" \
  npx dockitty-pdf --dist dist --base /my-site
npx dockitty-assert-pdf dist
```

`dockitty-pdf` writes `dist/pdf/<name>.pdf` for each print document. Use
`--sections architecture,site` to print a subset. It exits `0` on success, `1`
when a print fails and `2` on a usage error or missing input.

Each PDF is tagged and has a bookmark outline. The language comes from the site.
The two PDF dates, `CreationDate` and `ModDate`, are pinned to `SOURCE_DATE_EPOCH`, or to the last commit time
when that is unset, so two prints of one build are identical, byte for byte.
`dockitty-assert-pdf-determinism dist --base /my-site` proves it. `dockitty-assert-pdf`,
run from the site's directory on a `dist` inside it, checks that every expected PDF exists and is tagged, and that its outline lists
every printed page. It does not check PDF/UA conformance.

Diagram-heavy sections print best once their diagrams read well in light mode. Diagram contrast and label clipping are tracked in
[#369](https://github.com/spec-kitty/doc-kitty/issues/369) and
[#370](https://github.com/spec-kitty/doc-kitty/issues/370).

## The print control

A site can add a **Print / Save as PDF** button to every page:

```js
defineDocKittyIntegrations({
  printControl: true,
});
```

When the page's section has its own PDF, a **Download section PDF** link follows
the button. The control turns the print layer on, and is hidden on paper. A theme restyles it, or hides it,
through `.dk-print-control`.

The link points at `/pdf/<section>.pdf`, which only exists once the PDFs are
printed, so print them in the same deploy that publishes the site. The link checks
accept a link to a PDF the build expects, and still fail any other `/pdf/` link.

## In this repository's CI

The `pdf` lane prints the example's PDFs from the drafts-off build, then runs
the gate and the determinism check. It is advisory, so a red run does not block
a merge. The deploy on `main` prints the PDFs and publishes them with the site.
See [Activating and operating CI/CD](../ops/ci-cd.md).
