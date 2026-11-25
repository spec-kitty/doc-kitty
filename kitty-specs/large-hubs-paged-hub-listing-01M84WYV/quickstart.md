# Quickstart: seeing the paged hub listing work

```bash
pnpm install --frozen-lockfile
pnpm --filter example build          # or: cd example && pnpm build
```

1. Open `example/dist/guides/paged-hub/index.html`. The hub lists its first page of children, followed by a "Pagination" navigation.
2. Open `example/dist/guides/paged-hub/page/2/index.html`. It shows the next children inside the site frame, its canonical URL is its own, and the sidebar's "N pages" entry is current.
3. Check the machine surfaces:

   ```bash
   grep -c 'guides/paged-hub/page/' example/dist/sitemap-0.xml
   grep 'guides/paged-hub/page/' example/dist/llms.txt
   node -e "const i=require('./example/dist/api/index.json');console.log(i.pages.filter(p=>p.kind==='Listing'))"
   ```

4. Run the gates:

   ```bash
   pnpm test                     # fast + build tiers + mcp
   node src/scripts/assert-build-artifacts.mjs
   pnpm assert:no-broken-links
   pnpm exec playwright test tests/a11y/paged-hub-listing.spec.ts
   ```

5. Tune the page size: set `hub_page_size: 2` in `example/docs/guides/paged-hub/index.md` and rebuild. The page count changes.
