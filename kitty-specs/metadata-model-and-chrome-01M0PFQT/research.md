# Research — Metadata model and chrome (M1)

Most decisions are already settled in ADRs; this records the few mechanism
choices M1 makes and the adversarial-evidence disposition from the post-spec
squad. No open `[NEEDS CLARIFICATION]` remain.

## Settled by ADR (implement, do not re-open)

- **`status` → `doc_status`**, same enum — ADR-0005.
- **`kind` required, open vocabulary, drives per-kind layout** — ADR-0009 + the
  planning kinds in ADR-0010.
- **`related` (bare | `{ref,note}`), `external_references`, `hero_image`/`social_thumb`
  (renamed from `banner`), authored `type`, freshness** — ADR-0009 / ADR-0011.
- **Four carriers + `kind→layout` resolution in-frame; `Presentation` is the only
  out-of-frame kind (not built in M1)** — ADR-0011.
- **M1 ships the degenerate single-layer substrate; M2 grows it to the merged
  manifest** — ADR-0013 (authored this mission).

## Mechanism decisions M1 makes

### D1 — Sitemap draft-exclusion

- **Decision**: Add a `filter` to the `@astrojs/sitemap` integration that drops the
  URL of any page whose `doc_status` is `draft` (compute the draft URL set from the
  docs collection at config time).
- **Rationale**: `@astrojs/sitemap` crawls emitted HTML, so `isPublished` (which
  gates the RSS/llms/agent generators) does not touch it; M0 accepted a 13-loc
  sitemap. The convention requires drafts absent from `sitemap.xml`, so M1 needs an
  explicit filter. `assert-build-artifacts.mjs` then asserts the draft URL is absent
  and the loc count matches the published set.
- **Alternatives**: Starlight `draft: true` frontmatter (rejected — couples to a
  Starlight field, not our `doc_status`, and hides the page from dev too); not
  rendering draft pages (rejected — drafts must still render for preview).

### D2 — `type` validation with a registry-less root

- **Decision**: Keep the validator's built-in section→type map (+ the short
  sub-path override table) as the authority, reading `docs/_meta/sections.yaml`
  where present; a root without a registry (`example/docs/`) degrades gracefully
  via the built-in map. Do not make a registry a hard dependency of validation.
- **Rationale**: `example/docs/` has no `_meta/sections.yaml`; the validator runs on
  both roots. Section-registry.md says the sub-path overrides live in the loader
  today. This keeps `doc-sanity` green on both trees with no new required file.
- **Alternatives**: add `example/docs/_meta/sections.yaml` (optional, deferred —
  not needed for green CI); hard registry dependency (rejected — breaks the example
  root).

### D3 — WCAG AA verification without Playwright

- **Decision**: Verify text-label presence and hero `alt` by HTML string assertion;
  verify contrast, ≥24px target size, and visible focus **by construction** — assert
  the emitted CSS declares `min-height`/`min-width ≥24px` on interactive targets and
  a `:focus-visible` rule, and that chrome uses only the pre-verified AA `--dk-*`
  state/`-bg` token pairs (theming.md contrast summary). Residual pixel checks go on
  a manual checklist.
- **Rationale**: Playwright/axe is deferred to M2 (C-002); build-time HTML/CSS
  assertions are the only automated M1 signal. Token pairs are AA-checked in
  theming-spec-kitty-brand.md; the neutral Default catalog is derived to the same
  bar.
- **Alternatives**: pull Playwright forward (rejected — M2 boundary); leave AA
  unasserted (rejected — anti-laziness).

### D4 — Carrier packaging

- **Decision**: Ship the four `.astro` carriers and the `Default`/`Hub` layouts from
  the toolkit via new `./components/*` and `./layouts/*` export entries (+ `files[]`),
  resolved from `example/`'s `workspace:*` dependency; the token catalog expands
  `src/styles/theme.css` shipped through the existing `./styles/*` export.
- **Rationale**: The toolkit ships zero `.astro` today; theming.md says doc-kitty
  registers the carriers, so they belong in the toolkit (consumers get them). ADR-0013.
- **Alternatives**: carriers in `example/` only (rejected — throwaway; theming.md
  says the toolkit owns them).

## Supply-chain (DIRECTIVE_051)

No dependency added/upgraded/removed (NFR-006). Registry-authenticity /
lifecycle-script review **N/A this mission** — examined, not skipped. Any
unexpected new dep triggers the `supply-chain-install-safety` check with a
recorded disposition before adoption.

## Adversarial evidence (post-spec squad)

Full record: [reviews/post-spec-squad.md](./reviews/post-spec-squad.md). All
contested findings were **accepted** and folded into spec.md rev 2 + ADR-0013;
none deferred, none dropped. Convergent, independently-raised findings
(AA-testability, Pagefind assertion, social-thumb per-branch tests, the
`example/docs` registry gap, the atomic-cutover invariant) carried the most
weight. No finding required a second-opinion delegate (the four lenses were
complementary and non-contradictory).
