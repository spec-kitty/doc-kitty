# Findings D — Contextive glossaries, glossary auto-linking, PlantUML & Mermaid in Astro/Starlight

Research date: 2026-08-21. Target: an Astro + Starlight documentation toolkit ("doc-kitty"). This is a findings document — no implementation.

Note on version/date sensitivity: the Astro/Starlight/rehype ecosystem moves fast. Everything below reflects the state as of August 2026. Pin exact versions in the spec and re-verify the Playwright/mermaid interplay at implementation time, since that is the most fragile moving part.

## Top takeaways

- **Contextive is a viable glossary source.** Its `.contextive/definitions.yaml` is plain YAML with a clear, small schema (`contexts[] → terms[] → {name, definition, aliases, examples, meta}`). It is trivial to parse with any YAML library and re-render as Starlight glossary pages. There is **no official CLI/library** to reuse for rendering — doc-kitty would own a small parser + generator. This is a feature, not a blocker: the format is stable and simple.
- **Reuse the Contextive schema directly** as doc-kitty's glossary source of truth. It gives us DDD bounded-context grouping, aliases, examples, and free-form `meta` for free, plus editors get IntelliSense/hover from the Contextive extension while authoring — the same file feeds both the IDE and the docsite.
- **Glossary auto-linking**: the mature pattern is a **remark plugin that wraps the first occurrence of each term/alias per node in a link** to a generated glossary anchor, optionally enhanced with a hover tooltip via a small client component. Existing plugins (`@truepic/remark-automatic-glossary-markup`, `@renatonagliati/remark-auto-glossary`) prove the mechanism but are Docusaurus-flavoured / minimal — expect to write a thin Starlight-native remark plugin fed by the parsed Contextive terms.
- **PlantUML**: use `astro-plantuml` (remark, build-time). Default is server-rendered SVG via plantuml.com; for privacy/offline builds run a **local PlantUML server (Docker/JAR)** and point `serverUrl` at it, or use its local-file cache mode. No client JS. This is the recommended approach.
- **Mermaid**: use **`@beoe/rehype-mermaid`** (the package Starlight sites already use) for **build-time static SVG** with dark-mode theming and a **disk cache** so the headless browser isn't relaunched per build. It needs Playwright/Chromium at build time. If the build/deploy environment can't run Playwright, fall back to the client-side `astro-mermaid` integration.
- **Consistent story**: both diagram types can be authored as fenced code blocks (```plantuml / ```mermaid) and rendered to static SVG at build time — no runtime JS required for either, which fits a docs toolkit that wants fast, JS-light pages.

---

## Topic 1 — Contextive (.contextive glossaries)

### What it is
Contextive is "a suite of tools to immerse developers in the language of their users' domains" — an implementation of the DDD *Ubiquitous Language* concept. Teams keep a glossary file in the repo; editor extensions surface term definitions and usage examples via autocomplete and hover panels across code, comments, config, and docs. There is a Community (open-source) edition and a Cloud edition (private beta as of 2026).

### File format & schema
- **Format**: YAML. **Default location**: `.contextive/definitions.yaml` in the repo. The project publishes a JSON schema so schema-aware editors give IntelliSense/validation while editing (referenced in the docs; see GitHub issue #74 "Schema for definitions.yml file").
- **Top-level structure**: a `contexts` list. Each context is a bounded context and holds a `terms` list. This maps cleanly to DDD bounded contexts and lets the same term differ between contexts.

Context-level fields:
- `name` (required) — context identifier
- `domainVisionStatement` (optional) — high-level domain description
- `meta` (optional) — arbitrary key/value pairs (markdown + emoji supported)
- `terms` (list)

Term-level fields:
- `name` (required) — supports natural-language phrases ("Leg Magnitude Policy") as well as camelCase/PascalCase/snake_case/kebab-case; natural phrase is the recommended pattern
- `definition` (optional) — markdown; multi-line YAML (`|`, `>`) supported
- `examples` (optional) — list of real-world usage sentences
- `aliases` (optional) — list of alternative names/acronyms used interchangeably
- `meta` (optional) — arbitrary key/value shown under the definition (markdown + emoji)

Only `name` is strictly required.

### Example
```yaml
contexts:
  - name: Cargo
    domainVisionStatement: Manage routing of cargo through transportation legs
    meta:
      "👥 Owner": "[Team A](https://wiki.example/teams/TeamA)"
    terms:
      - name: Cargo
        definition: A unit requiring movement to a delivery location
        examples:
          - Multiple customers handle a single cargo
        aliases:
          - unit
        meta:
          "🌐 Reference": "[Wiki](https://wiki.example/cargo)"
          "✅": Approved
      - name: Leg Magnitude Policy
        definition: Policy selecting legs based on lowest magnitude
        examples:
          - Engine selects fastest leg instead of cheapest
```

### How it is consumed
- Official editor support: **VS Code, IntelliJ IDEs (limited Rider), Visual Studio 2019/2022, Neovim, Helix**, and any editor that speaks **LSP** (Contextive ships a language server). The extensions provide hover definitions and autocomplete keyed off the terms/aliases.
- Consumption is editor-driven via the language server; the definitions file is the single source.

### KEY QUESTION — Can `.contextive/definitions.yaml` be the SOURCE for docsite glossary generation?
**Yes, cleanly.** The file is plain YAML with a small, stable schema, so:
- **Parsing**: any YAML parser (e.g. `yaml` / `js-yaml` in Node, already available in the Astro toolchain) reads it into `{ contexts: [{ name, terms: [{ name, definition, aliases, examples, meta }] }] }`. Trivial.
- **Rendering glossary pages**: iterate contexts → terms and emit a Starlight page (or one page per context, or a single glossary with per-context sections). Each term becomes a heading + rendered markdown definition + examples + meta, with a stable anchor id derived from the term name (e.g. `#glossary-leg-magnitude-policy`). `definition`/`meta` are markdown, so run them through the same markdown pipeline.
- **Auto-linking term occurrences**: build a lookup of `name` + `aliases` → anchor, and feed it to a remark plugin (see Topic 2) so prose auto-links to the definition. Aliases are first-class in the schema, which is exactly what auto-linking needs.
- **Bounded-context awareness**: because terms are grouped by context, doc-kitty can disambiguate same-named terms per context, or scope auto-linking to a context per docs section.

**Existing tooling to reuse**: essentially none for the *docsite generation* side. Contextive's own tooling is editor/LSP-focused (autocomplete + hover), not a static-site generator, and there is no published CLI that emits HTML/markdown glossary pages. doc-kitty would own ~a small parser + page generator + remark linker. Upside: the schema is simple and the file also keeps working as the IDE glossary, so authors edit one file and get both IDE hover and docsite pages.

### Recommended approach for doc-kitty
Adopt the Contextive `definitions.yaml` schema as doc-kitty's canonical glossary source. Add:
1. a loader that parses the YAML (validate against the Contextive JSON schema if we want authoring guardrails),
2. a generator that produces Starlight glossary page(s) with deterministic anchors, and
3. a remark auto-link plugin fed by the term/alias→anchor map (Topic 2).
Keep the file at the conventional `.contextive/definitions.yaml` so the Contextive editor extensions light up for authors for free.

### Effort & risks
- **Effort**: Low–Medium. YAML parse + page emit is small; the remark linker is the bulk of the work.
- **Risks**: (a) schema drift — pin to the schema version we target and validate on load; (b) same-name terms across contexts need a disambiguation policy for anchors and links; (c) markdown-in-YAML (`definition`, `meta`) must go through the real markdown renderer, not be treated as plain text; (d) Cloud edition is private beta — rely only on the open Community file format, not Cloud APIs.

### Sources
- https://contextive.tech/
- https://docs.contextive.tech/community/guides/defining-terminology/
- https://docs.contextive.tech/community/changelog/
- https://github.com/dev-cycles/contextive
- https://github.com/dev-cycles/contextive/issues/74 (JSON schema for definitions file)

---

## Topic 2 — Glossary auto-linking in Astro/Starlight

### What it is
The pattern: given a glossary of terms (and aliases), automatically turn occurrences of those terms in page prose into links to the definition (a glossary page anchor), often with a hover tooltip showing the definition inline. This is implemented as a **remark plugin** operating on the markdown AST (mdast) before HTML is produced.

### How it works — mechanism
A remark plugin walks text nodes and, for each glossary term/alias found, replaces the first matching occurrence with a link node pointing at the term's anchor. Key design points learned from existing plugins:
- Terms come from a config array (JSON) or an external file (YAML) passed to the plugin.
- Links are typically added **only to the first occurrence per paragraph/list-item** (and headings skipped) to avoid a wall of links.
- The link target is a hash anchor like `#glossary-<term>` (URL-encoded); a small client script or component listens for those links to render a tooltip/popover, or they simply navigate to a glossary page anchor.

### Viable mechanisms (2–3)

1. **remark auto-link plugin fed by parsed glossary (recommended)**
   - Write a thin Starlight-integrated remark plugin (or adapt `@truepic/remark-automatic-glossary-markup`) that receives the term/alias→anchor map produced from the Contextive file (Topic 1). Wraps first occurrences in links to `/glossary/#<anchor>`.
   - *Pros*: build-time, no runtime cost for the link itself; single source of truth; alias-aware; full control over anchor scheme and first-occurrence policy; integrates with Starlight via the standard "remark plugin inside a Starlight plugin" pattern (HiDeoo's guide).
   - *Cons*: we own the code; tooltip (hover preview) needs a small extra client component if we want more than a plain link.

2. **Existing off-the-shelf remark plugins**
   - `@truepic/remark-automatic-glossary-markup` — JSON term array, wraps first occurrence, links to `#glossary-[TERM]`, you supply the tooltip/popup handler. Framework-agnostic remark, so it works in Astro's `markdown.remarkPlugins`.
   - `@renatonagliati/remark-auto-glossary` — tooltips + glossary list from a **YAML** glossary file, but **Docusaurus-focused**; the tooltip rendering assumes Docusaurus components, so only the AST-walking logic transfers cleanly to Starlight.
   - *Pros*: proven mechanism, minimal code. *Cons*: Docusaurus coupling or minimal feature set; neither is Contextive-aware, so we still adapt the input side.

3. **Component/directive-based manual linking (`<Term>` or `:term[...]`)**
   - Provide an MDX component or a remark directive so authors explicitly mark terms (`<Term name="Cargo">cargo</Term>`) that resolve to the glossary + tooltip.
   - *Pros*: explicit, no false positives, easy tooltip via a Starlight/Astro component; great for high-value terms. *Cons*: manual — defeats "automatic" linking; only worth it as a complement to mechanism 1 for cases where auto-detection is wrong.

### Recommended approach for doc-kitty
Mechanism 1: a small Starlight-native remark plugin, fed by the Contextive-derived term/alias map, that first-occurrence-links prose to generated glossary anchors. Layer an optional lightweight tooltip (CSS/`<details>` or a tiny island component) that reads the definition. Optionally expose mechanism 3's `<Term>` component as an escape hatch for explicit control and to suppress false positives.

### Effort & risks
- **Effort**: Medium — the plugin plus anchor generation and tooltip.
- **Risks**: (a) false positives (a term matching a common English word) — need case-sensitivity/word-boundary rules and an ignore list; (b) not linking inside code, headings, or existing links; (c) performance on large docs (walk once, precompiled matcher); (d) tooltip hover needs a client component, adding a little JS if we want previews rather than plain jump-links; (e) alias collisions across bounded contexts.

### Sources
- https://github.com/TRUEPIC/remark-automatic-glossary-markup
- https://github.com/renatonagliati/remark-auto-glossary
- https://github.com/mcclowes/docusaurus-plugin-glossary
- https://hideoo.dev/notes/starlight-plugin-use-remark-rehype-plugin/
- https://starlight.astro.build/reference/plugins/
- https://starlight.astro.build/resources/plugins/

---

## Topic 3 — PlantUML in Astro/Starlight

### What it is
Rendering PlantUML diagrams written as fenced ```plantuml code blocks in markdown into images during the Astro build. PlantUML (unlike Mermaid) is not a browser-native JS renderer — the canonical renderer is a Java engine, usually reached via a PlantUML server that returns SVG/PNG for an encoded diagram.

### How it works — options
- **`astro-plantuml`** (recommended) — a **remark** plugin that converts ```plantuml blocks to images at build time. It runs before Shiki so there are no syntax-highlight language warnings. Two workflows:
  1. **Server mode (default)**: diagrams generated on demand from a PlantUML server during build. Default server is `https://www.plantuml.com/plantuml/svg/`.
  2. **Local-file mode**: pre-generate during dev, cache the files, and use the cached files in production (`diagramsPath`).
  - Config: `serverUrl`, `format` (SVG/PNG), `diagramsPath` (cache), `timeout`, `addWrapperClasses`, `language`. Install via `npx astro add astro-plantuml`. Output is a static image — **no client JS**.
- **`remark-local-plantuml`** — remark plugin that renders PlantUML **locally** and embeds **inline `<svg>`** nodes (better text selection/styling than `<img>` + data URL). Good when you want fully local, inline SVG and are willing to provide the local rendering toolchain.
- **Self-hosted PlantUML server** — run `docker run -d -p 8080:8080 plantuml/plantuml-server:jetty` (or the JAR) and point `astro-plantuml`'s `serverUrl` at it. Keeps diagram source private and makes builds reproducible/offline.

### Comparison with Mermaid handling
- Mermaid has a JS renderer, so it can be done client-side or build-time-via-headless-browser (Topic 4). PlantUML has no JS renderer, so build-time rendering means calling a server/JAR — but the payoff is the same: **static SVG, no client JS**.
- Both fit the same authoring model (fenced code block → static SVG at build), so doc-kitty can present a uniform "diagrams as code blocks" experience.

### Recommended approach for doc-kitty (build-time static, no client JS)
Use **`astro-plantuml`** in **SVG** mode. For privacy and reproducible/offline builds, default to a **self-hosted PlantUML server** (Docker in CI, or a JAR) via `serverUrl`, and/or use `diagramsPath` local caching so production builds don't hit the public server. Avoid the public plantuml.com endpoint for anything non-public, since server mode uploads the (encoded) diagram source to that host. Ensure the plugin runs before Shiki (it does by design).

### Effort & risks
- **Effort**: Low to wire up; Medium if we ship/manage a bundled local server or JAR for offline builds.
- **Risks**: (a) **privacy** — default server mode sends diagram source to plantuml.com; mitigate with self-host or local mode; (b) build-time network dependency/timeout when using a remote server (use cache or local server); (c) Java/Docker dependency for local rendering in CI; (d) version-compatibility note — `astro-plantuml` advertises Astro 7+ with the newer processor plus legacy pipelines, so pin and verify against our Astro/Starlight version; (e) SVG theming/dark-mode needs CSS work (PlantUML SVGs aren't theme-aware by default).

### Sources
- https://github.com/joesaby/astro-plantuml
- https://www.npmjs.com/package/astro-plantuml
- https://astro-starlight-plantuml-demo.netlify.app/ (Starlight demo)
- https://github.com/mstroppel/remark-local-plantuml
- https://www.chartquery.com/p/diagram-engines/astro/plantuml
- https://dteather.com/blogs/astro-uml-diagrams/

---

## Topic 4 — Mermaid in Astro/Starlight

### What it is
Rendering ```mermaid fenced blocks. Two families: **build-time static SVG** (rehype plugins + headless browser) and **client-side** (ship the `mermaid` package, render on page load).

### How it works — current best practice
- **`@beoe/rehype-mermaid`** (recommended for build-time) — a rehype plugin that replaces mermaid code fences with generated SVG at build time. It is based on `mermaid-isomorphic` (same core as the upstream `rehype-mermaid`) and adds features that matter for docs: **selector-based dark mode**, out-of-the-box **pan/zoom** compatibility, and — crucially — a **disk cache** so the headless browser isn't permanently relaunched during the build. It is the package **Starlight sites already use**, and there are Starlight setups layering color-agnostic SVG rewriting (CSS-variable theming, cluster-title pills) on top of it.
- **Upstream `rehype-mermaid`** (remcohaszing) — same idea, renders to static SVG at build time; **requires Playwright/Chromium** (as of Astro 5.5 the Playwright Chromium dependency is needed). Heavier build dep, no cache — `@beoe`'s fork exists mainly to fix that.
- **`astro-mermaid`** (client-side alternative) — an Astro integration that renders mermaid in the browser on page load. Must be placed **before Starlight** in the `integrations` array. Simpler, **builds anywhere** (no Playwright), fast enough for docs, but adds runtime JS and renders client-side.
- Expressive Code (Starlight's code-block renderer) does its own highlighting and doesn't use Astro's Shiki instance, so it **coexists** with these mermaid approaches — mermaid blocks are handled by the rehype/integration path, not by Expressive Code.

### Does it render at build time to SVG?
- `@beoe/rehype-mermaid` and upstream `rehype-mermaid`: **yes** — static SVG emitted at build (needs Playwright/Chromium at build time; `@beoe` caches results to disk).
- `astro-mermaid`: **no** — client-side render on page load.

### Recommended approach for doc-kitty (build-time static, no client JS)
Use **`@beoe/rehype-mermaid`** for build-time static SVG with its cache enabled and selector-based dark mode wired to Starlight's theme. Accept the **Playwright/Chromium build dependency** (install the browser in CI). Provide a documented **fallback to `astro-mermaid`** (client-side) for environments that cannot run Playwright (e.g. some serverless deploy targets like Vercel where system packages can't be installed). This mirrors the PlantUML story (build-time static SVG, no runtime JS) for a consistent diagrams-as-code experience.

### Effort & risks
- **Effort**: Low–Medium — plugin wiring is small; the friction is the Playwright/Chromium install in CI and theme/dark-mode CSS.
- **Risks**: (a) **Playwright/Chromium** is a heavy build dependency and blocks some deploy targets — cache mitigates rebuild cost but not the install requirement; (b) dark-mode/theming needs the selector-based approach or SVG rewriting; (c) build time grows with many diagrams (cache helps a lot); (d) keep `@beoe/rehype-mermaid` and mermaid versions pinned — this area churns.

### Sources
- https://www.npmjs.com/package/@beoe/rehype-mermaid
- https://beoe.stereobooster.com/diagrams/mermaid/
- https://github.com/withastro/starlight/discussions/1259 (Mermaid support out of the box)
- https://www.npmjs.com/package/astro-mermaid
- https://vivekkalyan.com/writing/astro-mermaid/
- https://sourcier.uk/blog/mermaid-diagrams-astro/
- https://dteather.com/blogs/astro-rehype-mermaid-cli/
- https://rikuka.dev/blog/astro-mermaid-rendering
