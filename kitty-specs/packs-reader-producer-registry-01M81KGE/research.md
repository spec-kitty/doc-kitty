# Research: packs reader, contract snapshot and producer registry

## R1. Which contract release to pin

- **Decision**: tag `contract-packs-v0.1.0-rc.1`, charter commit `69ec326179246c9a79eca1ba1d424f059f5153e2`.
- **Rationale**: the operator's correction on #367 names it, and it is the first packs-contract release (charter #559). The tag also carries `contract-charter-v0.2.0-rc.1`.
- **Alternatives**: charter `main` HEAD (not a release, ADR-0079 prefers a release); open-packs' own pin `cb9b154` (a service release, not a contract release).

## R2. Conformance cases: copy or transcribe

- **Decision**: copy `contracts/packs/conformance/classifier-cases.yaml` as data.
- **Rationale**: the pinned release publishes it (charter #559), so the transcription ADR-0079 D1 planned "until #559 lands" is not needed. The lock records it like every other file.
- **Alternatives**: transcribe from `PackFileKindTest` and `RetiredFilesTest` (obsolete).

## R3. Which schemas to vendor

- **Decision**: `pack-descriptor`, `pack-manifest`, `policy`, `pack-document`, `preset`, plus `file-kinds.yaml` and the conformance cases.
- **Rationale**: these are the shapes the reader interprets (D4). The reader takes the descriptor's known keys and the policy's keys from the schemas, so an unknown key is detected from the contract, not from a hard-coded list. Artefact schemas arrive with the artefact pages (#339) and the sync script takes any list.
- **Alternatives**: all 26 schemas (more churn per refresh for no reader use).

## R4. Glob and precedence semantics

- **Decision**: implement the conformance file's rules exactly: `*` within one segment (it matches a leading dot), `**/` zero or more whole segments, everything else literal. The order is `files` and `exclusions` and `retired` (retired beats a matching `files` rule unless an exclusion matches), then `payloads`, then a root case variant, then `ignored` case-insensitively, except for a path a `files`, `retired` or `payloads` rule takes in lower case, which is `unmodelled`.
- **Rationale**: ADR-0079 D1 holds the reimplementation to the charter's cases.

## R5. Manifest membership

- **Decision**: a constituent candidate is a file the contract maps to a kind that, with `-` written as `_`, is one of the contract's `artifact_kinds` (`template` payloads included, `asset-payload` excluded, companions excluded). Membership drift compares the manifest's constituent paths with that set, and its preset paths with the `preset` files.
- **Rationale**: matches every constituent in open-packs' manifests at `0be738a`, derives the set from the contract, and needs no per-kind list in code.
- **Evidence**: open-packs manifests list `routing_catalog`, a kind the pinned contract does not know. It is reported as an unknown kind, and the pack still reads.

## R6. Artefact ids in the file-kinds walk

- **Decision**: the YAML `id` key when the file parses and has one; a template's id is its path below `templates/`, prefixed `<type>/` under a mission type; else the file stem without the kind suffix.
- **Rationale**: matches the ids in open-packs' manifests (`plan/plan-plan-skeleton.md`).

## R7. Producer registry scope in the frontmatter gate (decision D1)

- **Decision**: a scope `{type: 'section'}` with no `section` means any one top-level section. The gate accepts `producerScopes` to narrow it; the default gate leaves it open.
- **Rationale**: the gate never evaluates `gherkin.section`, and the existing tests call `isGeneratedPage(relPath, data)`. The stamp is still required, so an authored page cannot opt out, and a root page (one segment) is never in a section scope.
- **Alternatives**: evaluate the site config in the gate (slower, changes the test contract).

## R8. Glossary recognition (decision D2)

- **Decision**: scope `{type: 'section', section: 'glossary', kinds: ['Glossary', 'Hub']}` with `recognition: 'scope'` (stamp optional), exactly today's path rule.

## R9. The `packs` option before #338 (decision D3)

- **Decision**: `packs: {charterLock?, contract?}`, validated eagerly with `[dk-packs]`. A `contract` directory's lock is checked at config time. Unknown keys fail and name #338's keys as not yet supported. The CLI takes `--charter-lock` and `--contract`.

## R10. The open-packs corpus (decision D4)

- **Decision**: pin open-packs `0be738ac07bc4d7dbaba54011bdb250c806728df` in `src/tests/fixtures/packs/open-packs.pin.json`. A `packs-corpus` vitest project reads `DK_OPEN_PACKS_DIR` and fails when it is unset. CI fetches the pinned commit and runs `pnpm test:packs-corpus`.

## R11. Supply chain

No dependency is added, upgraded or removed (DIRECTIVE_051 controls not triggered). The sync script uses the system `git`; it is a maintainer tool, never run at build time.
