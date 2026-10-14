---
affected_files: []
cycle_number: 1
mission_slug: reading-width-01M4X4XG
reproduction_command:
reviewed_at: '2026-10-14T12:42:00Z'
reviewer_agent: claude
wp_id: WP02
---

# WP02 review feedback 1

Independent adversarial review (reviewer-renata profile) of 65a4bf4. No blocking
defects: centring, containment, print, cascade and invalid values all verified
in Chromium. Changes requested for small items that should not be deferred:

1. `container-type: inline-size` on `.content-panel` is load-bearing (without it
   `100cqi` resolves against the viewport and, at 1600px expanded, the table runs
   160..1440 over the sidebar and the rail) but nothing pins it. Add a contract
   assertion for the declaration inside the 72rem query, and an acceptance case
   at 1600px expanded where the pane, not the cap, limits the table.
2. NFR-002 names 1152, 1280 and 1600px; the wide-table page is not scroll-checked
   at those widths. Add them.
3. FR-005 says nothing changes below 72rem, but between about 1057px and 1151px
   with a sidebar the column now fills its pane (up to about 816px instead of
   720px). That follows from FR-001; correct the requirement wording and the docs
   that repeat it, rather than the behaviour.
4. Nit: `translate: -50%` can land on a half pixel; note it in the rule comment.
5. Nit: a float beside a grown table can overlap it; none exist in the docs. Note
   only.
