# Research: base-aware-generated-links

The grounding squad's findings are posted on the issues (236#issuecomment-6381877740, 237#issuecomment-6381878039).

- **Decision:** compose the site URL in `exportOkfBundle`, not in the integration.
  **Rationale:** the CLI has the same origin-only contract, so one place fixes both.
  **Alternatives considered:** an integration-only fix (leaves the CLI broken); redefining `--site-url` as origin plus base (breaks CLI callers).
- **Decision:** resolve `.md` targets by node id against the source directory.
  **Rationale:** ids are already source paths without the extension. This keeps C-001 (and the module's own C-010 note), "no second route resolver".
  **Alternatives considered:** reuse the HTML-side resolver. None exists, because Astro handles `.md` links on the HTML side.
- **Decision:** leave an unresolved `.md` target unchanged.
  **Rationale:** an absolute URL to a `.md` file 404s on the site, and the advisory check already reports the link.
  **Alternatives considered:** make it absolute, or drop the link.
- **Decision:** section-index bodies are out of scope.
  **Rationale:** the export does not write them today, so fixing that is a separate feature (follow-up).
