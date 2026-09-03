# Research & Decisions — Adopter loader & migration

Consolidated from the pre-spec grounding squad (alignment + scope lenses) and the post-spec adversarial squad (completeness + boundary lenses). Every decision is grounded in a real seam on `main` @ `6751aa9`.

## D-01 — `index.md` detection mechanism

- **Decision**: Broaden `readmeToIndexId` (`src/lib/metadata.ts:374`) to `/(^|\/)(README|index)$/i` and add an `indexBasename` option (default `README`) threaded through the content loader. Case-insensitive.
- **Rationale**: The regex is the single derivation the loader, config, routes, and llms.txt all route through; broadening it once covers the TS surfaces. README default keeps the current corpus a no-op (C-001).
- **Alternatives**: A separate `index-config.yaml` (rejected — an option is sufficient, avoids a new file). Hardcoding both names with no default control (rejected — removes the opt-out an existing adopter needs).

## D-02 — Bare-Node gate twin

- **Decision**: Add an index-detection twin to `src/scripts/validate-frontmatter.mjs` (which today only knows the literal `'README.md'` at :340) and extend the root-index exemption (:384-388) to `index.md`. Guard it with the parity tests (D-06).
- **Rationale**: The gate runs in bare Node with **no** Astro build context, so it cannot import the build-coupled `readmeToIndexId`. A mirrored twin is the only option short of the #49 consolidation.
- **Alternatives**: Import the TS helper into the gate (rejected — that *is* #49, explicitly OUT, and needs a build context the gate lacks). Skip the gate side (rejected — the partial-adoption trap: loader accepts `index.md`, gate rejects it).

## D-03 — Section rename: registry `subtypes` field

- **Decision**: Promote the hardcoded sub-path subtype table (`metadata.ts:231-242` + `validate-frontmatter.mjs:224-233`) to an **optional `subtypes` field** on the section registry (`sections.yaml`), resolved in `sections.ts` (the deferred seam ~585). Derivation order: authored `type` > registry `subtypes` > built-in table (fallback) > section default. Both twins consult the field.
- **Rationale**: This is the post-spec BLOCKER resolution. #48's own example (`plans/features → plans/missions`) is a *sub-path* rename; against the literal `switch` it reverts to the section default. Only a data-driven field makes the rename data-only (SC-002) without a per-rename code edit. The built-in table stays as fallback so doc-kitty's own tree is unaffected (NFR-003).
- **Alternatives**: Narrow FR-004 to top-level renames only (rejected — does not satisfy #48's stated example). Edit the two-twin `switch` per adopter (rejected — the whack-a-field anti-pattern the mission exists to remove).

## D-04 — Redirect emission

- **Decision**: Use Astro's native `redirects` config in `example/astro.config.mjs`; optionally emit a host `_redirects` file. No new dependency.
- **Rationale**: Astro ships first-class redirect support that produces the static redirect the adopter needs; reusing it avoids a bespoke middleware and a new dep.
- **Alternatives**: Custom middleware / rewrite plugin (rejected — heavier, non-static). A third-party redirect package (rejected — unnecessary supply-chain surface).

## D-05 — Redirect-coverage gate

- **Decision**: A new bare-Node `src/scripts/check-redirect-coverage.mjs`, patterned off `check-links.mjs:75-86` and `assert-build-artifacts.mjs`. Inputs: the committed URL baseline, the redirect map, and the built `dist/`. It fails when a baselined old URL has neither a live page nor a redirect whose **target resolves** (chains followed to a live terminus). Deterministic, no Astro build spawned.
- **Rationale**: Mirrors the existing sanity-gate pattern (bare Node, deterministic, CI-wired). Target-awareness (post-spec BLOCKER B1) is the whole point — a redirect to a 404 *is* a live 404.
- **Alternatives**: A Playwright crawl of the built site (rejected — needs a served build, heavy, non-deterministic vs. NFR-002). Source-only coverage (rejected — the B1 defect).

## D-06 — Twin parity guard extension

- **Decision**: Extend `section-type-parity.test.ts` and `schema-validator-parity.test.ts` to cover the new basename detection and the registry-`subtypes` derivation across both twins. Parity **test** in scope; full single-source consolidation (#49) OUT (C-003).
- **Rationale**: The mission *adds* two mirrored code paths; guarding them is the honest containment of the split-brain it enlarges, consistent with the #38/#40 NFR-004 precedent.

## D-07 — URL baseline provenance

- **Decision**: The URL baseline is a **committed artifact** captured before the change (NFR-005); the gate never derives it from the current build.
- **Rationale**: A self-referential baseline can never fail against real drift (post-spec MAJOR M3).

## D-08 — Dependencies / supply-chain

- **Decision**: **No new dependency.** Redirects via Astro native; YAML/schema via installed `js-yaml`/`zod`.
- **Rationale**: DIRECTIVE_051 — the cheapest supply-chain posture is adding nothing. If implementation finds a real need, apply the directive (authenticity/freshness/lifecycle-scripts/Node-LTS) and record here before adding.

## Adversarial evidence (post-spec squad dispositions)

Per `contracts/adversarial-evidence-contract.md`, no contested finding silently dropped:

| Finding | Disposition |
|---|---|
| paula B1 — FR-004 sub-path rename can't be data-only vs SC-002 | **changed** — registry `subtypes` pulled in scope (D-03); SC-002 reworded to "no per-rename edit". |
| annie B1 — redirect gate accepts redirect-to-dead-target | **changed** — FR-010 made target-aware + US3-AS4 (D-05). |
| annie M1 / paula M2 — FR-003 surface list untested / omits mjs+check-links | **changed** — FR-003 reconciled; per-surface acceptance scenarios; mjs twin (D-02). |
| annie M2 — #48 rename→redirect linkage dropped | **changed** — FR-011 + US3-AS5. |
| annie M3 — no baseline-provenance FR | **changed** — FR-008 + NFR-005 (D-07). |
| paula M3 — ADR-0029 sidebar group survival unasserted | **changed** — FR-007 + US2-AS4. |
| annie M4 — both-index collision undefined | **changed** — FR-004 + edge case. |
| annie m1/m2/m3/m4/m5 — minors | **changed** — folded (fallback warning, root index, case policy, NFR-002 ceiling, redirect chains). |
| paula M4 — ADR must name ADR-0004 reversal | **accepted** — C-007 requires the reversal stated in words. |
| paula M5 — C-006 over-broad (era typing shipped) | **accepted** — C-006 narrowed to era-path routing. |
| Confirmed sound: #43/#49/#39/corpus OUT, US3 greenfield ADR, C-002, build order | **accepted** — no change. |
