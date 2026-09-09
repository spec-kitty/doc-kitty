# Contract: Collapsible TOC rail

Authoritative for IC-01..IC-06. Revised post-plan-squad (2026-09-09): the recenter
override is corrected for CSS specificity (3 lenses converged), the hairline is made
deterministic, blocked-storage is hardened, and the no-flash proof is a structural
build-HTML assertion.

## C-1 — Preference state machine (blocked-storage hardened)
- Persistence key: `localStorage['dk-toc-collapsed']`; value `'1'` = collapsed, `'0'`/absent = expanded.
- Attribute: `document.documentElement` gets `data-toc-collapsed` (empty string) iff collapsed.
- Pre-paint (a synchronous **classic** inline `<head>` `<script>` — NOT `type=module`/`defer`/`async`):
  read the key inside a real `try/catch` and, if collapsed, set the attribute before first paint.
  **Do NOT copy Starlight ThemeProvider's `typeof localStorage !== 'undefined' && localStorage.getItem(...)`
  pattern** — in private mode `localStorage` exists but `getItem`/`setItem` *throw*; a bare `typeof`
  guard would abort the inline script. Wrap BOTH read and write in try/catch (FR-005, INV-2).
- Toggle: flips the attribute AND writes the key (try/catch on write). No other state.

## C-2 — CSS override contract (all inside `@media (min-width: 72rem)`, keyed on `html[data-toc-collapsed]`)

Verified against the compiled example CSS: Starlight uses `:where()` scoping (zero specificity),
so the human selector specificity decides the cascade. Load order does NOT raise specificity — it
only breaks ties at equal specificity.

- **Collapse the reserved column**: `html[data-toc-collapsed] .right-sidebar-container` (0,2,1)
  beats Starlight's `.right-sidebar-container` (0,1,0) — set it to a **1px hairline column**, not 0:
  `{ width: 1px; background: var(--sl-color-hairline); }`. (A 0-width container makes the collapse
  depend on the off-screen `position:fixed` `.right-sidebar` border landing at ~100vw, where a 1px
  border is clipped/invisible — FR-002/SC-001 require a *visible* hairline. The 1px column supplies
  it deterministically and makes the recenter math exact: main = calc(100% − 1px).)
- **Hide the outline panel**: hide `.right-sidebar` inner panel via **`display: none`** on
  `.right-sidebar-panel` (so axe skips the off-screen TOC links; NOT opacity/visibility). Keep the
  1px hairline from the container above.
- **Recenter the article (CORRECTED — the one real cascade bug)**: Starlight's right-bias rule is
  `[data-has-sidebar][data-has-toc] .main-pane` at specificity **(0,3,0)**. The collapse override
  MUST be **≥ (0,3,0)** or it loses and the article stays narrow with dead right space (worse than
  a no-op). Use `html[data-toc-collapsed][data-has-sidebar][data-has-toc] .main-pane { width: 100%; --sl-content-margin-inline: auto; }`
  (= (0,4,1), wins) — or equivalently override the calc inputs on the collapsed root
  (`html[data-toc-collapsed] .main-pane { --sl-content-width: 100%; --sl-sidebar-width: 0px }`).
  `data-has-toc`/`data-has-sidebar` sit on `<html>` (same element as `data-toc-collapsed`), so
  compounding them is valid. The recenter test MUST assert the **computed** `.main-pane` width equals
  full content width when collapsed — not merely that the attribute flipped.
- Styling uses `--sl-*` (and bridged `--dk-*`) tokens only — ZERO hard-coded hex (NFR-002).
- **Scrollbar / clipping**: Starlight already hides the TOC-body scrollbar (`.right-sidebar { scrollbar-width: none }`);
  add only the WebKit pseudo (`.right-sidebar::-webkit-scrollbar { display: none }`) if needed. Do
  **NOT** force `overflow: visible` on the expanded rail (it would break long-TOC scrolling); the
  fixed toggle is not clipped by ancestor overflow (no `transform`/`contain` in the layout chain),
  so mount it as a sibling of `.right-sidebar-panel` (or on `<body>`) and no overflow change is needed.

## C-3 — Toggle control contract
- Native `<button type="button">` (Enter/Space free); `aria-expanded` = String(!collapsed);
  `title` + non-empty `sr-only`/`aria-label` text = "Hide the table of contents" / "Show the table
  of contents" per state; circular ~2rem, 1px hairline border, subtle shadow (`--dk-shadow-sm`),
  sidebar-surface bg, accent focus-visible ring (`--dk-shadow-focus`/accent).
- **Placement**: `position: fixed`, vertically centered (`top: 50%; transform: translateY(-50%)`).
  Horizontal anchor = the rail's left-edge hairline via a CSS `calc` of the rail column width when
  expanded, collapsing to `right: 0` (viewport edge) when collapsed — **no JS measurement**. It must
  NOT live inside the `display:none` collapsed panel (a `pointer-events:none` collapsed rail is fine —
  the button sets `pointer-events: auto`, valid only if the button is not in a `display:none` subtree).
- Injected only when `.right-sidebar` exists; idempotent (bail on a stable unique id if already present).

## C-4 — Scoping / non-regression contract
- No rule or script targets `mobile-starlight-toc`, the mobile TOC block, or `nav.sidebar` (left).
- Below 72rem: no toggle visible and no collapsed chrome; the below-breakpoint test loads FRESH at a
  narrow viewport (the button is injected at load; a resize-down alone would leave it in the DOM, so
  CSS must also hide it below 72rem). Mobile TOC unchanged. (NFR-003 / SC-003)
- No Starlight `components` carrier added; no frontmatter/sections.yaml/convention change (C-001).

## C-5 — Test contract
- **No-flash (NFR-001) — structural build-HTML assertion (the definitive proof)**: in built HTML the
  pre-paint `<script>` node exists in `<head>`, precedes `<body>`, and carries **no** `type=module`/`defer`/`async`;
  AND `toc-rail.css` (via `GLOBAL_COMPONENT_SHEETS`) appears as a render-blocking `<link rel="stylesheet">`
  in `<head>`. (These two facts prove zero-flash by construction; a runtime "attribute present at load"
  check is a complement, not sufficient alone.)
- **Vitest** — split by environment: **node** for the pure string/const (the 72rem breakpoint constant;
  the pre-paint script *string* shape / no async attrs); **jsdom** for behavior (executing the pre-paint
  sets `data-toc-collapsed` for a collapsed value and is a no-op otherwise; preference read/write incl.
  a throwing-storage stub for private mode).
- **Playwright** (`tests/a11y/`, on a **named** known-has-TOC route — `home` or `guides/getting-started/`
  — with a `guardRoots` entry asserting `.right-sidebar` + `[data-has-toc]` so it fails loudly if the
  page ever loses its TOC; viewport 1280×800 ≥ 72rem so the toggle renders): toggle hides outline and
  `.main-pane` **computed width == full content width** (recenter); toggle again restores; `aria-expanded`
  flips; Enter/Space operate; reload keeps collapsed with no expanded flash; a FRESH load below 72rem shows
  no toggle; mobile TOC + left `nav.sidebar` unchanged. Regenerate `home-{light,dark}.png` visual baselines
  via the CI `update-a11y-baselines.yml` workflow (the new toggle shifts home pixels).
