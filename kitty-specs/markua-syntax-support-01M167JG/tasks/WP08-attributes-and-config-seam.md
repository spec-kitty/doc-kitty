---
work_package_id: WP08
title: Attribute-list plugin (whole) + single-owner config.ts wiring seam
dependencies:
- WP02
- WP04
- WP06
- WP07
requirement_refs:
- C-002
- C-003
- C-005
- FR-005
- FR-006
- FR-007
- FR-011
- FR-012
- NFR-002
planning_base_branch: feat/markua-syntax-support
merge_target_branch: feat/markua-syntax-support
branch_strategy: Planning artifacts for this mission were generated on feat/markua-syntax-support. During /spec-kitty.implement this WP may branch from a dependency-specific base, but completed changes must merge back into feat/markua-syntax-support unless the human explicitly redirects the landing branch.
subtasks:
- T029
- T030
- T031
- T032
- T033
- T034
- T035
history:
- '2026-08-29: authored by /spec-kitty.tasks'
agent_profile: frontend-freddy
authoritative_surface: src/lib/config.ts
create_intent:
- src/lib/remark/markua-attributes.internal.ts
- src/lib/remark/markua-attributes.ts
- src/tests/markua-attributes.test.ts
execution_mode: code_change
model: opus
owned_files:
- src/lib/remark/markua-attributes.internal.ts
- src/lib/remark/markua-attributes.ts
- src/tests/markua-attributes.test.ts
- src/lib/config.ts
role: implementer
tags: []
tracker_refs: []
---

## ⚡ Do This First: Load Agent Profile

`/ad-hoc-profile-load frontend-freddy` (role: implementer). Apply its initialization,
boundaries, directives, and tactics. Then read this WP, [../spec.md](../spec.md) (FR-005/006/007
attr halves, FR-011 preset-gated, FR-012, C-002, C-005), [../plan.md](../plan.md) (IC-01 — the
attribute plugin owned WHOLE + the wiring seam + the single `remark-directive` owner + prepend
order), **the pinned contract** [../contracts/attribute-list-plugin.md](../contracts/attribute-list-plugin.md)
(this WP implements it whole), [../contracts/normaliser-block-detection.md](../contracts/normaliser-block-detection.md)
(§attr-above-wrapper + three-way equivalence), [../research.md](../research.md) (D-07 ordering +
single directive owner; the `createPageProcessor`/`OnThisPage` shared-substrate note),
`docs/adr/0030-markua-preprocess-to-directive.md`, and **the wiring you mirror**:
`src/lib/config.ts` — the `diagramsIntegration` prepend, the `glossaryIntegration` (which today
registers `remarkDirective` at `config.ts:498`), and the `...(diagrams ? […] : [])` /
`...(glossaryActive ? […] : [])` prepend-before-`starlight()` pattern.

## Objective

Own the **rest of the shared substrate**: (1) the **attribute-list remark plugin WHOLE** — its
`{…}` grammar parse **and** the `hProperties` write for **every** target (images, spans, **and
ids**), per [`attribute-list-plugin.md`](../contracts/attribute-list-plugin.md); and (2) the
**single-owner `config.ts` wiring seam**. This is the **only** WP that edits `config.ts`.

The wiring seam does four load-bearing things (research D-07, ADR-0030 Risks):

- adds the **opt-in `markua` flag** to `DocKittyOptions` (**OFF by default**, same shape as
  `diagrams`);
- assigns a **single `remark-directive` owner** — hoist `remarkDirective` registration **out of
  `glossaryIntegration`** into a shared registration gated on **(glossaryActive OR markuaActive)**
  (the example ships `.contextive`, so both will be active), so it is registered **exactly once**;
- **prepends the markua integration before `starlight()`** so the markua remark plugins run
  **before** Starlight's `remarkAsides` (the native-aside consumption ordering — WP04's mapped
  directives must be present when `remarkAsides` visits), with a **registration-site comment**
  mirroring the deck/glossary ordering comments;
- **pins the full plugin order**: remark `markua-normalise → markua-attributes → markua-callouts`
  (after `remarkDirective`); rehype user stage `markua-figure` and `markua-toc-demote` **before**
  `rehypeImages`/`rehypeHeadingIds`.

Because `config.ts` imports every markua plugin, this WP depends on **WP02** (normalise),
**WP04** (callouts, which itself pulls WP03 icons), **WP06** (toc-demote), and **WP07** (figure);
the attribute-list plugin is authored here. The **preset stays OFF** — the example is not turned
on here (WP10 owns the on-switch), so with `markua` absent/false the integrations array and
corpus are **byte-identical** to today (FR-011, NFR-001) — the byte-identical twin of
`diagrams: false`.

> **Boundaries & the IC-01/IC-04 fix.** The attribute-list plugin is owned **whole here** — its
> `{…}` parse and the `hProperties` id write for images, blocks, **and** spans. **WP09 (crosslink
> ids) does NOT re-edit `markua-attributes*.ts`** (it is verification-only). This WP does **not**
> parse wrapper markers (WP02), map callouts (WP04), style anything (WP05), demote headings
> (WP06), or emit figures (WP07) — it wires them and supplies their `{…}` values.

## Subtasks

### T029 — `{…}` grammar parse (`markua-attributes.internal.ts`)
- Create `src/lib/remark/markua-attributes.internal.ts` (Astro-free) — the pure `{…}` grammar
  parse, mirroring the `diagram-meta`/`deck-split` split:
  - `parseAttrList(raw: string): { entries: Record<string,string>; id?: string } | null` —
    accepts `{key: value}` pairs, comma-separated; **quoted (`"…"`) or bare** values (quotes
    stripped, **percentages keep their `%`**); the **`{#id}` shorthand** ≡ `{id: id}`; whitespace
    around keys, `:`, and commas tolerated.
  - A `{…}` string that **does not parse** as an attribute list returns `null` → the caller
    leaves it as **literal text** (ordinary paragraph content), **never an error** (FR-012).
- **Files**: `markua-attributes.internal.ts` (parse section, ~90 lines).
- **Validation**: T035 (parse matrix: pairs, quotes, bare, `#id`, `%`, whitespace, non-parsing).

### T030 — Block-form attach + keys-honoured-per-target (`markua-attributes.ts`)
- Create `src/lib/remark/markua-attributes.ts` — the remark plugin (hand-rolled mdast walk, no
  `unist-util-visit`):
  - **Block form**: an attribute-list paragraph on its **own line immediately above** a
    block-level element (image, heading, aside, blurb, figure, or a WP02 container directive)
    attaches to the **following** block by writing onto its `data.hProperties` (the mdast→hast
    projection the figure rehype + heading-id pass read — the same channel `mermaidFenceTransform`
    / `diagram-figure` use).
  - **Keys honoured per target** (silently ignore the rest — FR-012, contract table):
    - image: `alt`, `caption`, `title`, `width`, `height`, `align`, `class`, `id`/`#id`;
    - block id (heading/figure/aside/blurb): `id`/`#id` only;
    - callout (attached `{class:}`/`{icon:}`/`{#id}`): `class`, `icon`, `id`/`#id`.
  - `id`/`#id` → `hProperties.id`; `width`/`height`/`align`/`class` are carried for the **figure
    rehype** (WP07) to turn into sizing/layout/class — they are **not** applied to a bare heading.
  - **Remove the consumed attribute-list paragraph** from the tree so it never renders as literal
    `{…}` text.
- **Files**: `markua-attributes.ts` (block-form + honour table, ~110 lines).
- **Validation**: T035 (per-target honour, silently-ignored `fullbleed`, paragraph removed).

### T031 — Span forms (`[text]{#id}`, `word{#id}`)
- In `markua-attributes.ts`, implement the **inline span** forms:
  - `[text]{#id}` → a `<span id="…">text</span>` replacing the `[text]` + `{#id}` run.
  - `word{#id}` (no brackets) → a `<span id="…">word</span>` around the immediately preceding
    word/token.
  - Only `id`/`#id` is honoured on a span; other keys on a span are ignored (contract table).
- **Files**: `markua-attributes.ts` (span section, ~70 lines).
- **Validation**: T035 (both span forms → `<span id>`; non-id keys on a span ignored). US3 sc.2.

### T032 — Attr-above-wrapper-container + three-way-equivalence reconciliation
- Handle the **attr-above-wrapper** rule (H, coverage row 34): an attribute list immediately
  above a `{aside}`/`{blurb}` **container directive** (WP02 already turned the wrapper lines into
  a `containerDirective`, leaving the attribute-list paragraph as its immediate predecessor)
  attaches to that **container's** `hProperties` — `{#id}` gives the whole aside/blurb an anchor;
  `{class: …}` above a `{blurb}` supplies its callout class (reconcile with the
  three-way-equivalence rule: a `{class: warning}` line above a `B>` block, once WP02 has emitted
  the block, folds the class onto it). The ordering is pinned: **normaliser first, this plugin
  after** on the same tree, so the id/class lands on the container, not a sibling.
- **Files**: `markua-attributes.ts` (wrapper-attach section, ~50 lines).
- **Validation**: T035 (`{#note}` above `{aside}` → id on the container; `{class: warning}` above
  `B>` → warning class on the block).

### T033 — `config.ts`: markua flag + single directive owner + prepend + pinned order
- Edit `src/lib/config.ts` (the **only** WP touching it):
  - Add `markua?: boolean` (default **false**) to `DocKittyOptions` and destructure it in
    `defineDocKittyIntegrations` (mirror `diagrams = false`).
  - Add `const markuaActive = markua === true;` alongside `glossaryActive`.
  - **Single `remark-directive` owner**: remove the `remarkDirective` entry from
    `glossaryIntegration`'s `remarkPlugins` (currently `config.ts:498`) and register
    `remarkDirective` **once** in a shared place gated on **(glossaryActive || markuaActive)**,
    with the cross-integration order pinned. Keep glossary behaviour identical when
    glossary-active (directive still present before `glossary-term`/`glossary-autolink`).
  - Define a **`markuaIntegration(docsDir)`** (mirroring `diagramsIntegration`/`glossaryIntegration`)
    that, in `astro:config:setup`, registers via `updateConfig({ markdown: { remarkPlugins,
    rehypePlugins } })`:
    - **remark** (after `remarkDirective`): `markuaNormalise → markuaAttributes → markuaCallouts`;
    - **rehype** (user stage, **before** `rehypeImages`/`rehypeHeadingIds`): `markuaFigure`,
      `markuaTocDemote`.
  - **Prepend `markuaIntegration` before `starlight()`** in the returned integrations array
    (`...(markuaActive ? [markuaIntegration(docsDir)] : [])`), so markua remark plugins run
    **before** Starlight's `remarkAsides`. Add a **registration-site comment** mirroring the
    deck/glossary/diagram ordering comments explaining the prepend + single-owner gate.
  - **Preset OFF / presence-gated**: with `markua` absent/false the whole seam is omitted →
    integrations array + corpus **byte-identical** (FR-011, NFR-001 — the `diagrams: false` twin).
- **Files**: `config.ts` (~90 lines of edits + comments).
- **Validation**: T035 config assertions + WP10's build. Reviewer: glossary tests still green
  (directive still registered when glossary active).

### T034 — `createPageProcessor` / `OnThisPage` markua-unaware forward-rule note
- Own the **shared-substrate forward rule** (research "shared-substrate note") so a future
  `entry.body` re-derive does not silently regress: the glossary `createPageProcessor` and
  `OnThisPage.astro` re-derive from the **raw `entry.body`** string, so raw `A>`/`{blurb}`/`{…}`
  lines look like literal text to them. This is **inert today** (those surfaces need no Markua
  understanding for this mission). Record a **code comment** at the appropriate seam (in
  `config.ts` near the markua registration, and/or a pointer comment) stating the forward rule:
  **any future surface that re-derives from `entry.body` must replay the markua normalisation
  before deriving**, or it will index/emit raw Markua as literal text.
- Do **not** modify `createPageProcessor`/`OnThisPage.astro` (not owned here, and not needed) —
  only record the note so the tasks phase does not lose it.
- **Files**: `config.ts` (comment).
- **Validation**: the note is present and accurate; no behavioural change.

### T035 — Vitest (`markua-attributes.test.ts`) + config byte-identical assertion
- Create `src/tests/markua-attributes.test.ts`:
  - **`{…}` parse matrix**: `{alt: "a palm-lined beach", width: "75%"}` → entries with `%` kept;
    bare vs quoted values; `{#id}` ≡ `{id: id}`; whitespace tolerance; a non-parsing `{…}` →
    `null` (left as text).
  - **Per-target honour**: image keys applied; `{fullbleed: true}` above an image **silently
    ignored** (coverage row 26); a heading honours only `id`; the consumed attribute paragraph is
    **removed** from the tree.
  - **id write / precedence support** (C-005): `{#overview}` above a heading writes
    `hProperties.id = "overview"` (so Astro's `rehypeHeadingIds`, which runs last and only slugs
    when no id is set, keeps it — the precedence is proven in WP09).
  - **Span forms**: `[is lorem]{#lorem}` → `<span id="lorem">is lorem</span>`;
    `ipsum{#ipsum}` → `<span id="ipsum">ipsum</span>`; non-id key on a span ignored.
  - **Attr-above-wrapper**: `{#note}` above a container directive → id on the container.
  - **Config byte-identical, markua OFF (FR-011)**: a **committed, re-runnable** assertion that
    resolving `defineDocKittyIntegrations` with `markua` **absent/false** (and no `.contextive`)
    yields an integrations array **equal to a pinned baseline** (mirror the `diagrams: false`
    check) — a future unconditional markua-plugin registration must fail loudly.
  - **Single `remark-directive` owner, glossary-ACTIVE / markua-INACTIVE (the real hoist risk,
    research D-07 — MANDATORY second committed assertion)**: the both-OFF check above does **not**
    exercise the hoist. Add a **committed** assertion for the **glossary-active, markua-inactive**
    case proving `remarkDirective` is registered **exactly once** and in the **same pre-hoist
    position** relative to `glossary-term`/`glossary-autolink` as today's baseline:
    - Use the repo's **existing carrier-counting pattern** — `src/tests/config-invariants.test.ts`
      mocks `@astrojs/starlight` to **capture the config**, then locates an integration **by its
      captured config, not by array index**. Commission the **equivalent counting test for
      `remarkDirective`**: resolve the integrations with glossary active (`.contextive` present)
      and markua off, then inspect the glossary integration's registered `markdown.remarkPlugins`
      (capture what `updateConfig` receives, the way `config-invariants` captures the Starlight
      config) and assert **`remarkDirective` appears exactly once**, **before** `glossary-term`
      and `glossary-autolink`, i.e. the plugin order is **identical to the pre-hoist baseline**.
    - A **double registration** (glossary + markua both adding it) or a **silent
      non-registration** must fail this assertion — that is the actual risk surface of the
      single-owner hoist, and the both-OFF test cannot catch it.
- **Files**: `markua-attributes.test.ts` (~140 lines) + **both** config assertions (extend/mirror
  `config-invariants.test.ts`'s capture-by-config pattern for the directive-owner count).
- **Validation**: `pnpm test` green; `astro check`/`tsc` clean; **both** the markua-OFF
  byte-identical assertion **and** the glossary-active single-`remarkDirective`-owner counting
  assertion are green.

## Branch Strategy

Planning branch: `feat/markua-syntax-support`. Final merge target: `feat/markua-syntax-support`.
**Depends on WP02, WP04, WP06, WP07** (`config.ts` imports every markua plugin; land each
approved dep lane onto `feat/markua-syntax-support` first, then cut this lane from the composed
branch). WP03 (icons) arrives transitively via WP04. Implement with
`spec-kitty agent action implement WP08 --agent claude`.

## Definition of Done

- `markua-attributes.internal.ts` + `markua-attributes.ts` implement the `{…}` parse and the
  `hProperties` write **whole** — block form (per-target honour, silently-ignored keys, paragraph
  removed), span forms, id write (C-005), and attr-above-wrapper-container.
- `config.ts`: `markua` flag (OFF default); **single** `remark-directive` owner gated on
  (glossary OR markua); `markuaIntegration` **prepended before `starlight()`**; pinned remark
  order (`normalise → attributes → callouts`) and user-rehype order (`figure`, `toc-demote`
  before `rehypeImages`/`rehypeHeadingIds`); registration-site comment; `createPageProcessor`
  forward-rule note.
- **Two committed config assertions** are green: (1) markua-OFF → integrations array
  byte-identical to the pinned baseline; (2) **glossary-active / markua-inactive → `remarkDirective`
  registered exactly once, in the pre-hoist position relative to `glossary-term`/`glossary-autolink`**
  (the actual hoist risk, using the `config-invariants.test.ts` capture-by-config counting
  pattern). Glossary behaviour is unchanged.
- Tests green; `ci-ok` green — **the example is not switched on here** (WP10 owns the on-switch).

## Risks / Reviewer guidance

- **Single owner of `config.ts`** — this is the only WP editing it; a `config.ts` diff in any
  other WP is a finding. WP09 (crosslink) must **not** edit `markua-attributes*.ts`.
- **Single `remark-directive` owner — the hoist is the top risk and MUST have its own committed
  test** — after hoisting, `remarkDirective` must be registered **exactly once**, gated on
  (glossary OR markua); a double registration (glossary + markua) or a silent non-registration is
  the exact ownership bug the squad flagged (research D-07). The **markua-OFF byte-identical test
  does not exercise this** — the mandatory **glossary-active / markua-inactive** counting
  assertion (T035, capture-by-config à la `config-invariants.test.ts`) is what proves it; its
  absence is a finding.
- **Prepend order is load-bearing** — markua must sit **before `starlight()`** so its remark
  plugins run before `remarkAsides`; WP10's `T>`→`starlight-aside--tip` assertion fails loudly on
  a reorder. Verify the prepend + the pinned intra-array order.
- **Preset OFF byte-identical (FR-011/NFR-001)** — with `markua` absent the array must be
  byte-identical; the most common miss is registering a plugin unconditionally. Mirror the
  `diagrams ? [diagramsIntegration] : []` shape and keep the committed assertion green.
- **Attribute plugin owned WHOLE** — the span/id write lives here, not in WP09; a re-edit of the
  parser from WP09 is a finding.
- **Never fail the build** — a non-parsing `{…}` degrades to text; the plugin never throws
  (FR-012, NFR-002).
