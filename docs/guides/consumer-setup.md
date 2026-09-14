---
title: Consumer setup — build a docsite from the published toolkit
description: The install → configure → theme → build path for a net-new adopter, using only the published @commondocs-kitty/toolkit surface.
doc_status: active
updated: 2026-09-09
type: Guide
kind: How-To
tags: [adoption, setup, consumer, theming, release]
authors:
  - stijn@sddevelopment.be
related:
  - guides/adopting
  - context/convention
---

# Consumer setup — build a docsite from the published toolkit

**Audience.** An engineer standing up a net-new documentation site who has
`@commondocs-kitty/toolkit` from the registry and wants to wire it exactly as an
external adopter would — through the package's published entry points only, with
no reach into the toolkit's own source tree. If you are migrating an *existing*
Common Docs `docs/` tree instead, start at [Adopting the toolkit](/guides/adopting/)
and return here for the configuration and theming detail.

Every step below references either a **published toolkit entry point**
(`@commondocs-kitty/toolkit/*`) or a **file you own** in your own project
(`src/…`, `astro.config.mjs`). No step points at `@commondocs-kitty/toolkit`
package internals or a repository-internal toolkit path — that constraint is the
reuse contract (SC-005) and is machine-checked by
`tests/consumption/scripts/assert-guide-no-internal-paths.mjs`.

> **This path is proven, not aspirational.** The consumption-test fixture builds
> this exact sequence from the *packed* tarball on every CI run: install →
> configure → theme → build, with a gate asserting no toolkit source is on the
> resolution path. Where this guide shows a file, the fixture ships the worked
> equivalent.

## Prerequisites

- Node ≥ 20 and pnpm (`corepack enable`).
- A project directory with a `docs/` tree that follows the
  [Common Docs — Kitty Variation](/context/convention/) (section folders, a
  `README.md` section index per folder, required frontmatter). An empty tree is
  fine — the site builds with whatever pages are present.

## 1. Install the toolkit and its peers

The toolkit declares Astro, Starlight, and the sitemap integration as peers, so
install them alongside it — pin the version you want to track:

```sh
pnpm add @commondocs-kitty/toolkit astro @astrojs/starlight @astrojs/sitemap
```

Pin a real release (for example `@commondocs-kitty/toolkit@0.1.0`) rather than a
floating range so your build is reproducible against a known published surface.

## 2. `astro.config.mjs` — wire the integrations

Compose the toolkit's Astro integrations through the published `/config` entry
point. `defineDocKittyIntegrations` returns the integration array Starlight and
the feed/agent-API generators need:

```js
// astro.config.mjs
import { defineConfig } from 'astro/config';
import { defineDocKittyIntegrations } from '@commondocs-kitty/toolkit/config';
import { myTheme } from './src/theme/index.ts'; // your consumer theme — see step 4

const SITE = 'https://you.example.com';
const BASE = '/docs'; // '' or '/' if you deploy at the domain root

export default defineConfig({
  site: SITE,
  base: BASE,
  integrations: defineDocKittyIntegrations({
    title: 'My Docs',
    description: 'What this documentation set is.',
    // MUST equal the site `base` above — the sitemap draft filter strips this
    // prefix to compare routes. The loader in step 3 must use the same value.
    base: BASE,
    theme: myTheme,
    markua: true,
    indexBasename: ['README', 'index'],
  }),
});
```

Two invariants to hold from the start:

- **`base` appears twice and must match** — once as Astro's `site`-level `base`,
  once inside `defineDocKittyIntegrations`. A based deployment (GitHub Pages, a
  sub-path) exercises the toolkit's base-prefix seam; a mismatch drifts the
  sitemap filter and feed URLs.
- **`indexBasename` is routing-authoritative** — the value you pass here must be
  the identical list you pass to the docs loader in step 3.

## 3. `src/content.config.ts` — register the collections

Register the `docs` collection Starlight expects, plus the two citation-catalog
data collections, from the published `/schema` entry point. Keep the loader
`base` equal to the integration `base` from step 2:

```ts
// src/content.config.ts
import { defineCollection } from 'astro:content';
import {
  docKittyDocsSchema,
  docKittyDocsLoader,
  docKittyBibliographySchema,
  docKittyBibliographyLoader,
  docKittyToolsSchema,
  docKittyToolsLoader,
} from '@commondocs-kitty/toolkit/schema';

export const collections = {
  docs: defineCollection({
    // `base` and `indexBasename` MUST match astro.config.mjs (config invariant).
    loader: docKittyDocsLoader({ base: 'docs', indexBasename: ['README', 'index'] }),
    schema: docKittyDocsSchema(),
  }),
  bibliography: defineCollection({
    loader: docKittyBibliographyLoader(),
    schema: docKittyBibliographySchema(),
  }),
  tools: defineCollection({
    loader: docKittyToolsLoader(),
    schema: docKittyToolsSchema(),
  }),
};
```

The loader `base: 'docs'` is the *content root* (where your `docs/` tree lives),
which is independent of the *URL* `base` (`/docs`) from step 2 — the former tells
the loader where to read files, the latter tells Astro where the site is served.

## 4. `src/pages/*` — add the route endpoints

The feeds and agent-API are Astro route endpoints you own, each delegating to a
published `/routes` factory. Add these files under `src/pages/`:

```ts
// src/pages/rss.xml.ts
import { rssRoute } from '@commondocs-kitty/toolkit/routes';
export const GET = rssRoute({ title: 'My Docs', description: 'Documentation updates.' });
```

```ts
// src/pages/llms.txt.ts
import { llmsTxtRoute } from '@commondocs-kitty/toolkit/routes';
export const GET = llmsTxtRoute({ title: 'My Docs', description: 'What this documentation set is.' });
```

```ts
// src/pages/api/index.json.ts
import { agentIndexRoute } from '@commondocs-kitty/toolkit/routes';
export const GET = agentIndexRoute({ title: 'My Docs' });
```

```ts
// src/pages/api/bibliography.json.ts
import { bibliographyRoute } from '@commondocs-kitty/toolkit/routes';
export const GET = bibliographyRoute();
```

If you publish reveal.js slide decks (`kind: Presentation` pages under
`presentations/`), add the out-of-frame deck route. It wires the deck layout and
slug helper from their published entry points:

```astro
---
// src/pages/presentations/[...slug].astro
import { getCollection } from 'astro:content';
import type { CollectionEntry } from 'astro:content';
import DeckLayout from '@commondocs-kitty/toolkit/layouts/DeckLayout.astro';
import { deckRouteParams } from '@commondocs-kitty/toolkit/deck/deck-slug';

export const prerender = true;

export async function getStaticPaths() {
  const decks = (await getCollection('docs')).filter(
    (entry) => entry.data.kind === 'Presentation' && entry.id.startsWith('presentations/'),
  );
  return decks.map((entry) => ({ params: deckRouteParams(entry), props: { entry } }));
}

interface Props { entry: CollectionEntry<'docs'>; }
const { entry } = Astro.props as Props;
---

<DeckLayout entry={entry} />
```

The route yields nothing until you author a deck, so wiring it early costs
nothing and proves the deck exports resolve.

## 5. A consumer theme — refine `--dk-*`, never `--sl-*`

A consumer theme is a **declarative data record**: it `extends` a brand (or the
shipped default) and shallow-overrides a subset of `--dk-*` tokens the toolkit
folds over the brand, then over the default. There are exactly two placements,
and which one a value takes is decided by whether it varies between light and
dark mode.

**Mode-invariant values** (a font family, a radius, a tracking value that is the
same in both modes) go in the object `tokens` map. The object form is
mandatory here: a string css-path token form would be imported at the *top* of
the generated sheet and then overridden by the later generated `:root`,
inverting consumer precedence.

```ts
// src/theme/index.ts
import { specKittyTheme } from '@commondocs-kitty/toolkit/themes/spec-kitty/index.ts';
import type { DocKittyOptions } from '@commondocs-kitty/toolkit/config';

// `DocKittyTheme` is named via the one published surface that carries it — the
// `theme` option of `defineDocKittyIntegrations` — so the theme stays on the
// package's public exports only.
type DocKittyTheme = NonNullable<DocKittyOptions['theme']>;

export const myTheme: DocKittyTheme = {
  name: 'press',
  extends: specKittyTheme, // or omit `extends` to layer straight over the default
  tokens: {
    '--dk-font-display':
      '"Iowan Old Style", "Palatino Linotype", Palatino, "Book Antiqua", Georgia, ui-serif, serif',
    '--dk-radius-md': '0.125rem',
    '--dk-tracking-caps': '0.2em',
  },
  customCss: ['./src/theme/press.css'],
};

export default myTheme;
```

**Mode-varying colour** (surfaces, heading ink, and any accent group the brand
restates per mode) cannot live in the object map — one value per key would
re-emit the light value in dark. It ships in a `customCss` sheet you own, under
**both** `:root` and `:root[data-theme='dark']`:

```css
/* src/theme/press.css */
:root {
  --dk-color-surface-1: #faf7f0;
  --dk-color-text-strong: #1a1410;
  --dk-color-accent: #a6231f;
  --dk-color-accent-text: #ffffff;
}
:root[data-theme='dark'] {
  --dk-color-surface-1: #232019;
  --dk-color-text-strong: #f4efe6;
  --dk-color-accent: #a6231f;
  --dk-color-accent-text: #ffffff;
}
```

Both blocks are mandatory: the toolkit layers your sheet after its generated
token sheet, so a bare `:root` override wins in light by source order — but the
generated sheet re-declares every mode-varying key under its own
`:root[data-theme='dark']` block (specificity `0,2,0`), which out-ranks a bare
`:root` in dark regardless of load order. Matching that selector is what makes
your value win in both modes.

**Never set a `--sl-*` key.** A theme addresses `--dk-*` tokens only; the
`--dk-*` → `--sl-*` bridge is toolkit-owned, and the theme merge rejects a
`--sl-*` key. A distinct set of at least five `--dk-*` overrides is what proves
the consumer layer actually won the cascade in the built output.

## 6. Build

```sh
astro build
```

`dist/` then contains the rendered site plus `sitemap*.xml`, `rss.xml`,
`llms.txt`, and the `api/*.json` agent-API. Deploy `dist/` to any static host;
a based deployment (a sub-path) is covered by the `base` you set in step 2.

## 7. Govern your docs — the documentation charter

Everything above renders and validates a *default* docsite. To change what
governs your tree — the vocabulary, the sections, the status set, the required
fields — author a single optional file, `docs/_meta/charter.yaml`. It is the one
authoritative surface; an absent or empty charter resolves to the shipped
defaults with no error, and it needs no Spec Kitty runtime to resolve
([ADR-0042](/adr/0042-native-documentation-charter/)). Each axis is independent —
declare only the ones you want to change.

```yaml
# docs/_meta/charter.yaml
version: 1
vocabulary:
  types:
    aliases:   { Feature: Capability }
    forbidden: [ Feature ]
statuses:
  add: [ deprecated ]
required_fields:
  optional: [ updated ]
sections:
  index_basename: README
  order: [ context, architecture, adr, guides ]
```

The governable dimensions:

- **Vocabulary — `type` / `kind`** (*overridable*). Alias, forbid, or pass
  through terms over the canonical sets. A forbidden authored `type` hard-fails
  the gate; an unknown-but-not-forbidden value warns.

  ```yaml
  vocabulary:
    types: { forbidden: [ Feature ], aliases: { Feature: Capability } }
    kinds: { aliases: {}, forbidden: [] }
  ```

- **Sections / information architecture — `sections`** (*overridable*). Order,
  labels, entries, the section-index basename, and sub-path `subtypes` — the same
  shape as the legacy `_meta/sections.yaml`.

  ```yaml
  sections:
    index_basename: README            # or "index"
    order: [ context, architecture, adr, guides ]
    entries:
      - { id: context, label: Context, type: Context, purpose: "Why we exist", feeds: [rss] }
  ```

- **Statuses — `statuses.add`** (*overridable, extend-only*). You may **add**
  values to `doc_status`; the canonical set (`draft`, `active`, `deprecated`,
  `superseded`, `durable`) is reserved. Removing or aliasing-away a canonical
  status fails closed. An unknown-and-not-added status on a page warns.

  ```yaml
  statuses:
    add: [ archived ]
  ```

- **Required-field floor — `required_fields.optional`** (*overridable, with a
  floor*). Relax listed required fields for your consumer — **except `title`**,
  which is always required. Listing `title` fails closed with a floor message.

  ```yaml
  required_fields:
    optional: [ updated ]
  ```

A malformed charter fails the build naming the file and offending key; an unknown
*top-level* key only warns. If you already run a legacy `_meta/vocabulary.yaml`
or `_meta/sections.yaml`, both keep working (you will see one deprecation notice)
— consolidate them with [Migrating to the charter](/guides/migrating-to-charter/).

## Caveat — `check-links` strict mode does not cover your tree

The toolkit's `check-links` script applies its fail-closed *strict* tightening
(rejecting `.md`-relative and bare-relative links that 404 in a based
deployment) **only** to the toolkit's own base-prefixed built tree — its
`SITE_ROOTS` is `example/docs`. It does **not** run in strict mode against a
consumer project's own `docs/` tree.

Do not assume you inherit strict-check parity by installing the toolkit. If you
want the same guarantee for your own tree, use root-absolute routes
(`/section/page/`) rather than `.md`-relative links in your Markdown, and run
your own link check in strict mode as part of your pipeline.

## What you referenced

Every entry point above is part of the toolkit's published surface:

| What | Published entry point |
|---|---|
| Integration array | `@commondocs-kitty/toolkit/config` |
| Collection schemas + loaders | `@commondocs-kitty/toolkit/schema` |
| Feed / agent-API route factories | `@commondocs-kitty/toolkit/routes` |
| Deck layout + slug helper | `@commondocs-kitty/toolkit/layouts/…`, `@commondocs-kitty/toolkit/deck/…` |
| Brand theme to extend | `@commondocs-kitty/toolkit/themes/…` |

Everything else (`astro.config.mjs`, `src/content.config.ts`, `src/pages/**`,
`src/theme/**`, your `docs/` tree) is a file you own. Nothing reaches into the
toolkit's package internals or a repository-internal toolkit path — which is the
whole point.
