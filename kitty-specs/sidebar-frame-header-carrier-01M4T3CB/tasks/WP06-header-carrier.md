---
work_package_id: WP06
title: Header carrier
dependencies:
- WP05
requirement_refs:
- FR-024
- FR-025
- NFR-007
- SC-008
planning_base_branch: fix/sidebar-frame-header-carrier
merge_target_branch: fix/sidebar-frame-header-carrier
branch_strategy: Planning artifacts for this mission were generated on fix/sidebar-frame-header-carrier. During /spec-kitty.implement this WP may branch from a dependency-specific base, but completed changes must merge back into fix/sidebar-frame-header-carrier unless the human explicitly redirects the landing branch.
base_branch: kitty/mission-sidebar-frame-header-carrier-01M4T3CB
base_commit: 38d8e6d6e563961ccc9e31fbdda64cd1ad671962
created_at: '2026-10-13T09:18:23.898311+00:00'
subtasks:
- T033
- T034
- T035
- T036
history: []
agent_profile: frontend-freddy
authoritative_surface: src/components/
create_intent:
- src/components/Header.astro
- src/tests/header-carrier.test.ts
execution_mode: code_change
owned_files:
- src/components/Header.astro
- src/lib/manifest.ts
- src/tests/config-invariants.test.ts
- src/tests/header-carrier.test.ts
- src/tests/fixtures/header-theme/**
role: implementer
tags: []
tracker_refs: []
---

# WP06 — Header carrier

## ⚡ Do This First: Load Agent Profile

Before reading anything else, load your assigned agent profile with the `/spk-charter-profile-load` skill, using the `agent_profile` value from this file's frontmatter (`frontend-freddy`). Apply its boundaries and directives for the whole work package, and state in your hand-off which ones you applied.

## Objective

Add a fifth toolkit-owned carrier, `Header`, that renders a theme-supplied site header when one is present and Starlight's stock header otherwise, with no wrapper element and no change to the markup of sites that do not supply one.

Requirements: FR-024, FR-025, NFR-007. Research: R9. Contract: `contracts/public-surface.md` section 3. The decision record (FR-027) and consumer documentation (FR-026) are written in WP07; give WP07 the facts it needs in your hand-off.

## Shared context

- **Mission documents** (read before coding): `kitty-specs/sidebar-frame-header-carrier-01M4T3CB/spec.md`, `plan.md`, `research.md`, `data-model.md`, `contracts/public-surface.md`.
- **Stack**: Astro ^5.2, @astrojs/starlight ^0.32.6. Do not upgrade either, and do not add, upgrade or remove any dependency. If you believe one is needed, stop and report.
- **Starlight 0.32 has no cascade layers.** An override wins only on specificity or load order. doc-kitty sheets load after Starlight's.
- **Vocabulary**: tokens use the `--dk-*` namespace. Quote measurements from this repository's builds and tests.
- **Commands** (repository root): `pnpm test` (Vitest), `pnpm build` (example site), `pnpm test:a11y` (Playwright), `pnpm lint`, `pnpm typecheck`, `pnpm validate`. If a stale build cache gives odd results, run `pnpm clean` first.
- **Out-of-map edits**: stay inside `owned_files`. A small edit elsewhere is acceptable only when this prompt names it; record it in your hand-off with one line of rationale.
- **Comments**: match the surrounding files, which explain *why* a rule exists and which requirement it serves.

## Background

`src/lib/config.ts` registers four carriers with Starlight's `components` map:

```ts
const carriers = {
  Head: '@spec-kitty/doc-toolkit/components/Head.astro',
  PageTitle: '@spec-kitty/doc-toolkit/components/PageTitle.astro',
  MarkdownContent: '@spec-kitty/doc-toolkit/components/MarkdownContent.astro',
  Footer: '@spec-kitty/doc-toolkit/components/Footer.astro',
};
```

Themes never touch that map. They fill named `dk:` slots, which `src/lib/manifest.ts` code-generates into a virtual module exposing `slotComponents`; each carrier looks up its slot and falls back to the default. ADR-0013 and ADR-0015 fix the map at exactly four ("seam 3"), and `src/tests/config-invariants.test.ts` plus several comments in `config.ts` (around lines 15–17, 113, 179–185, 1001, 1284, 1305–1309) assert that. The owner has decided to add the Header carrier; WP07 writes ADR-0044 to supersede the four-carrier clause.

Read first: `docs/adr/0013-m1-chrome-substrate-single-layer.md`, `docs/adr/0015-m2-slot-resolution-and-components-map-seam.md`, `src/components/Footer.astro` and `PageTitle.astro` (how an existing carrier consumes a slot and falls back), `src/lib/manifest.ts`, and the theme definition types (`src/lib/theme.ts`, `src/themes/spec-kitty/index.ts`).

## Subtask T033 — `Header.astro`

**Steps**: create `src/components/Header.astro`:

- Import Starlight's default: `@astrojs/starlight/components/Header.astro`.
- Import `slotComponents` from the toolkit's virtual manifest module (same import the other carriers use).
- Look up the slot `dk:site-header`.
- Render `<SiteHeader />` if present, else `<Default />`. Pass through props and slots exactly as Starlight passes them to an overriding component (in 0.32 overrides read route data from `Astro.locals.starlightRoute`; check whether `Default` needs `{...Astro.props}` and a `<slot />` forwarded, by looking at how the existing carriers wrap their defaults).
- **No wrapping element, no added attribute, no whitespace-bearing markup** in the fallback branch. The output with no theme header must be byte-identical to today's.
- Header comment: what the carrier is, the slot name, that the branch is deliberately wrapper-free, and a pointer to ADR-0044.

## Subtask T034 — Slot, carriers map and package export

**Steps**:
1. `src/lib/manifest.ts`: add `dk:site-header` to the known slot names / validation list, so a theme can declare it and an unknown slot name is still rejected as before. Update the theme type that enumerates slots if it lives in `src/lib/theme.ts` (owned by WP01, already merged in the other lane or not yet — if you must touch it, it is a one-line recorded out-of-map edit).
2. `src/lib/config.ts` (owned by WP04; named, permitted out-of-map edit): add `Header: '@spec-kitty/doc-toolkit/components/Header.astro'` to `carriers`, and update every comment that says "four" (the list above). Do not weaken the invariant: it becomes "exactly these five, in every case, with or without a theme".
3. `src/package.json` (owned by WP04; permitted out-of-map edit): ensure the component is exported. If exports use a `./components/*` pattern nothing is needed; verify the file is in the published tarball's `files`.
4. The spec-kitty brand theme (`src/themes/spec-kitty/`) does **not** get a header in this mission; leave it on the stock one.

## Subtask T035 — Invariant tests and comments

**Steps**:
1. `src/tests/config-invariants.test.ts`: the exactly-four assertion becomes exactly-five with `Header` named. Keep the strength of the test: it must still fail if a sixth key appears or one is missing, with and without a theme, and when a consumer passes their own `components` through the escape hatch (read how the current test covers that and preserve each case).
2. Grep the repository for other statements of the count and list them for WP07 (docs and ADR text are WP07's): `grep -rn -i "four carrier\|four chrome\|exactly four\|4 carriers" src docs example/docs`.
3. `src/tests/glossary-generate.test.ts` mentions carriers; check whether it encodes the count.

## Subtask T036 — Neutrality and theme-header tests

**Steps**: create `src/tests/header-carrier.test.ts`.

1. **Neutrality (FR-025, NFR-007)**: build output with no theme header must have header markup byte-identical to a build made before the carrier existed. Practical form: capture the `<header class="header …">…</header>` block of two or three pages from a build at the commit before your change (store as a fixture, with the Astro scoped-class hashes normalised only if they would differ for reasons unrelated to this change — say exactly what you normalised and why) and compare against the current build. Do this on 100% of built pages in a looser form too: every page's header block equals the one captured from the same page pre-change, computed in a one-off script whose result you record in the hand-off.
2. **Replacement (FR-024)**: a fixture theme under `src/tests/fixtures/header-theme/` supplies a tiny header component for `dk:site-header` (include a skip link, since the contract makes that the theme's job). Build (own output directory) and assert: the fixture header's marker appears exactly once per page; Starlight's stock header markup is absent; there is no extra wrapper between `<body>`'s page container and the fixture header beyond what Starlight renders around any header override.
3. **Slot validation**: an unknown slot name is still rejected by the manifest.
4. Same-fixture pairing: tests 1 and 2 run against the same pages, so the ratchet in 1 cannot pass vacuously.

## Layout note

WP01 added a rule that insets the **stock** header's content by the frame gutter (`html[data-has-sidebar] header.header { padding-inline: … }`). A theme-supplied header may not use `header.header`. Do not try to style arbitrary replacement headers; record for WP07's documentation that a replacement header should use `--dk-frame-gutter` if it wants to follow a capped frame.

## Verification

`pnpm test`, `pnpm lint`, `pnpm typecheck`, `pnpm clean && pnpm build`, and the consumption tests if they run locally (`tests/consumption/`), since a new export and a new carrier specifier must resolve from the packed tarball.

## Branch Strategy

- Planning branch: `fix/sidebar-frame-header-carrier`. Final merge target for this mission: `fix/sidebar-frame-header-carrier` (a draft pull request to `main` follows; the owner merges).
- Execution worktrees are allocated per computed lane from `lanes.json`; do not pick a base branch by hand.
- Start with: `spec-kitty agent action implement WP06 --agent <name> --mission sidebar-frame-header-carrier-01M4T3CB`

## Definition of Done

- `Header.astro` exists, is wrapper-free, and is registered as the fifth carrier.
- `dk:site-header` is a valid slot; unknown slots are still rejected.
- The invariant test asserts exactly five carriers in all the cases it covered before.
- Neutrality proven against a pre-change build on every page; replacement proven with a fixture theme on the same pages.
- Every "four carriers" statement in `src/` is updated; the remaining ones in docs are listed for WP07.
- Out-of-map edits to `src/lib/config.ts` and `src/package.json` are listed with rationale.

## Risks

- **Byte-neutrality**: Astro can change scoped-class hashes or whitespace when a component is wrapped. If the fallback branch alters the output at all, that is a finding to resolve, not to normalise away.
- **Props/slots forwarding** to the default header in Starlight 0.32.
- **Resolution from a consumer install**: the carrier is addressed by package-export specifier.

## Reviewer Guidance

- Diff a built page's header block before and after: it must be empty.
- Check the invariant test still fails for six keys and for a missing key.
- Check the fixture header appears once and the stock header is gone.
