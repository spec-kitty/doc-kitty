# Research: Markua syntax support (subset)

Phase 0 for the Markua mission. It consolidates the design decisions in
Decision / Rationale / Alternatives form, records the supply-chain disposition,
and flags where the pinned toolchain diverges from the design research doc's
assumptions. The design backing is
[`docs/architecture/research/markua-syntax-support.md`](../../docs/architecture/research/markua-syntax-support.md)
and [`docs/architecture/research/astro-markdown-extensions.md`](../../docs/architecture/research/astro-markdown-extensions.md);
this note does not re-explain them, it decides against the codebase.

## Decisions

### D-01 — Approach (b): preprocess to remark-directive, not a micromark extension

- **Decision**: Bring the two non-CommonMark constructs into the AST via a
  **preprocessing normaliser** that compiles the line-prefix blocks (`A>` and the
  `B> C> D> E> I> Q> T> W> X>` shorthands) and the `{aside}…{/aside}` /
  `{blurb, class: …}…{/blurb}` wrappers into `remark-directive` container syntax,
  plus a small **remark attribute-list plugin** for `{…}` on images and ids. All
  three input forms for a callout class (shorthand, `{class:}`+`B>`,
  `{blurb, class:}`) normalise to one directive per class (FR-004). The
  block-detection rules are pinned in
  [`contracts/normaliser-block-detection.md`](./contracts/normaliser-block-detection.md)
  (FR-013).
- **Rationale**: keeps the blast radius small and reuses the `remark-directive` +
  `astro:assets` mechanisms the repo already runs (M5 diagrams, M6 decks, M4
  glossary all follow the same remark/rehype-plus-`*.internal.ts` shape). The
  extra callout classes and figure styling live in the theme's curated surface
  (ADR-0008), governed per-kind by ADR-0009.
- **Alternatives**:
  - **(a) Custom micromark syntax extension** — the most faithful and the most
    work; micromark extensions are non-trivial to write and maintain. Rejected for
    v1 and explicitly out of scope (C-001); reserved if preprocessing proves too
    fragile against code blocks and nesting.
  - **(c) Existing Markua-to-mdast tooling** — none is mature. The closest
    (`@humanwhocodes/markdown-it-markua-aside`) handles only asides/blurbs and
    targets markdown-it, not remark; the Markua tools that exist all *write* Markua,
    none *read* it into an AST. Rejected: the direction we need is unserved.

### D-02 — Wiring seam: an mdast-level remark plugin (ratified, not a choice)

- **Decision**: Wire the normaliser as a **remark plugin operating on the parsed
  mdast** — it rewrites line-prefix runs and `{aside}`/`{blurb}` wrappers into
  `containerDirective` nodes, and Starlight's own `remarkAsides` renders the four
  mapped names (`note`/`tip`/`caution`/`danger`) **natively**. This is the ratified
  route, not one of two options.
- **Why the pre-parse route was dropped**: the squad ground-truthed that a pre-parse
  body-string stage is **not reachable** through Astro/Starlight public config. There
  is no raw-body hook in `markdown.*`; the custom glob loader has no
  doc-kitty-controlled body seam, and replacing it would forfeit native image
  optimisation. So the only viable public seam is `markdown.remarkPlugins` (what
  `config.ts` already wires for diagrams/glossary/decks), which operates on mdast.
- **Consequences for the spike**: IC-01's spike is **not** "choose between two seams";
  it is "prove the mdast route": (1) plugin ordering — doc-kitty prepended before
  `starlight()` so markua plugins run before `remarkAsides`; (2) fence/blockquote
  handling; (3) native-aside consumption of the constructed `containerDirective`;
  (4) explicit-id survival (now known native, see divergences). A **second** spike
  covers ToC heading exclusion (D-03 note / callout-mapping contract).
- **Fence and blockquote avoidance falls out for free** at the mdast level: a fenced
  `>` is inside a `code` node and a real `> quote` is a `blockquote` node, so **only**
  Markua line-prefix paragraphs and wrapper-marker paragraphs are ever candidates. The
  block-detection rules are stated at line level but implemented on paragraph/code node
  values (`contracts/normaliser-block-detection.md`).
- **Alternatives**: emit `:::` directive **text** at mdast level (impossible — text
  emitted after parse is never re-lexed); a pre-parse body-string stage (unreachable,
  above); reimplement Starlight aside markup ourselves (rejected — discards Starlight's
  tested aside a11y for the common four); MDX (rejected, C-002 — pages stay plain `.md`).

### D-07 — Plugin ordering and single `remark-directive` owner

- **Decision**: (1) The native-aside path depends **entirely** on doc-kitty's markua
  remark plugins running **before** Starlight's `remarkAsides`. The squad confirmed the
  Astro/Starlight order: doc-kitty's *prepended* integrations run their
  `astro:config:setup` before Starlight registers `[remarkDirective, remarkAsides]`.
  So markua is prepended before `starlight()` in `config.ts` (identical to
  diagrams/glossary), an **explicit ordering requirement** is pinned in the IC-01
  contract, `config.ts` carries a registration-site comment mirroring the existing
  deck/glossary ordering comments, and IC-06 asserts a `T>` renders
  `starlight-aside--tip` so a future array reorder fails loudly.
  (2) `remark-directive` is **currently registered only by the glossary integration and
  only when glossary is active** (`config.ts:498`). The example ships `.contextive`
  definitions, so markua and glossary will **both** be active. Assign a **single
  owner**: hoist `remark-directive` registration out of glossary into a shared
  registration gated on **(glossary-active OR markua-active)**, with the
  cross-integration plugin order pinned. This is an explicit IC-01 task surface.
- **Rationale**: two integrations registering `remark-directive` independently (or one
  silently not registering it) is exactly the kind of ordering/ownership bug the squad
  flagged; a single gated owner removes the ambiguity.
- **Alternatives**: leave `remark-directive` glossary-owned and depend on glossary
  always being active (rejected — couples markua to glossary presence); register it
  twice (rejected — undefined ordering).

### D-03 — Callout home split: four to Starlight asides, the rest to emitted theme hast

- **Decision**: `T>`→Starlight `tip`, `W>`→`caution`, `E>`→`danger`,
  `I>`→`note` (native `remarkAsides`). **`A>` aside → the doc-kitty theme-callout hast
  `dk-callout--aside`** — `:::aside` is *not* a native Starlight type, so
  the earlier `note`/theme-aside OR is resolved to a theme callout (distinct from
  `I>`→`note`). `D>` discussion, `Q>` question, `X>` exercise, generic `B>`, and
  `C>`/`{class: center}` also render as emitted hast
  (`<aside class="dk-callout dk-callout--{variant}">`, mirroring `diagram-figure.ts`) —
  **not** a `.astro` component, because the Starlight `components` map is frozen at four
  carriers (ADR-0013/0015) and no directive→component seam exists (see D-03a) — with
  class-specific `--dk-callout-*` styling; **six** theme classes in all. The
  full table is in [`contracts/callout-mapping.md`](./contracts/callout-mapping.md).
- **D-03a — hast, not a component (pinned)**: the theme callouts are hand-emitted hast
  styled by the `--dk-callout-*` token family in `theme.css`, exactly as diagrams emit a
  `<figure>` styled by `--dk-diagram-*`. A remark/rehype plugin cannot invoke a `.astro`
  component on a plain `.md` page (the four-carrier `components` lock), so this is the one
  DOM owner (the emitting plugin) — closing the split-brain risk a standalone
  `Callout.astro` would create. Recorded in ADR-0030 Decision item 4.
- **Attribute tradeoff (pinned)**: because native `remarkAsides` discards a directive's
  attributes, a mapped-class callout carrying `{#id}` or `{icon:}` routes to the
  `dk-callout` hast (a mapped-name fallback variant `dk-callout--tip/caution/danger/note`)
  so the attribute survives (recorded in the ADR Consequences; the icon-map contract
  extends this to `{#id}`).
- **ToC exclusion**: keeping an aside/callout heading out of the on-this-page nav has
  **no native hook** (`rehypeCollectHeadings` collects every heading). The ratified
  mechanism is a user rehype **demotion** pass (before `rehypeHeadingIds`) that turns
  an in-callout ATX heading into a non-heading element carrying `role="heading"` +
  `aria-level`, preserving a11y while removing it from the ToC — a **second bounded
  spike** (callout-mapping contract).
- **Rationale**: Markua has more callout types than Starlight has aside types
  (Starlight ships four: `note`/`tip`/`caution`/`danger`). Reusing Starlight for
  the four with an equivalent keeps native styling and a11y; a theme component is
  the cleaner home for the rest so styling and icons stay consistent (C-004).
- **Alternatives**: render **all** classes through a theme component (rejected —
  discards Starlight's tested aside a11y/styling for the common four); collapse the
  three theme-only classes onto `note` (rejected — loses the discussion/question/
  exercise distinction the spec requires, FR-003).

### D-04 — Icons: a curated seed map with graceful drop, not a full map and not deferred

- **Decision**: Ship a small **curated Font Awesome → Starlight seed map**
  (~12–20 common names) in `src/lib/markua/icon-map.ts`. A mapped `{icon: fa-name}`
  renders the Starlight icon on the callout; an unmapped name **drops the icon**
  (the callout still renders) and emits a **build-time warning** naming the icon —
  the build never fails on an unknown icon (FR-010, NFR-002). Contract:
  [`contracts/icon-map.md`](./contracts/icon-map.md).
- **Rationale**: Font Awesome has thousands of names that do not line up one-to-one
  with Starlight's icon set; a bounded seed map plus graceful drop delivers the
  common cases without an open-ended mapping burden, and the map is designed to
  grow (spec assumption).
- **Alternatives**: a full FA→Starlight map (rejected — open-ended upkeep, the
  research's heaviest piece); defer icons entirely (rejected — the spec keeps a
  bounded P3 slice in scope, and the seed map is the natural growth point); a
  hardcoded default icon per class (kept as a *possible* fallback flavour in the
  contract, but drop-with-warning is the ratified default).

### D-05 — Local image resolution: reconcile the Markua `resources/` convention with astro:assets

- **Decision**: A **local** image path renders through `astro:assets` optimisation
  (Astro optimises importable local assets referenced by Markdown `![]()`); a web
  `http(s)` URL passes through unoptimised. The Markua `resources/`-relative
  convention is reconciled at the page level: a local reference resolves relative to
  the page file the way Astro already resolves Markdown image assets, so authors
  place images alongside the page (or under an author-chosen `resources/` folder the
  reference points at). The requirement (FR-005) is that local figures **optimise
  correctly**, not a specific on-disk layout. Contract:
  [`contracts/figure-render.md`](./contracts/figure-render.md).
- **Rationale**: `astro:assets` optimises local paths at build time against Astro's
  asset resolution (imported assets vs `public/`); forcing a literal `resources/`
  root would fight that resolution. Meeting the *outcome* (optimised local figures)
  keeps the pipeline native.
- **Alternatives**: a literal `resources/`-root rewrite before asset resolution
  (rejected — brittle against Astro's importer, and out of step with how every other
  doc-kitty image resolves); `public/`-only (rejected — skips optimisation for the
  common case, US2 sc.5).
- **Risk (lowered)**: the reconciliation is **lower risk than first carried** — the
  native glob loader already resolves page-relative images, so the figure pass does not
  re-implement resolution. The remaining proof (IC-03) is the **rehype ordering**: the
  markua figure pass runs **before** `rehypeImages` (it is a user rehype plugin) and
  wraps the `<img>` keeping `src` intact; `rehypeImages` then folds `alt`/`title`/
  `style` into the `__ASTRO_IMAGE_` marker. IC-03 asserts a local and a web image both
  render (local optimised) **and** that `style="width:75%"` survives the
  `__ASTRO_IMAGE_` round-trip (`contracts/figure-render.md`).

### D-06 — Explicit-id-wins precedence

- **Decision**: An explicit `{#id}`/`{id:}` on a heading, figure, aside, blurb, or
  span **deterministically wins** over the auto-generated id on collision (C-005).
  The attribute-list plugin writes `id` onto the target's `hProperties`; the
  auto-generated heading id is applied only when no explicit id is present.
- **Native and proven**: this needs **no** code beyond writing the id —
  `rehypeHeadingIds` (Astro built-in, runs last) skips any heading whose
  `node.properties.id` is already a string (`rehype-collect-headings.js:52`). So IC-04
  is mostly *tests* (precedence, span forms, crosslink resolution), not parser work.
- **Rationale**: crosslinks must be unambiguous (US3 sc.3); explicit authoring
  intent beats a slugger default.
- **Alternatives**: last-writer-wins by pipeline order (rejected — non-deterministic
  to an author); suffixing the collision (`overview-1`) (rejected — breaks the
  author's `[text](#overview)` link).

## Supply-chain install safety (directive 051)

**No new runtime or dev dependency is added by this mission.** Silence is not
compliance, so the disposition is recorded explicitly.

- **Why none is needed**: every building block the approach requires is already a
  pinned dependency in the repo. Ground-truthed against `package.json` (root),
  `src/package.json`, `example/package.json`, and `pnpm-lock.yaml`:
  - `remark-directive@4.0.0`, `mdast-util-directive@3.1.0`, `remark-parse@11.0.0`,
    `remark-gfm@4.0.1`, `unified@11.0.5` — direct root dependencies already.
  - `astro:assets` and the built-in heading-id rehype ship **inside**
    `astro@5.18.2`; `sharp` (the image service) is already lockfile-pinned and
    hoisted via `pnpm-workspace.yaml` for the optimised-image pipeline.
  - Starlight asides ship inside `@astrojs/starlight@0.32.6`.
  - `vitest@2.1.0`, `@playwright/test@1.62.1`, `@axe-core/playwright@4.13.0` cover
    testing already.
- **Registry authenticity / freshness**: N/A for new packages (none added). The
  existing pins are canonical public-npm packages with integrity hashes recorded in
  `pnpm-lock.yaml`; this mission does not bump any of them.
- **Lifecycle-script discipline**: unchanged. The workspace keeps its deny-by-default
  install-script posture (`pnpm-workspace.yaml` `allowBuilds` lists only `esbuild`
  and `sharp`); adding no package adds no `preinstall`/`install`/`postinstall`
  surface.
- **Node Active LTS**: build/runtime baseline stays Node ≥22 (Active LTS; CI/dev on
  24.11), unchanged.
- **Disposition**: **accepted** — zero new dependencies; the only supply-chain
  action is *not* adding one where the research doc's prose might have implied a
  plugin. If a later revision genuinely needs `rehype-slug` (see divergences), it
  would re-open this note with a full per-dependency check.

## Toolchain divergences from the design research doc

Flagged rather than papered over, per the mission brief.

- **`rehype-slug` is not in this repo — and is not needed (proven).** The design
  research names `rehype-slug`; there is none here (checked across `package.json` and
  `pnpm-lock.yaml`). The squad read `@astrojs/markdown-remark@6.3.11`:
  `rehypeHeadingIds` runs **last** and assigns a slug **only when
  `node.properties.id` is not already a string** (`rehype-collect-headings.js:52`). So
  explicit-id-wins (D-06) is **native and proven** — the attribute-list plugin writes
  the explicit `id`, `rehypeHeadingIds` then skips it, with **no** `rehype-slug` and
  **no** ordering shim. IC-04 shrinks accordingly (see plan): it verifies precedence
  and covers spans + crosslink resolution, it does not re-edit the parser.
- **Astro rehype order is fixed and load-bearing for figures.** The squad established
  the stage order: remarkParse → gfm → smartypants → **USER remarkPlugins** →
  remarkCollectImages → remarkRehype → shiki → **USER rehypePlugins** → `rehypeImages`
  → `rehypeHeadingIds` → rehypeRaw. Consequence (D-05 / figure contract): the markua
  figure rehype is a *user* rehype plugin, so it runs **before** `rehypeImages` and
  must wrap the `<img>` keeping `src` intact; `rehypeImages` then folds the wrapped
  `<img>`'s `alt`/`title`/`style` into the `__ASTRO_IMAGE_` marker. Running **before**
  is required for markua alt/sizing to survive into the optimised image — the earlier
  "after optimisation" framing was inverted and is corrected in
  `contracts/figure-render.md`.
- **Starlight `remarkAsides` discards directive attributes.** The squad read
  `@astrojs/starlight@0.32.6`: `remarkAsides` visits `containerDirective` nodes with
  name ∈ {note,tip,caution,danger} and **rebuilds** them as fresh aside nodes,
  discarding the container's attributes/`hProperties`; its restoration pass restores
  only unhandled text/leaf directives, and an unhandled `containerDirective` silently
  drops/malforms. Consequences: (a) markua must emit **exactly** those four names for
  the mapped classes and nothing else through the native path; (b) a mapped callout
  carrying `{#id}` or `{icon:}` routes to the `dk-callout` hast (a mapped-name fallback
  variant), so the attribute survives (D-03 / D-03a / B).
- **`remark-directive` resolves at two versions.** The root direct dependency is
  `remark-directive@4.0.0`; a transitive `remark-directive@3.0.1` also resolves
  under Starlight in the lockfile. The glossary integration already imports the
  top-level `remark-directive` (4.0.0), so this mission uses the same 4.0.0 with
  `mdast-util-directive@3.1.0`. No action needed, but the plan pins the version so a
  future Starlight bump that changes the transitive copy is noticed.
- **`unist-util-visit` is present only transitively.** The repo convention is to
  hand-roll tree walks (see `mermaidFenceTransform` in `config.ts` and
  `rehype/diagram-figure.ts`) rather than depend on `unist-util-visit@5.1.0`
  directly. This mission follows that convention — its walks are hand-rolled — so it
  adds no direct dependency on it.
- **Starlight-aside consumption is version-coupled.** The mdast route (D-02) depends
  on Starlight's `remarkAsides` consuming the constructed `note`/`tip`/`caution`/
  `danger` `containerDirective` nodes; C-003 already caps the Starlight peer at
  `>=0.32.0 <0.33.0`, so a Starlight change that alters aside directive handling fails
  loudly at install (the same fencing ADR-0029 uses).
- **Node version wording.** The mission brief suggested "Node 24"; the repo's
  authoritative floor is `engines.node >=22` (Active LTS) with CI/dev observed on
  24.11. The plan states both so the pin is not overstated.

## Shared-substrate note: `createPageProcessor` / `OnThisPage.astro` are markua-unaware by design

The glossary `createPageProcessor` and the `OnThisPage.astro` slot re-derive their
output from the **raw `entry.body`** string, not from the rendered mdast/hast. They
are therefore **markua-unaware by design**: raw `A>`/`{blurb}`/`{…}` lines look like
literal text to them. This is **inert today** — those surfaces do not need to
understand Markua for this mission to ship. The forward rule to record: **any future
surface that re-derives from `entry.body`** (a new on-this-page derivation, a new
excerpt/summary generator, an agent-index body reader) **must replay the markua
normalisation** before deriving, or it will index/emit raw Markua as literal text.
IC-01 owns this note so the tasks phase does not silently regress it.

## Post-plan squad findings & disposition

Per the adversarial-evidence contract, each finding from the post-plan brownfield
squad (paula-patterns, debugger-debbie, reviewer-renata, frontend-freddy) and its
disposition. All are **accepted → folded** into the plan-phase artifacts and the spec.

| Finding | Disposition |
|---------|-------------|
| A. Wiring seam: mdast route is the ratified design; pre-parse body-string is unreachable | **Accepted → folded** (research D-02, ADR Decision/Risks, plan IC-01, spec C-001) |
| B. One emission owner; native `remarkAsides` for the 4 mapped classes; mapped+`{#id}`/`{icon:}` routes to `dk-callout` hast (superseded at post-tasks: theme classes are emitted hast, not a component — D-03a) | **Accepted → folded** (callout-mapping, icon-map, data-model, ADR Consequences) |
| C. Plugin ordering pinned (prepend before `starlight()`, IC-06 assertion, config comment) + single `remark-directive` owner gated on glossary-OR-markua | **Accepted → folded** (research D-07, plan IC-01/IC-06, callout-mapping, ADR Risks) |
| D. ToC heading-exclusion demotion pass with `role`/`aria-level`, bounded spike | **Accepted → folded** (callout-mapping, research D-03, plan IC-01/IC-02, spec FR-001 mechanism pinned in contract) |
| E. Figure rehype runs BEFORE `rehypeImages`; ordering required, `__ASTRO_IMAGE_` round-trip asserted | **Accepted → folded** (figure-render, research divergence + D-05, plan IC-03) |
| F. Activation model: preset-flag opt-in (not automatic); spec FR-011/Overview reconciled with ADR | **Accepted → folded** (spec FR-011/Overview/SC-003, ADR Decision — models now agree) |
| G. `A>` aside → theme-callout hast `dk-callout--aside` (removed the OR) | **Accepted → folded** (callout-mapping, data-model, research D-03) |
| H. Attribute list above a wrapper attaches to the emitted container | **Accepted → folded** (normaliser-block-detection, attribute-list-plugin) |
| I. Non-fakeable DoDs: `fence-suppresses-line-prefix` + `unterminated-fence-at-EOF` cases; concrete SC-003; SC-005 coverage-matrix denominator | **Accepted → folded** (normaliser test matrix, data-model coverage matrix, spec SC-003/SC-005/NFR-003) |
| J. ADR Status flips to Accepted on landing; back-link updated to `docs/adr/` path | **Accepted → folded** (ADR Status note, normaliser back-link note, plan IC-00/IC-07) |
| K. Decomposition: IC-01 owns attribute-list parser whole / IC-04 test-only; callout theme styling its own WP; directive/hast schema carries icon from IC-02; `createPageProcessor` note; FR-014 coverage hook | **Accepted → folded** (plan concern map, this note, data-model coverage row 34/FR-014 hook) |
| L. Adversarial-evidence disposition recorded | **Accepted** (this section) |

Nothing was deferred. Every finding is folded into the artifacts named above; where a
correction touched a load-bearing claim, the contract, plan, and spec lines were
brought into agreement (no corrected contract left contradicting an un-corrected
plan/spec line).

### Post-tasks squad findings & disposition

A second bounded squad (reviewer-renata anti-laziness, paula-patterns decomposition,
debugger-debbie test-coverage) reviewed the 11 WPs post-tasks. Dispositions:

| # | Finding | Disposition |
|---|---------|-------------|
| P1 | **Callout rendering mechanism unresolved; component route foreclosed.** `config.ts` Seam 3 freezes the Starlight `components` map at four carriers (verified), and no plugin→`.astro` seam exists — so `Callout.astro` cannot render on a plain `.md` page (dead code / split-brain). | **Accepted → folded**: pinned emitted `dk-callout` hast (D-03a; ADR-0030 Decision 4; callout-mapping, data-model, WP04, WP05). `Callout.astro` not created; WP05 owns only `theme.css`. |
| P2 | **FR-004 three-form equivalence has no non-fakeable owner** (WP04 T016 = tautology on already-normalised input; WP02 proves 2/3). | **Accepted → folded** into WP10 (explicit per-class live-render byte-identical assertion; SC-005 rows 5–14 map to it). |
| P3 | **C-005 explicit-id-wins carries a fakeable citation escape hatch** (WP09 T037 "OR assert the documented rule"). | **Accepted → folded**: WP09 must run the real `rehypeHeadingIds` pass over a colliding tree; citation-only proof removed. |
| P4 | **WP08 double-registration (its own top risk) has no test** — only the both-OFF case is asserted. | **Accepted → folded**: WP08 adds a committed glossary-ON/markua-OFF array-identity assertion (directive once, pre-hoist position; carrier-counting pattern). |
| P5 | Theme-variant + mapped-icon render discriminators unnamed; SC-005 manifest proves existence not behavior; nested `{aside}` only unit-tested; figure locator by substring. | **Accepted → folded** into WP10 (per-`dk-callout--{variant}` + icon discriminators; per-row fail-red assertion names; live nested `{aside}` fixture; identity-anchored figure locator). |
| P6 | FR-014 machine hook conflates publish (checkable) with construct-coverage (judgment); WP01 "two owned files" wording; SC-003 `:::`-leak grep vacuous preset-off. | **Accepted → folded** (WP11 named reviewer check; WP01 wording; WP10 keeps the `{…}`/line-prefix literal-text check as the real SC-003 gate). |
| P7 | WP08 parser/config fusion over-serializes the attribute parser (scheduling only; acyclic). | **Conceded** — not split; the fusion is cohesive and acyclic, cost is critical-path scheduling only. |
