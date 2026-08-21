# Findings F — Reveal.js Slide-Deck Support for doc-kitty

**Scope:** Read-only technical discovery to inform a doc-kitty spec for reveal.js
slide-deck support following a **Markdown → pre-processing → rendered slidedeck**
pipeline.
**References reviewed:** (1) Hugo site (author-owned) — the **target pattern**;
(2) Client Astro portal — the **anti-pattern**.
**Guardrail applied:** all customer/org/product/deck names, titles, and internal
URLs genericized to `<client>` / `<term>` / `<deck>`. Only mechanisms and
patterns captured.

## Top takeaways

1. **The Hugo reference is a true Markdown→preprocess→render pipeline.** An author
   writes one Markdown file per deck under `content/presentations/<deck>.md` with
   reveal options in TOML/YAML frontmatter. Hugo's Go templates
   (`layouts/presentations/*` + vendored `partials/reveal-hugo/*` +
   `shortcodes/slide.html`) run `markdownify` on the body, **split the rendered
   HTML on `<hr/>` (from `---`)** into `<section>` slides, and emit a complete
   reveal.js page at build time. The author never touches `<section>`
   scaffolding, reveal init, or the deck `<head>`. This is the pattern doc-kitty
   should replicate.
2. **The client Astro portal does the opposite and is explicitly an
   anti-pattern.** There is **no Markdown→slides pipeline in Astro.** Each deck is
   a fully hand-authored (or externally-generated) reveal.js `index.html` — 13 of
   19 decks are 500–4600 lines of raw HTML with hundreds of inline `<section>`
   blocks and large inline `<style>` blocks. `sync-decks.mjs` merely **copies the
   pre-built HTML verbatim** into `public/decks/`, and a **hand-maintained YAML
   manifest** (`decks.manifest.yaml`) kept 1:1 in sync (build fails on drift)
   drives the overview. Authoring a slide = editing raw HTML; the site build
   contributes zero rendering.
3. **Reveal.js ships a Markdown plugin, but it parses on the client at runtime** —
   slides are empty in the initial HTML until JS runs. For a static-build doc
   site (SEO, no-JS, printable PDF) doc-kitty should prefer **build-time
   pre-rendering** of Markdown into `<section>` HTML, exactly as the Hugo
   reference does.
4. **Recommended approach:** an Astro **content collection** `decks/` of Markdown
   files + a **remark/unified pre-processing step** that splits each deck body on
   `---` (horizontal) / `##` or `--` (vertical) into reveal `<section>` elements,
   rendered once at build time into a per-deck static route loading a
   **locally-vendored reveal.js** (no CDN). Maps cleanly onto doc-kitty's
   Common-Docs frontmatter + static-build model and eliminates the hand-authored
   HTML burden.

## Hugo approach (target pattern)

**Location:** `penguin-pragmatic-patterns/`. Key files:

- `content/presentations/_index.md`, `content/presentations/<deck>.md` —
  **author-written Markdown decks**
- `layouts/presentations/single.html` — per-deck reveal page shell
- `layouts/presentations/list.html` + `partials/slidedeck.html` — overview page
- `layouts/partials/reveal-hugo/slides.html` — **the core Markdown→`<section>`
  splitter**
- `layouts/shortcodes/slide.html`, plus `section`/`note`/`fragment` shortcodes —
  per-slide control
- `data/presentations.toml` — overview-page metadata catalog (`[[slidedeck]]` per
  deck)
- `config.yaml` `markup.goldmark.renderer.unsafe: true` — lets authors mix raw
  HTML into Markdown
- `static/reveal-js/`, `static/reveal-hugo/` — **locally vendored** reveal.js
  engine + theme (no CDN)

The `reveal-hugo` machinery is **vendored into `layouts/`+`static/`** (local
copies of the open reveal-hugo theme), not a remote module — the whole pipeline
is self-contained.

**How an author writes a deck (genericized):**

```markdown
+++
title = "<Deck Title>"
subtitle = "<deck subtitle>"
author = "<Author>"
[logo]
src = "/images/logos/<logo>.webp"
text = "<Org>"
link = "https://<site>"
[reveal_hugo]
margin = 0.2
theme = "<theme>"
+++

{{% section %}}          {{/* opens a VERTICAL stack */}}
## <Opening slide>
Prose. Raw HTML allowed (goldmark unsafe=true):
<img src="/images/presentations/<deck>/<image>.png" style="width:60%" />
{{% /section %}}

---                      {{/* `---` == new HORIZONTAL slide */}}

{{% section %}}
## <Section title>
---                      {{/* `---` inside a section == VERTICAL slide */}}
### <Sub-slide>
- bullet one
{{% note %}}Presenter-only reminder.{{% /note %}}
---
### <Code slide>
```js{1,4-6}              {{/* `{1,4-6}` => reveal line-highlight */}}
const x = 1;
```
{{% /section %}}
```

**Pre-processing / rendering mechanism:**

1. **Route+layout:** files under `content/presentations/` get
   `type=presentations` → `layouts/presentations/single.html`, which builds the
   full document (`<head>` with reveal CSS/theme/plugins, `.reveal > .slides`
   container, optional logo from frontmatter), then calls
   `partial "reveal-hugo/slides" (slice .Page)`.
2. **Markdown→slides split (the heart):** `partials/reveal-hugo/slides.html`
   renders the body to HTML, **splits on `<hr/>`** (`split $content "<hr />"`),
   wraps each fragment in `<section>` **unless it already carries
   `data-noprocess`** (raw-HTML/shortcode slides), and rewrites code-fence classes
   so reveal/highlight.js takes over (```` ```js{1,4-6} ```` →
   `data-line-numbers="1,4-6"`).
3. **Vertical stacks & per-slide control via shortcodes:** `{{% section %}}`
   groups a vertical stack; `shortcodes/slide.html` can pull Markdown from `data/`,
   emit `<section data-noprocess ...>` with per-slide `data-*` and a named
   reusable **template** (from `reveal_hugo.templates`); `{{% note %}}`→speaker
   notes; `fragment`→incremental reveals.
4. **Overview page:** `list.html` ranges over `data/presentations.toml`
   `[[slidedeck]]` entries → card per deck (title, subtitle, banner, abstract,
   "View" link, and a **`?print-pdf` PDF-export link**). Catalog is a metadata
   sidecar authored separately from deck bodies.
5. **Assets/engine:** reveal.js + theme served from `static/` (vendored,
   offline-capable); images under `static/images/presentations/<deck>/`.

**Net author experience:** write Markdown, separate slides with `---`, group with
`{{% section %}}`, notes with `{{% note %}}`; build produces a themed, navigable,
PDF-exportable deck. No `<section>` bookkeeping, no reveal boot code, no per-deck
`<head>`.

## Client Astro approach (anti-pattern)

**Location:** `portal/`. Key files:

- `src/scripts/sync-decks.mjs` — copies pre-built decks into `public/decks/`
- `src/lib/decks.ts` — loads+validates the hand-authored manifest against copied
  decks
- `src/data/decks.manifest.yaml` (+ `presentation_tags.yaml`) — hand-maintained
  deck catalog
- `src/pages/presentations/index.astro` + `components/DeckInventoryCard.astro` —
  overview page
- `integrations/deck-dev-index-integration.ts` — dev-only middleware resolving
  `/decks/<slug>/`→`index.html`
- `public/decks/<deck>/index.html` — **the actual decks: raw, hand-authored
  reveal.js HTML**
- npm scripts: `sync:decks`, `validate:decks`, wired into `prebuild`/`dev`

**How it works:**

1. **Decks authored/generated entirely outside the site**, each a self-contained
   reveal.js `index.html` (own `<head>`, inline `<style>`, hand-written
   `<section>`s, CDN or deck-local/vendored engine). Some decks embed a *full
   private copy* of the reveal.js source tree (`<deck>/reveal.js/**`).
2. **`sync-decks.mjs` is a pure copy step** — `rm -rf public/decks` then
   byte-for-byte copy of external `presentations/**` into `public/decks/**`
   (dereferencing symlinks, excluding only `tests/`). It **must not rewrite any
   path or content** because decks reference sibling assets (`../shared_assets/`,
   `../vendor/reveal.js/`) by fragile relative paths.
3. **Hand-maintained manifest drives overview.** `decks.ts#validateAndLoad` reads
   `decks.manifest.yaml` (per deck: `slug`, `title`, `description`, ISO `date`,
   `status`, `tags`, optional preview) and **cross-checks 1:1 against copied
   decks**, throwing (failing `astro build`) on any drift.
4. **Extra glue to serve static folders:** a dev-only integration rewrites
   `/decks/<slug>/`→`index.html` because Vite's public-dir middleware won't
   resolve a directory index in dev.

**Why it is cumbersome to maintain (reasons to avoid):**

- **Authoring is raw HTML at scale** — 13/19 decks are 500–4600-line hand-written
  HTML with hundreds of hand-managed `<section>`s and huge inline `<style>`
  blocks. Editing a slide = editing HTML.
- **Massive duplication** — deck theme/branding CSS copied inline into every
  `<head>`; reveal engine vendored **multiple times** (shared `vendor/reveal.js`
  *plus* whole private copies inside individual decks). No single source of truth
  for look or engine version; a theme tweak or reveal upgrade is an N-deck edit.
- **Manual, drift-prone catalog** — every deck needs a hand-written manifest entry
  kept exactly in sync or the build breaks; metadata authored in a *second place*,
  divorced from content (two sources of truth).
- **Fragile relative-path + symlink coupling** — decks depend on precise sibling
  layout and cross-repo symlinks that break in worktrees/containers; the sync
  script carries elaborate special-casing.
- **Build contributes no rendering** — the site only copies and validates; all
  value-add (splitting, theming, notes, fragments) is manual per deck. No
  `---`-to-slide convenience anywhere.
- **Inconsistency baked in** — 7/19 decks use reveal's runtime `data-markdown`
  plugin while the rest are hand-authored HTML; two incompatible authoring styles
  coexist with no shared pipeline.

**Conclusion:** the portal treats decks as opaque external binaries — it solves
*serving & cataloging* but not *authoring*, pushing all authoring cost onto raw
HTML. doc-kitty must move rendering into the build, Hugo-style.

## Reveal.js-from-Markdown options for Astro (compared)

**Option A — Reveal.js built-in Markdown plugin (runtime, client-side).** Markdown
in `<textarea data-template>` or external `data-markdown="<deck>.md"`; reveal
parses in-browser, splitting on `data-separator`(`---`)/`data-separator-vertical`/
`data-separator-notes`; per-element/slide attrs via HTML comments.

- *Pros:* trivial to wire; canonical reveal syntax; least custom code; pure-Markdown authoring.
- *Cons:* **parsing on hydration — initial HTML has no slides** (bad for SEO/no-JS/print/first-paint); external-file mode needs a web server + client fetch; you still hand-write the boot shell per deck; indentation-sensitive. Not a build-time pipeline — this is exactly what the portal's `data-markdown` decks do, which we're moving away from.

**Option B — Build-time pre-render via content collection + remark/unified split
(RECOMMENDED).** A `decks/` content collection of Markdown (frontmatter=config); a
remark/unified step (or a dynamic route reading the collection) splits each body
on `---` (horizontal) and `##`/`--` (vertical) into `<section>`s and renders them
to **static HTML at build time**, in one shared layout loading vendored reveal.js.
Astro-native equivalent of reveal-hugo's `slides.html`; same idea as the
`reveal-md` CLI.

- *Pros:* **true Markdown→preprocess→render — matches the Hugo target exactly.** Slides exist in built HTML (SEO, no-JS, `?print-pdf`). Single shared layout/theme/engine — no per-deck `<head>` or duplicated CSS. Config+content in one Markdown file; overview derived from same collection (no separate manifest). Reuses Astro's Markdown/remark toolchain + static build; engine vendored locally.
- *Cons:* must write/maintain the split-and-render step (~one remark plugin or templated route) + shared layout; you own the mapping of notes/fragments/backgrounds to reveal attributes. Modest one-time effort.

**Option C — MDX component-driven framework (`astro-slides` / custom `<Slide>`
components).** MDX; slides delineated by explicit `<Slide>`/`<Section>` components,
prose in Markdown, interactivity in JSX. (Some such frameworks replace reveal.js
with a custom View-Transitions engine.)

- *Pros:* most powerful — real components, layouts-as-components, per-slide JSX; content collections/i18n/SEO reusable; good for rich interactive islands.
- *Cons:* **couples authoring to MDX/JSX** (higher bar, different model than Common-Docs Markdown); per-slide component wrapping more verbose than `---`; some options aren't reveal.js (lose themes, speaker view, PDF export, plugins). Heavier than the target needs.

## Recommendation for doc-kitty

**Adopt Option B — a build-time Astro content collection + remark/unified
slide-splitter rendering each deck to static reveal.js HTML — the direct Astro
analogue of the Hugo reveal-hugo pipeline.**

**Shape:**

1. **Content collection `decks/`** (`src/content/decks/<deck>.md`), one Markdown
   per deck. Frontmatter in **Common-Docs style**: reuse `title`, `description`,
   `updated`/`date`, `doc_status`/deck `status`, `tags`, `related`, plus a small
   deck block (`theme`, `transition`, optional `logo`, `card_image`). Validate
   with a Zod schema in `content.config.ts` (mirroring the portal's docs-collection
   validation) — decks become first-class Common-Docs records, not opaque HTML.
2. **Pre-processing step:** a remark/unified transform (or render helper from the
   route) that splits the rendered body on `---`→horizontal `<section>`s and
   `##`/`--`→vertical nested `<section>`s (reveal-hugo's split-on-`<hr/>` done in
   the Astro build); honors a `data-noprocess` passthrough for hand-tuned raw-HTML
   slides; maps notes/fragments/backgrounds to reveal attributes (speaker-note
   fence→`<aside class="notes">`, `<!-- .element: class="fragment" -->`,
   `<!-- .slide: ... -->`).
3. **One shared `DeckLayout.astro`** producing the `.reveal > .slides` shell,
   `<head>` (reveal core CSS + theme), branding from frontmatter, and reveal init
   — written once, reused by every deck (kills per-deck duplication).
4. **Vendor reveal.js locally** (npm dep into build/`public`), **no CDN** —
   offline/reproducible, like the Hugo `static/reveal-js/`.
5. **Overview derived from the collection**, not a hand-kept manifest:
   `getCollection('decks')`→sorted cards (title, description, date, status, tags,
   `?print-pdf`). Removes the portal's biggest tax (drift-checked YAML manifest)
   since content and catalog are one source.
6. **Routing:** dynamic route `src/pages/decks/[slug].astro` via `getStaticPaths()`
   over the collection, `prerender=true`; keep reveal `?print-pdf`. No dev-only
   index-rewrite integration needed (real routes, not `public/` folders).

**Mapping to doc-kitty's content model:** decks become another collection of
Common-Docs Markdown (same frontmatter vocabulary + Zod-in-`content.config.ts`
validation); authors stay in Markdown in-repo (the doc-kitty "low-friction docs"
ethos). Rendering is pure build-time → static HTML + vendored assets, matching
doc-kitty's static/prerendered posture (no server rendering for decks). Reuses
existing image/diagram conventions; reveal `?print-pdf` yields a PDF artifact for
free; the overview reuses the site's card/listing components fed by
`getCollection`.

**Effort:** moderate, mostly one-time — split-and-render remark step + shared
layout + dynamic route + Zod deck schema + overview page. Afterward, adding a deck
is "drop in a Markdown file."

**Risks / watch-items:** (a) reveal's global CSS can hijack viewport/scroll —
scope it to the deck route only, never doc pages; (b) Markdown-mapping fidelity for
fragments/backgrounds/vertical-stacks/code-line-highlighting — copy reveal-hugo's
proven `slides.html` regexes; (c) existing hand-authored HTML decks won't
auto-convert — plan a one-time port to Markdown, or keep a `data-noprocess`
raw-HTML escape hatch for genuinely bespoke decks (as reveal-hugo allows); (d)
consolidating N inline stylesheets into one theme needs a deliberate design pass
(that's the point); (e) verify reveal notes plugin + `?print-pdf` work with the
vendored (non-CDN) engine in the static build.

## Sources

- Hugo reference (author repo): `penguin-pragmatic-patterns/` —
  `content/presentations/*`, `layouts/presentations/*`,
  `layouts/partials/reveal-hugo/slides.html`, `layouts/shortcodes/slide.html`,
  `layouts/partials/slidedeck.html`, `data/presentations.toml`, `config.yaml`,
  `static/reveal-js/`, `static/reveal-hugo/`.
- Client Astro reference (portal repo): `portal/` — `src/scripts/sync-decks.mjs`,
  `src/lib/decks.ts`, `src/pages/presentations/index.astro`,
  `src/components/DeckInventoryCard.astro`,
  `integrations/deck-dev-index-integration.ts`, `src/content.config.ts`,
  `public/decks/<deck>/index.html`.
- Reveal.js Markdown plugin docs — https://revealjs.com/markdown/
- reveal.js external-markdown separators (issue #929) —
  https://github.com/hakimel/reveal.js/issues/929
- "Astro + reveal.js — Convert Markdown into Stunning Slides" —
  https://andrewmarder.net/revealjs/
- "Building a Multilingual Slide System Inside Astro with Reveal.js" —
  https://xergioalex.com/blog/building-slide-system-inside-astro-revealjs/
- "View Transitions and an Astro Presentation Framework" —
  https://nabeelvalley.co.za/blog/2024/06-03/astro-slides/
- `astro-slides` (MDX slide framework) — https://github.com/jluterek/astro-slides
- `astro-presentations` (reveal.js decks served by Astro) —
  https://github.com/cnguyen-de/astro-presentations
- `reveal-md` (Markdown → reveal HTML generator) —
  https://github.com/webpro/reveal-md
