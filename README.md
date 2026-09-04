# Doc Kitty 🐱📚

**Common Docs — Kitty Variation**: a reusable [Astro](https://astro.build) +
[Starlight](https://starlight.astro.build) scaffold for **human-first,
agent-supported** documentation sites.

Point it at a documentation tree that follows the convention and you get a
docsite plus, out of the box:

- 🗺️ `sitemap.xml` — standard search-engine discovery
- 📰 `rss.xml` — subscribe to documentation changes
- 🤖 `llms.txt` + a JSON **agent-API** — optimized browsing/discovery for LLM
  agents (not a RAG index; a structured, crawlable map of the docs)

The toolchain is live: `pnpm build`, `pnpm test`, and `pnpm validate` all run,
and CI exercises build, test, frontmatter validation, and accessibility checks
on every change. The design and the convention spec — captured across 30+
architecture decision records — live in [`docs/`](./docs).

## What's in here

This repository is both the **toolkit** and its own **worked example**.

| Path            | What it is                                                                                     |
| --------------- | ---------------------------------------------------------------------------------------------- |
| [`src/`](./src)         | The **toolkit** (`@commondocs-kitty/toolkit`) — a library you install or copy into a docs repo. Exports the Starlight config preset, the metadata schema + README-as-index loader, the `rss` / `llms.txt` / agent-index route handlers, and builder scripts + tests. |
| [`example/`](./example) | A **minimal docsite** that consumes the toolkit and deploys to GitHub Pages. Start here to see the convention in practice; its README has installation instructions. |
| [`docs/`](./docs)       | Documentation **about the toolkit itself**, written in the convention it describes — see [the spec](./docs/context/convention.md). (Not the deliverable docsite.) |
| [`agents/`](./agents)   | Minimal **agent skills** (scaffold / write / find / convert), mirroring and extending the Common Docs skills. To be recast as Spec Kitty charter/doctrine later. |
| [`.github/`](./.github) | CI: build + test + frontmatter validation + accessibility checks, and a Pages deploy for the example. |

## The convention, in one breath

Documentation is a repo-root `docs/` tree following the twelve-section **Common
Docs** convention, with two Kitty twists: **`README.md` is the section index**
(instead of `index.md`) and **carries frontmatter**, and metadata is
first-class — it drives navigation, the RSS feed, and the agent-API. See
[`docs/context/convention.md`](./docs/context/convention.md) for the full spec.

## Quickstart

```sh
corepack enable
pnpm install
pnpm dev        # runs the example docsite
pnpm build      # builds example/ -> static site + sitemap + rss + agent-API
pnpm test       # toolkit unit tests
pnpm validate   # check docs frontmatter against the convention
pnpm clean      # clear ALL build caches before a from-scratch build (see note below)
```

> [!NOTE]
> Astro's content layer persists a render cache at
> `example/node_modules/.astro/` (and Vite pre-bundles some deps under
> `example/node_modules/.vite/`) — both survive `rm -rf example/.astro
> example/dist`, since they live under `node_modules/`. If a page's rendered
> output looks stale after editing the toolkit (`src/`) while a content file
> itself didn't change, run `pnpm clean` (not just a `dist`/`.astro` wipe)
> before rebuilding. A fresh `pnpm install` (CI, a new clone) never hits this —
> only a long-lived local checkout can.

## License

Undecided (public vs. private TBD). Currently marked `UNLICENSED`; no license
file is included yet.
