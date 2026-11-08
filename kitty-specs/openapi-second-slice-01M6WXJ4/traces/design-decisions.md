# Design decisions

- **[2026-11-08][spec] Maintainer decisions 1-5 and rulings R1-R21.** Bundled raw document, pinned remote with cache, archive glob with label pattern, unreleased entries kept on agent surfaces, same-operation switch target. Not reopened.
- **[2026-11-08][plan] Unreleased search exclusion via the getPageProps splice.** `pagefind: false` in the spliced frontmatter, so Starlight drops `data-pagefind-body` (research R2).
- **[2026-11-08][plan] Dev raw documents via Connect middleware.** Same materialised bytes as the build (research R3).
- **[2026-11-08][plan] Synthetic entries use existing vocabulary.** `type: reference`, `kind: Reference`, `doc_status: active`, explicit `released`; graph node kind `resource` (research R10, R11).
