# Contract: callout mapping (class → Starlight aside | theme callout)

How a normalised callout directive resolves to its rendered target. There are **two**
render vehicles and **one** emission owner: the `markua-callouts` remark plugin emits
a `containerDirective` for the four Starlight-mapped classes (Starlight renders them)
and **raw hast** (`<aside class="dk-callout dk-callout--{variant}">`) for the six theme
classes (`theme.css` styles them). The class → target logic lives in a pure
`*.internal.ts` helper (vitest-covered). There is **no `Callout.astro` component** —
see "why hast, not a component" below.

## Class → target table

| Markua class | Emission (WP04) | Target | Rendered as |
|--------------|-----------------|--------|-------------|
| tip | `containerDirective` `tip` | Starlight native aside | Starlight `tip` |
| warning | `containerDirective` `caution` | Starlight native aside | Starlight `caution` |
| error | `containerDirective` `danger` | Starlight native aside | Starlight `danger` |
| information | `containerDirective` `note` | Starlight native aside | Starlight `note` |
| aside (`A>` / `{aside}`) | raw hast | **theme callout hast** | `<aside class="dk-callout dk-callout--aside">` + `--dk-callout-*` tokens (`:::aside` is **not** a native Starlight type); internal headings kept out of the ToC |
| discussion | raw hast | theme callout hast | `<aside class="dk-callout dk-callout--discussion">` + `--dk-callout-*` tokens |
| question | raw hast | theme callout hast | `<aside class="dk-callout dk-callout--question">` + `--dk-callout-*` tokens |
| exercise | raw hast | theme callout hast | `<aside class="dk-callout dk-callout--exercise">` + `--dk-callout-*` tokens |
| center (`C>` / `{class: center}`) | raw hast | theme callout hast | `<aside class="dk-callout dk-callout--center">` + `--dk-callout-*` tokens |
| generic (`B>` no class) | raw hast | theme callout hast | `<aside class="dk-callout dk-callout--generic">` + `--dk-callout-*` tokens |

- The four mapped classes (`tip`/`caution`/`danger`/`note`) keep Starlight's native
  aside styling and accessibility — doc-kitty does **not** reimplement aside markup.
  The **six** theme classes (`aside`, `discussion`, `question`, `exercise`, `center`,
  `generic`) render as **hand-emitted hast** (mirroring `rehype/diagram-figure.ts`),
  styled by a `--dk-callout-*` token family in `theme.css`, because Starlight ships
  only four aside types and `A>`'s `aside` is not one of them (research D-03, FR-003,
  FR-001).

## Rendering seam (one emission owner, native aside consumption)

- **One owner, two vehicles.** The `markua-callouts` plugin is the **single DOM owner**
  for callouts. For the four mapped classes it constructs a `containerDirective` whose
  name is `note`/`tip`/`caution`/`danger`; Starlight's own `remarkAsides` visits those
  names and rebuilds them as **native** Starlight asides (doc-kitty never emits mapped
  aside markup). For the six theme classes it emits **raw hast** directly — an
  `<aside class="dk-callout dk-callout--{variant}">` element (optional icon child +
  optional title + the compiled body children) — exactly the `type: 'element'`
  emission pattern `rehype/diagram-figure.ts` already uses. There is **no second DOM
  copy**: one plugin owns both vehicles.
- **Ordering requirement (load-bearing).** This works only because doc-kitty's markua
  remark plugins run **before** Starlight's `remarkAsides`, which is guaranteed solely
  by the markua integration being **prepended before `starlight()`** in
  `config.ts` — the exact ordering the `diagrams` and `glossary` integrations already
  rely on. `remarkAsides` runs in Starlight's own `astro:config:setup`, which fires
  **after** doc-kitty's prepended integrations, so the constructed directive nodes are
  present when it visits. IC-06 locks this with a build/vitest assertion that a `T>`
  renders `starlight-aside--tip` (so a future array reorder fails loudly), and
  `config.ts` carries a registration-site comment mirroring the deck/glossary ordering
  comments.
- **Attribute tradeoff (pinned, deliberate).** `remarkAsides` rebuilds a mapped
  directive as a fresh aside node and **discards the container's attributes /
  `hProperties`** (and its restoration pass restores only unhandled text/leaf
  directives, never a `containerDirective`). So a mapped-class callout that carries
  `{#id}` or `{icon: …}` **routes to the theme-callout hast** (`<aside class="dk-callout
  dk-callout--{variant}">`) instead of the native aside, so the id/icon survives. A
  mapped callout with no such attribute takes the native-aside path. This is the
  ratified native-a11y-reuse vs attribute-support tradeoff (recorded in the ADR
  Consequences); it is *not* an accident of ordering.
- The six theme classes always render as the theme-callout hast.

## Why hast, not an `.astro` component

Emitting an `<aside class="dk-callout …">` directly from the plugin — rather than
rendering a `Callout.astro` component — is a **deliberate, forced** decision, not a
shortcut:

- **The Starlight `components` map is frozen at exactly four carriers** (`config.ts`
  Seam 3, ADR-0013/ADR-0015 decision 3): the map is applied **after** `...overrides`
  so "a consumer's escape hatch cannot silently add a fifth carrier," and WP08's
  assertion enforces it. A markua callout is not one of the four carriers, so it
  cannot be a component the map surfaces.
- **doc-kitty has no directive→component seam.** No remark/rehype plugin in
  `src/lib/{remark,rehype}/` references a `.astro` component; they read
  `file.data.astro.frontmatter` and emit hast. A plugin on a plain `.md` page has no
  supported way to mount a component.
- So a `Callout.astro` would be **dead code** — never wired into any render path — and
  worse, a **split-brain second copy of the DOM** (co-owned by the plugin's emitted
  hast and the component's markup). The hast route keeps **one** DOM owner: the
  emitting plugin. This mirrors `diagram-figure.ts`, which builds its `<figure>` as
  raw hast styled by `--dk-diagram-*` tokens — the established pattern for custom
  rendering in plain `.md`.

## Heading exclusion from the table of contents (bounded spike)

A heading inside an aside/callout must not appear in the page's on-this-page nav
(FR-001, US1 sc.2). This is a **second real unknown** of similar magnitude to the
wiring seam, because there is no native hook for it: Starlight's
`rehypeCollectHeadings` collects **every** ATX heading unconditionally, and neither
Starlight nor Astro offers an aside-heading exclusion.

Ratified mechanism — **demotion**: a doc-kitty **user rehype pass runs before
`rehypeHeadingIds`** (and before `rehypeCollectHeadings`) and, for any ATX heading
inside a callout/aside container, demotes it to a non-heading element that preserves
accessibility semantics:

- the `<h_n>` becomes a `<p>` (or `<div>`) carrying `role="heading"` and
  `aria-level="{n}"`, so assistive tech still announces it as a heading at the right
  level, but `rehypeCollectHeadings` no longer sees an `h_n` element and omits it from
  the ToC;
- this keeps the WCAG 2.2 AA bar the rest of this contract promises (the heading is
  still a heading to a screen reader; it is only removed from the *visual* on-this-page
  index).

This is a **bounded spike inside IC-01/IC-02**: prove the demotion pass runs early
enough (before collection), that the demoted node keeps its `role`/`aria-level`, and
that the page ToC omits it while the document outline stays intact. The fallback, if
demotion proves fragile, is to restrict aside/callout bodies to non-ATX-heading
content (a documented author limit) — but demotion is the ratified default because it
preserves author-written headings.

## Emitted theme-callout hast (the pinned DOM + class scheme)

WP04 emits the theme callouts as raw hast; WP05 styles them in `theme.css`. The
structure and class scheme are **contract-fixed** so WP04's emission, WP05's CSS, and
WP10's per-variant assertions all name the same discriminators.

```html
<aside class="dk-callout dk-callout--{variant}"  id?="{id}">
  <span class="dk-callout__icon">…icon…</span>   <!-- present only when an icon resolved -->
  <p class="dk-callout__title">{title}</p>        <!-- present only when a title exists -->
  <div class="dk-callout__body">…compiled body children…</div>
</aside>
```

- **Base class**: `dk-callout` (every theme callout). **Modifier**:
  `dk-callout--{variant}`. The **six theme variants** (always hast) are
  **`{variant}` ∈ `aside` · `discussion` · `question` · `exercise` · `generic` ·
  `center`**: `dk-callout--aside`, `dk-callout--discussion`, `dk-callout--question`,
  `dk-callout--exercise`, `dk-callout--generic`, `dk-callout--center`.
- **Mapped-name fallback variants** (used *only* on the attribute-bearing mapped path —
  a `tip`/`warning`/`error`/`information` callout carrying `{#id}`/`{icon:}` that cannot
  ride the native aside): `dk-callout--tip`, `dk-callout--caution`, `dk-callout--danger`,
  `dk-callout--note` (the Starlight variant names), styled to echo the corresponding
  native aside. So the full `dk-callout--{variant}` scheme admits **ten** names; the six
  above are the canonical theme set, the four here are the rare attribute-bearing
  fallback.
- **Sub-element classes** (BEM, mirroring `dk-diagram__caption`): `dk-callout__icon`,
  `dk-callout__title`, `dk-callout__body`.
- **`id`**: set on the `<aside>` only when the callout carries an explicit `{#id}`.
- **Icon**: an **already-resolved** Starlight icon name (resolved by WP04 via
  `resolveIcon`, dropped cleanly when unmapped — see `icon-map.md`); WP04 emits the
  icon child, WP05 styles it. No client JS (NFR-005).
- **Styling / tokens**: styled entirely by the `--dk-callout-*` token family in
  `theme.css` (below), so an ADR-0008 theme overrides only tokens; `dk-callout--center`
  applies centered layout.
- **Accessibility**: the `<aside>` is a complementary landmark meeting the site
  WCAG 2.2 AA bar; contrast on each variant's tokens holds in both colour modes;
  asserted on the fixture corpus by WP10 (NFR-004).

### `--dk-callout-*` token family (pinned; owned by WP05 in `theme.css`)

Mirrors `--dk-diagram-*`: a closed family, light values in `:root`, **colour** tokens
redeclared under the dark selector.

| Token | Role |
|-------|------|
| `--dk-callout-bg` | callout surface / background |
| `--dk-callout-border` | accent border / left rule (driven per variant) |
| `--dk-callout-text` | body text colour |
| `--dk-callout-title` | title / label colour (driven per variant) |
| `--dk-callout-icon` | icon colour (driven per variant) |
| `--dk-callout-aside-accent` | per-variant accent for `aside` |
| `--dk-callout-discussion-accent` | per-variant accent for `discussion` |
| `--dk-callout-question-accent` | per-variant accent for `question` |
| `--dk-callout-exercise-accent` | per-variant accent for `exercise` |
| `--dk-callout-generic-accent` | per-variant accent for `generic` |
| `--dk-callout-center-accent` | per-variant accent for `center` |
| `--dk-callout-tip-accent` | mapped-name fallback accent for `tip` |
| `--dk-callout-caution-accent` | mapped-name fallback accent for `caution` |
| `--dk-callout-danger-accent` | mapped-name fallback accent for `danger` |
| `--dk-callout-note-accent` | mapped-name fallback accent for `note` |

Each `.dk-callout--{variant}` rule sets `--dk-callout-border` / `--dk-callout-title` /
`--dk-callout-icon` from its variant accent, so the base rule stays variant-agnostic.
The four `*-tip/caution/danger/note-accent` tokens style only the attribute-bearing
mapped fallback (they may alias the `--sl-*` aside colours so the fallback matches the
native aside look).

## Guarantees

- Every class resolves to exactly one target; an unknown `{class: …}` value degrades
  to the generic (`blurb`) variant rather than erroring (FR-012).
- The three input forms of any class produce identical output (FR-004) because they
  are normalised to one directive before this mapping runs
  (`normaliser-block-detection.md`).
