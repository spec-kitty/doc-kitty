# Research: Page chrome

## R1: Finding which surfaces a site serves

- **Decision**: read Astro's `astro:routes:resolved` hook.
- **Rationale**: a spike on the example, run on 2026-11-05, reported `/api/bibliography.json`, `/api/content-graph.json`, `/api/index.json`, `/api/pages/[...slug].json`, `/api/scenarios.json`, `/llms.txt` and `/rss.xml`. It needs no consumer config and can't drift.
- **Alternatives**: a site-level declaration (#290's preference; maintainer rejected it, decision 01M6PDCRA1451NM7YR1R2BT8CX) and detection from `dist/` (too late, since pages render first).

## R2: Hub block placement

- **Decision**: rebind blocks to positions outside `<Layout>` for `kind: Hub`, using the carrier's existing `EmptyFragment` technique.
- **Rationale**: themes can register layouts through the manifest (`src/lib/manifest.ts`), so a new named slot would be a contract third-party layouts could miss. This has no such contract, and non-hub output stays byte-identical.
- **Alternatives**: a named slot in layouts (#290's likely approach), which needs a fallback or guard for every layout.

## R3: Disclosure control

- **Decision**: extract the rail's toggle, enhancing a native `<details>` baseline.
- **Rationale**: the maintainer chose one scripted control (decision 01M6PDCSJA3PEZRH4NCZYVN9BB). `<details>` keeps no-script reach, in-page find and Starlight's persister working.
- **Alternatives**: native only, with a shared look. It needs no script, but doesn't deliver `aria-controls` or one shared component.

## R4: Icons and the sidebar

- **Decision**: a DocKitty sublist, rendered only when a site opts in, inside Starlight's exported `SidebarPersister`.
- **Rationale**: Starlight 0.42.6's `SidebarSublist.astro` renders group labels as escaped text in `<summary>`, and groups have no `attrs`, so neither icons nor a link label can get in through route data.
- **Alternatives**: rewriting HTML in middleware (fragile), or `attrs` with CSS masks on links (doesn't reach groups).

## R5: Icon source and licence

- **Decision**: Starlight's built-ins plus pinned `@iconify-json/fa6-solid`, with a licence comment on pages that render an FA icon (decision 01M6PDCTVAM98BB6QY4SWDH1F6).
- **Rationale**: the package is CC BY 4.0. Font Awesome's own files embed attribution as comments, but Iconify's data doesn't.
- **Alternatives**: visible credit; Starlight icons only.

## R6: Atom entry shape

- **Decision**: a top-level `<entry>` document with `application/atom+xml;type=entry`, skipped when a page has no date.
- **Rationale**: RFC 4287 requires `updated`, and `author` for an entry outside a feed. A made-up date would be false, and the current build time isn't deterministic.

## R7: Title-as-index and pagination

- **Decision**: keep the index link in route data with a marker, and skip it only when rendering.
- **Rationale**: Starlight builds pagination by flattening the sidebar, so removing the entry would drop the index from previous and next links.

## Squad findings

Post-tasks squad, 2026-11-05: architect-alphonso, frontend-freddy, reviewer-renata, analyst-annie. All returned GO-WITH-FIXES. Every finding below is **accepted**, and the change is in the location named, unless marked otherwise.

### Design

| Finding | Severity | Found by | Disposition |
|---|---|---|---|
| Starlight's persister records only clicks in a `summary`, so a button toggle is never stored | High | Two reviewers independently | WP03 T011, WP06 T022, WP06 T023 |
| The button inserted first lands before the label link | High | Two reviewers | WP03 T011: `details.before(button)` |
| Scoped CSS doesn't reach a script-created button | High | Frontend | WP03: global `disclosure.css` |
| Adjacent `</Layout>` positions are needed for byte identity | Medium | Architect, by compiling | WP02 T006 |
| Static import leaks the custom body's CSS to all sites | Medium | Architect, from source, not built | WP06 T021: manifest. WP11's golden includes CSS |
| `sitemap` isn't always served | Medium | Architect | WP01 T003, data model, spec unaffected |
| `sidebarGroupHasCurrent` and built-in icons aren't exported | Medium | Two reviewers | WP06 T020, WP07 T026 |
| Focus is lost when hiding a focused summary | Medium | Frontend, by probe | WP03 T011 |
| Accessible name dropped the visible count | Medium | Frontend, by probe | WP03 T011, WP04 T013 |
| Caret stops rotating outside `details` | Medium | Frontend | WP06 T022 |
| Pill has no tone, no hover or focus rule, and the wrong line cited | Medium | Frontend | WP09 T037, contract |
| New handoffs must be registered in `internal-env.mjs` | Low | Architect | WP01 T002 |
| `getSidebarHash` rationale was wrong | Low | Two reviewers | WP05 T018 |
| Empty title-as-index group; route factory staleness; icon margins; print rule traceability | Low | Various | WP06 T022, WP01 T005, WP07 T026, WP04 T013 |
| Script in the sublist breaks parity, and may hit a Safari bug | Low | Frontend, inlining untested | WP06 T022 |

### Tests

| Finding | Severity | Disposition |
|---|---|---|
| An example icon would switch every example build to the custom renderer | Critical | WP07 T030: icons stay out of the example. Spec assumption amends #293 |
| No mechanism to vary options in a build | High | New WP11 T043 |
| A whole-example golden breaks on any docs edit | High | New WP11 T044, T045: frozen fixture and stamp |
| Container API looks infeasible (inferred, not run) | High | WP06 T020: build twice, compare |
| An env-guarded route can't remove a route (not run) | High | WP01 T004: delete and rebuild |
| Playwright serves only two dists | High | New WP11 T047 |
| No unthemed fixture exists | High | WP11 T043, T047 |
| No DOM test environment | High | WP03 T012, moved to Playwright |
| Both named hubs carry only the glossary panel | High | WP02 T007: content added to `rhetoric/book-one/` |
| Unnamed XML parser | High | WP08 T033, WP11 T046: `sax`, with a control |
| Twelve visual baselines go stale | High | WP05 T019, WP10 T042, orchestrator dispatch |
| `assert-chrome-artifacts.mjs:1287-1296` goes red | High | WP04 owns and changes it |
| `sidebar-reveal.spec.ts:173` becomes unreachable | High | WP05 T019 |
| Axe and target-size lose closed content | Medium | WP04 T016, WP06 T023 |
| Weak coverage of SC-003, NFR-006, NFR-001 pages, FR-021 | Medium | WP04 T016, WP06 T023, WP08 T033, WP09 T038 |
| `build:a11y` omits `dist-nodrafts`; SC-006 undefined base | Medium | WP11 T047, WP10 T042 |
| Comparing a build with itself | Medium | WP07 T030, WP11 T045 |
| Serialized suite runtime | Low | **Deferred with rationale**: acceptable when warm; WP11 caches by option set and reports cold runs |

### Scope

| Finding | Severity | Disposition |
|---|---|---|
| OKF, scenarios and MCP weren't ruled in or out of the footer group | High | FR-001, WP09 T034 |
| Hub guard tests had no owner | High | WP02 T007 |
| #293's Markua map reuse had no subtask | Medium | WP07 T025 |
| #290's third ADR was silently dropped | Medium | ADR-0077, WP03 T049, C-002 |
| FR-007 lacked the ARIA contract | Medium | FR-007 |
| NFR-008 overstated validation | Medium | NFR-008, WP08 T033 |
| "Dated" narrows #292; host header limit | Medium | Spec assumption, WP08 T032, T033, contract |
| `repository` shape vs #150, and which Bitbucket | Medium | Hosted services only, in spec, contract and WP09. **Deferred**: a comment on #150 goes with the ticket reconciliation below |
| Tickets need amending for this mission's decisions | Medium | **Deferred** to the PR stage, with maintainer confirmation of the GitHub writes |
| DM-01M6PC9D9X1EDV9H8RXQPEHAD6 still reads "one site-level declaration" | Low | Superseded by DM-01M6PDCRA1451NM7YR1R2BT8CX. Decision records stay as written, and this note records it |
| Decision records have no rationale | Low | **Deferred with rationale**: the rationale is here and in `plan.md` |
| Issue citations lack context markers | Low | Prompts use "see #" where the issue owes nothing |

### Second opinions

None needed. Delegates didn't disagree on anything consequential, and two independent reviewers converged on the top design finding. Findings marked "not run" rest on source reading. WP11 and WP06 validate them in their first steps.

### Supply chain

The adversarial pass raised no finding against either dependency. WP11 T046 reruns DIRECTIVE_051's controls on the resolved packages.

## Post-implementation notes

Recorded after the mission merged.

### DIRECTIVE_051 results

Controls run on the resolved packages, as WP11 T046 planned.

| Package | Registry | Integrity | First published | Latest | Scripts | Pinned and frozen | Licence | Dependencies |
|---|---|---|---|---|---|---|---|---|
| `@iconify-json/fa6-solid@1.2.4` | registry.npmjs.org | `sha512-LmDNNdJVyvF5mPm1yxWvL8KjCc/E8LzoqnF1LNTVpyY2ZJRUlGOWuPIThdbuFBF2IovgttkIyumhyqfmlHdwKg==` | 2022-02-14 | 1.2.4, 2025-07-23 | No lifecycle scripts | Yes; the frozen install succeeds | CC-BY-4.0 | `@iconify/types@2.0.0` only |
| `sax@1.6.1` (dev) | registry.npmjs.org | `sha512-42tBVwLWnaQvW5zc4HbZrTuWccECCZfBi92FDuwtqxasH+JbPB3/FOKb1m222K42R4WxuxzzMsTswfzgtSu64Q==` | 2011-02-09 | 1.6.1, 2026-07-24 | No install scripts | Yes | BlueOak-1.0.0 | none |

Two more facts about `@iconify-json/fa6-solid`: its registry entry has no `repository` field, and it takes 980 KB on disk.

### Decisions made during implementation

- **Pages with `agent.discoverable: false` show no format links.** The orchestrator ruled this in WP09. The page's JSON, Atom and OKF files are still built and served; only the links go.
- **Decks are outside SC-004's "from any page".** A deck has no Starlight footer or head, so it carries no footer links. SC-004 in `spec.md` now says so.
- **`contentGraph` is a `boolean`** in the served-surfaces field list. `data-model.md` said `true`, "always injected", and now matches the other routes.
