# Research: Operating-model templates and a Role kind

The operator's rulings are recorded as Decision Moments (see spec.md). The decisions below are engineering choices made from the code; none of them changes scope.

## D1. Role is added through the single-source vocabulary

- **Decision**: append `'Role'` to `KINDS` in `src/lib/vocabulary-core.mjs`, following ADR-0067 (`Schematic`) and ADR-0046 (`Specification`).
- **Rationale**: `src/lib/schema.ts` imports `KINDS` from the core, and so does the gate. A `git grep` for `'Schematic'` finds no other list of kinds in code (the mcp package derives its list).
- **Alternatives considered**: a separate list of compliance kinds. Rejected because it would break the single source of truth (C-003).

## D2. Template storage: a manifest module plus Markdown bodies

- **Decision**: `src/lib/operating-model-templates.mjs` holds the 12 records: id, title, kind, default path, default type and measure ids. Each body is a Markdown file under `src/lib/templates/operating-model/<id>.md`, read relative to `import.meta.url`.
- **Rationale**:
  - Bodies are easier to review as Markdown than as JS strings.
  - Frontmatter is generated from the manifest, so its shape is tested in one place.
  - `lib` is already in the package's `files`, so consumers get the bodies.
  - The tools are bare-Node scripts, so an fs read is fine. Unlike the content-graph routes, they are not bundled by Vite.
- **Alternatives considered**:
  - Full Markdown files with frontmatter: this duplicates the shape 12 times and still needs placeholders filled in for the date and title.
  - Bodies as JS strings: harder to review.

## D3. Frontmatter rendering

- **Decision**: a pure `renderTemplatePage(record, { title, type, now })` emits:
  - `title` and `description` (a TODO prompt);
  - `doc_status: draft`;
  - `type` and `kind`;
  - for Role: `role` and `responsibilities` placeholders;
  - `tom_classification` as `{measure, scope: organisation}` entries;
  - the shared `scaffoldMeta()` lines.

  Then it appends the body. Values go through the `yaml` stringifier, so a title with a colon stays valid.
- **Rationale**:
  - It matches the existing stub frontmatter.
  - The Role placeholders are non-empty strings, so the page passes FR-002 while it is still a draft.
  - The object form of `tom_classification` is the one ADR-0080 defines for a scope.

## D4. Type of emitted pages

- **Decision**: `type = expectedDocType(path) ?? record.defaultType`.
  - Pages under `operating-model/` default to `Operations`, because the frozen map has no `operating-model` section.
  - The two runbooks sit under `operations/runbooks/`, so the core derives `Runbook`.
  - The `--type` flag still overrides.
- **Rationale**: an unregistered section yields a `null` expectation, which means no type check, so a registry-less consumer still validates. With the preset snippet applied, the expectation is `Operations`, which matches. A consumer that aliases the type through the vocabulary is handled by the existing resolver.

## D5. CLI surface

- **Decision**:
  - `new-doc --template <id> [slug] [--title]`. The slug is optional; with none, the record's default path is used.
  - `--kind` and `--section` combined with `--template` exit 2 with a message. A template fixes its kind, and no template is a section index.
  - `scaffold [base] --preset operating-model` writes only the preset's 13 files. Combined with `--sections`, it exits 2.
  - An unknown template or preset id exits 2 and lists the known ids.
- **Rationale**: no combination can silently produce a page that fails the gate (spec edge cases), and the default runs are untouched (FR-014).

## D6. Policy index as a leaf Hub

- **Decision**: `operating-model/policy-index.md`, with `kind: Hub`.
- **Rationale**: the gate does not tie `Hub` to index files (checked in `validate-frontmatter.mjs`). A leaf hub avoids depending on the index basename (README or index).

## D7. Role default path

- **Decision**: `operating-model/roles/accountable-role.md` in the preset. Authors who use `new-doc` pass their own slug, such as `operating-model/roles/dpo`.

## D8. Enforcing no policy wording (NFR-004)

- **Decision**: a test strips each body's HTML comments, heading lines and blank lines, and asserts that nothing remains. The "not legal advice" notice therefore lives in a comment.
- **Rationale**: this turns C-001 into a check that fails rather than a review convention.

## Supply chain

No dependency is added, upgraded or removed, so DIRECTIVE_051 has nothing to check, and no adversarial pass on supply chain is needed.
