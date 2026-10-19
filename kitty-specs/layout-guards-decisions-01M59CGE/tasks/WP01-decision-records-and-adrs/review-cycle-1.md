---
affected_files: []
cycle_number: 1
mission_slug: layout-guards-decisions-01M59CGE
reproduction_command:
reviewed_at: '2026-10-19T07:10:52Z'
reviewer_agent: claude
wp_id: WP01
---

# WP01 review feedback (cycle 1) - reviewer-renata

Verdict: changes requested. There are two accuracy defects, both in ADR-0064. An ADR cannot be edited once it is accepted, so they must be fixed before approval. Everything else passes: SC-005 citations, numbers, frozen ADRs, validators and scope.

## Findings

1. [MEDIUM] docs/adr/0064-default-frame-cap.md:64-66 - Decision 3 says "Only ADR-0045 decision 1 is superseded. Decisions 2 onward stand." This contradicts the ADR's own Status (lines 25-29). The Status correctly says that the `100%` token default in ADR-0045 decisions 2 and 3 is also superseded. ADR-0045 decision 2 says "Default `100%`" and decision 3 says "initial value `100%`", and that an invalid value computes to `100%`. ADR-0064 decision 1 replaces both. The Status reading is correct and is not an over-claim. Decision 3 is the line that is wrong. - Fix: reword decision 3 to match the Status. For example: "ADR-0045 decision 1 is superseded, and so is the `100%` default in decisions 2 and 3. Everything else in ADR-0045 stands: ...". Optionally, make the frontmatter description (line 3) say the same, for example "Supersedes ADR-0045 decision 1 and its 100% default."

2. [MEDIUM] docs/adr/0064-default-frame-cap.md:72-73, :112-113 and docs/architecture/theming.md:126-127 - "A cap below 117rem brings back a 72 px shift of the column between rail and no-rail pages" is false for the layout this mission ships. The 117rem threshold comes from #204 option 2 (anchored column): "Zero shift once the frame is 117rem (1872 px) or wider". The owner rejected option 2 and chose option 3 (accept the shift). The research note's #204 table shows the shift with the shift accepted: 0 for a 1280 px frame, 72 for 1440 and 144 from 1600 up. So under the shipped layout, a 90rem (1440 px) cap gives a 72 px shift, less than the 144 px that the 120rem default and full width give. A 100rem cap gives 144 px, the same as 120rem. Nothing is "brought back". Presenting this as a reason for 120rem in an immutable ADR is wrong. - Fix: either qualify the statement ("Under the anchored-column layout of #204 option 2, which was not chosen, a cap below 117rem would leave a 72 px shift; 120rem keeps that option open"), or drop the 117rem bullet. The real reasons are already there: 1920 px and narrower layouts are unchanged, and a 90rem or 100rem cap leaves only 24 px or 32 px beside the column on a rail page at 2560 px. Apply the same fix to theming.md lines 126-127 ("which is why the docs no longer suggest a 90rem cap"). collapsible-toc-rail.md:139 is correct as written, because it correctly ties 117rem to the anchored-column option.

## Checked and passing (no action)

- SC-005: every row of "Decisions taken" has a citation:
  - #199: earlier acceptance matrix and spec, and collapsible-toc-rail (guard and tripwire).
  - #200: collapsible-toc-rail tripwire paragraph.
  - #201: starlight-integration "Deterministic output".
  - #202: collapsible-toc-rail target-size line.
  - #203: ADR-0063.
  - #204: the collapsible-toc-rail section, with #216 noted.
  - #205: ADR-0064.
  - #206: theming persona card.
  - #207: starlight-integration fixture note.
  - #217 (padding below 84rem): collapsible-toc-rail "Clear of the toggle".
- All quoted numbers match the research note: 60 ms / 2 s / 4 s; 512/656; the cap table; 192; the 1920 frame; the #204 table; 26 of 68; 30%; 944 to 656; 7 px from 1152 to 1295; 4 px; 224/329/960/120 characters; 50rem/800 px.
- ADR-0013, 0015, 0044 and 0045 are byte-unchanged. In docs/adr only 0061, 0062 and README.md changed.
- ADR-0063 supersession points are correct: ADR-0044 decisions 1 and 4, ADR-0013 decision 3 and ADR-0015 decision 3.
- The test names and the `fixture:stock-header` script match plan.md. In Starlight 0.42.6 the skip link and the mobile toggle are outside the header (checked in node_modules).
- acceptance-matrix.json is valid. `automated_test` is used by 26 other entries.

## LOW (optional)

- [LOW] docs/adr/0064-default-frame-cap.md:27-29 - "the pinned rail width" stands. ADR-0045 decision 5 also says "its column is at most 720px", which ADR-0053 has already replaced. Consider "the pinned rail width (decision 5)" so the record does not seem to re-affirm 720 px.
