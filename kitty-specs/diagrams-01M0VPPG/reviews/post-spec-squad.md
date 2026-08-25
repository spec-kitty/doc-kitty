# Post-spec adversarial squad — M5 Diagrams

Four profile-loaded, read-only lenses reviewed spec rev 1 in parallel. All findings
folded into **rev 2**. Verdicts: testability remediate-then-ship, decomposition
ship-blocked-then-fix, architecture NOT-plan-ready-until-ADRs, terminology
ship-after-tighten.

## reviewer-renata — testability / coverage
- **R-01 (BLOCKER)** — a `description`-only diagram has no accessible **name**: `accTitle`
  → `aria-labelledby` (name), `accDescr` → `aria-describedby` (description only). Since
  `title` is optional and `description` primary, description-first diagrams fail the
  "non-empty accessible name" gate; the all-fields demonstrator masks it. **Fix:** derive
  `accTitle` from `title` **or fall back to `description`**; gate the title-absent path.
- **R-02 (MAJOR)** — axe does not evaluate SVG contrast → the "AA on `--dk-diagram-*` via
  axe" claim is vacuous. **Fix:** contrast via a **vitest** computing the WCAG ratio from
  the token hex pairs (both modes); axe only for the HTML `<figcaption>`.
- **R-03 (MAJOR)** — the "mermaid chunk only on diagram pages" check is mis-laned (runtime
  import, not static HTML). **Fix:** verify astro-mermaid code-splits mermaid; assert
  footprint via **Playwright network capture** (diagram page requests the library chunk, a
  control route doesn't); define "mermaid chunk" = library bundle vs the per-page loader.
- **R-04 (MAJOR)** — the render-wait has no non-vacuous predicate; a mermaid syntax-error
  SVG passes axe silently. **Fix:** guardRoot the **rendered named** node
  (`figure svg[aria-labelledby]`) + assert `pre.mermaid` no longer holds the raw source.
- **R-05 (MAJOR)** — opt-in-**off** has zero coverage. **Fix:** unit test
  `defineDocKittyIntegrations({ diagrams: false })` → `mermaid()` absent.
- **R-06..R-10 (MINOR)** — "interaction lane" isn't a ci-ok lane (rides the a11y Playwright
  specs); reconcile the JS-off mechanism (built HTML = the no-JS DOM); verify the
  astro-mermaid↔mermaid peer range + no Playwright transitive; add a `%%{init}%%`-first
  injection-placement vitest; make the count re-pin **required** not conditional.

## architect-alphonso — architecture / ADR obligations
- **A-01 (MAJOR)** — render-ownership race: astro-mermaid ships its own render+re-theme
  loop; a second doc-kitty observer means two uncoordinated loops. **ADR-0023** names one
  render owner (disable astro-mermaid `autoTheme`; feed `themeVariables` via its config, or
  own the render). Constraint: exactly one render loop per `pre.mermaid`.
- **A-02 (MAJOR)** — deck script path asserted-not-proven: `injectScript('page')` may or may
  not reach the out-of-frame deck; verify in plan; a shared exported mermaid-init module
  used by both surfaces also fixes A-01. **Tokens ride DeckLayout's existing `baseTokenHref`
  once promoted — no new deck token wiring** (FR-009 was over-broad).
- **A-03 (MAJOR)** — rehype-after-astro-mermaid ordering is stage-dependent + unstated;
  contract + fallback (remark-parse/inject/strip + `file.data` → rehype figure) in ADR-0023.
- **A-04 (MAJOR)** — FR-011 is a shared axe-harness flow change: a real render-gate + a
  **direct** accessible-name/figure assertion (axe alone won't check them; **A-06**: axe's
  `svg-img-alt` may not fire), per-shell; the deck diagram must be on the **active first
  slide** (reveal `display:none`s later slides).
- **A-05 (MAJOR)** — promoting `--dk-diagram-*` to Default alone leaves the branded
  example/deck un-themed; **ADR-0024** must fold the orphan's brand values into `tokens.css`
  (+ `DEFAULT_BASE`/`DEFAULT_DARK` + `theme.css` + `emitTokenSheet`) and retire the orphan.
- **A-07 (MINOR)** — injection "after the first line" is fragile; locate the actual
  diagram-type-declaration line (skip init/frontmatter/comments); bound the supported types
  (flowchart/sequence/class + directive-first + frontmatter-first vitest cases).
- **A-08 (MINOR)** — no CSP conflict today; keep the `style-src 'unsafe-inline'` note as a
  consumer/ADR note.

## planner-priti — decomposition / sequencing
- **P-01 (BLOCKER)** — the deck fence lands on the already-scanned showcase-deck route; the
  deck a11y entry's render-wait must co-land, or the existing deck scan reds.
- **P-04 (MAJOR)** — flip the example `diagrams: true` **in the transform WP**, so the
  pre-existing `overview.md` fence isn't rendered unwrapped/unnamed during foundation.
- **P-05 (MAJOR)** — prove the promoted light `--dk-diagram-*` AA contrast with a **vitest
  at foundation** (where authored), not two groups later (converges R-02).
- **P-06 (MAJOR)** — author **ADR-0023 + 0024 in the plan phase** (C-001, like M6).
- **P-02/P-03 (MAJOR)** — split the oversized group 4: deck-vs-doc, publish-vs-scan (M6
  lesson); 7-WP shape below.
- **P-07/P-08 (MINOR)** — no foundation smoke diagram needed; assign FR-014's clauses homes.

**Adopted 7-WP shape:** WP01 foundation (deps+opt-in preset+token promotion+brand
wiring+contrast vitest) → WP02 transform (+flip diagrams:true) ‖ WP03 theme hook → WP04
doc demonstrator + assertions + pins (unscanned) → WP05 doc a11y + render-gate ‖ WP06 deck
diagram + deck render-wait ‖ WP07 docs (ADR-0023/0024 pulled into plan).

## lexical-larry — terminology
- **L-01 (MAJOR)** — "directive" is overloaded: the spec forbids it for the `%%` block yet
  calls `accTitle`/`accDescr` "directives". Reserve "directive" for `%%{ }%%` only; call
  them **accessibility statements** (rename the Key Entity).
- **L-02..L-06 (MINOR)** — disambiguate `source` (diagram source vs the `source` field);
  **diagram** = umbrella / **rendered SVG** = picture; mirror M6's three-cascade token
  entry (`--dk-diagram-*` ⊂ `--dk-*`, `themeVariables` the sole target); separate
  "build-time transform" (v1) from "build-time render" (#13); tie `accTitle`→name /
  `accDescr`→description. Ready-to-paste Domain Language folded in.
