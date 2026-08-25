# Post-tasks adversarial squad — Diagrams (M5)

Four independent lenses reviewed the 7-WP decomposition against spec/plan/contracts before
implementation. Verdict across all four: **sound to implement, no blocking issues** — with a
set of accuracy/robustness fixes applied below. Dispositions: `changed` (remediated in the WP
files / tasks.md) or `accepted_as_is` (confirmed correct, no change).

## Lenses

1. **planner-priti** — dependency DAG, lanes, ownership reality, CI-green-at-every-boundary.
2. **reviewer-renata** — requirement coverage + contract fidelity.
3. **reviewer-renata** — a11y/CI load-bearing guards.
4. **paula-patterns** — sizing + hidden cross-WP coupling.

## Positive confirmations (accepted_as_is)

- **Ownership map clean** — all 27 `owned_files` present-or-`create_intent`; no overlaps; DAG
  acyclic and correct (WP01,02,07=[]; WP03←01,02; WP04←03; WP05←03; WP06←04,05).
- **Token emit is generic** — `emitTokenSheet` (theme.ts) iterates the catalog + `MODE_VARYING`
  generically, so promoting `--dk-diagram-*` in `theme.ts`/`theme.css` needs **no `config.ts`
  edit** → `config.ts` stays cleanly WP03-owned (no ownership leak).
- **DeckLayout import is a proven pattern** — `DeckLayout.astro` already loads
  `reveal-init.client` via a browser-only `<script>` dynamic `import()`; WP05 mirrors it.
- **Reserved-directive guard airtight** — `^%%\s+(key):` cannot match `%%{` (no whitespace);
  structurally excluded, with the explicit non-match test.
- **No-JS = raw source airtight** — BD-2 reads the static `dist` DOM, which by construction holds
  source not SVG (sharpened by F8 below).
- **CI stays green at every boundary** — the `<figure>` + `accTitle`/`accDescr` are
  server-rendered, so no ordering leaves `ci-ok` deterministically red.
- **Full coverage** — every FR (001–015) and NFR (001–007) is discharged by some subtask.

## Findings and dispositions (changed)

| # | Lens | Sev | Finding | Disposition |
|---|------|-----|---------|-------------|
| C-F1 | coverage | med-high | page-wide `injectScript` + top-level `import mermaid` would pull the chunk onto diagram-free routes, breaking FP-1/NFR-006 | **changed** — WP03 T011: dynamic `await import('mermaid')` **inside** the `nodes.length` guard |
| C-F2 | coverage | med | the "astro-mermaid code-splits" precondition had no owning spike | **changed** — WP03: folded into the T011 spike, now a **DoD gate** with a dynamic-import fallback |
| C-F3 | coverage | low-med | FR-014's CSP `style-src 'unsafe-inline'` **consumer** note lived only in ADR-0023 | **changed** — WP07 T023 carries it into the consumer-facing arch doc |
| C-F6 | coverage | low | guaranteed types sequence/class only structurally tested, never rendered | **changed** — WP04 demonstrator spans **two** types (flowchart + sequence) |
| G-F1/F2 | guards | high | render-gate could be a vacuous conditional; the 2-diagram demonstrator makes a bare locator strict-mode-throw / `.first()` gate only one | **changed** — WP06 T019: **declarative `renderWait`, awaited unconditionally, count-aware** |
| G-F4 | guards | med-high | direct name assertion could be proven vacuously by the all-fields diagram | **changed** — WP06 T019 asserts the name on the **title-absent diagram by identity** |
| G-F5 | guards | high | `autoTheme:false ≠ render suppressed`; no runtime double-render guard | **changed** — WP06 T019: **exactly one `<svg>` per `pre.mermaid`** runtime assertion; WP03 spike is a DoD gate |
| G-F6 | guards | high | `pnpm why playwright` "must be empty" is wrong — Playwright is an existing dev dep | **changed** — WP01 T001 scopes to the **build/prod** graph, adds **puppeteer** |
| G-F7 | guards | med | no positive browser-free proof; puppeteer unchecked | **changed** — WP04 T015: assert **no `<svg>` in static HTML**; WP01 checks puppeteer |
| G-F3 | guards | med | `guardRoots` non-vacuity didn't cover the diagram itself | **changed** — WP06 T020 adds `figure.dk-diagram svg[aria-labelledby]` to diagram-route guardRoots (post-gate) |
| G-F8 | guards | low-med | BD-2 might assert only `<pre>` presence, not real source | **changed** — WP04 T015: assert **source tokens + figcaption text in order** |
| D-FA | deps | high | "add the deck to AXE_PAGES / deck fence co-lands its render-wait" is false — the deck is **already** scanned (`routes.ts:97`); WP05 can't co-land a `tests/a11y/*` change | **changed** — WP06 T020 **updates** the existing deck entry; tasks.md/WP05 reworded to the SSR guarantee |
| D-FB / A-F1 | deps/sizing | med | WP03's "self-named figure" DoD unachievable — `overview.md` has no `%%` metadata and no owner | **changed** — `overview.md` added to WP03 `owned_files`; T011 gives its fence `%% title`/`%% description` |
| A-F5 / D5 | sizing | low | dead WP04↔WP05 count-coordination hedge | **changed** — stated plainly: WP04 owns the sole +1 (18→19); WP05 adds no route |
| D-FC | deps | low | stale `KNOWN DECK THEMING GAP` comment in `mode.ts` (DeckLayout now links `theme.css`) | **accepted/noted** — WP05 heads-up not to be misled; `mode.ts` cleanup flagged for WP06/follow-up (not owned by WP05) |

## Accepted-as-is (no change)

- **C-F4** — NFR-002/003/005 covered though `map-requirements` only validates FRs; NFR-005→WP02
  and NFR-003→WP04 added as traceability refs; NFR-002 (ci-ok green) is emergent from every DoD.
- **C-F5** — some FRs are mapped to one WP but a clause lands in another (FR-010 deck clause in
  WP05, FR-012 footprint in WP06, FR-014 docs in WP07, NFR-001 contrast in WP01); all clauses are
  built and owned — the mapping is a coverage pointer, not a sole-ownership claim.
- **C-F7** — "figure inside the searchable content region" is INFO-level; no assertion added.
- **A-F3/F4** — WP05 (2 subtasks) and WP07 (2 subtasks) are below the 3–7 band but are genuinely
  separable (out-of-frame deck shell; two independent doc pages); kept separate deliberately.

## Outcome

All `high`/`med-high` findings remediated in `tasks.md` and the WP prompt files; re-validated
(`finalize-tasks --validate-only` → passed) and re-finalized (7 lanes, no cycles, no ownership
conflicts). Decomposition is ready for `/spec-kitty.analyze` and the implement-review loop.
