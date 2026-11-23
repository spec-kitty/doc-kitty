# Quickstart: Sub-processor catalog

1. **Create the catalog.** Write `docs/_meta/subprocessors.yaml` with one record
   per sub-processor. The format is in
   [contracts/subprocessors-catalog.contract.md](contracts/subprocessors-catalog.contract.md).
2. **Validate it without a build.**

   ```bash
   node src/scripts/validate-catalog.mjs docs      # or: pnpm validate:catalog
   ```

3. **Build.** The site now serves `api/subprocessors.json` and
   `subprocessors.xml`, and `api/index.json` links both.
4. **Announce a change in advance.** Set a future `since` (new provider) or
   `until` (leaving provider). The feed carries the item from the next build.
   ⚖ Whether this meets your contract's notice terms is for your counsel.
5. **Remove a provider.** Set `until`; do not delete the record. Past providers
   stay in the export and the feed history.
6. **No catalog.** Delete the file and the routes and links disappear. Nothing
   else changes.

To check the feature end to end, build the example site, then run
`pnpm test` (both tiers and mcp).
