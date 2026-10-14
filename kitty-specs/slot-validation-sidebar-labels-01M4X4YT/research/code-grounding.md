# Code grounding — slot validation (#114) and sidebar labels (#112)

Read-only survey taken on `origin/main` at `81e1663` (2026-10-14), before any
specification. Line numbers are from that commit.

## 1. Theme slots (#114)

### Where slots live

- `src/lib/theme.ts:41-57` — `DkSlotName` is a **type-only** union of 16 names.
  No runtime list exists, so nothing at run time can check a name against it.
- `src/lib/theme.ts:81` — `DocKittyTheme.slots?: Partial<Record<DkSlotName, string>>`.
- `src/lib/theme.ts:381-415` — `mergeLayers` folds the layers. Slots merge
  per-key last-wins (`:410`) with no name check. The same function already
  **throws** on a `--sl-*` token key (`:399-403`, ADR-0011 rule), so a
  config-time failure on a theme mistake has a precedent in this exact loop.
- `src/lib/theme.ts:427-434` — `resolveTheme(theme)`: `undefined` → Default
  only; otherwise `mergeLayers([DEFAULT_LAYER, ...flattenChain(theme)])`.

### Where config is loaded

- `src/lib/config.ts:1852` — `defineDocKittyIntegrations` calls
  `resolveTheme(theme)` once, while the consumer's `astro.config.mjs` is being
  evaluated. That is the config-time seam: a throw there fails `astro build` and
  `astro dev` before any page renders.
- Consumer configs are plain JavaScript (`example/astro.config.mjs`,
  `src/tests/fixtures/header-theme/astro.config.mjs`, the consumption fixture).
  `// @ts-check` is advisory; nothing type-checks a `.mjs` config in a build.
  This is the gap the issue names.

### Where slots are transported

- `src/lib/manifest.ts:119-121` — `generateManifestSource` emits one
  `slotComponents` entry per resolved slot, whatever its name.
- `src/lib/manifest.ts:57-60` — its doc comment states the current contract:
  "Slot NAMES are checked where a theme is written, not here … performs no name
  check of its own." That comment changes with this fix.
- Readers: `src/components/Header.astro` (`dk:site-header`),
  `Footer.astro` (`dk:site-footer`), `PageTitle.astro` (`dk:page-hero`,
  `dk:metadata-band`), `Head.astro`. A misspelt key is carried in the manifest
  and never read, so the stock component renders. That is the silent failure.

### Invariants and decisions that bind the fix

- ADR-0011 (slot surface): themes target `dk:` names, never Starlight's
  `components` map.
- ADR-0015: slots resolve per carrier through the manifest.
- ADR-0044 §Consequences (`docs/adr/0044-header-carrier.md:123-125`) records
  "Slot names are checked by TypeScript only … accepted and the slot never
  renders" as a known limit. ADRs are immutable (charter, "Amendment and
  exceptions"), so lifting it needs a new ADR, not an edit.
- `docs/architecture/theming.md:185` repeats that limit in prose; it must be
  updated in the same change (charter: living documentation).
- `DocKittyTheme` is a stable public surface (`theme.ts:69`, NFR-006: "a
  breaking change requires an ADR"). Rejecting a config that used to load is a
  behaviour change for that surface, which is another reason for the ADR.

### Adopter exposure

Every slot name in the repository is valid: the spec-kitty brand
(`src/themes/spec-kitty/index.ts:123-126`, `dk:site-footer`), the
header fixture (`dk:site-header`), `config-invariants.test.ts:80`,
`theme-merge.test.ts:22,32`. A config that a name check would reject today
renders the stock component in place of the one its author wanted, so that
site is already wrong; failing turns a silent wrong render into a build error
that names the fix.

## 2. Sidebar labels (#112)

### Shaping code

- `src/lib/route-shaping.ts:80-98` — `buildDirectoryMeta`: per directory, the
  index page's `sidebar.label ?? title` and `sidebar.order`.
- `src/lib/route-shaping.ts:184-271` — `shapeSidebar`: for a nested group the
  label is the directory's index label (`:248-261`); children are ordered index
  first, then links, then subgroups (`:221-246`). Top-level labels come from
  `sections.yaml` and are left alone (depth 0).
- Starlight labels each link with the page's `sidebar.label ?? title`. A nested
  group takes the same value from the same page. So **every nested group's
  first entry repeats the group label by construction**, and most top-level
  groups do too (section index title = registry label).
- `src/lib/route-shaping.ts:306-334` — `shapePagination` takes prev/next labels
  from the **shaped** links (`now`). Any relabelling of index links would leak
  into "Previous / Next" unless pagination reads labels from the original tree.
- `src/lib/route-middleware.ts` — applies `shapeSidebar`, `shapePagination`,
  `shapeToc` per page. Pure functions, identical tree on every page (NFR-006).

### Glossary contexts

- `src/lib/glossary/generate.ts:179-190` — each context page gets
  `title: <context name>` verbatim; the context lives at
  `glossary/<slug>/<index>.md`, so the sidebar sees a directory with one index
  page: group `hr` containing link `hr`.
- `src/lib/glossary/load.internal.ts:36-48` — `ContextSchema` is
  `{ name, domainVisionStatement?, terms }`. Zod strips unknown keys.
- Contextive's own reader (dev-cycles/contextive,
  `src/core/Contextive.Core/GlossaryFile.fs:154-160`) builds a YamlDotNet
  deserializer **without** `IgnoreUnmatchedProperties`, so an unknown key on a
  context makes Contextive reject the whole file. A toolkit-only display-name
  key in `.contextive/definitions.yaml` would break the editor tooling that
  file exists for. Contextive's context `meta` map is valid but is rendered in
  editor hovers, so it is not a label channel either.
- In Contextive the context `name` is itself the display text; the example
  site names its contexts `hr`, `rhetoric`, `shipping`. Renaming them would
  change slugs, URLs and about 30 `glossary_context:` references, including
  `behaviour/hr` owned by the Gherkin sibling. Out of scope.

### Built sidebar today (example, `pnpm build`)

```
[Presentations]  → Presentations                (sole child)
[Reference]      → Glossary, [hr] → hr, [rhetoric] → rhetoric, [shipping] → shipping
[Guides]         → Guides, Getting started, …
[Rhetoric]       → Rhetoric, About and license, Introduction, Preamble, [books…]
[Architecture]   → Architecture, …, Overview (a page titled "Overview"), …
[Behaviour]      → Behaviour, [Hr] → Hr, Request annual leave; [Shipping] → …
```

`/rhetoric/` lists its three pages alphabetically: none declares
`sidebar.order`.

### ADRs and convention

- ADR-0029 (sidebar autogenerate content-root coupling), ADR-0033 (flexible
  section identity): top-level groups come from `sections.yaml`; this fix must
  not change top-level group identity or order.
- ADR-0026 §Decision 3: generated glossary pages are written into the docs
  collection so the sidebar picks them up with no new wiring. The fix keeps
  that: no injected routes, no generator-specific sidebar code.
- `docs/guides/authoring.md:48-90` documents the sidebar rules for authors and
  must describe any new rule.
- Docs convention (`docs/context/convention.md`, AGENTS.md): any page touched
  keeps `title`, `description`, `doc_status`, `updated`; bump `updated`.

## 3. Gates touching these files

| Gate | What it covers | How it stays honestly green |
|---|---|---|
| `src/tests/theme-merge.test.ts` | merge semantics, valid slot names | unchanged inputs are valid names; add rejection cases |
| `src/tests/header-carrier.test.ts:245-280` | TypeScript rejects a bad slot name in a `.ts` theme | stays; the runtime check is the second line for `.mjs` |
| `src/tests/config-invariants.test.ts` | config-level invariants with valid slots | unchanged |
| `src/tests/route-shaping.test.ts` (51 cases) | shaping rules on hand-built trees | update cases whose expected index label changes; add collapse/relabel/pagination cases |
| `src/tests/sidebar-build-html.test.ts` | built example sidebar; label check scoped to `AUTHORED_DIRECTORY_SLUGS` (`:43`) | widen to every group (issue asks); update prev/next expectation once `/rhetoric/` gains `sidebar.order` |
| `src/tests/glossary-generate.test.ts` | generated files byte-for-byte | untouched if the generator is untouched |
| `tests/a11y/visual.spec.ts` baselines `home-*.png`, `chrome-1920-*.png` | the home page and chrome at 1920px show the sidebar | **will change**. Regenerate only through `update-a11y-baselines.yml` in the pinned container, never locally |
| `tests/a11y/axe.spec.ts`, `layout-geometry.spec.ts`, `glossary.spec.ts`, `presentations-hub.spec.ts` | a11y and geometry on routes incl. `/glossary/*`, `/presentations/` | routes are unchanged; run them |
| `tests/consumption/scripts/assert-consumer-surfaces.mjs` | packed-tarball consumer: draft listed/unlisted in sidebar | checks hrefs, not labels; run `tests/consumption` |
| `src/scripts/assert-build-artifacts.mjs` | built artifacts | no label assertions on these groups |
| `pnpm validate` (frontmatter, links, catalog) | `example/docs` frontmatter after adding `sidebar.order` | keep frontmatter valid, bump `updated` |

## 4. Churn (`git log --since=90.days`)

| File | Commits |
|---|---|
| `src/lib/config.ts` | 39 |
| `src/lib/theme.ts` | 7 |
| `src/lib/glossary/generate.ts` | 5 |
| `src/lib/manifest.ts` | 4 |
| `src/tests/route-shaping.test.ts` | 4 |
| `src/lib/route-shaping.ts` | 3 |
| `src/tests/sidebar-build-html.test.ts` | 3 |
| `src/tests/theme-merge.test.ts` | 3 |

`config.ts` is the hot spot and is also edited by the docs sibling (#153). The
fix avoids it: validation lives in `theme.ts`, reached through the existing
`resolveTheme` call.

## 5. Sibling dispatches

- **#154 reading width** edits `src/lib/theme.ts` (width default inside
  `DEFAULT_BASE`). This mission touches only the slot type, a new runtime slot
  list and `mergeLayers`; disjoint hunks.
- **Gherkin #156, #123–#128** change hub titles and groups under `behaviour/`.
  This mission changes no `behaviour/` content, but its generic relabelling
  rule changes how those groups render (index entry reads "Overview"). The
  built-HTML test must not pin Behaviour labels so either order of landing
  merges cleanly.
- **Docs #153** edits `docs/guides/consumer-setup.md` and a `config.ts` doc
  comment. Not touched here.
- Shared: the visual baselines. Whichever lands second rebases and regenerates
  once.

## 6. Doctrine notes

- No `bugfix` mission type is installed (`spec-kitty mission list`:
  documentation, plan, research, software-dev), so the mission is
  `software-dev` run under the test-first-bug-fixing and
  disciplined-defect-diagnosis procedures.
- test-first-bug-fixing's exit says "test and fix are committed together";
  the dispatch asks for the failing test committed first. Both are honoured in
  the sense that matters (red is observable in history, fix is the next
  commit); the tension is flagged in the PR.
