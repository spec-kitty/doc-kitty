# Contract: the `openapi` option and its published artifacts

This contract is public. spec-kitty-charter depends on it.

```ts
import starlightOpenAPI from 'starlight-openapi';

defineDocKittyIntegrations({
  openapi: {
    renderer: starlightOpenAPI,             // required: the pinned renderer, imported by the adopter
    section: 'reference/api',               // optional, default 'reference/api'
    specs: [
      { path: 'openapi/v1.2.0.yaml', label: 'v1.2.0', released: true },
      { path: 'openapi/main.yaml',   label: 'main',   released: false },
    ],
  },
});
```

The adopter installs the optional peers `starlight-openapi` and `@astrojs/markdown-satteri` at the versions the how-to names, and imports the renderer in `astro.config` (DM plan.architecture.renderer-loading). The toolkit never imports either package itself.

## Stable addresses (per version)

- `<base>/<section>/<label>/` is the reference pages.
- `<base>/<section>/<label>/openapi.<ext>` is the raw document, byte-identical to the input.
- `<base>/<section>/<label>/openapi.<ext>.sha256` is in `sha256sum` format, so `sha256sum -c` verifies the raw document.

## Errors (build fails, nothing is published)

Each error starts with `[dk-openapi]`. Each one names the entry (by index and label) and, where there is one, the file. The cases:
- the path is missing or unreadable;
- the file is empty;
- the file is not OpenAPI 3.0 or 3.1;
- the document references another file;
- a label is a duplicate (case-insensitive) or uses a character outside the label rule;
- `released` is missing;
- `renderer` is missing or is not the renderer's plugin factory (the error shows the import line);
- a route collides with an authored page (reported through ADR-0050).
