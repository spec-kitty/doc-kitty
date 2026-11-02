---
section: Added
---

- **Any MCP client can read a DocKitty site's published artifacts (#284).**
  Before, an agent had to fetch and stitch `/api/index.json` and
  `/api/pages/*.json` itself. Now the new `@spec-kitty/doc-kitty-mcp`
  workspace package serves them over stdio: run `pnpm pack --filter
  @spec-kitty/doc-kitty-mcp`, install the tarball, and launch
  `doc-kitty-mcp --site <url>` or `--dir <dist>`. Registry publishing is
  deferred, so the tarball is the supported form. Every site's `/api/*.json`
  also gains `buildId` (to detect a torn read) and, on the index, `sections`.
  A site that sets `links: { mcp: true }` advertises the wiring in
  `_links.mcp` and `llms.txt`. See
  [ADR-0073](docs/adr/0073-generic-mcp-server-over-published-artifacts.md) and
  the [MCP server quickstart](docs/guides/mcp-server-quickstart.md).
