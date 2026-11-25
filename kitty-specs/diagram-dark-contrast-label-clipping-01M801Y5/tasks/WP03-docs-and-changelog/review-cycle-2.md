---
affected_files: []
cycle_number: 2
mission_slug: diagram-dark-contrast-label-clipping-01M801Y5
reproduction_command:
reviewed_at: '2026-11-22T07:47:38Z'
reviewer_agent: claude::curator-carla
wp_id: WP03
---

# WP03 re-review — operator ruling (2026-11-22, via the dispatcher)

WP03 was moved to review with `--force` and later accepted with `--attest-no-implementation`.
Both were workarounds for spec-kitty/spec-kitty#7809: a planning-artifact WP's evidence window
is defined on the target branch (`main`), while its docs had been committed on the mission
branch, so the real `consolidate` refused the docs as unattributable.

Operator ruling: commit WP03's docs on LOCAL `main` (never pushed), re-review WP03 so its evidence
window is satisfied, then run the real consolidate; drop the attestation if the re-review makes
it unnecessary.

Content to land (and to review):
- `docs/architecture/diagrams.md`: the label entry with the font ruling (#412), the narrowed claims
  from the pre-PR squad (HTML labels only; only `classDef`/`style` colours count as the author's;
  the `classDef` font override), and the new "Author edges" item replacing the stale "an edge
  colour the author sets is the author's to check" (reviewer note, WP02 cycle 4).
- `docs/changelog/unreleased/369-diagram-label-legibility.md`: the label and edge bullets.
- `docs/changelog/unreleased/370-diagram-label-font.md` (out-of-map, a `Changed` fragment for the
  ignored `%%{init}%%` font).
