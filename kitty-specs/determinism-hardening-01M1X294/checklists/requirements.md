# Specification Quality Checklist: Determinism hardening (#87 + #88)

**Created**: 2026-09-07 · **Feature**: [spec.md](../spec.md)

## Content Quality
- [x] Behaviour stated as outcomes (reproducible sitemap; intrinsic-total rankers; one comparator)
- [x] The one intentional built-bytes change (sitemap order) is explicit; everything else byte-neutral
- [x] All mandatory sections completed

## Requirement Completeness
- [x] No [NEEDS CLARIFICATION] markers
- [x] Requirements testable (two-build hash; shuffle tests; pre/post corpus diff; parity twins)
- [x] FR / NFR / C separated, IDs unique, Status populated, thresholds measurable
- [x] Success criteria measurable
- [x] Edge cases identified (pagination; locale pin fallback; id/path collation; no metadata.mjs twin)
- [x] Scope bounded (byte-neutral except sitemap, C-001); no dependency (C-003)

## Feature Readiness
- [x] Acceptance scenarios cover all four stories and the oracle
