---
affected_files: []
cycle_number: 1
mission_slug: doc-kitty-mcp-server-01M6BAQX
reproduction_command:
reviewed_at: '2026-11-01T20:14:17Z'
reviewer_agent: opencode::reviewer-renata
wp_id: WP04
---

# WP04 review feedback (round 1) — reviewer-renata

**Verdict: CHANGES REQUESTED — one blocking issue.** Everything else on the
mandated checklist passes; the evidence trail is at the bottom so you can see
what does NOT need reworking.

## Blocking Issue 1: `get_site_info.capabilities.resources` still reports `false`

`mcp/src/surface/tools.ts:230` ships `resources: false, // WP04 toggles when the
resources surface registers`. WP04 registered the surface (capability + all
three handlers, unconditionally, via the `optional.ts` seam), so the handshake
now declares `resources: { listChanged: false }` while `get_site_info` tells
clients the resources surface is NOT live. That is a client-visible lie on the
exact surface this WP exists to ship, and it contradicts both:

- `contracts/mcp-surface.md` Tools table: `get_site_info` output is
  "capabilities (which surfaces are live: pages, scenarios, resources)"; and
- your own WP04 DoD: "FR-011 requirements met end to end."

### Why this cannot be follow-up

No later WP owns `tools.ts` (WP05 = conformance, WP06 = packaging,
WP07 = governance artifacts). If this ships, WP05's conformance suite will
either codify the lie into goldens or bounce it right back here.

### Ownership adjudication

WP03's own artifacts designate WP04 as the toggle point — four separate
breadcrumbs: `tools.ts` header ("the resources flag flips in WP04"), the
comment at line 230 ("WP04 toggles when the resources surface registers"),
WP03's DoD ("No resources capability declared yet (WP04 toggles it)"), and
the WP03 test name ("announces all surfaces live **except resources (WP04)**").
I am therefore sanctioning this as a supervised cross-ownership fix INSIDE
WP04, not a scope violation. Record it in your next move-task note as a
shared-file coordination note (lane-c already shares `server.test.ts` the
same way).

### Required fix (minimal, three edits)

1. `mcp/src/surface/tools.ts` — `siteCapabilities`: flip `resources: false`
   to `resources: true` (unconditional: the surface registers in every mode;
   a pages-gated/pageless corpus degrades to empty listings and named read
   errors — that is a live-but-degraded surface, exactly how `pages: false`
   announces the pages gate. Update the two stale comments while you are
   there).
2. `mcp/tests/surface/get-site-info.test.ts:35` — the `'announces all
   surfaces live except resources (WP04)'` test: rename (e.g. `'announces
   all surfaces live'`) and expect `{ pages: true, scenarios: true, resources: true }`.
3. Same file, line ~52 (gated corpus): expect `{ pages: false, scenarios: true, resources: true }`
   — the resources surface stays live there; only `pages` reflects the gate.

Re-run `pnpm --filter @spec-kitty/doc-kitty-mcp test`: all 129 existing
tests plus these flips must stay green. No other file may change.

## Evidence for the things that PASS (do not rework)

- **Q-P1 seam hygiene**: `server.ts` untouched by WP04's commit; capability
  declared ONLY via `registerOptionalSurfaces` → `registerResources`, with
  capability + `resources/list` + `resources/templates/list` + `resources/read`
  registered as ONE unit (degrade-loud held). The low-level `server.server`
  escape hatch is justified and documented (SDK RFC-6570 `{id}` does not
  cross `/`; corpus ids nest).
- **`server.test.ts` flip is legitimate**: WP03's expectation literally read
  "(WP04 toggles resources)" — the anticipated seam activation, contract-shaped
  (`{ listChanged: false }`, no prompts).
- **Listing gate**: strict `snapshot.pages.length > threshold` (post-filter
  snapshot count, not a config echo); boundary `threshold == count` stays
  listed, tested explicitly (70-page fixture at threshold 69 and 70).
- **Template both modes**: `docs://<slug>/pages/{id}` advertised in listed
  AND gated modes; pageless fs corpus yields an empty template list rather
  than minting identities from a directory.
- **`resources/read`**: prefix-exact against `uris.ts` mintings; nested ids
  (`guides/getting-started`, `context/audience`) resolve; fs byte-equality vs
  disk bytes with no rewrite, AND a non-vacuous `--link-base` test comparing
  the full body to an independent in-test FR-007 projection (content fields
  byte-equal, exactly `links`/`_links`/`source`/`url` rewritten) — the
  mandated fs read test exists and bites.
- **URI identity**: single canonical rule (`siteSlugFor` in `snapshot.ts`,
  re-exported by `uris.ts`); no second derivation anywhere; the
  `config.siteSlug` dir-derived value is guard/logging only and never feeds
  `docs://` identities; two servers over the same site mint identical URIs
  (tested); `/pages/` plural everywhere, the singular drift is tested absent.
- **Named errors**: `PAGE_NOT_FOUND:`/`PAGES_LINKS_GATED:` lead wire
  messages (asserted over the wire); pages-gated family answer precedes
  identity resolution (get_page parity); gated corpus degrades, never 404s.
- **Scope**: WP04's lone commit touches exactly
  {`surface/optional.ts`, `surface/resources.ts`, `tests/resources/**`,
  `tests/surface/server.test.ts`} — the flagged set.
- **Tests**: 129/129 pass in the lane worktree.
- Anti-pattern sweep: no dead code, no synthetic fixtures, documented
  empty-return reasons only, frozen files untouched, no MUST-NOT violations.
