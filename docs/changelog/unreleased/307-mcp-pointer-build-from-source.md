---
section: Fixed
---

- **`links.mcp` no longer points at an MCP package that cannot be installed (#307).**
  Before, a site with `links.mcp: true` put `npm:@spec-kitty/doc-kitty-mcp` in
  `_links.mcp.href` on `/api/index.json` and in its `llms.txt` line, but that
  package is not published, so a reader who followed it got nothing. Now both
  surfaces say the server is not published yet and point at the
  build-from-source steps in
  [the MCP server quickstart](docs/guides/mcp-server-quickstart.md#build-from-source).
  `_links.mcp.title` says so too, and the `llms.txt` line now reads
  `MCP server (not published yet, build it from source: <link>): once built,
  doc-kitty-mcp --site <url> serves …`. The shape of `_links.mcp` is unchanged.
  With `links.mcp` unset or `false`, nothing is emitted, as before. Publishing
  the package is tracked in #408.
