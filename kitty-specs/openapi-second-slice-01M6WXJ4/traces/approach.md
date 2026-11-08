# Approach

- **[2026-11-08][plan] Materialise once at config time.** Every OpenAPI surface reads one `MaterialisedSpec[]` computed in `defineDocKittyIntegrations`; bytes stay in the integration closure and metadata goes through the `DK_OPENAPI` env (plan.md, research R1).
- **[2026-11-08][plan] Red-first test seam.** WP01 lands failing fixtures and assertions that later WPs flip green, following the page-chrome lesson on late goldens.
