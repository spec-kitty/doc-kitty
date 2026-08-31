---
title: Common Docs — Kitty Variation
description: The documentation convention Doc Kitty implements — base convention, Kitty twists, and enhancements.
doc_status: active
updated: 2026-08-21
type: Context
kind: Reference
tags: [convention, spec, metadata, okf]
authors:
  - stijn@sddevelopment.be
sources:
  - resource: https://github.com/velvet-tiger/common-docs
    title: Common Docs specification v1.2
  - resource: https://github.com/GoogleCloudPlatform/knowledge-catalog/blob/main/okf/SPEC.md
    title: Open Knowledge Format (OKF) v0.2
---

# Common Docs — Kitty Variation

The convention Doc Kitty renders. It is the **Common Docs** convention
([velvet-tiger/common-docs](https://github.com/velvet-tiger/common-docs), spec
v1.2 — a valid [OKF v0.2](https://github.com/GoogleCloudPlatform/knowledge-catalog/blob/main/okf/SPEC.md)
bundle) with a small set of deliberate twists and enhancements.

> This document is the source of truth for the toolkit's schema and generators.
> It will later be recast as a Spec Kitty **charter/doctrine**; for now it
> captures the base convention faithfully and layers our variation on top.

## 1. Base convention (unchanged)

The parts of Common Docs the Kitty Variation keeps exactly:

- **A fixed, ordered `docs/` tree** of twelve sections, arranged for
  progressive disclosure (context → operations):

  ```text
  docs/
  ├── context/          # Why we exist, who we serve, domain vocabulary
  ├── architecture/     # Current system design (present tense)
  ├── adr/              # Architecture Decision Records (immutable log)
  ├── plans/            # Future work: roadmap, epics, features
  ├── api/              # API reference
  ├── configuration/    # Env vars, flags, secrets (reference only)
  ├── integrations/     # Per third-party system
  ├── security/         # Threat model, auth, data handling
  ├── guides/           # How-to for humans and agents
  ├── operations/       # Monitoring, runbooks, disaster recovery
  ├── migrations/       # DB / data migration log
  └── changelog/        # Release history
  ```

- **`kebab-case`, lowercase filenames** (no spaces; underscores only in ADR /
  migration numeric prefixes).
- **One concern per file**; split files over ~300 lines.
- **Plans describe the future. ADRs record the past. Architecture describes the
  present.** Never conflate them.
- **ADRs are immutable** once accepted — supersede, never edit. Numbered
  sequentially `NNNN-short-title.md`, never reused.
- **`docs/` is curated, not a wiki** — stale docs are updated or deleted.
- **OKF v0.2 conformance** — every non-reserved file carries a `type` (OKF's one
  hard requirement); the tree is a valid OKF bundle.
- **Optional metadata families** — `authors`, `related`, `tags`, `resource`,
  `generated`, `verified`, `sources`, `stale_after` — added only when a genuine
  value exists, never fabricated.
- **Actor convention** — tools identify as `agent/<tool>`; humans as
  `human:<id>`.

## 2. Kitty twists

Where the Kitty Variation deliberately diverges from Common Docs:

| # | Common Docs | Kitty Variation | Why |
|---|-------------|-----------------|-----|
| 1 | Section index is `index.md` | Section index is **`README.md`** | Renders on GitHub/Bitbucket *and* as the section landing page — one file, two audiences. |
| 2 | `index.md` carries **no** frontmatter | `README.md` **carries frontmatter** (same required fields) | Metadata-first: the section index feeds nav, feeds, and the agent-API like any other page; Starlight needs a title. |
| 3 | `docs/` is consumed by external OKF tooling | `docs/` is **rendered directly** by the toolkit (Astro reads repo-root `docs/`) | Point the toolkit at an existing Common Docs tree; no file moves. |
| 4 | Metadata is descriptive | An optional **`agent`** block tunes discovery | Fine control over agent-API visibility/ordering without new top-level fields. |
| 5 | Fixed 12-section set | **Canonical, supported default** — the core focus is docsites that follow the structure; amendable only by *canonical* additions recorded in ADRs. A project *may* adapt (subset, own sections) and the toolkit degrades gracefully, but that is **tolerated, not officially supported**. | Flexibility without abandoning structure — [ADR-0004](../adr/0004-amend-common-docs-as-extensible-variation.md). |
| 6 | Nav is implied by the fixed tree | **Display derives from an authored registry**, `docs/_meta/sections.yaml` (`id` / `label` / `order` / `type` / `purpose` / `feeds`) — see the [section registry](../architecture/section-registry.md) | Decouple display concerns (labels, ordering, feeds) and section type from on-disk structure; relabel/reorder/refilter without moving files. |

Reserved, **frontmatter-free / non-content** (excluded from the docs collection):
`log.md` (an optional per-directory change log) and the **`docs/_meta/`**
directory — which holds `sections.yaml` (the authored section registry) and a
generated `page-inventory.yaml` metadata lockfile.

### Canonical sections beyond Common Docs

Added deliberately via ADR (see the amendment log in
[ADR-0004](../adr/0004-amend-common-docs-as-extensible-variation.md)):

| Section | `type` | Purpose |
|---|---|---|
| `presentations/` | `Presentation` | Markdown-authored reveal.js slide decks. |

## 3. Frontmatter

Every file **except a frontmatter-free `log.md`** opens with YAML frontmatter.

### Required

```yaml
---
title: Short descriptive title
description: One sentence describing what this document contains.
doc_status: draft | active | deprecated | superseded
updated: YYYY-MM-DD
type: <see Type values>
kind: <see Kind values>
---
```

`doc_status` meanings: `draft` (WIP, not authoritative), `active` (current and
maintained), `deprecated` (no longer applies, kept for history), `superseded`
(replaced — link the replacement in `related`).

> **Publication:** `draft` pages are excluded from `sitemap.xml`, `rss.xml`, and
> the agent-API. `active` / `deprecated` / `superseded` are published.

### `type` values

| Path pattern | `type` |
|---|---|
| `context/*` | `Context` |
| `architecture/*` | `Architecture` |
| `adr/NNNN-*` | `ADR` |
| `adr/template` | `Template` |
| `plans/roadmap` | `Plan` |
| `plans/epics/*` | `Epic` |
| `plans/features/*` | `Feature` |
| `api/*` | `API` |
| `configuration/*` | `Configuration` |
| `integrations/*` | `Integration` |
| `security/*` | `Security` |
| `guides/*` | `Guide` |
| `operations/*` (top level) | `Operations` |
| `operations/runbooks/*` | `Runbook` |
| `migrations/*` | `Migration` |
| `changelog/*` | `Changelog` |
| `presentations/*` | `Presentation` (Kitty canonical addition) |

Section `README.md` files take their section's `type` (e.g. `context/README.md`
→ `Context`).

### `kind` values

`type` says where a page lives (its section); `kind` says what kind of page it
is and how to read it. `kind` is **required on every page** — including the
bundle-root `README.md` — and drives per-kind layout ([ADR-0009](../adr/0009-finalize-metadata-contract.md)).
The vocabulary is open: the validator checks the canonical set and warns on an
unknown value rather than failing.

- **Content quadrants** (Divio): `Tutorial`, `How-To`, `Reference`,
  `Explanation`.
- **Structural kinds**: `Hub` (a section index or link list), `ADR`,
  `Changelog`, `Glossary`, `Presentation`, `Persona`, and the planning kinds
  `Planning`, `Feature`, `User-Journey`.

A section `README.md` is a `Hub`; an ADR page is `kind: ADR`; a getting-started
guide is a `Tutorial`; most prose pages are `Reference` or `Explanation`. `type`
and `kind` are independent axes and may coincide (an ADR is `type: ADR`,
`kind: ADR`) or differ (a guide is `type: Guide` with `kind: How-To`).

### The bundle root

`docs/README.md` is exempt from `type` and instead carries `okf_version: "0.2"`
alongside the standard required fields — it still carries `doc_status` and
`kind` (`Hub`).

### Optional fields

`authors`, `related`, `tags`, `resource`, `generated {by, at}`,
`verified [{by, at}]`, `sources [{resource, title}]`, `stale_after` — as in
Common Docs. Plus the Kitty extension:

```yaml
agent:
  discoverable: true    # include in llms.txt / agent index (default true)
  priority: 0.5         # 0..1 relative importance to agents (default 0.5)
  keywords: [a, b, c]   # extra retrieval keywords beyond `tags`
```

## 4. Enhancements the toolkit adds

Beyond rendering, the toolkit generates from this metadata:

- **`sitemap.xml`** — every published page.
- **`rss.xml`** — published pages, newest `updated` first.
- **`llms.txt`** — discoverable pages grouped by section in canonical order.
- **`/api/index.json`** + **`/api/pages/<id>.json`** — the agent-API: a
  browsable map plus per-page metadata and raw Markdown. Discovery, **not** a
  RAG index.

### ADR status reconciliation

Common Docs' ADR template uses an ADR-specific `status` (`proposed | accepted |
…`). The Kitty Variation keeps every file on the one convention-wide
`doc_status` enum: frontmatter `doc_status` records the *document* lifecycle
(`active`), while the *decision* status lives in the ADR body's `## Status`
section.

The `adr/README.md` index table is **generated, not hand-maintained**: the ADR
files are the source of truth, and `src/scripts/generate-adr-index.mjs` derives
the `ID | Title | Status | Date` table from each ADR's frontmatter (`title`,
`updated`) and body `## Status`. A lockfile-style sync-check
(`generate-adr-index.mjs --check`, wired into CI as `validate:adr-index`) reds
if the committed table drifts from the ADR sources — re-run the generator and
commit. The example tree instead drops its table and lets the `kind: Hub` layout
auto-list, because only the example tree is Astro-rendered (see
[ADR-0032](../adr/0032-adr-index-generation.md)).

## 5. Relationship to `AGENTS.md`

Per Common Docs, the repo-root `AGENTS.md` / `CLAUDE.md` must point at
`docs/README.md` (the Kitty root index) as the starting point. See
[`../../AGENTS.md`](../../AGENTS.md).
