# Mission Specification: Document the diagrams option

**Mission Branch**: `issue-153-diagrams-option-docs`  
**Created**: 2026-10-14  
**Status**: Draft  
**Input**: Issue spec-kitty/doc-kitty#153: "An adopter can set `diagrams: false`
believing it means 'render diagrams in the browser', and ship every Mermaid block
as plain code."

Grounding: [`research/code-grounding.md`](./research/code-grounding.md). Every
behaviour named below is cited there.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Turn diagrams on from the consumer guide (Priority: P1)

An adopter following `docs/guides/consumer-setup.md` wants their ```` ```mermaid ````
blocks drawn. The guide has a Diagrams section that says what `diagrams: true`
does, what leaving it out or setting `false` does, and gives a minimal working
config.

**Why this priority**: This is the gap that caused spec-kitty-charter#28. Without
it an adopter guesses, and `false` looks like a render-mode choice.

**Independent Test**: On a scratch copy of the example site with diagrams off,
follow only the guide section, build with `DK_DIAGRAM_BUILD_RENDER=client`, and
see a Mermaid fence emitted as `pre.mermaid` inside a `figure.dk-diagram` with
the client render script on the page. Before the change it ships as code.

**Acceptance Scenarios**:

1. **Given** a site with no `diagrams` option, **When** the adopter reads the
   Diagrams section, **Then** it states the blocks ship as code and shows the
   one-line change that turns them on.
2. **Given** `diagrams: true`, **When** the adopter builds with
   `DK_DIAGRAM_BUILD_RENDER=client`, **Then** the Mermaid fence is drawn in the
   browser, with nothing else installed.

---

### User Story 2 - Pick and pin a render mode (Priority: P2)

An adopter running CI wants to know which mode their build will use and how to
force one.

**Why this priority**: Auto-detection depends on whether Chromium is installed,
so the same config can render differently on a laptop and in CI.

**Independent Test**: The section names both modes, the auto-detect rule, the
`DK_DIAGRAM_BUILD_RENDER` values, and recommends `client` for CI without
Chromium. Each statement matches `resolveDiagramMode` (grounding §2).

**Acceptance Scenarios**:

1. **Given** no Chromium, **When** `DK_DIAGRAM_BUILD_RENDER` is unset, **Then**
   the guide says the build uses client mode.
2. **Given** an adopter wants PlantUML, **When** they read the section, **Then**
   it says PlantUML needs build mode and a self-hosted server set through
   `DK_PLANTUML_SERVER_URL`, and that Mermaid needs neither.

---

### User Story 3 - The option comment says what `false` does (Priority: P2)

A developer reading the `diagrams?: boolean` doc comment in an editor sees what
the default does before what `true` wires.

**Independent Test**: The comment's first line reads "`false` (default): diagram
blocks are shown as code, not drawn."

**Acceptance Scenarios**:

1. **Given** the published typings, **When** a developer hovers `diagrams`,
   **Then** the first sentence states the `false` behaviour.

### Edge Cases

- A forced `DK_DIAGRAM_BUILD_RENDER=build` without Chromium does not fall back;
  the guide must not promise a fallback for the forced case.
- A ```` ```plantuml ```` fence in client mode stays a code block; the guide must
  say so.
- A `plantuml.com` server URL fails the build by design; the guide says to use a
  self-hosted server.

## Requirements *(mandatory)*

### Functional Requirements

| ID | Title | User Story | Priority | Status | Delivery | No-op passable? |
|----|-------|------------|----------|--------|----------|-----------------|
| FR-001 | Guide Diagrams section: on/off | As an adopter, I want the consumer guide to say that `diagrams: true` draws Mermaid (and PlantUML) blocks and that omitting it or `false` ships them as code, so that I do not mistake `false` for a render mode. | High | Open | [build] | no — the section does not exist on main |
| FR-002 | Guide Diagrams section: render modes | As an adopter, I want the two render modes, the auto-detect rule and `DK_DIAGRAM_BUILD_RENDER=build\|client` explained, with `client` recommended for CI without Chromium, so that my build renders the same everywhere. | High | Open | [build] | no — not documented for adopters on main |
| FR-003 | Guide Diagrams section: engines | As an adopter, I want to know that Mermaid needs nothing extra and PlantUML needs build mode plus a self-hosted server URL, so that I can plan my CI. | Medium | Open | [build] | no — not documented for adopters on main |
| FR-004 | Minimal working config | As an adopter, I want a minimal config that turns on client-side Mermaid, proven by building a scratch copy of the example from the section alone. | High | Open | [build] | no — needs a recorded scratch build |
| FR-005 | Option doc comment | As a developer, I want the `diagrams?: boolean` doc comment in `src/lib/config.ts` to start with "`false` (default): diagram blocks are shown as code, not drawn." | High | Open | [build] | no — the current comment starts differently |
| FR-006 | Build-time hint decision | As a maintainer, I want the optional "N diagram blocks found but diagrams is off" hint decided and recorded, with a test if it is added. | Low | Open | [folded] | yes — a recorded "not added" decision is the deliverable |
| FR-007 | Changelog entry | As a reader of the changelog, I want a docs entry for this change. | Low | Open | [build] | no — no entry exists |

### Non-Functional Requirements

| ID | Title | Requirement | Category | Priority | Status |
|----|-------|-------------|----------|----------|--------|
| NFR-001 | Docs gates stay green | `pnpm validate:docs`, `pnpm validate:links`, `pnpm validate:catalog` report 0 errors after the change. | Quality | High | Open |
| NFR-002 | Code gates stay green | `pnpm lint` and `pnpm typecheck` exit 0 after the comment edit. | Quality | High | Open |
| NFR-003 | Grounded claims | 100% of behaviour statements in the new section map to a cited line in `research/code-grounding.md`. | Accuracy | High | Open |

### Constraints

| ID | Title | Constraint | Category | Priority | Status |
|----|-------|------------|----------|----------|--------|
| C-001 | Sibling isolation | Do not edit `src/lib/gherkin/**`, `src/lib/theme.ts`, `src/styles/theme.css` or the Gherkin section of the consumer guide; add a new section instead. | Technical | High | Open |
| C-002 | No new ratchet gates | Add no size or length gate. | Technical | High | Open |
| C-003 | Convention | A touched page keeps `title/description/doc_status/updated` and bumps `updated`. | Process | High | Open |
| C-004 | No behaviour change | The toolkit's runtime behaviour is unchanged unless the hint is added (FR-006). | Technical | Medium | Open |

### Key Entities

- **`diagrams` option**: boolean on `defineDocKittyIntegrations`, default `false`.
- **Render mode**: `build` (inline SVG at build, Chromium) or `client` (drawn in
  the browser).
- **`DK_DIAGRAM_BUILD_RENDER`**: env var that pins the mode.
- **`DK_PLANTUML_SERVER_URL`**: env var naming the self-hosted PlantUML SVG
  endpoint.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A scratch copy of the example, changed only as the guide section
  says, builds with diagrams drawn in client mode. [build] (no-op passable: no)
- **SC-002**: The `diagrams` doc comment's first sentence states the `false`
  behaviour. [build] (no-op passable: no)
- **SC-003**: All five listed gates pass with 0 errors. [build] (no-op passable: yes — paired with SC-001)
