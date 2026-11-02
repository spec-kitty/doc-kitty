# @spec-kitty/doc-kitty-mcp

Generic MCP server over any published DocKitty corpus. One server, pointed at a
site at launch time, serves that site's published machine artifacts
(`/api/index.json`, `/api/pages/*.json`, `/api/scenarios.json`) to any
MCP-capable agent client over stdio. Read-only, pass-through projection; the
server never derives, ranks, or summarizes content, and never touches the
network in `--dir` mode.

- Transport: MCP over stdio only (no HTTP listener, by design).
- Snapshot-at-start: the corpus is loaded once at launch and pinned for the
  process lifetime, so answers never mix two deploys of one site.
- Requires Node.js >= 22.22.

## Protocol support (NFR-004)

- SDK: `@modelcontextprotocol/server` **2.4.0** (the v2 line), an exact pin and
  the package's one declared runtime dependency.
- The supported MCP spec revision is the one bundled with that pin - the v2
  line tracks the current (2026-07-28) revision. Clients negotiating a revision
  the SDK cannot serve get a named `UNSUPPORTED_CLIENT_REVISION` error (normalized
  from the SDK's protocol-version handshake failure) - never a silently
  degraded conversation.

## Install and client configuration

The full self-serve story (tarball install, client wiring for every MCP
client, the two input modes, Windows notes) lives in the docs guide:
[docs/guides/mcp-server-quickstart.md](../docs/guides/mcp-server-quickstart.md)
- the guide is the single owner so the story cannot drift between surfaces.

In short: `pnpm --filter @spec-kitty/doc-kitty-mcp build` then
`pnpm --filter @spec-kitty/doc-kitty-mcp pack`, install the tarball, launch
`doc-kitty-mcp --site <url>` or `--dir <path>`. The launch line is exactly the
one the toolkit emits into `_links.mcp.usage` and `llms.txt` when a site opts
in with `links.mcp`.

## What you get

Tools (always present): `get_site_info`, `list_pages`, `get_page`,
`search_pages`, `list_scenarios`. When the corpus is at or below the resource
threshold, pages are also listed as MCP resources at
`docs://<site-slug>/pages/<id>`; above it, the resource listing is omitted and
tool outputs carry the same URIs, so read-by-URI stays reachable.

Every answer byte-derives from the site's published artifacts. The server
refuses loudly (at launch, exit code 2) on an unknown contract major, an
unreachable source, a malformed artifact, or a torn corpus (mixed `buildId`
values across artifacts); a clean shutdown on stdin close exits 0.

## Error taxonomy (NFR-005)

Every failure mode surfaces as a named, typed error; none manifests as a hang
or as fabricated content. All seven codes:

| Code | Meaning |
| --- | --- |
| UNKNOWN_CONTRACT_MAJOR | The index `version` major is not in the supported set; the server refuses to become ready. Upgrade doc-kitty or pin the matching server major. |
| UNREACHABLE_ENDPOINT | The source fetch failed after the one documented retry (wrong URL, network down). |
| MALFORMED_CORPUS | An artifact failed presence/shape validation. |
| PAGES_LINKS_GATED | The index gates per-page artifact links off; the server degrades to index-only tools and announces it. |
| BUILD_IDENTITY_MISMATCH | Torn corpus read: artifacts carry diverging `buildId` values (the site redeployed mid-load). Restart the server. |
| PAGE_NOT_FOUND | The requested identifier is not present in the loaded snapshot. |
| UNSUPPORTED_CLIENT_REVISION | The connecting client negotiated an MCP spec revision older than the supported one (announced, never silently degraded). |

## Publishing status

Not published to any registry; the npm-scope, provenance, and registry-listing
decision is deferred to a release-engineering ruling (mission constraint
C-002). GitHub Packages was evaluated as a channel and found unsuitable as a
public channel: its npm registry requires a token even to install public
packages, so it can serve only as an internal/beta channel. Until the ruling,
the tarball form above is the only supported installation, and the advertised
launch line names the installed bin - never an `npx -y @spec-kitty/...`
registry form.

## Development

```bash
pnpm --filter @spec-kitty/doc-kitty-mcp build       # tsc emit to dist/
pnpm --filter @spec-kitty/doc-kitty-mcp test        # vitest (unit, surface, conformance, perf lanes)
pnpm --filter @spec-kitty/doc-kitty-mcp typecheck   # tsc --noEmit over src and tests
pnpm assert:supply-chain                            # NFR-003 closure audit (mcp/scripts/audit-closure.mjs)
```

The supply-chain audit enforces the packaging budget: exactly one declared
runtime dependency (the exact-pinned SDK), at most 5 new lockfile entries
attributable to this package, and zero install scripts anywhere in that
closure.
