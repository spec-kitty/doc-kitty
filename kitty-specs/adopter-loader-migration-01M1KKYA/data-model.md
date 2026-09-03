# Data Model — Adopter loader & migration

No database. The "data" is toolkit configuration and committed artifacts. Entities below are the shapes the design introduces or extends.

## E-01 — `indexBasename` option

- **Where**: the toolkit loader/config surface (`schema.ts` loader, `metadata.ts`, `config.ts`, routes).
- **Shape**: `indexBasename?: string | string[]` — default `"README"`. One or more basenames (no extension), matched case-insensitively against the leaf filename. A **set** of basenames lets one build collapse both `README` and `index` sections simultaneously (needed for the mixed-basename example — resolves anti-laziness M2).
- **Invariant**: only a *configured* basename collapses to the section slug; the default (`"README"` only) leaves any stray `index.md` as an ordinary page, so an existing README corpus is untouched (NFR-003). When a folder holds two configured basenames, E-05 collision applies.
- **Example config**: `indexBasename: ['README', 'index']` — both collapse; used by the worked example so README sections and an `index.md` section coexist in one build.

## E-02 — Section registry `subtypes` field (new)

- **Where**: `docs/_meta/sections.yaml` per-section entry; zod in `schema.ts`; resolver in `sections.ts`.
- **Shape** (optional, additive):
  ```yaml
  sections:
    - id: plans
      type: Plan
      subtypes:                # NEW — optional
        - match: missions       # first sub-path segment under the section folder
          type: Mission
        - match: features
          type: Feature
  ```
- **Semantics**: when a page's path is `plans/<seg>/…` and `<seg>` matches a `subtypes[].match`, its derived type is that entry's `type`. Absent field ⇒ fall back to the built-in table (backward-compatible for doc-kitty's own tree).
- **Invariant**: `subtypes` is data-only; renaming the folder + updating `match` is the entire change — no derivation code edit.

## E-03 — Redirect map

- **Where**: `example/astro.config.mjs` (`redirects`), optionally emitted `_redirects`.
- **Shape**: `{ [oldPath: string]: string /* newPath */ }` (Astro's native form), e.g. `{ '/plans/features/foo/': '/plans/missions/foo/' }`.
- **Invariant**: every `to` target must resolve to a live page or another redirect terminating in one (enforced by the gate, E-06).

## E-04 — URL baseline artifact (new, committed)

- **Where**: a committed file under the example (e.g. `example/url-baseline.txt` or `.json`).
- **Shape**: a list of absolute site paths that must keep resolving, captured **before** the change.
- **Invariant**: version-controlled; never regenerated from the current build (NFR-005).

## E-05 — Index collision rule (FR-004)

- **Inputs**: a folder containing both `README.md` and `index.md`.
- **Rule**: the configured `indexBasename` wins as the section index; the loser is demoted to an ordinary page; a warning names the collision. Deterministic, no silent resolution.

## E-06 — Derived-type resolution order (authoritative)

For a page with no authored `type`:

```
authored type (if present, wins)
  └─ registry subtypes[].match on first sub-path segment   (E-02)
       └─ built-in sub-path table (fallback)                (metadata.ts / .mjs twin)
            └─ section-level default from registry `type`    (sectionTypes)
```

Both the TS lib and the bare-Node validator MUST implement this identical order (guarded by the parity tests). A section id with no registry entry falls to the documented default with a warning (US2-AS5).

## E-08 — Example redirect/rename fixture contract (frozen shared datum)

Removes the WP02↔WP04 ordering hazard (anti-laziness M4). WP02 and WP04 both touch the redirect story but land in dependency order (WP02 before WP04); the coverage gate must be green at **each** commit.

- **WP02 seeds a self-contained fixture** whose baseline + redirect map reference **only URLs that already exist** in the example at WP02 time (e.g. redirect one old alias path to an existing example page). This is green standalone — the gate does not depend on any rename existing yet.
- **WP04 extends** the same baseline + redirect map for the section it renames, using these frozen values (recorded here so both WPs agree without an informal handshake):
  - renamed section: `example/docs/plans/features/` → `example/docs/plans/missions/` (WP04 confirms the example actually has this section; if not, WP04 picks a real one and updates this datum before starting).
  - old URL prefix: `/plans/features/…` → new URL prefix: `/plans/missions/…`.
  - registry: add `subtypes: [{ match: missions, type: Mission }]` under the `plans` section in `example/docs/_meta/sections.yaml`.
- **Ownership**: `example/astro.config.mjs` (redirects **and** `indexBasename: ['README','index']`) and `example/url-baseline.txt` are WP02-owned; WP02 seeds them so they are green, and includes the frozen new-URL redirect so WP04's rename lands green. WP04 owns only `example/docs/**` + its test.
- **Gate meaningfulness**: the end-to-end rename→redirect proof is complete only after WP04; WP02's fixture proves the gate mechanism (pass + both failure modes) independently.

## E-07 — Coverage-gate verdict model

- **Inputs**: URL baseline (E-04), redirect map (E-03), built `dist/`.
- **Per-URL verdict**: `covered` if a live page exists at the URL, OR a redirect exists whose target chain terminates at a live page; else `uncovered` (fail) — a redirect to a dead/looping target is `uncovered` and named.
- **Gate result**: pass iff every baselined URL is `covered`.
