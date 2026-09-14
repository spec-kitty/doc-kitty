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

> This document is the narrative companion to the toolkit's **documentation
> charter** — the default doctrine pack, resolved natively by doc-kitty's own
> pure-core/fs-loader/gate triad with no Spec Kitty runtime dependency
> ([ADR-0042](../adr/0042-native-documentation-charter.md)). It captures the base
> convention and our variation in prose; the machine-readable, consumer-authorable
> surface is `docs/_meta/charter.yaml`. Each governable dimension below is marked
> **fixed-doctrine** (a floor the toolkit enforces and a consumer cannot relax) or
> **consumer-overridable** (an axis a consumer may author in `_meta/charter.yaml`);
> everything else is the shipped canonical default.

## Governable dimensions

What a consumer may change, and what the toolkit holds fixed. The overridable
axes are authored in `docs/_meta/charter.yaml` (a single optional file; every key
optional). An absent or empty charter resolves to the canonical defaults below.

| Dimension | Charter axis | Stance | Rule |
|---|---|---|---|
| `type` / `kind` vocabulary | `vocabulary.types`, `vocabulary.kinds` | **consumer-overridable** | Alias, forbid, or pass through terms over the canonical sets ([ADR-0031](../adr/0031-vocabulary-override.md)). A forbidden authored `type` hard-fails; an unknown-but-not-forbidden value warns. |
| Sections / IA | `sections` | **consumer-overridable** | Order, labels, entries, `index_basename`, and sub-path `subtypes` — the authored section registry (twist 6 below; [ADR-0004](../adr/0004-amend-common-docs-as-extensible-variation.md)). |
| `doc_status` set | `statuses.add` | **consumer-overridable, extend-only** | You may *add* statuses; the canonical set (`draft`, `active`, `deprecated`, `superseded`, `durable`) is reserved. Removing/forbidding/aliasing-away a canonical status fails closed. |
| Required-field set | `required_fields.optional` | **partly overridable, with a floor** | You may relax listed required fields for your consumer — **except `title`**, which is **fixed-doctrine** and always required. Listing `title` fails closed. |
| `title` on every page | — | **fixed-doctrine** | Always required; cannot be relaxed. |
| OKF `type` on every non-reserved page | — | **fixed-doctrine** | OKF v0.2's one hard requirement; every non-orphan page resolves to a non-empty `type`. |
| Twelve-section canonical tree | `sections` (adapt), ADR (extend) | **fixed-doctrine default, adaptable** | The canonical set is the supported default; canonical *additions* are recorded in ADRs, and a project may subset/add sections with graceful degradation (twist 5). |

A malformed charter fails the build with a message naming the file and offending
key; an unknown *top-level* charter key only warns (forward-compat). Legacy
`_meta/vocabulary.yaml` / `_meta/sections.yaml` still resolve per-axis and emit
one deprecation notice — see [migrating to the charter](../guides/migrating-to-charter.md).

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
| 1 | Section index is `index.md` | Section index is **`README.md`** by default, and **configurably `index.md`** via the `indexBasename` option ([ADR-0033](../adr/0033-flexible-section-identity.md), partially superseding [ADR-0002](../adr/0002-readme-as-index.md)) | Renders on GitHub/Bitbucket *and* as the section landing page — one file, two audiences. The configurable basename spares a migrating adopter renaming an existing `index.md` tree. |
| 2 | `index.md` carries **no** frontmatter | `README.md` **carries frontmatter** (same required fields) | Metadata-first: the section index feeds nav, feeds, and the agent-API like any other page; Starlight needs a title. |
| 3 | `docs/` is consumed by external OKF tooling | `docs/` is **rendered directly** by the toolkit (Astro reads repo-root `docs/`) | Point the toolkit at an existing Common Docs tree; no file moves. |
| 4 | Metadata is descriptive | An optional **`agent`** block tunes discovery | Fine control over agent-API visibility/ordering without new top-level fields. |
| 5 | Fixed 12-section set | **Canonical, supported default** — the core focus is docsites that follow the structure; amendable only by *canonical* additions recorded in ADRs. A project *may* adapt (subset, own sections) and the toolkit degrades gracefully, but that is **tolerated, not officially supported**. | Flexibility without abandoning structure — [ADR-0004](../adr/0004-amend-common-docs-as-extensible-variation.md). |
| 6 | Nav is implied by the fixed tree | **Display derives from an authored registry**, `docs/_meta/sections.yaml` (`id` / `label` / `order` / `type` / `purpose` / `feeds` / **`subtypes`**) — see the [section registry](../architecture/section-registry.md) | Decouple display concerns (labels, ordering, feeds) and section/sub-path type from on-disk structure; relabel/reorder/refilter/**rename** without a derivation-code edit. |

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

### Section identity: index basename and renaming a section

Two migration frictions are first-class supported, not merely tolerated
([ADR-0033](../adr/0033-flexible-section-identity.md), which reverses
[ADR-0004](../adr/0004-amend-common-docs-as-extensible-variation.md)'s
"tolerated, not supported" stance for exactly these two cases):

- **`indexBasename`** — a loader option, default `README`, that additionally
  accepts `index` (case-insensitive) as the section-index basename. A folder
  with both `README.md` and `index.md` resolves to the configured basename; the
  other file is demoted to an ordinary page and the collision is warned, never
  silently resolved.
- **Section rename via registry `subtypes`** — renaming a section folder,
  including a sub-path subtype rename (e.g. `plans/features` →
  `plans/missions`), is a data edit to `sections.yaml`'s `subtypes` field, not a
  derivation-code edit. The built-in sub-path table remains the fallback when
  `subtypes` is absent, so doc-kitty's own tree is unaffected.

Both are the exceptions to the "tolerated, not officially supported" rule in
twist 5 above — adding an entirely new, non-canonical section is still tolerated
graceful degradation, not first-class support.

## 3. Frontmatter

Every file **except a frontmatter-free `log.md`** opens with YAML frontmatter.

### Required

```yaml
---
title: Short descriptive title
description: One sentence describing what this document contains.
doc_status: draft | active | deprecated | superseded | durable
updated: YYYY-MM-DD
type: <see Type values>
kind: <see Kind values>
---
```

`doc_status` meanings: `draft` (WIP, not authoritative), `active` (current and
maintained), `deprecated` (no longer applies, kept for history), `superseded`
(replaced — link the replacement in `related`), `durable` (a never-retire
throughline — a foundational document expected to stay current indefinitely, so
adopters can mark it without hard-failing the strict enum; see
[ADR-0035](../adr/0035-vocabulary-core-consolidation.md)).

> **Publication:** `draft` pages are excluded from `sitemap.xml`, `rss.xml`, and
> the agent-API. `active` / `deprecated` / `superseded` / `durable` are published.

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

### Redirect coverage for a URL-preserving migration

An adopter moving from a URL-preserving host (old URLs must keep resolving) uses
a three-part primitive ([ADR-0034](../adr/0034-redirect-coverage-gate.md)):

1. **A committed URL baseline** — a version-controlled snapshot of the URLs that
   must keep resolving, captured *before* the change. It is never regenerated
   from the current build, so it stays a real reference to check drift against.
2. **A redirect map**, declared via Astro's native `redirects` config, mapping
   each old URL to its new location. The build emits it; no new dependency.
3. **`src/scripts/check-redirect-coverage.mjs`**, a bare-Node CI gate (no Astro
   build context) that fails when a baselined URL has neither a live page nor a
   redirect whose *target* resolves — a redirect chain is followed to a live
   terminus, so a redirect to a dead page is reported, not silently accepted.

A section rename (above) produces exactly the URL churn this gate is built to
cover: baseline the renamed section's old child URLs and add matching redirect
entries.

## 5. Relationship to `AGENTS.md`

Per Common Docs, the repo-root `AGENTS.md` / `CLAUDE.md` must point at
`docs/README.md` (the Kitty root index) as the starting point. See
[`../../AGENTS.md`](../../AGENTS.md).
