---
work_package_id: WP07
title: 'Governance artifacts: ADR, changelog fragment, docs'
dependencies:
- WP01
- WP02
- WP03
- WP05
- WP06
- WP08
requirement_refs:
- C-004
planning_base_branch: feat/doc-kitty-mcp-server
merge_target_branch: feat/doc-kitty-mcp-server
branch_strategy: Planning artifacts for this mission were generated on feat/doc-kitty-mcp-server. During /spec-kitty.implement this WP may branch from a dependency-specific base, but completed changes must merge back into feat/doc-kitty-mcp-server unless the human explicitly redirects the landing branch.
subtasks:
- T027
- T028
- T029
history:
- '2026-11-01 planned: created from IC-04 of plan.md'
authoritative_surface: docs/adr/
owned_files:
- docs/adr/**
- docs/changelog/unreleased/**
- docs/architecture/generators.md
- docs/guides/**
- kitty-specs/doc-kitty-mcp-server-01M6BAQX/squad-dispositions.md
- kitty-specs/doc-kitty-mcp-server-01M6BAQX/quickstart.md
create_intent: []
execution_mode: planning_artifact
mission_slug: doc-kitty-mcp-server-01M6BAQX
tags: []
tracker_refs: []
---

# WP07 - Governance artifacts: ADR, changelog fragment, docs

## Objective

Close the repo-process obligations so the mission is mergeable:

1. The C-004 ADR: Shape A over Shape B (with B's re-trigger), the pass-through invariant (C-001), the research-R4 relative-at-build fork record, the Q-P1 outcome, stdio-only transport boundary, and the publishing deferral (C-002).
2. Changelog fragment + docs updates (fifth discovery surface paragraph in generators.md; guides page).
3. Final cross-artifact consistency sweep.

Squad context you must respect:

- The ADR must record squad evidence rather than retell it: unanimous A verdicts, the ecosystem prior-art list (mcpdoc/GitMCP/Context7 generic-fetch pattern; Mintlify/GitBook per-site hosting pattern not available to a static host), the B rejection rationale (stamp-time freeze vs moving contract; config-as-codegen anti-pattern), and the B re-trigger (>= 3 real consumer demands for a configure-only wrap).
- Repo rules (current AGENTS.md): changelog = fragment file `docs/changelog/unreleased/<issue>-<slug>.md` with `section:` frontmatter (never edit CHANGELOG.md; `pnpm validate:changelog` gates it). ADR = next free number, new file only (never edit `docs/adr/README.md`; `.github/workflows/adr-index.yml` bot regenerates it). Check `main` and open PRs for the next free ADR number at writing time.
- Docs policy: sentence-case headings, audience-oriented, OKF frontmatter on docs/ pages (`title`, `description`, `doc_status`, `updated`, `kind`, `type`), no em-dash tells.

## Subtask guidance

### T027 - ADR

- File: `docs/adr/NNNN-generic-mcp-server-over-published-artifacts.md` with the next free number. Follow the repo's ADR frontmatter conventions (check two recent ADRs for the exact keys).
- Sections: Context (agent-interoperability outcome; ecosystem pressure), Decision (numbered: A over B; re-trigger; pass-through invariant; stdio-only; type-only contract coupling; buildId identity; publishing deferral naming the evaluated GitHub Packages tradeoff), Consequences (positive/negative/risks), Alternatives (B; relative-at-build; hosted HTTP), References (decision moments = the two squad runs + Q-P1, mission dir, ADR numbers of related records like ADR-0006/0058 family if referenced).
- The ADR exists BEFORE merge (C-004 hard gate).

### T028 - Changelog fragment + docs (+ mission quickstart sync)

- Sync the mission `quickstart.md`: fix its lingering C-002 self-contradiction - the local-build section still advertises the unpublished `npx -y @spec-kitty/doc-kitty-mcp` form; tarball-first everywhere (implementer lens).

- Fragment: `docs/changelog/unreleased/doc-kitty-mcp-server-generic-mcp-server.md`, `section:` per README convention, body: user-visible statement (generic MCP server consuming published artifacts; example: launch via tarball; wiring pointer opt-in).
- `docs/architecture/generators.md`: one paragraph naming the MCP adapter the fifth discovery surface (pass-through; never hosted; see ADR).
- `docs/guides/`: add a quickstart-style guide mirroring the mission quickstart (tarball-first), frontmatter per convention. Add it to the guides README index per site rules.

### T029 - Final consistency sweep

- Re-run `spec-kitty status` and confirm every WP done/approved.
- Cross-artifact sweeps: spec FR/NFR/C/SC ids referenced by WP frontmatter all exist; contract matches implementation knobs (threshold default 1000, cap 25); data-model ScenarioRecord flattening honesty (feature-level nesting preserved - per reviewer warning, verify final docs match).
- Update `squad-dispositions.md` tail with the implement-phase squad outcome references.

## Definition of Done

- [ ] ADR committed with next-free number, no index edit.
- [ ] `pnpm validate:changelog` green; doc-sanity (frontmatter/links) green.
- [ ] generators.md names the MCP surface accurately (advisory, consumer-side, static-host-safe).
- [ ] T029 report posted in the mission notes; FR/SC coverage table complete.

## Risks / reviewer guidance

- Reject future-tense ADRs ("will", "should become"): decisions in the ADR record what the merged code does.
- Reviewer: confirm no CHANGELOG.md or docs/adr/README.md edit appears in the diff.

## Branch strategy

Planning base branch: `feat/doc-kitty-mcp-server`; merge target: `main`. Depends on WP01, WP02, WP03, WP05, WP06, WP08; WP04 is deliberately NOT a dependency (contingent on Q-P1 - an undecided operator question must not block the critical path; the ADR records whichever ruling arrives).

Implementation command: `spec-kitty agent action implement WP07 --agent <name> --mission doc-kitty-mcp-server-01M6BAQX`
