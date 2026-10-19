# Research: Layout guards and decisions

The product research is in
[`docs/architecture/research/layout-guards-and-decisions.md`](../../docs/architecture/research/layout-guards-and-decisions.md).
It covers measurements on Starlight 0.42.6, options per issue, the owner's
decisions, and the four new findings. This file records only the engineering
decisions taken while planning.

## D-01: How the regeneration script gets a build without the header carrier (#207)

- **Decision**: a test-only environment switch read by `createConfig`, which omits
  only `Header` from the carriers map. It is off by default, undocumented for
  consumers, and unit-tested both ways. Owner decision `01M59CR08D2F8D3P8T3D0GN9VD`.
- **Rationale**: the fixture is the real example's header (title, logo, social links,
  `compressHTML`) without the carrier. Only a build of the real example gives that
  exactly.
- **Alternatives considered**: a separate plain-Starlight fixture site. It needs
  hand-kept parity with what `createConfig` passes to Starlight, so drift would
  silently change what "stock" means.

## D-02: How the reveal runs after Starlight's restore (#203)

- **Decision**: `src/components/Sidebar.astro` renders Starlight's own `Sidebar`
  (`@astrojs/starlight/components/Sidebar.astro`, exported by the package) and then
  emits the reveal as an inline script. Starlight's `Sidebar` already contains
  `SidebarPersister`, whose closing inline script restores the scroll position, so
  anything after it runs after the restore. The head entry for
  `REVEAL_CURRENT_SCRIPT` is removed; the popover `toggle` re-reveal stays.
- **Rationale**: the order comes from the markup itself, so no timing assumption is
  needed. The script runs while the HTML is still streaming, before first paint of
  the sidebar.
- **Alternatives considered**:
  - Keeping the head script as a fallback. Rejected: it would run a second time on
    `DOMContentLoaded`, and nothing in the new placement can fail in a way the
    fallback would fix.
  - A head-script `MutationObserver`. Declined by the owner.

## D-03: How the header search tracks the column (#216)

- **Decision**: the column's start becomes one toolkit-owned length, set where the
  toolkit centres the column (`dk-components.css`) and changed by the collapsed-rail
  rule (`toc-rail.css`). The header's `grid-template-columns` first track uses that
  length, set by an unlayered toolkit rule. The header markup is not touched.
- **Rationale**: the stock header computes its first track from Starlight's own
  geometry, which the toolkit no longer uses. With one length shared by the column
  and the header, they cannot drift apart. The header carrier must stay
  byte-identical (`sidebar-frame-header-carrier-01M4T3CB#NFR-007`), so the fix has to
  be CSS.
- **Alternatives considered**:
  - Overriding Starlight's private `--__main-column-fr`. Rejected as fragile across
    upgrades.
  - Moving the search out of the header. Rejected: that changes the header markup.

## D-04: When screenshot baselines are regenerated

- **Decision**: once, by the `update-a11y-baselines` workflow on the mission branch,
  after every layout change and the published projects have landed. That single run
  writes both the drafts-on and the published baseline sets.
- **Rationale**: C-001. Every layout concern moves pixels, so regenerating earlier
  would mean regenerating again.
- **Alternatives considered**: regenerating per work package. That would churn the
  baselines and invite local regeneration.

## D-05: Where the new geometry checks live

- **Decision**: each new guard gets its own spec file under `tests/a11y/`:
  - `sidebar-reveal.spec.ts` (#203);
  - `frame-alignment.spec.ts` (#216, #217 and the cap);
  - `persona-card.spec.ts` (#206);
  - `no-sidebar-recentre.spec.ts` (#199);
  - `target-size.spec.ts` (#202);
  - `sidebar-membership.spec.ts` (#200).

  Each one uses the existing light-project-only geometry convention, and shared
  measuring code goes in `tests/a11y/helpers/`. `layout-geometry.spec.ts` and
  `reading-width.spec.ts` change only where the 120rem default moves an existing
  expectation.
- **Rationale**:
  - Work packages must own disjoint files, so several work packages cannot all add
    tests to `layout-geometry.spec.ts`.
  - A file per guard also makes the guard and its fail-first proof easy to find.
  - Geometry is the same in both colour modes.
- **Alternatives considered**: putting every check in `layout-geometry.spec.ts`.
  Rejected: work packages would collide on one file.

## Findings disposition (adversarial squad, Phase 1 research)

Every finding the four delegates returned is dispositioned in the research note's
"Decisions taken" and "New findings" sections:

- the decision findings: accepted or changed, per the owner;
- the new defects: accepted, as #216 and #217;
- the stale docs: accepted, as FR-015;
- the local font-dependent failure: accepted, as #217.

No finding was dropped.
