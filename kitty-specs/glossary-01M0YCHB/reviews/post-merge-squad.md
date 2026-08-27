# Post-merge adversarial squad — Glossary + Contextive (M4)

Three independent profile-loaded lenses reviewed the **merged** feature on `feat/glossary`
(read-only). All three returned **no merge blocker** — every finding is dormant behind an
input shape the example corpus does not contain (MDX pages, slug-colliding/non-ASCII term
names, a malicious contributor `.contextive`). Dispositions below: `fixed` = remediated on
`feat/glossary` before the PR; `follow-up` = filed as a tracked issue; `accepted` = confirmed
sound.

## Lenses

1. **reviewer-renata** — security (author/contributor trust model)
2. **reviewer-renata** — spec fidelity (FR-by-FR delivery + documented deviations)
3. **debugger-debbie** — correctness (latent bugs the tests didn't catch)

## Findings & dispositions

### Security

| # | Sev | Finding | Disposition |
|---|-----|---------|-------------|
| S-1 | MED | `serializeDefinitionsPayload` was a bare `JSON.stringify` dropped into a raw-text `<script>` element (no entity escaping there), so a `</script>` in a term name or inline-code definition breaks out → stored XSS. The module even *claimed* injection-safety it lacked. | **fixed** — escape `<`→`<` (+ U+2028/U+2029) in `serializeDefinitionsPayload`; JSON.parse decodes it back so the island reads true text, but `</script>`/`<!--` can no longer form. |
| S-2 | MED | `generate.ts renderMeta` rendered a non-`http(s)` meta value **verbatim as markdown**; a value like `[x](javascript:alert(1))` passes `safeHref` as "relative" and re-parses into a live `javascript:` href (no `rehype-sanitize` wired). | **fixed** — render only a clean whitespace/bracket-free `http(s)` URL as a markdown link; everything else as inert inline code (markdown treats code content as literal — no href forms). Closes the http(s)-trailing-markdown edge too. |
| S-3 | LOW | Generated pages emit term fields as raw markdown (HTML passthrough on). | **accepted** — the site-wide "markdown authors are trusted" model; not a new boundary. Noted in the contract. |
| S-4 | LOW | A context name of only non-alphanumerics slugs to `""` → collides onto the hub. | **follow-up** (folded into the anchor-hardening issue). Not a traversal escape (`slug` cannot emit `..`/`/` — confirmed). |
| — | ✔ | Path traversal (slug-safe), anchor href scheme injection (hardcoded internal path), `data-glossary-*` attribute injection (serializer-escaped), hover island (`JSON.parse`+`textContent`, no `eval`/`innerHTML`), supply chain (exact-pinned unifiedjs packages, no install lifecycle scripts). | **accepted — sound** |

### Correctness

| # | Sev | Finding | Disposition |
|---|-----|---------|-------------|
| C-1 | MED | The render-time re-derive (`OnThisPage.linksForBody`) builds its own `remarkParse → remarkDirective → glossary-term → computePageLinks` processor — **without gfm/MDX/deckSplit**, unlike the build pipeline. On an **MDX** page (globbed `**/*.{md,mdx}`) or a gfm-autolink literal, the re-derive over-counts → a phantom "glossary links used" entry. The corpus is all `.md` with no gfm-autolinked surfaces, so they agree today. | **follow-up** — the reviewer explicitly says fix structurally, not point-patch: source `linksUsed` from the real build tree, or build one shared `unified()` processor factory configured identically to the build, imported by both `linksForBody` and `stripMarkdown`. Filed. |
| C-2 | MED | No anchor-uniqueness guard: distinct names that slug to the same string (`C`/`C++`/`C#`→`c`; non-ASCII→`""`) collide on one DOM id and one resolver target; empty slug ships `#`. `buildIndex` + `renderTerm` both recompute `slug` with no de-collision/empty check. | **follow-up** — per-context anchor de-collision (suffix `-2`/`-3`) computed once in `buildIndex`, consumed by `generate.ts` + `resolveSurface`, plus build-fatal on empty slug; reuse for the same-context duplicate diagnostic (C-3) and the ASCII-only word-boundary (non-ASCII adjacency). Filed. |
| C-3 | LOW | An intra-context duplicate surface resolves silently first-wins, no diagnostic. | **follow-up** (folded into C-2's `buildIndex` hardening). |
| C-4 | LOW | `stripMarkdown` (payload) parses without gfm → a gfm table/strikethrough definition previews differently than the page renders. | **follow-up** (same shared-processor class as C-1). |
| — | ✔ | Determinism/NFR-004 (code-point sorts, pure `slug`, insertion-order Maps), `entry.body` frontmatter parity, `process.cwd()` root parity, `glossary_autolink:false` path, deck skip, warning dedup (one per distinct surface per page), ignore-list lowercasing, `collectLinksUsed` anchor recompute. | **accepted — sound** |

### Fidelity

All 15 FRs **delivered in code** (verified, not just referenced); FR-013 generators-pickup delivered, its named-group relocation an honestly-documented descope; terminology clean (zero banned synonyms as domain vocabulary); the AS-3 seam genuinely remediated (re-derive reuses the pure exports, `:term`-inclusive, presence-gated single-owned mount).

| # | Sev | Finding | Disposition |
|---|-----|---------|-------------|
| F-1 | LOW | Spec-phase changelog line stated the `sections.yaml` relocation as shipped. | **fixed** — reconciled to tree-autogen + deferred relocation. |
| F-2 | LOW | `types.ts` `GlossaryLinkUsed` comment still described the retired `remarkPluginFrontmatter` channel. | **fixed** — updated to the render-time re-derive. |
| F-3 | LOW | `OnThisPage` sub-list order (Related→External→Glossary) vs FR-010's enumeration, unannotated. | **fixed** — added a comment (order follows the M3 carrier for byte-identity; FR-010's enumeration is descriptive; the load-bearing "stable order" governs the glossary sub-list). |

## Outcome

No finding blocks the PR. The two security MEDs and three fidelity LOWs are **remediated on
`feat/glossary`** before the PR (279 tests + browser-free build + a11y still green, generated
pages unchanged). The two structural correctness MEDs (processor divergence; anchor
de-collision) + their LOW siblings and the security LOW are **filed as tracked follow-ups**
(the reviewers explicitly advised a single structural fix over point-patching). No finding was
silently dropped.
