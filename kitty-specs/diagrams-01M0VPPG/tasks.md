# Tasks: Diagrams (Mermaid) — M5

**Mission**: `diagrams-01M0VPPG` | **Branch**: `feat/diagrams` | **Merge target**: `feat/diagrams`
**Spec**: [spec.md](./spec.md) · **Plan**: [plan.md](./plan.md) · **Squad**: [reviews/post-spec-squad.md](./reviews/post-spec-squad.md)

Seven work packages. Gating ADRs (0023 render/metadata seam, 0024 token promotion/brand) were
authored in the plan phase. The single-owner `config.ts` integration is WP03; the transform
plugins (WP02) land standalone so WP03 can import them; the a11y harness (WP06) scans the doc
demonstrator (WP04) and **tightens the already-present deck scan** (WP05). Every WP boundary
keeps `ci-ok` green (C-007): the example stays `diagrams: false` until the **transform's
integration lands** (flipped in WP03), so no fence renders unwrapped/unnamed; the demonstrator
publishes before it is scanned; and the deck's `<figure>` + `accTitle`/`accDescr` are
**server-rendered** (WP02 remark/rehype), so the already-scanned deck stays a11y-green even
before its client render — WP06 then tightens its render-gate (it does not "add" the deck).

```
WP01 tokens ──┐
WP02 transform┴─→ WP03 integration+render ──┬─→ WP04 doc demo+pins ──┐
                                            └─→ WP05 deck ───────────┴─→ WP06 a11y (doc+deck)
WP07 docs (ADRs in plan) ── runs ‖
   (WP01 ‖ WP02 ; WP04 ‖ WP05)
```

## Subtask Index

| ID | Description | WP | Parallel |
|----|-------------|----|----------|
| T001 | Pin `astro-mermaid@2.1.0` + `mermaid@11.17.1`; verify peer range + **build/prod graph** has no Playwright **or puppeteer** | WP01 | [P] |
| T002 | Promote `--dk-diagram-*` to Default catalog (theme.ts + theme.css + emitTokenSheet), add light values | WP01 | [P] |
| T003 | Wire the brand `--dk-diagram-*` motif into `tokens.css`; delete the orphan asset | WP01 | [P] |
| T004 | Update the catalog/CSS-signature chrome assertion for the promoted tokens | WP01 | [P] |
| T005 | vitest: `--dk-diagram-*` pairs meet AA (size-aware) in both modes | WP01 | [P] |
| T006 | remark plugin: parse `%%` block, strip, inject accTitle/accDescr at the type-decl line, stash caption on file.data | WP02 | [P] |
| T007 | Pure helpers (parse / fallback / placement) in `diagram-meta.internal` | WP02 | [P] |
| T008 | rehype plugin: wrap `<pre class=mermaid>` in `<figure role=group>` + `<figcaption>` from file.data | WP02 | [P] |
| T009 | vitest matrix (fields, unknown-key, `%%{init}` non-match, accTitle fallback, placement incl. init/frontmatter, figure shape, types flowchart/sequence/class) | WP02 | [P] |
| T010 | Opt-in `diagrams` preset option: prepend `mermaid()` (autoTheme:false, strict) before starlight(); register remark+rehype; injectScript(render module) | WP03 | |
| T011 | Render owner `diagram-render.client.ts`: token→themeVariables, **dynamic-import mermaid inside the `nodes.length` guard** (footprint), re-render on [data-theme]; render-suppression+code-split spike is a **DoD gate**, not a note; name the bare `overview.md` fence | WP03 | |
| T012 | Flip `example/astro.config.mjs` `diagrams: true` (co-landed with the integration) | WP03 | |
| T013 | vitest: `{ diagrams:false }` omits mermaid(); `{ diagrams:true }` prepends before starlight | WP03 | |
| T014 | Published demonstrator `architecture/diagram-demonstrator.md` (all-fields flowchart + title-absent sequence — **two guaranteed types**) | WP04 | |
| T015 | Build/chrome assertions: figure + injected accTitle/accDescr; no-JS **source tokens + figcaption in order**; **no `<svg>` in static HTML** (browser-free proof); pinned/no-CDN | WP04 | |
| T016 | Re-pin `EXPECTED_INDEX_ENTRY_COUNT`/`EXPECTED_SITEMAP_URL_COUNT` for the new demonstrator | WP04 | |
| T017 | `DeckLayout` client `<script>` imports the shared render module (deck render path) | WP05 | |
| T018 | Mermaid fence on the showcase deck's ACTIVE FIRST slide (+ metadata) | WP05 | |
| T019 | a11y harness: declarative unconditional count-aware render-gate + DIRECT name (title-absent by identity) + one-`<svg>`-per-node + `[data-theme]` re-render, per shell | WP06 | |
| T020 | Add demonstrator to ROUTES/AXE_PAGES; **update** the already-present deck render-wait; axe both modes; diagram svg in guardRoots (post-gate) | WP06 | |
| T021 | Footprint: Playwright network capture (diagram page requests mermaid chunk; control route does not) | WP06 | |
| T022 | Resolve `docs/plans/features/diagrams.md` (client-side v1 + #13 deferrals) | WP07 | [P] |
| T023 | New `docs/architecture/diagrams.md` (the diagrams surface; links ADR-0023/0024) | WP07 | [P] |

## Work Packages

### WP01 — Token promotion + deps
- **Goal**: Pin the deps and promote `--dk-diagram-*` into the Default catalog (light+dark) **and** the brand `tokens.css`, retiring the orphan, with the AA-contrast proven by vitest where authored (ADR-0024).
- **Subtasks**: T001, T002, T003, T004, T005 · **Deps**: none · **Est.**: ~300 lines.
- **Independent test**: build green; `--dk-diagram-*` in the emitted Default + brand sheets both modes; orphan gone; contrast vitest passes. No diagram renders yet (example off).

### WP02 — Metadata transform (remark + rehype), standalone
- **Goal**: The pure `%%` parse + accTitle/accDescr injection (name from title-or-description; at the type-declaration line) + the rehype figure wrap, with a full vitest matrix. Not yet wired (green because nothing uses it).
- **Subtasks**: T006, T007, T008, T009 · **Deps**: none · **Est.**: ~360 lines.
- **Independent test**: vitest matrix green (incl. fallback, init/frontmatter placement, guaranteed types); Astro-free.

### WP03 — Integration + render owner (flip example on)
- **Goal**: The opt-in `diagrams` preset (mermaid() before Starlight, autoTheme:false, strict), the single-owner render module (token→themeVariables + [data-theme] re-render), register the WP02 plugins, and **flip the example `diagrams: true`** — so the pre-existing `overview.md` fence renders wrapped, named, and themed.
- **Subtasks**: T010, T011, T012, T013 · **Deps**: WP01, WP02 · **Est.**: ~380 lines.
- **Independent test**: build + serve; the `overview.md` diagram renders as a themed `<figure>` with a self-named SVG; `{ diagrams:false }` omits mermaid() (vitest); exactly one render loop.

### WP04 — Doc demonstrator + assertions + pins (unscanned)
- **Goal**: Publish the demonstrator (all-fields + title-absent diagrams), the build/chrome assertions (figure, injected statements, no-JS source+caption, pinned versions), and the count-pin re-pin — a11y still green (not yet scanned).
- **Subtasks**: T014, T015, T016 · **Deps**: WP03 · **Runs ‖ WP05** · **Est.**: ~300 lines.

### WP05 — Deck diagram (separable)
- **Goal**: `DeckLayout` imports the shared render module; a mermaid fence on the showcase deck's active first slide. (Its a11y is scanned in WP06.)
- **Subtasks**: T017, T018 · **Deps**: WP03 · **Runs ‖ WP04** · **Est.**: ~180 lines.

### WP06 — a11y (doc + deck): render-gate + direct name/figure + footprint
- **Goal**: Change the axe-harness flow (declarative **unconditional, count-aware** render-gate + **direct** accessible-name asserted on the title-absent diagram by identity + a one-`<svg>`-per-`pre.mermaid` single-loop guard, per shell), add the **demonstrator** to `AXE_PAGES` and **update the already-present** showcase-deck render-wait (the deck is already scanned — do not duplicate it), extend diagram-route `guardRoots` with the rendered svg (post-gate), the `[data-theme]` re-render spec, and the footprint network capture.
- **Subtasks**: T019, T020, T021 · **Deps**: WP04, WP05 · **Est.**: ~340 lines.

### WP07 — Docs of record
- **Goal**: Resolve `diagrams.md` feature page (client-side v1 + #13 deferrals) and a new `architecture/diagrams.md`. (ADR-0023/0024 authored in plan.)
- **Subtasks**: T022, T023 · **Deps**: none · **Runs ‖** · **Est.**: ~150 lines.
