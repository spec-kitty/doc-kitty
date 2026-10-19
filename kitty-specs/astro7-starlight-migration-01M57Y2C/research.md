# Research: Astro 7 and Starlight 0.41 migration

The upgrade findings themselves are produced by WP01 (the spike) and published as a
DocKitty research note under `docs/` plus a comment on #142. This file records the
planning decisions.

## R-1 Markdown processor
- Decision: `markdown.processor: unified()` from `@astrojs/markdown-remark`.
- Rationale: every DocKitty Markdown feature is a remark/rehype plugin; `unified()` runs them unchanged.
- Alternatives: port to Sätteri (#148): rejected for this mission by operator ruling; recorded in the ADR with a reopen trigger.

## R-2 Spike before commitment
- Decision: the spike is WP01 and ends at an operator go/no-go gate.
- Rationale: two majors are skipped (Astro 6 breaking changes apply); sizing needs evidence.
- No-go deliverable: research note + #142 comment only.

## R-3 One line for #119, #144, #145
- Decision: three commits on one branch line, one WP sequence.
- Rationale: the build only goes green when all three land.

## R-4 Rebaseline discipline
- Decision: regenerate each pinned baseline and state a reason; never loosen a gate.
- Known drift: three local screenshot baselines on `main` fail locally but pass in CI; judged against CI.

## R-5 Breaking-release scope
- Decision: 0.4.0 = migration + #183 + #210 on top of the existing `[Unreleased]` breaking entries.

## R-6 Supply-chain adversarial pass
- Decision: the dependency change is challenged inside the pre-PR two-lens review (one lens: supply chain and pins).
- Findings disposition: recorded in the PR body; none silently dropped.
