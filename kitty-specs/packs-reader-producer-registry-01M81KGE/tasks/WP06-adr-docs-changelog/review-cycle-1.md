---
affected_files: []
cycle_number: 1
mission_slug: packs-reader-producer-registry-01M81KGE
reproduction_command:
reviewed_at: '2026-11-22T14:25:18Z'
reviewer_agent: claude::reviewer-renata
wp_id: WP06
---

# WP06 review feedback (cycle 1): claude::reviewer-renata

Verdict: **changes requested**. These are text edits to ADR-0083, plus one nit in
packs.md. Everything else matches the approved code.

Reviewed commit: `feat/330-packs-reader-producer-registry` 0d2f61b (9621b5f..0d2f61b).

## Blocking

### B1. ADR-0083 overstates what a scope override does, and leaves out its caveat

Decision 5 says a caller "narrows" Gherkin's scope through `producerScopes`. The
code does not enforce narrowing.
- `ownerOfPage` uses `options.scopes[id] ?? producer.scope` as given.
- The override never goes through `checkEntry`, so it can name a different or
  wider scope, a malformed one, or an open section scope for the scope-recognised
  glossary producer.
- That last case is exactly what decision 4's guard refuses at registration
  ("must name its section, or it would own every page in the tree").

This is the pending WP01/WP04 follow-up: an override is not validated today.

As written, decisions 3–5 read as if every scope the registry acts on had been
checked. Change two things:
- In decision 5, say that `producerScopes` *replaces* the registered scope for
  that call, and that callers pass the resolved `gherkin.section` to narrow it.
- Add a caveat (decision 5, or Risks). The registry validates entries when it is
  built, but not a scope passed through `producerScopes`/`ownerOfPage`, so a caller
  can widen a scope. Validating overrides the way `checkEntry` does, including the
  open-section guard for scope-recognised producers, is a follow-up. Do not word
  it as already validated.

### B2. "As wide as before, but no wider" is not accurate

Under Consequences → Negative: before the registry, a Gherkin stamp exempted a page
**anywhere**, the docs root included. Now a root page is never in a section scope,
so a Gherkin-stamped root page is held to the contract (FR-017). The gate is
narrower than before, not equally wide. Say that it still accepts a Gherkin stamp
in any one top-level section unless the caller passes the configured section, and
that it no longer accepts one on a root page.

## Non-blocking

1. packs.md, "What is built": "README frontmatter is split off and parsed the same
   way, with known tags off". It is parsed with known tags off but with the
   default (core) schema, not failsafe, so an unquoted `1.10` in README
   frontmatter does become a number. Say "with known tags off (core schema)", or
   drop "the same way".
2. consumer-setup.md example: `contract: undefined` is accepted (an undefined key
   is skipped) but looks odd in a copy-paste example. Drop the line, or show it
   commented out with a path.
3. ADR-0083 `related` lists `architecture/generators`, but the registry paragraph
   went into `metadata-model.md`. That placement is right: it sits after the
   `generated` stamp's ownership semantics. Consider adding
   `architecture/metadata-model` to `related`.

## Verified (no action)

- The warning-code table in packs.md equals the codes the approved code emits:
  23 codes, no extras, none missing.
- CLI exit codes (0 with warnings; 2 for usage, no `pack.yaml`, broken contract),
  the option keys (`charterLock`, `contract`; #338's keys listed as future),
  `[dk-packs]` errors, YAML failsafe with known tags off for pack files, no reads
  through a symlinked component, `--ref <tag or full commit>`, and tag
  `contract-packs-v0.1.0-rc.1` / `69ec326` all match the approved WP01–WP05 code.
- open-packs' `charter.lock.yaml` pins `cb9b15426d…`, so the `cb9b154` mismatch
  claim holds. The corpus claim (19 packs, every manifest verifies) matches my run
  at 0be738a.
- ADR number 0083 is free: 0081 is used on #405 / feat/print-pdf-output, and 0082
  on #413 / docs/346-mission-status-reader-adr. No other origin branch or PR head
  has 0083. `docs/adr/README.md` is untouched, and ADR-0079's text is unchanged.
- Gates on 0d2f61b: validate:docs (the 4 warnings are all pre-existing, none in
  touched files), validate:links, validate:adr-ids, validate:changelog, and
  markdownlint on the 5 touched files are all clean. Vale is not installed in the
  reviewer's container, so I did not re-run it.
