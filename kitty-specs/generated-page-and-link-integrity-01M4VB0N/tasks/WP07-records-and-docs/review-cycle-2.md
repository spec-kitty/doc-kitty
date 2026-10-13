---
affected_files: []
cycle_number: 2
mission_slug: generated-page-and-link-integrity-01M4VB0N
reproduction_command:
reviewed_at: '2026-10-13T21:02:15Z'
reviewer_agent: claude
wp_id: WP07
---

# WP07 review feedback, cycle 2

Verdict: changes requested, for one sentence. Every finding from cycle 1 is resolved and true against the code. The gates pass (exit 0): `generate-adr-index.mjs --check`, `validate-frontmatter.mjs docs`, `check-links.mjs docs example/docs` with drafts on and with `DK_PUBLISH_DRAFTS=off`, `assert-guide-no-internal-paths.mjs`. `git diff --name-status main -- docs/adr/` shows `A` 0047, `A` 0048, `M` README.md. No accepted ADR is edited and no version field changed. Do not touch anything else that cycle 1 or this cycle confirmed.

## Must fix

### 1. `docs/architecture/gherkin-pages.md`, "Related follow-ups", first bullet (lines 419-421) (MAJOR, one sentence)

> - The glossary generator writes `index.md` regardless of `indexBasename`, so under the default `README`-only setting its hub lands at `/glossary/index/`. The Gherkin hubs use the first configured basename and don't have this problem.

This bullet predates the mission and WP07 left it standing in a page it edited. It is now false twice over, and it contradicts ADR-0048, `docs/architecture/glossary.md` and the changelog's #129 entry:

- The generator no longer writes `index.md` regardless of the setting. `src/lib/glossary/generate.ts` takes the name from `generatedIndexBasename(indexBasename, { prefer: 'index' })`: `index` when the site lists it, otherwise the first index name. This mission closed the follow-up (#129).
- The hub never "landed at" `/glossary/index/`. ADR-0048's Context says so: Starlight served it at `/glossary/`, and only links the toolkit built pointed at `/glossary/index/`.

Required change: remove the bullet, or replace it with a statement of the current state, for example:

> - The glossary generator now follows `indexBasename` too, but prefers `index` when the site lists it, while the Gherkin hubs use the first index name. One site can therefore hold a `README.md` Gherkin hub and an `index.md` glossary hub. See [ADR-0048](../adr/0048-generated-page-names-and-empty-sources.md).

Keep the second bullet (Phase 2 results). Bump `updated` only if it is not already today's date.

## Wording notes (optional, do not block)

- `docs/guides/consumer-setup.md`, "Upgrading from 0.2.0", glossary bullet: "Old pages also stay, silently, in the folder of a context that no longer exists and under a name that is no longer one of your index names." "and" reads as one combined condition. Suggested: "Two kinds of old page also stay, with no message: a page in the folder of a context that no longer exists, and a page under a name that is no longer one of your index names."
- Same bullet: start "If a page you wrote sits at a path the generator needs" on its own line (the line is over-long after the edit).
- `docs/adr/0047-…`, Option A: re-wrap the over-long line "Rejected. It leaves every adopter to rewrite its links by hand, 61 in the first consumer, and breaks the".
- `docs/guides/consumer-setup.md`, "What `dockitty-check-links` checks" and the first upgrade bullet list three every-root classes; ADR-0047 and the changelog now list five. Adding "a link that goes up out of the docs root and back in" would make the guide complete. Not false as written.

## Out of scope for WP07 (for the orchestrator)

`USAGE` in `src/scripts/check-links.mjs` still says "A relative .md/.mdx link passes exactly when the build would rewrite it to a published page", with no `--strict` qualifier. That is the same claim cycle 1 rejected in the guide. It is code, not a WP07 file.
