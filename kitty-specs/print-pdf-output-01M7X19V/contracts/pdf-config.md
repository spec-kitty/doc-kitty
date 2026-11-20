# Contract: `pdf` configuration

## `sections.yaml`

```yaml
sections:
  - id: architecture
    label: Architecture
    order: 20
    pdf: true                  # own PDF; whole-site placement main
  - id: rhetoric
    label: Rhetoric
    order: 50
    pdf: { section: false, site: appendix }
```

- `pdf: true|false` sets `section`. The mapping sets `section` and/or `site` (`main` | `appendix` | `omit`).
- Any other value or key is an advisory `[dk-sections]` warning and is ignored (treated as absent).
- Carried by `src/lib/sections.ts` (Astro side) and `src/lib/vocabulary-loader.mjs` (bare Node, gates and CLI) alike.

## Site option

```js
defineDocKittyIntegrations({
  pdf: {
    sections: false,          // default for sections without an authored `section`
    site: true,               // the whole-site PDF, /pdf/site.pdf
    exclude: { sections: ['changelog'], kinds: ['Persona'] },
  },
});
```

- Resolution: authored section value > site `sections` default > false.
- `kind: Presentation` pages are always excluded; OpenAPI reference pages are never docs entries. `exclude` only adds.
- Errors (`[dk-config]`): unknown key, wrong type, a section id `site` with its own PDF on, an `exclude.sections` id that is not a section (advisory warning, not an error).
