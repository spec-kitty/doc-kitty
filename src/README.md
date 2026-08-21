# `@commondocs-kitty/toolkit`

The reusable core of Doc Kitty. A **library** (not a runnable site) that a docs
repository installs or copies in. See the runnable
[`../example`](../example) for how it's wired together, and
[`../docs/architecture`](../docs/architecture) for how it works.

> **Structure-first scaffold.** The files here define the intended API surface
> and are annotated where they depend on exact Astro/Starlight versions to be
> verified when the build toolchain is wired up. Nothing here has been built or
> installed yet.

## Layout

```
src/
├── index.ts                 # barrel: re-exports the public API
├── lib/
│   ├── config.ts            # defineDocKittyConfig() — Starlight preset
│   ├── schema.ts            # docKittyDocsSchema + README-as-index loader
│   ├── metadata.ts          # shared types + metadata helpers
│   └── routes/
│       ├── index.ts
│       ├── rss.ts           # rssRoute        -> rss.xml
│       ├── llms-txt.ts      # llmsTxtRoute    -> llms.txt
│       ├── agent-index.ts   # agentIndexRoute -> /api/index.json
│       └── agent-page.ts    # agentPageRoute  -> /api/<slug>.json
├── scripts/
│   ├── scaffold.mjs             # emit the 12-section Common Docs — Kitty tree
│   ├── validate-frontmatter.mjs # CI gate: validate a docs/ tree
│   └── new-doc.mjs              # scaffold one page with correct frontmatter
└── tests/
    ├── metadata.test.ts
    └── agent-api.test.ts
```

## Public API

| Export                         | From                | Purpose                                   |
| ------------------------------ | ------------------- | ----------------------------------------- |
| `defineDocKittyConfig(opts)`   | `./config`          | Starlight config preset.                  |
| `docKittyDocsSchema`           | `./schema`          | zod schema for page frontmatter.          |
| `docKittyDocsLoader(opts)`     | `./schema`          | Content loader with README-as-index.      |
| `rssRoute`, `llmsTxtRoute`, `agentIndexRoute`, `agentPageRoute` | `./routes` | Astro endpoint handlers. |

## Tests

```sh
pnpm --filter @commondocs-kitty/toolkit test
```
