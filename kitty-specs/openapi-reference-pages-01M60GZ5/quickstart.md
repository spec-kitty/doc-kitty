# Quickstart: verify OpenAPI reference pages

1. **Install** with `corepack pnpm install --frozen-lockfile`.
2. **Build** with `corepack pnpm build`. The example site configures `v1` (released) and `main` (unreleased).
3. **Check the pages**:
   - `example/dist/reference/api/v1/` and `example/dist/reference/api/main/` exist, inside the site layout.
   - The `main` pages show "unreleased".
   - Each version's pages link to the other version.
4. **Check the raw document**: run `cd example/dist/reference/api/main && sha256sum -c openapi.yaml.sha256`. It prints `OK`, and `cmp` against `example/openapi/main.yaml` is silent.
5. **Check the site surfaces**:
   - `example/dist/llms.txt` lists both versions.
   - `sitemap-0.xml` contains the API pages.
   - Searching for an operation title finds the page.
6. **Fail closed**: point a spec at a missing file and rebuild. The build fails with `[dk-openapi] specs[0] (main): … not found`.
7. **Opt-in at no cost**: the consumption test arm without the renderer installs and builds, and the example site output without the option equals the merge-base output.
