# Research: Determinism hardening (#87 + #88)

## D1 — #87 sitemap hook location and XML shape

- `@astrojs/sitemap` is registered in `defineDocKittyIntegrations`
  (`src/lib/config.ts:856`) and never sorts; it serializes Astro's route order,
  which for Starlight docs routes is the concurrent glob loader's completion
  order (the #85 root cause, unreachable from `collectDocEntries`).
- The toolkit already owns two `astro:build:done` dist-rewriting integrations:
  `src/lib/favicon.ts:135` and `src/lib/manifest.ts:177`. The new
  `doc-kitty:sitemap-order` integration copies the favicon idiom (resolve
  `path.join(fileURLToPath(dir), 'sitemap-0.xml')`, read, rewrite) and is
  appended to the integrations array AFTER the `sitemap(...)` entry so the file
  already exists.
- Emitted shape (demonstrator): `sitemap-index.xml` (one `<sitemap><loc>` to
  `sitemap-0.xml`) and `sitemap-0.xml` — single line, no inter-tag whitespace,
  30 × `<url><loc>URL</loc></url>` inside `<urlset …>`, each `<url>` carrying
  **only** `<loc>`. Sort whole `<url>…</url>` blocks by `<loc>` text.

## D2 — #88 site table (byte-neutral unless noted)

Grounded in the built demonstrator; **no two docs pages share a title**, so every
`title.localeCompare` fallthrough is already total there.

| Site | Comparator | Fix | Byte impact |
|------|-----------|-----|-------------|
| `metadata.ts:502` `rankForAgents` | section → priority desc → `title.localeCompare` | pin title locale; APPEND `compareCodeUnit(slug)` tiebreak | **byte-neutral IF appended** (titles unique; slug never fires). Replacing title→slug WOULD reorder the priority-0.5 `context` trio (Marzipan ahead of Domain) — do NOT. |
| `routes/llms-txt.ts:99` section sort | `sectionRank` only | append `compareCodeUnit` on section key | byte-neutral (one unregistered section) |
| `hub-children.mjs:63` `selectHubChildren` | section → `title.localeCompare` | pin locale; append `compareCodeUnit(slug)` | byte-neutral (no hub has duplicate-titled children) |
| `sections.ts:87` `byOrderThenId` | `order` → `id.localeCompare` | route id compare through `compareCodeUnit` | byte-neutral (ids ASCII, unique) — .mjs twin `vocabulary-loader.mjs:121` |
| `catalog.ts:84` | `id.localeCompare` | `compareCodeUnit` | byte-neutral (bib ids lowercase ascii) |
| `metadata.ts:457` `resolveIndexEntries` | `rankOf` → `localeCompare` | `compareCodeUnit` | byte-neutral (paths unique) — .mjs twin `vocabulary-core.mjs:501` |
| `glossary/generate.ts:200` | inline `a<b?-1:...` (context name) | import `compareCodeUnit` | byte-neutral (pure dedupe) |
| `glossary/definitions-payload.ts:123` | inline `a<b?-1:...` (term name) | import `compareCodeUnit` | byte-neutral (pure dedupe) |
| `generate-adr-index.mjs:150,190` | `number.localeCompare` | `compareCodeUnit` | byte-neutral (zero-padded digits) |
| Audience/Related/OnThisPage `.astro`; `Hub.astro:91` | inline `buildDocsIndex`/`collectDocEntries` copies | call shared helper | byte-neutral / order-insensitive (keyed maps); Hub gets #85's slug baseline |

## D3 — Shared comparator home

`vocabulary-core.mjs` is the pure-ESM core already imported by both the `.ts`
side (`schema.ts`, `metadata.ts`, `sections.ts`) and the `.mjs` side
(`vocabulary-loader.mjs`, `new-doc.mjs`, `scaffold.mjs`, `validate-frontmatter.mjs`).
Define `compareCodeUnit(a, b)` there; `metadata.ts` re-exports it as `compareSlug`
(moving #85's body down). `hub-children.mjs`, `vocabulary-core.mjs:501`, and
`vocabulary-loader.mjs:121` import it directly.

## D4 — Locale pinning

Titles (`rankForAgents`, `hub-children`) keep `localeCompare` for human
alphabetic order, pinned to a fixed locale (e.g. `'en'`) for reproducibility,
with `compareCodeUnit(slug)` appended for totality. id/path/number sorts move to
`compareCodeUnit` outright (byte-neutral, one comparator). The oracle verifies the
pinned-locale title order does not reorder the demonstrator; if it does, drop the
pin and keep the bare title compare + appended slug (still total; the residual
title-locale exposure is then documented, not fixed, for those two sites).

## D5 — Squad outcome (WP02/#88)

- reviewer-renata: APPROVE. Byte-neutrality of the 'en' title-pin and the
  code-unit path collation confirmed by the orchestrator oracle (example/dist
  diff vs baseline EMPTY; api/index.json + llms.txt byte-identical).
- paula-patterns: ship. Every #88 duplication/non-total hazard closed;
  compareCodeUnit single-source; twins synced; Hub deferral sound (its
  determinism is already closed by selectHubChildren being intrinsically total).
  FOLLOW-UPS (not folds), filed as #90: (a) move collectDocEntries/buildDocsIndex
  out of route-scoped routes/shared.ts into a neutrally-named owner shared by
  routes AND components; (b) a body-carrying shared collection variant so
  Hub.astro (ADR cards read entry.body) can drop its inline copy too.
- Orchestrator did the clean slot-component dedup (Audience/Related/OnThisPage →
  shared collectDocEntries+buildDocsIndex); byte-identical to the WP02 build.
- paula NIT (actioned in WP01): the pinned integrations-baseline test
  (tests/markua-attributes.test.ts) must be updated for the new
  doc-kitty:sitemap-order integration.
