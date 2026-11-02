---
work_package_id: WP04
title: 'Resource surface: docs:// URIs, size gate, template'
dependencies:
- WP03
requirement_refs:
- FR-011
planning_base_branch: feat/doc-kitty-mcp-server
merge_target_branch: feat/doc-kitty-mcp-server
branch_strategy: Planning artifacts for this mission were generated on feat/doc-kitty-mcp-server. During /spec-kitty.implement this WP may branch from a dependency-specific base, but completed changes must merge back into feat/doc-kitty-mcp-server unless the human explicitly redirects the landing branch.
subtasks:
- T017
- T018
- T019
history:
- '2026-11-01 planned: created from IC-03 of plan.md'
- '2026-11-01 ruling: operator answered Q-P1 = hybrid; this WP is live, not contingent'
authoritative_surface: mcp/src/
create_intent:
- mcp/src/surface/resources.ts
- mcp/src/surface/optional.ts
# note: WP03 creates optional.ts as a no-op stub; this WP fills it (serial dependency WP03 -> WP04), which is why both WPs declare it.

execution_mode: code_change
mission_slug: doc-kitty-mcp-server-01M6BAQX
owned_files:
- mcp/src/surface/resources.ts
- mcp/src/surface/optional.ts
- mcp/tests/resources/**
tags: []
tracker_refs: []
---

# WP04 - Resource surface: docs:// URIs, size gate, template

## Objective

Expose corpus pages (and sections) as MCP **resources** so clients with resource UX can attach docs directly:

- `docs://<site-slug>/pages/<pageId>` - byte-projected page artifact content.
- `docs://<site-slug>/sections/<sectionId>` - section metadata document.
- Listed only when the corpus is small; always readable by URI; a resource template keeps read-by-URI discoverable above the threshold.

**Ruling**: operator answered Q-P1 = hybrid on 2026-11-01; this WP is live. FR-011 is fully in scope.

Squad context you must respect:

- **A8**: `<site-slug>` must be derived by exactly one canonical rule so two servers over the same site mint identical identities: lowercase the launch base, drop scheme and trailing slash, collapse non-alphanumerics to `-` (e.g. `spec-kitty.github.io/doc-kitty` -> `spec-kitty-github-io-doc-kitty`). Put the function in `uris.ts` and use it nowhere else and everywhere it is needed.
- **R4 (researcher)**: above the listing threshold, plain `resources/list` returns the template only; page URIs stay reachable because T013's tool outputs carry each page's `uri` field.
- **V7/reviewer**: BOTH branches (listed and gated) must be conformance-tested in WP05; write the unit tests here for both so WP05 only wires the golden comparison.
- Protocol legality verified (2026-07-28 spec revision): declaring the resources capability with an empty list is explicitly legal; read-by-URI of an unlisted resource is fine.

## Subtask guidance

### T017 - Implement the optional-surface registration

- Fill WP03's stub `mcp/src/surface/optional.ts`: `registerOptionalSurfaces(server, snapshot, config)` registers the resources capability + handlers per the contract. URIs come from WP03's `uris.ts` (already minted and unit-tested there; this WP consumes it, keeping ownership disjoint).

### T018 - resources.ts

- Declare capability when snapshot present; `resources/list`: when `pages.length <= config.resourceListingThreshold` (default 1000), list all page + section resources with name/uri/description from published fields; above the threshold list nothing and rely on the registered template `docs://<site-slug>/pages/{id}`.
- `resources/read`: resolve by URI, byte-projected body from the snapshot (HTTPS mode: byte-equals artifact; fs mode: content fields byte-equals, link fields re-origined per the contract carve-out).
- Unknown URI -> `PAGE_NOT_FOUND`-family error; gated snapshot -> `PAGES_LINKS_GATED`.

### T019 - Tests

- Listed mode (example fixture, 68 pages <= threshold): every page listed with URI and description.
- Gated mode (threshold forced below 68): list empty, template registered, read-by-URI still works.
- Identity: two servers configured against the same site mint identical URIs (canonical-slug test).

## Definition of Done

- [ ] Both branches exercised by tests; template present in both modes.
- [ ] One fs-mode `resources/read` test asserting byte-projection with the documented link rewrite (reviewer: the DoD carve-out clause must be backed by a subtask).
- [ ] URIs canonical per the pinned rule; slash/plural form is `/pages/` everywhere (research R5 drift fixed).
- [ ] Byte-projection matches the contract carve-out in both input modes.
- [ ] FR-011 requirements met end to end.

## Risks / reviewer guidance

- Reject slug derivation from directory paths or titles (A8).
- Reject a second URI form appearing anywhere (contract names exactly one).
- Reviewer: verify gating uses the SNAPSHOT's page count (post-filter), not a config echo.

## Branch strategy

Planning base branch: `feat/doc-kitty-mcp-server`; merge target: `main`. Depends on WP03.

Implementation command: `spec-kitty agent action implement WP04 --agent <name> --mission doc-kitty-mcp-server-01M6BAQX`
