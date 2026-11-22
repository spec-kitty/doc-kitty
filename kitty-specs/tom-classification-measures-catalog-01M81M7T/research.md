# Research: TOM classification and measures catalog

## R1: Catalog loading (decision DM-01M81M98JR2GQJ03SNS8MPVRTK)

- **Decision**: The toolkit reads `<docsRoot>/_meta/measures.yaml` off disk and falls back to a default shipped in the toolkit. There is no new content collection.
- **Rationale**: The ADR-0018 citation catalogs are Astro content collections that each consumer declares in `content.config.ts`, and they have no default. ADR-0080 needs two rules: an absent file means the default, and an unused field leaves a tree unaffected. A collection would make every consumer add a declaration just to get the default. A disk read mirrors `sections.yaml`, `vocabulary.yaml` and `charter.yaml`, which the toolkit also reads itself. ADR-0080's "follows the ADR-0018 pattern" holds where it matters: the file lives in `_meta`, it is a closed reference, the build fails hard, and a build-free gate gives the same verdict.
- **Alternatives**: A `measures` collection with a `file()` loader (rejected: consumer wiring, no default). Embedding the catalog in TypeScript (rejected: a consumer copying the defaults wants YAML).

## R1a: The shipped default is a data module (amendment, WP05)

- **Decision**: The default lives in `src/lib/measures-default.mjs` (`DEFAULT_MEASURES`, frozen), statically imported by the loader. It replaces the planned `src/lib/measures.default.yaml`.
- **Rationale**: The content-graph and agent-page routes are bundled by Vite. A file read relative to `import.meta.url` then points into `.prerender/chunks/`, so the YAML was not found and every example build failed (caught by the full suite in WP05). A static import travels with the bundle and loads the same way in bare Node for the `validate-catalog.mjs` gate. The records are unchanged, and the loader still validates them through `parseMeasuresCatalog`.
- **Alternatives**: Resolving the YAML through the package name (rejected: depends on the install layout); Vite `?raw` imports (rejected: the bare-Node gate cannot load them).

## R2: Default catalog content and DPV mapping

- **Decision**: 17 records, one per heading of Decision (EU) 2021/914 Annex II. Headings 1–4 also carry GDPR Article 32(1)(a)–(d) as a second framework reference. Each record has the nearest DPV 2.3 concept IRI, checked against the published DPV 2.3 TOM module term lists (technical, organisational, physical).
- **Rationale**: Headings 1–4 restate Article 32(1)(a)–(d) almost word for word. Separate records would make two ids for one measure, and authors would pick at random.
- **Mapping**:

  | # | id | nature | DPV concept |
  |---|----|--------|-------------|
  | 1 | `pseudonymisation-encryption` | technical | `dpv:Encryption` |
  | 2 | `confidentiality-integrity-availability-resilience` | technical | `dpv:SecurityMethod` |
  | 3 | `availability-restoration` | technical | `dpv:DataBackupProtocols` |
  | 4 | `testing-evaluation` | organisational | `dpv:SecurityAssessment` |
  | 5 | `user-identification-authorisation` | technical | `dpv:AccessControlMethod` |
  | 6 | `transmission-protection` | technical | `dpv:EncryptionInTransfer` |
  | 7 | `storage-protection` | technical | `dpv:EncryptionAtRest` |
  | 8 | `physical-security` | physical | `dpv:PhysicalAccessControlMethod` |
  | 9 | `events-logging` | technical | `dpv:ActivityMonitoring` |
  | 10 | `system-configuration` | technical | `dpv:PrivacyByDefault` |
  | 11 | `it-security-governance` | organisational | `dpv:InformationSecurityPolicy` |
  | 12 | `certification-assurance` | organisational | `dpv:Certification` |
  | 13 | `data-minimisation` | organisational | `dpv:PrivacyByDesign` |
  | 14 | `data-quality` | organisational | `dpv:DataQualityManagement` |
  | 15 | `limited-retention` | organisational | `dpv:DataStoragePolicy` |
  | 16 | `accountability` | organisational | `dpv:ComplianceMonitoring` |
  | 17 | `portability-erasure` | organisational | `dpv:DataErasurePolicy` |

  The ADR's own examples (`transmission-protection`, `events-logging`) keep their ids.
- **Caveat**: DPV 2.3 has no exact class for accountability, data minimisation or portability. The nearest broader concept is used, and the YAML header says the IRI is a pointer, not an equivalence. Counsel questions OQ-1 and OQ-2 stay open (operator ruling D1).

## R3: Where the build fails

- **Decision**: The content-graph route resolves every published and draft page's classification and throws on a miss. That route is injected on every site. The agent page route resolves too. `validate-catalog.mjs` reports the same verdict without a build.
- **Rationale**: The graph route is the one surface every site serves (ADR-0059 "always on"), so a site that does not mount `/api/pages` still fails. Resolution runs over the full corpus (drafts included), matching how `related` stays fatal for drafts.
- **Alternatives**: A Zod refine in the docs schema (rejected: the schema cannot read the catalog without fs at schema-build time, and a per-entry refine would hide the page path in Astro's error shape).

## R4: Graph shape (decision DM-01M81M9B6Z9NJSJX49W90JC506)

- **Decision**: Node `catalog:measure:<id>` with `kind: catalog`, title = label, `url` = DPV IRI, and a `measure: { nature, frameworks }` object. The edge `classified-as` carries `note` and `scope`. The schema stays `dockitty.content-graph/1`.
- **Rationale**: It matches the existing `catalog:<type>:<id>` node id form of citations. Reusing `kind: catalog` keeps the node kinds closed. Both additions are optional fields, which the schema comment allows without a bump.

## R5: Organisation scope (decision DM-01M81M9G9JS058CTEGHETA642B)

- **Decision**: Scope is carried on edges and in the agent record. The link-not-copy rule is taught in the authoring guide and shown by an example pair. There is no lint.
- **Rationale**: ADR-0080 decision 5 is an authoring rule, and the annex export that consumes it is a follow-up (#401–#404). A lint that guesses "restated" text would be noisy.

## R6: Counsel questions (decision DM-01M81M9DX7PE9GKHF10D5NBMD3)

- **Decision**: These are recorded as open questions OQ-1 to OQ-3 in the spec. The default ships without a controller-leaning marker. The docs say the classification marks evidence and does not make a description sufficient.
