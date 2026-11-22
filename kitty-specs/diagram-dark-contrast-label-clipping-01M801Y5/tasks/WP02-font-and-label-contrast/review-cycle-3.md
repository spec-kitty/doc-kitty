---
affected_files: []
cycle_number: 3
mission_slug: diagram-dark-contrast-label-clipping-01M801Y5
reproduction_command:
reviewed_at: '2026-11-22T06:39:49Z'
reviewer_agent: claude::node-norris
wp_id: WP02
---

# WP02 cycle 3 — reopened by operator ruling (2026-11-22, via the dispatcher, option a)

#369 item 1 reproduces on its own example page: docs.spec-kitty.ai 02_containers figure 3 sets
`lineColor: '#0a0721'` in `%%{init}%%`; its 13 edges are ~1.1:1 on the dark page. The legibility
check exempted author-set edge colours, so the approved WP02 does not meet #369's done-criterion
("every Mermaid edge 3:1 in dark").

Required:
1. Red first: the fixture gets an author-edge-colour diagram (`%%{init}%%` lineColor, and a
   `linkStyle` that fails in the other theme); the check stops exempting author edges and asserts
   >= 3:1 for every edge in both themes.
2. Keep each author edge colour where it is readable; add an id-scoped themed override
   (`var(--dk-diagram-edge)`) only in the theme where it is under 3:1 against the worst page
   (pure black for dark, pure white for light), for edge paths and their arrowhead markers.
