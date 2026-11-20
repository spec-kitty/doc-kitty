# Data model: print and PDF output

## SectionPdfSetting (authored, `sections.yaml`)

| Field | Type | Default | Notes |
|---|---|---|---|
| `section` | boolean | site `pdf.sections` (false) | own PDF at `/pdf/<id>.pdf` |
| `site` | `main` \| `appendix` \| `omit` | `main` | placement in the whole-site PDF |

Authored forms: `pdf: true` = `{ section: true }`; `pdf: false` = `{ section: false }`; the mapping form. Any other value: advisory warning, treated as absent.

## SitePdfOptions (`defineDocKittyIntegrations({ pdf })`)

| Field | Type | Default |
|---|---|---|
| `sections` | boolean | false |
| `site` | boolean | false |
| `exclude.sections` | string[] | [] |
| `exclude.kinds` | string[] | [] (floor `Presentation` always applies) |

Validation: unknown keys throw `[dk-config]`; a section id `site` with `section: true` throws (reserved PDF name).

## ResolvedPdfOptions (`DK_PDF_OPTIONS`, JSON)

```json
{
  "sections": ["architecture", "guides"],
  "site": true,
  "appendix": ["rhetoric"],
  "omit": [],
  "excludeSections": [],
  "excludeKinds": ["Presentation"]
}
```

Invariant: `sections` lists ids in registry order; `site` false ⇒ `appendix`/`omit` unused.

## PrintDocument (built, `dist/print/manifest.json`)

```json
{
  "version": 1,
  "documents": [
    { "name": "architecture", "route": "/print/architecture/", "title": "Architecture", "lang": "en", "titleLevel": 2, "pages": 5, "titles": ["Content blocks demonstrator", "…"] },
    { "name": "site", "route": "/print/", "title": "DocKitty Example", "lang": "en", "titleLevel": 3, "pages": 55, "titles": ["…"] }
  ]
}
```

Invariant: one document per name in `ResolvedPdfOptions` (`sections` + `site` when true); `pages >= 0` (`0`: a section with no page besides its index prints its cover only).

## PdfArtefact (`dist/pdf/<name>.pdf`)

Info: `Title` = document title; `Producer` = `doc-kitty-pdf/<toolkit version>`; `CreationDate` = `ModDate` = `D:<SOURCE_DATE_EPOCH as UTC>+00'00'`. Catalog: `/Lang`, `/MarkInfo`, `/StructTreeRoot`, `/Outlines`. Build-clock fields for #300: `CreationDate`, `ModDate`.
