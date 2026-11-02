---
section: Added
---

- **A generic MCP server reads any DocKitty site's published artifacts.** The
  new `@spec-kitty/doc-kitty-mcp` workspace package serves a built site's
  agent-API (`/api/index.json`, `/api/pages/*.json`, `/api/scenarios.json`) to
  any MCP client over stdio: pack it with `pnpm pack --filter
  @spec-kitty/doc-kitty-mcp`, install the tarball, and launch
  `doc-kitty-mcp --site <url>` or `--dir <dist>`. A site that opts in with
  `links: { mcp: true }` advertises that wiring in its `/api/index.json`
  (`_links.mcp`) and `llms.txt`. Registry publishing is deferred, so the
  tarball is the supported form for now. See
  [ADR-0073](docs/adr/0073-generic-mcp-server-over-published-artifacts.md) and
  the [MCP server quickstart](docs/guides/mcp-server-quickstart.md).
