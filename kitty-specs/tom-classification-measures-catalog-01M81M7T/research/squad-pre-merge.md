# Adversarial squad: pre-merge (#406)

**Point-cut**: pre-merge, after consolidation, on `feat/406-tom-classification-clean`.
**Question**: does the shipped change implement ADR-0080 faithfully, without breakage, and with accurate, non-over-claiming prose?
**Cast**: three profile-loaded, read-only delegates (each ran `spec-kitty agent profile show <id>` and `charter context --action review`):

- `architect-alphonso`: design fit (ADR-0080, ADR-0018, ADR-0059, ADR-0009). Verdict: ship-with-fixes.
- `debugger-debbie`: breakage and edge cases, with probes. Verdict: ship-with-fixes.
- `lexical-larry`: terminology, legal over-claims, docs against code. Verdict: ship-with-fixes.

Convergence: the dev-server cache (architect and debugger) and the gate/build page label (architect and debugger) were raised independently. No consequential divergence, so no second opinion was needed.

## Findings and dispositions

| # | Sev | Lens | Finding | Disposition | Evidence |
|---|-----|------|---------|-------------|----------|
| 1 | HIGH | debugger | A consumer `measures.yaml` opening with `---` parsed as an empty catalog with no problem; records after a second `---` were dropped. | accepted | `src/lib/measures-loader.mjs` parses with `yaml` directly; tests in `measures-loader.test.ts` ("consumer catalog parsing") |
| 2 | HIGH | lexical | ADR-0080's caution said counsel review comes "before the default catalog ships", contradicting the accepted Status. | accepted | `docs/adr/0080-…md` caution |
| 3 | MEDIUM | architect, debugger | The catalog cache never refreshed under `astro dev`. | accepted | Cache keyed on the consumer file's existence and mtime; test "reloads the catalog when the file changes" |
| 4 | MEDIUM | architect, debugger | The "same wording" parity claim did not hold for the page label (repo-relative, OS separators), and no test compared build and gate verdicts. | changed | Gate label normalised to forward slashes; the header comment and `metadata-model.md` state the path difference; new `src/tests/measures-parity.test.ts` compares verdicts and unknown ids over every `catalog-measures/*` fixture |
| 5 | MEDIUM | lexical | The docs did not say a DPV IRI is the nearest concept, not an equivalence. | accepted | `content-graph.md`, `consumer-setup.md`, ADR-0080 decision 3 |
| 6 | LOW | debugger | A multi-line `note` or label could inject a heading into the OKF Measures section. | accepted | `okf-export/core.mjs` folds whitespace on `classified-as` lines; test "keeps a multi-line note or label on its own list line" |
| 7 | LOW | debugger | An unquoted numeric `ref` got a generic message. | accepted | `measures-core.mjs`: `"ref" must be a string; quote numbers such as "32"` |
| 8 | LOW | debugger | A UTF-8 BOM gave a cryptic parse error. | accepted | BOM stripped before parsing; test "reads a file with a UTF-8 byte order mark" |
| 9 | LOW | debugger | The agent-page label fallback (`<slug>.md`) is wrong for section indexes. | deferred_with_rationale | The content layer always sets `filePath`, so the fallback is unreachable in a build; it only affects message text. Tracked as a follow-up in the PR body. |
| 10 | LOW | architect | The bare-Node gate does not apply ADR-0070 excluded folders, so a page in an excluded folder fails the gate but not the build. | deferred_with_rationale | Pre-existing for citations; measures inherit it. Tracked as a follow-up in the PR body. |
| 11 | LOW | architect | ADR-0059 still listed the closed `rel` set. | accepted | `docs/adr/0059-…md` addendum (2026-11-22) |
| 12 | LOW | architect | `GraphNode.measure.nature` was typed `string`, and `AgentPageMeasure` repeats the literal unions. | changed | `docs-index.ts` now uses `MeasureNature`. `contract.ts` keeps its literals on purpose: it is the standalone published contract, and its exhaustive key table pins the shape. |
| 13 | LOW | architect | Readers with an exhaustive `rel` switch break when the set grows. | accepted | `content-graph.md` Edges: values may grow within `/1`, so readers must tolerate unknown ones |
| 14 | LOW | lexical | ADR decision 3 read as 21 records. | accepted | ADR-0080 decision 3 rewritten (17 headings, 1 to 4 also cite Art. 32(1)) |
| 15 | LOW | lexical | content-graph.md omitted the plain-text case for a measure without an IRI. | accepted | `content-graph.md` OKF paragraph |
| 16 | LOW | lexical | The example page described a not-yet-built export as present. | accepted | `example/docs/context/incident-handling.md` ("a later export") |
| 17 | LOW | lexical | "Measures catalog" had no glossary entry. | accepted | `docs/context/domain.md` |
| 18 | LOW | lexical | An em dash in the new ADR Status line. | accepted | ADR-0080 Status ("Accepted on 2026-11-21") |
| 19 | LOW | debugger | The same `---` wrapper exists in `validate-catalog.mjs` `loadCatalogFile` (bibliography and tools). | deferred_with_rationale | Pre-existing, citation catalogs only, outside #406's scope. Tracked as a follow-up in the PR body. |
| 20 | note | lexical | The build-free gate does not reject an unknown entry key such as `scop`. | deferred_with_rationale | By design: the shape belongs to `validate-frontmatter.mjs` and the build schema, which both reject it (strict). The docs name those two. |
