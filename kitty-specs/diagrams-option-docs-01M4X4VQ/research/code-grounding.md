# Code grounding — the `diagrams` option (#153)

Read-only pass on `origin/main` at `81e1663`, before specifying. Every behaviour
claim below cites the line that ships it.

## 1. Where `diagrams` is read and what it wires

- Option declaration and its current doc comment: `src/lib/config.ts:151-160`.
  The comment says "**Default off**" and describes what `true` wires. It never
  says, as a plain sentence, that `false` ships the blocks as code. This is the
  gap #153 names.
- Default: `diagrams = false` in the destructure of `defineDocKittyIntegrations`,
  `src/lib/config.ts:1813`.
- The switch: `...(diagrams ? [diagramsIntegration] : [])`,
  `src/lib/config.ts:1974-1978`. With `false` nothing diagram-related is
  registered: no remark/rehype plugins, no client script. A ```` ```mermaid ````
  fence then goes through the normal code-block path and renders as code.
- The integration: `diagramsIntegration` (`doc-kitty:diagrams`),
  `src/lib/config.ts:998-1118`. Its `astro:config:setup` calls
  `resolveDiagramMode()` once per build (`:1011`).

## 2. How the render mode is chosen

- `resolveDiagramMode(env)`, `src/lib/config.ts:668-680`:
  1. `DK_DIAGRAM_BUILD_RENDER` in `1/true/on/yes/build` → `build`
     (`:640`, `:677`).
  2. `DK_DIAGRAM_BUILD_RENDER` in `0/false/off/no/client` → `client`
     (`:641`, `:678`).
  3. Unset or unrecognised → `build` when a Playwright Chromium resolves, else
     `client` (`:679`).
- Chromium detection, `chromiumResolvable()`, `src/lib/config.ts:650-665`:
  require one of `playwright`, `playwright-core`, `@playwright/test`
  (`:643`) and check its `chromium.executablePath()` exists on disk. No launch.
- The fallback to client happens only in step 3. A forced `build` with no
  browser does not fall back: the build branch loads `@beoe/rehype-mermaid`
  (`:1032-1036`), whose `mermaid-isomorphic` needs `playwright` (optional peer,
  `node_modules/.pnpm/mermaid-isomorphic@3.1.0_playwright@1.62.1/.../package.json`).
- The toolkit package does **not** depend on Playwright
  (`src/package.json:75-90`): an adopter gets client mode unless they install
  Playwright and its Chromium themselves.

### Build mode (`src/lib/config.ts:1013-1094`)

- Mermaid → inline themed `<svg>` at build via `@beoe/rehype-mermaid`, disk
  cached (`:1038-1052`, `BEOE_CACHE_DIR`). No client render script is injected
  (`:1019-1020`).
- PlantUML → `astro-plantuml` against `resolvePlantumlServerUrl()`
  (`:1064-1077`). Build mode only.

### Client mode (`src/lib/config.ts:1096-1117`)

- `diagramMeta` + `mermaidFenceTransform` (remark), `diagramFigure` (rehype),
  and one page-wide injected script (`diagram-render.client.ts`) that draws the
  SVG in the browser.
- PlantUML is not wired in client mode. A ```` ```plantuml ```` fence stays a
  code block. Confirmed in prose by `docs/architecture/diagrams.md:155-156`
  ("PlantUML has no client renderer").

## 3. PlantUML server configuration

- Env var, not a config option: `DK_PLANTUML_SERVER_URL`,
  `src/lib/config.ts:868-873`.
- Default when unset: `http://localhost:8091/svg/` (`:847`). The trailing
  `/svg/` is required (`:844-846`).
- `plantuml.com` is refused: `assertSelfHostedPlantuml` throws
  (`:850-858`).
- CI sets both vars: `.github/workflows/ci.yml:166-167`.

## 4. Mermaid metadata (what a minimal fence needs)

- `diagramMeta` reads an optional leading `%% key: value` block
  (`src/lib/remark/diagram-meta.ts:1-9`). A bare fence works; `%% title:` and
  `%% description:` add the accessible name and caption. Example:
  `example/docs/presentations/feature-tour.md:74-75`.
- The example site turns diagrams on: `example/astro.config.mjs:89-91`.

## 5. Docs convention and decisions

- `docs/context/convention.md:152-180`: required frontmatter
  `title/description/doc_status/updated`; touching a page bumps `updated`.
- ADR-0023 (render + metadata seam), ADR-0024 (tokens), ADR-0036 (figure
  ownership), ADR-0040 (dual mode, `docs/adr/0040-…:39-60`). ADR-0040 already
  records the decision; this mission documents it for adopters and needs no
  new ADR.
- `docs/architecture/diagrams.md` is the Explanation page; the new guide
  section links to it rather than repeating it.
- `docs/guides/consumer-setup.md` (`kind: How-To`, `updated: 2026-10-13`) has
  no mention of `diagrams` today. The optional features live in sections named
  `## Optional: …` (`:660`, Gherkin).

## 6. Gates touching the guide

- `pnpm validate:docs` → `validate-frontmatter.mjs docs` (`package.json:20`).
- `pnpm validate:links` → `check-links.mjs docs example/docs` (`:22`).
- `pnpm validate:catalog` → `validate-catalog.mjs docs example/docs` (`:26`).
- `pnpm lint` (`eslint src`) and `pnpm typecheck` cover the `config.ts`
  comment edit; `pnpm test` only if a hint is added.

## 7. The optional build-time hint

The hint would need a walk of the docs tree for fences when `diagrams` is off,
which today costs nothing (`:1978`, "ZERO diagram cost"). The documentation fix
removes the cause the issue names (an unexplained option and a misleading
comment). Recommendation for the spec: do not add the hint in this mission;
record it as a decision.

## 8. Sibling dispatches

- #154 (`src/styles/theme.css`, `src/lib/theme.ts`) and #114/#112
  (`src/lib/theme.ts`, sidebar): no overlap.
- Gherkin (#156, #123–#128, `src/lib/gherkin/**`) may add a paragraph to the
  Gherkin section of `consumer-setup.md`. This mission adds a separate
  `## Optional: Diagrams` section placed before `## Optional: Gherkin feature
  pages`, plus the frontmatter `updated` bump (a likely one-line conflict to
  resolve on rebase). The `config.ts` edit touches only the `diagrams` comment
  (`:151-159`), not the `gherkin` comment below it.

## 9. Motivating mistake

spec-kitty/spec-kitty-charter#28 is outside this session's repository scope.
Its content is summarised in #153: a config comment read "Diagrams render
client-side" next to `diagrams: false`.
