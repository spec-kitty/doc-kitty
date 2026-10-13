# Data Model: Sidebar, TOC rail and page-frame remediation with Header carrier

No persisted data is introduced. The entities below are configuration and derived structures.

## Frame-width token

| Field | Value |
|---|---|
| Name | `--dk-width-frame` |
| Type | length or percentage |
| Default | `100%` |
| Invalid value | behaves as `100%` |
| Derived | frame gutter = `max(0, (viewport − frame) / 2)` |

Invariant: sidebar start edge = frame start edge; rail end edge = frame end edge; header content is inset by the gutter.

## Rail state

| State | Root attribute | Stored preference | Rail column | Toggle position |
|---|---|---|---|---|
| Expanded | absent | not collapsed | sidebar-width token | centred on the rail's inner edge |
| Collapsed | `data-toc-collapsed` | collapsed | 1px | end edge aligned to the frame's end edge |

Transitions: toggle activation flips the state, updates the attribute, stores the preference and updates `aria-expanded`. Names are unchanged from today (C-003). A page with a near-empty table of contents has no rail and no state.

## Draft-publication setting

| Field | Value |
|---|---|
| Name | `DK_PUBLISH_DRAFTS` |
| Values | `on`, `off` |
| Default | `off` |
| Sources, in precedence order | process environment; site env files |
| Unrecognised value | build error naming the setting and the accepted values |

| Surface | off | on |
|---|---|---|
| Draft page emitted | no | yes |
| Sidebar entry | no | yes |
| Search record | no | no (noindex) |
| Robots meta | n/a | `noindex` |
| Sitemap, feeds, `llms.txt`, agent index | excluded | excluded |

A page is a draft when its status is `draft` or absent, as today.

## Sidebar group metadata

Built once per build from the docs index, keyed by directory path.

| Field | Source | Fallback |
|---|---|---|
| label | index page title | humanised directory name + build warning |
| order | index page declared sidebar order | none: sorted after ordered siblings, by label |
| index entry | the directory's index page | none |

Rules: index entry first; ordered siblings ascending; ties and unordered siblings by label using the shared code-unit comparator; consumer-supplied sidebar config is not reshaped.

## Carrier set

`Head`, `PageTitle`, `MarkdownContent`, `Footer`, `Header` (new). The Header carrier has one slot, `dk:site-header`; when the slot is empty it renders the framework's default header unchanged.
