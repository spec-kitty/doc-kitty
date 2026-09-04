# Contracts — link-integrity

Internal-link resolution + gate invariants (see [`../data-model.md`]—N/A; see spec + research):
- Every internal `<a href>` in `example/dist` carries the site base and resolves as a URL (trailing-slash directory semantics) to a real page/asset — asserted by `assert:no-broken-links` (base-aware dist walk).
- Glossary term links (autolink/`:term`/preview) share one base-aware builder; component links share one `withBase`.
- Authored internal content links are root-absolute routes, base-prefixed by the `base-absolute-links` rehype plugin.
- The source gate (`check-links.mjs`) fails root-absolute-nonexistent / `.md`-relative / bare-extensionless internal doc links in `example/docs`.
