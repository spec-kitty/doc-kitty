---
title: MCP server quickstart
description: Point any MCP client at a published DocKitty site, or at a local build, with the generic doc-kitty-mcp server, so your agent can read your docs.
doc_status: active
updated: 2026-11-02T00:00:00Z
type: Guide
kind: How-To
tags: [mcp, agents, interoperability]
related:
  - adr/0073-generic-mcp-server-over-published-artifacts
  - architecture/generators
---

# MCP server quickstart

One generic MCP server, `@spec-kitty/doc-kitty-mcp`, serves any DocKitty
site's published discovery artifacts (`/api/index.json`, `/api/pages/*.json`,
`/api/scenarios.json`) to MCP clients over stdio. You never generate or host a
server per site; you launch the one server with a site URL or a build
directory.

Prereqs: Node >= 22.22 and an MCP client (Claude Code/Desktop, Cursor,
VS Code, opencode...).

## Install from the tarball

The package is not published to any registry yet (the publishing ruling is
deferred, see
[ADR-0073](../adr/0073-generic-mcp-server-over-published-artifacts.md)), so
the working form installs the packed tarball from a checkout:

```bash
pnpm pack --filter @spec-kitty/doc-kitty-mcp        # writes spec-kitty-doc-kitty-mcp-<version>.tgz
npm i -g ./spec-kitty-doc-kitty-mcp-<version>.tgz   # or: npx ./spec-kitty-doc-kitty-mcp-<version>.tgz
```

After the publishing ruling the registry form becomes
`npx -y @spec-kitty/doc-kitty-mcp ...`.

## Against a deployed site

Wire the installed bin into your MCP client config:

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

Standalone smoke: launch with `--site` or `--dir` and drive it with
`@modelcontextprotocol/inspector`.

## Against a local build

```bash
cd my-docs-repo
npx astro build            # or the repo's own build
doc-kitty-mcp --dir ./dist # the bin installed from the tarball above
```

Links embedded in answers resolve against your local build, not the
build-time baked origin (override with `--link-base <uri>`).

## Let your own site advertise the wiring

Pass `links: { mcp: true }` to `agentIndexRoute` (and to `llmsTxtRoute` for
the human-facing line). Your `/api/index.json` then carries a machine-readable
`_links.mcp` pointer and your `llms.txt` a one-line mention, both naming the
exact launch command for your site. It is opt-in and defaults to off; the
advertised form is the tarball launch until the publishing ruling.

## What you get

- Five read-only tools: `get_site_info`, `list_pages`, `get_page`,
  `search_pages` (registry order, capped at 25, published fields only),
  `list_scenarios`.
- Resources at `docs://<site>/pages/<id>` when the corpus is at or below the
  listing threshold (default 1000 pages; `--resource-threshold <n>` changes
  it); above the threshold the tools carry each page's `uri` so read-by-URI
  still works.
- Everything answers from the site build's published discovery artifacts; the
  server never re-reads your markdown sources and never derives content.

## Common failures and what they mean

| Message | Meaning |
|---|---|
| UNKNOWN_CONTRACT_MAJOR | the site was built by an incompatible doc-kitty version; upgrade doc-kitty or pin the matching server major |
| UNSUPPORTED_CLIENT_REVISION | your client negotiates an MCP spec revision older than the supported one (2025-11-25); upgrade the client |
| UNREACHABLE_ENDPOINT | URL wrong or network down (one retry happened already) |
| MALFORMED_CORPUS | a published artifact failed shape validation; rebuild the site |
| PAGES_LINKS_GATED | the site config disables per-page artifacts; index-only tools available |
| BUILD_IDENTITY_MISMATCH | the site redeployed while the server was loading; restart the server |
| PAGE_NOT_FOUND | the identifier is not in the loaded corpus; list pages first |
