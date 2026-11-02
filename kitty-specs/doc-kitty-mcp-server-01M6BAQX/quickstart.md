# Quickstart: run the MCP server against a doc-kitty site

Prereqs: Node >= 22.22, an MCP client (Claude Code/Desktop, Cursor, VS Code, opencode...).

## Against a deployed site

In this mission the package is not published to any registry (C-002), so the working form installs the packed tarball:

```bash
pnpm pack --filter @spec-kitty/doc-kitty-mcp        # writes spec-kitty-doc-kitty-mcp-<version>.tgz
npm i -g ./spec-kitty-doc-kitty-mcp-<version>.tgz   # or: npx ./spec-kitty-doc-kitty-mcp-<version>.tgz
```

Wired into an MCP client config:

```json
{
  "mcpServers": {
    "my-docs": {
      "command": "doc-kitty-mcp",
      "args": ["--site", "https://my-org.github.io/my-docs"]
    }
  }
}
```

(On Windows, wrap the command as `cmd /c doc-kitty-mcp ...`.)

After the publishing ruling (C-002) the registry form becomes `npx -y @spec-kitty/doc-kitty-mcp --site ...`.

Standalone smoke: launch with `--site` or `--dir` and drive it with `@modelcontextprotocol/inspector`.

## Against a local build

```bash
cd my-docs-repo
npx astro build            # or the repo's own build
doc-kitty-mcp --dir ./dist # the bin installed from the tarball above
```

## What you get

- Tools: `get_site_info`, `list_pages`, `get_page`, `search_pages`, `list_scenarios`
- Resources `docs://<site>/pages/<id>` when the corpus is small enough (default <= 1000 pages)
- Everything answers from the site build's published discovery artifacts; the server never re-reads your markdown sources.

## Common failures and what they mean

| Message | Meaning |
|---|---|
| UNKNOWN_CONTRACT_MAJOR | site was built by an incompatible doc-kitty version; upgrade doc-kitty or pin the matching server major |
| UNREACHABLE_ENDPOINT | URL wrong or network down (one retry happened already) |
| PAGES_LINKS_GATED | site config disables per-page artifacts; index-only tools available |
| BUILD_IDENTITY_MISMATCH | site redeployed while the server was loading; restart |
