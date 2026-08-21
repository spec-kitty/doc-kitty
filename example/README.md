# Doc Kitty — Example Site

A minimal, deployable docsite built with
[`@commondocs-kitty/toolkit`](../src). Use it as the starting point for your own
documentation, or just to see the [convention](../docs/conventions) in action.

## Installation

### In this monorepo

```sh
corepack enable          # provides pnpm
pnpm install             # installs the workspace (toolkit is linked)
pnpm --filter example dev
```

### As a standalone docs repo

1. Copy the contents of this `example/` directory to your new repo's root.
2. Depend on the toolkit — either publish/install it:

   ```sh
   pnpm add -D @commondocs-kitty/toolkit
   ```

   or vendor `src/` from this repo as a local workspace package.
3. Edit `astro.config.mjs`: set `site`, `base`, `title`, and the GitHub links
   (search for `OWNER`).
4. Replace `docs/**` with your own Common Docs — Kitty tree (or run the
   `scaffold.mjs` script to generate the empty structure), following the
   [convention](../docs).

## Commands

| Command            | What it does                                                        |
| ------------------ | ------------------------------------------------------------------- |
| `pnpm dev`         | Local dev server with hot reload.                                   |
| `pnpm build`       | Static build to `dist/` — site + `sitemap.xml` + `rss.xml` + `llms.txt` + `/api/*.json`. |
| `pnpm preview`     | Serve the built `dist/` locally.                                    |
| `pnpm validate`    | Validate `src/content/docs` frontmatter against the convention.     |

## Layout

```
example/
├── astro.config.mjs          # wires in the toolkit preset (site/base here)
├── docs/**                   # your Common Docs — Kitty tree (README = section index)
├── src/
│   ├── content.config.ts      # docs collection: toolkit loader (base: docs) + schema
│   └── pages/
│       ├── rss.xml.ts         # -> rssRoute
│       ├── llms.txt.ts        # -> llmsTxtRoute
│       └── api/
│           ├── index.json.ts          # -> agentIndexRoute
│           └── pages/[...slug].json.ts # -> agentPageRoute
└── public/                    # static assets
```

## Deployment

This site deploys to GitHub Pages via
[`.github/workflows/deploy.yml`](../.github/workflows/deploy.yml). Set your
`site`/`base` in `astro.config.mjs`, enable **Pages → GitHub Actions** in repo
settings, and push. See
[Deploy to GitHub Pages](./src/content/docs/how-to/deploy-to-github-pages.md).
