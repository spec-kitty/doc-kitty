# Contract: `dockitty-pdf`

```
dockitty-pdf --dist <dir> --base <path> [--sections a,b] [--out <dir>] [--timeout <ms>]
```

- Reads `<dist>/print/manifest.json`; prints each document (or the `--sections` subset; `site` names the whole-site PDF) to `<out|dist>/pdf/<name>.pdf`.
- Per document: serve `dist` under `--base`, open the route with the light theme stored and a fixed-seed `Math.random`, refuse a page that did not load light, `emulateMedia({ media: 'print' })`, wait for fonts and, when `pre.mermaid` exists, for every laid-out `pre.mermaid` to be `data-processed` and hold an `<svg>` (amended 2026-11-25: this replaced the `html[data-dk-diagram-theme="light"]` signal, see research.md "Rework for SC-004"); then a light self-check (the body background must be light and its text dark, else exit 1) and `page.pdf({ tagged: true, outline: true, preferCSSPageSize: true, printBackground: false })` (only the print layer's `print-color-adjust: exact` blocks keep their fills).
- Post-pass: structure-element ids (`/ID (nodeN)`, from Blink's DOM node counter) renumbered in place, order-preserving; dates pinned to `SOURCE_DATE_EPOCH` (fallback `git log -1 --format=%ct`), Info `Title` = document title, `Producer` = `doc-kitty-pdf/<version>`.
- Exit codes: `0` success; `1` a print, wait or post-pass failed; `2` usage error or missing input (no dist, no manifest, no date source, Playwright absent).
- Browser: the installed `playwright` peer's Chromium; never downloads one.

# Contract: `assert-pdf-artifacts`

`node src/scripts/assert-pdf-artifacts.mjs <dist>`: one PDF per manifest document and no other `*.pdf` in `dist/pdf/`; each has `>= 1` page, `/StructTreeRoot`, `/MarkInfo`, `/Lang` equal to the document lang, and the manifest's page titles (`titles`, `pages` of them) appearing in order, whitespace ignored, at outline level `titleLevel` (cover and divider body headings may share that level). `ok()`/fail style; exit 1 on failure.

# Contract: `assert-pdf-determinism`

`node src/scripts/assert-pdf-determinism.mjs <dist> --base <path>`: runs the CLI twice into two temp dirs with the same `SOURCE_DATE_EPOCH`, compares bytes; on a difference prints the file, first differing offset and the `N G obj` that holds it.
