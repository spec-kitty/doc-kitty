---
affected_files: []
cycle_number: 1
mission_slug: link-integrity-01M1PSEH
reproduction_command:
reviewed_at: '2026-09-04T18:53:10Z'
reviewer_agent: user
wp_id: WP01
---

# WP01 Review — Internal links resolve (#61/#63)

**Verdict: REJECT (changes requested).** The glossary base-prefix, glossary anchor,
and `withBase`/component work is correct and must be KEPT. Two issues block approval:
authored `.md`-relative links 404 in the built site (FR-004 / SC-002 unmet), and a
cross-WP gate (`assert:artifacts`) now fails because of the correct base-prefixing.

Reviewed diff: `git diff kitty/mission-link-integrity-01M1PSEH...HEAD -- src/ example/docs/`.
Verified against a clean build (`pnpm clean && pnpm build`, exit 0), `pnpm assert:artifacts`,
and `pnpm -C src test` (24 passing).

---

## CONFIRMED-GOOD — keep as-is (do NOT revert these)

1. **Glossary base-prefix (#61 / FR-001, C-001, NFR-002).** One shared
   `glossaryTermUrl(basePrefix, contextSlug, anchor)` builder in
   `src/lib/glossary/resolve.ts`, threaded via `config.ts`
   (`glossaryIntegration(docsDir, base)` → `normalizeBasePrefix(base)`) into BOTH
   `glossaryTerm` and `glossaryAutolink` factories, and reused by
   `OnThisPage.astro`. Verified: `grep -rhoE 'href="/glossary/[^"]*"' example/dist
   --include='*.html' | grep -vc /doc-kitty` → **0**; term hrefs render as
   `/doc-kitty/glossary/shipping/#cargo`. Autolink / `:term` / preview are
   single-sourced (NFR-002 met).

2. **Glossary anchors (#63 / FR-002, C-004).** `generate.ts` `renderTerm` now emits
   the block-form attribute line (`{#anchor}` paragraph above the heading) instead
   of inline `## name {#anchor}`. Verified on `example/dist/glossary/shipping/index.html`:
   no literal `{#`, `id="cargo"` present exactly once (not `cargo-cargo`), visible
   heading text unchanged.

3. **`withBase` helper + components (FR-003, C-002, NFR-002).** One helper in
   `src/lib/with-base.ts` (idempotent, skips scheme/`//`/`#`/relative), wired into
   `Related.astro`, `OnThisPage.astro` (section + glossary sub-list), and
   `Audience.astro` (via `resolveProfile`'s `withBase(routeFor(...))`). Verified in
   dist: Related/Audience hrefs base-prefixed (e.g.
   `/doc-kitty/architecture/superseded-note/`, `/doc-kitty/context/audience/example-persona/`).

4. **Deliberate base-less `routeFor` (agent-API / route-parity contract).** Keeping
   `metadata.ts routeFor` base-less and applying `withBase` only at the
   `resolveProfile` href site is the correct call — it preserves the base-less
   `route` field consumed by `assert-build-artifacts.mjs` (BA-3 deck-route-parity)
   and `agent-api.test.ts`, while still base-prefixing the reader-facing Audience
   link. Keep this split. **Do NOT** move `withBase` into `routeFor` (would double the
   agent-API contract). No double-prefixing observed.

5. **Tests (T007).** `src/tests/link-integrity.test.ts` genuinely invokes the
   production paths (`withBase`, `glossaryTermUrl`, `computePageLinks` pipeline run)
   and asserts base-prefix + anchor identity; not synthetic fixtures. 24 tests pass.

---

## REQUIRED FIX A [BLOCKER] — authored `.md`-relative links 404 (FR-004 / SC-002)

**Root cause of the miss:** research D2 assumed Astro rewrites `./target.md` to the
base-prefixed route. In this Starlight dynamic-route architecture it does **not** —
the `.md` href is emitted verbatim into the HTML and 404s.

**Evidence (clean build):**
- `grep -oE 'href="[^"]*blocks-demonstrator[^"]*"'
  example/dist/architecture/superseded-note/index.html` →
  `href="./blocks-demonstrator.md"` (the authored inline link — broken; the route is
  `architecture/blocks-demonstrator/`, no `blocks-demonstrator.md` target exists).
- All re-authored `.md` links render un-rewritten in dist:
  `./blocks-demonstrator.md`, `./superseded-note.md`, `./overview.md`,
  `../context/audience/example-persona.md`, `./mission-alpha.md`, `./mission-beta.md`,
  `./getting-started.md`, `./template.md`, `./2026-08-21-v0.1.0.md` — i.e. all 8
  offenders across superseded-note, blocks-demonstrator (×3), mission-alpha,
  mission-beta, and the 4 READMEs.

**Fix (DIRECTIVE_024 shared-seam, replaces D2):**
1. **Drop the `.md`-relative approach.** Author these internal content links as
   ROOT-ABSOLUTE canonical routes, e.g. `[…](/architecture/blocks-demonstrator/)`,
   `[…](/architecture/overview/)`, `[…](/architecture/superseded-note/)`,
   `[…](/context/audience/example-persona/)`, `[…](/plans/missions/mission-beta/)`,
   `[…](/adr/template/)`, `[…](/guides/getting-started/)`,
   `[…](/changelog/2026-08-21-v0.1.0/)`.
2. **Add a rehype plugin on the markdown pipeline** — e.g.
   `src/lib/rehype/base-absolute-links.ts` — that prefixes the site base onto
   root-absolute internal `href`s in rendered markdown. Skip: external (`http(s):`),
   `mailto:`/`tel:`, protocol-relative `//`, anchor-only `#…`, and hrefs already
   starting with the base (`/doc-kitty`). Wire it into `config.ts` `rehypePlugins`
   (thread the same `normalizeBasePrefix(base)` value already threaded to the
   glossary factories — one base source). This is the shared seam that makes SC-002
   achievable for authored content links, mirroring the glossary/component seams.
3. **Re-verify:** 0 internal links in `example/dist` that resolve (as URLs) to a
   missing page, including the 8 authored ones. A useful check is that no
   `href="…\.md"` and no base-less internal `href` survives in dist. Add a red→green
   test/assertion that actually exercises an authored link through the built pipeline
   (the current suite covers `withBase`/`glossaryTermUrl` units but nothing proves an
   authored content link resolves in dist — that gap is why this shipped).

---

## REQUIRED FIX B [MAJOR] — cross-WP gate regression (`assert:artifacts`)

Correct base-prefixing of Related-card hrefs broke a gate whose expected value is
hardcoded base-less.

**Evidence:** `pnpm assert:artifacts` → exit 1:
`assert:chrome: FAIL — demonstrator: no related card links the stale target
/architecture/superseded-note/ on architecture/blocks-demonstrator/index.html`.
The card now (correctly) emits `href="/doc-kitty/architecture/superseded-note/"`, but
`src/scripts/assert-chrome-artifacts.mjs` matches exactly:
- `DEMO_STALE_TARGET_HREF = '/architecture/superseded-note/'` (line 226)
- `DEMO_CURRENT_TARGET_HREF = '/architecture/overview/'` (line 231)
used via `cardAnchor(demoHtml, 'dk-related-card', <href>)` which requires an exact
`href="<href>"` substring. `git log kitty/mission-link-integrity-01M1PSEH..HEAD --
src/scripts/assert-chrome-artifacts.mjs` is empty — WP01 did not update it.

**Fix:** update the two hardcoded expected hrefs to the base-prefixed values
(`/doc-kitty/architecture/superseded-note/`, `/doc-kitty/architecture/overview/`).
This is a justified out-of-owned-map edit — the base-prefix change legitimately
changed the emitted href, and the gate asserts on that href. Record a one-line
rationale in the commit/move-task note. (Coordination: `assert-chrome-artifacts.mjs`
is shared gate surface; this edit is the cross-WP note.) Re-run `pnpm assert:artifacts`
→ must exit 0.

---

## SECONDARY (note; scope call for orchestrator) — redirect config is base-less

Not one of the 8 authored links and outside WP01's owned surface
(`example/astro.config.mjs`), but it is a real SC-001/NFR-001 violation the mission
should not leave standing:

- 3 base-less internal hrefs survive in dist:
  `example/dist/{plans/features/mission-beta,plans/features/mission-alpha,guides/old-getting-started}/index.html`.
- Source: the `REDIRECTS` map in `example/astro.config.mjs` (lines 47–49) declares
  targets base-less (`/guides/getting-started/`, `/plans/missions/mission-alpha/`,
  `/plans/missions/mission-beta/`). The generated redirect stub also emits a base-less
  canonical URL (`https://spec-kitty.github.io/guides/getting-started/`, missing
  `/doc-kitty`), so the redirect itself lands on a 404.

Decide whether to fold this into WP01 (astro.config is out of owned_files) or route it
to WP02 / a follow-up. Flagging so "0 base-less internal hrefs" (DoD/SC-001) is not
declared met while these remain.

---

## Anti-pattern checklist

1. Dead code — PASS (`withBase`, `glossaryTermUrl` have live callers).
2. Synthetic-fixture test — PASS (tests invoke production paths).
3. Silent empty return — PASS (`withBase` pass-through branches documented).
4. FR coverage — **FAIL** (FR-004 authored links have no resolving test and are broken in dist).
5. Frozen surface — PASS (no frozen file modified).
6. Locked decision — PASS (no MUST-NOT contradicted).
7. Shared-file ownership — **FAIL** (`assert-chrome-artifacts.mjs` gate regressed with no coordination edit — Fix B).
8. Production fragility — PASS (no new `raise`/throw on a transient path).

## What to hand back green
- `pnpm build` exit 0; 0 base-less internal hrefs AND 0 internal `.md`/relative links
  that 404 in `example/dist` (incl. the 8 authored links).
- `pnpm assert:artifacts` exit 0.
- `pnpm -C src test`, `pnpm lint` green; a new red→green test exercising an authored
  content link through the built pipeline.
