# Quickstart: classify a page

1. Add the field to a page:

   ```yaml
   tom_classification:
     - transmission-protection
   ```

2. Run `pnpm validate:catalog` to check the id without a build. A typo prints the page and the id.
3. Build (`pnpm build`) and open `dist/api/content-graph.json`. The page has a `classified-as` edge to `catalog:measure:transmission-protection`.
4. To use your own measures, write `docs/_meta/measures.yaml`. It replaces the default list entirely, so copy any default entries you still want.
5. For an organisation-wide measure, classify the organisation page with `scope: organisation`, and link product pages to it with `related` instead of repeating the classification.
