---
title: "ADR-0087: A generated-section contract: one stamp, one drift gate, registry ownership"
description: "One generated stamp with a source digest, one --check drift gate and registry ownership for every generated section; doc-kitty reads committed data only."
doc_status: active
updated: 2026-11-23T00:00:00Z
type: ADR
kind: ADR
authors:
  - process:claude-code
related:
  - adr/0083-producer-registry-and-ownership-scopes
  - adr/0079-kitty-packs-through-a-charter-contract-reader
  - adr/0046-gherkin-feature-pages
  - adr/0042-native-documentation-charter
  - adr/0059-content-graph-and-okf-alignment
  - architecture/metadata-model
  - architecture/gherkin-pages
---

# ADR-0087: A generated-section contract: one stamp, one drift gate, registry ownership

## Status

Accepted on 2026-11-23, by operator ruling on PR #445 (accepted together with
ADR-0083). Proposed the same day. Issue #359, epic #353. It builds on the producer
registry of [ADR-0083](0083-producer-registry-and-ownership-scopes.md), from
issue #330, and does not define a second one. It extends
[ADR-0079](0079-kitty-packs-through-a-charter-contract-reader.md) D6 and respects
[ADR-0042](0042-native-documentation-charter.md): no runtime dependency on another
kitty repository.

## Context

Generated reference pages are produced in different ways across kitty
repositories: events' `schema_pages.py`, charter's hand-authored Schematic stubs,
core's `build_cli_reference.py` with `check_cli_reference_freshness.py`, and
open-packs' `gen_pack_reference.py`. Each has its own stamp and its own freshness
check.

Inside doc-kitty, generated pages already carry
`generated: {by, at, content_hash}` (`src/lib/generator-stamp.mjs`), but the
hash means different things per producer:

- For a Gherkin feature page it hashes the **source** `.feature` bytes. For a
  Gherkin hub it hashes the child list.
- For a glossary page it hashes the **rendered** page.

Two problems follow:

1. **Drift.** Nothing uniform says whether a committed page still matches its
   source. Each generator implements `--check` its own way, or not at all.
2. **A stale `by`.** Where the hash covers the source, a release that changes only
   the renderer changes the page body but keeps `by` and `at`. So "last changed
   by" is false for those producers. #410's clean-tree CI step catches the dirty
   tree, but not the wrong meaning (the follow-up comment on #359).

Byte-stable output is a stated gate (#300). A stamp whose `at` came from a clock
at build time would break it.

New producers are queued behind this contract: the reference slices in #353
(#360–#363), pack pages (#338), the missions and Ops pages (#413), and the
evidence index of #401.

## Decision

### D1. One stamp, four keys

Every page an ownership producer writes carries:

```yaml
generated:
  by: <producer>/<version>
  at: 2026-11-23T09:30:00Z
  source_digest: sha256:<64 hex>
  content_hash: sha256:<12 hex>
```

- `by`: the producer id, as registered (ADR-0083 D7), and the version of the code
  that rendered the page. For doc-kitty's own producers that is the toolkit
  version. For an external producer it is that tool's version.
- `source_digest` (new): what the page was generated **from** (D2). It drives
  the drift gate.
- `content_hash`: what the page **is**. It is a hash of the rendered page without
  the stamp, for every producer. That makes the Gherkin rule the same as the
  glossary rule, and it is what detects hand edits (D4).
- `at`: when `content_hash` last changed (D5).

`by` and `at` move together, and only when `content_hash` moves. So a release
that changes only the renderer updates `by`, and "last changed by" is true again.

The serializer writes the keys in the order `by`, `at`, `source_digest`,
`content_hash`. `serializeStamp` stays the one serializer. #359 names the stamp
`{by, at, source_digest}`; `content_hash` is kept beside it because it already
exists, the OKF export reads it, and only it can detect hand edits.

### D2. The source digest is over declared, committed inputs

A producer declares, per page, the committed files that page is generated from:

- a feature file;
- a JSON schema;
- a CLI-reference data file;
- the list of child pages, for a hub.

`source_digest` is `sha256` over that input set in a canonical form:

- each input is listed as its repo-relative POSIX path, a NUL byte, and the hex
  `sha256` of its committed bytes;
- the entries are sorted by code-unit order of the path and joined with `\n`;
- a hub's input is its sorted child-path list.

The digest is the full 64 hex digits. Unlike `content_hash`, it may be quoted as
evidence (#401), so it is not truncated.

Inputs are bytes as committed. A producer whose inputs are text pins `eol=lf` for
them in `.gitattributes`, as Gherkin already does. Generator configuration that
changes the output, such as `defaultGlossaryContext`, is an input too: it is hashed
as a canonical JSON entry with the path `config:<producer>`. That closes the
"config-only changes" limit in the Gherkin architecture page.

### D3. One `--check` drift gate, same verdicts everywhere

Every producer that doc-kitty can run exposes `--check`. It regenerates in memory,
writes nothing, and reports each page with one verdict:

| Verdict | Condition | Meaning |
|---|---|---|
| `missing` | an expected page is absent | regenerate |
| `orphan` | a page carries the producer's stamp and is in its scope, but no input produces it | regenerate (prunes it) |
| `stale-source` | the committed `source_digest` differs from the recomputed one | the inputs changed; regenerate |
| `hand-edited` | the committed body's hash differs from the stamp's `content_hash` | someone edited generated output; move the edit to the source |
| `stale-render` | digests match, but the regenerated page differs from the committed one with `at` masked (D5) | the renderer changed; regenerate |
| `ok` | none of the above | |

The output and exit codes are the same for every producer:

- Output is one line per non-`ok` page: `<producer> <verdict> <path>`, then the
  producer's regenerate hint from the registry.
- `0` means every page is `ok`.
- `1` means drift.
- `2` means a usage or input error, the repository's existing convention.

`pnpm validate:generated` runs the check of every registered producer that has
one. It reads the registry, so a new producer joins the gate by registering.

The existing `validate:features` and the ADR index's `--check` keep their
commands. They report through the same verdicts once their producers adopt the
stamp.

### D4. Ownership comes from the registry, and hand edits are flagged

Ownership is ADR-0083's: a page is generated when it carries an ownership
producer's versioned stamp **and** sits inside that producer's scope. This ADR
adds the following to a registry entry:

- `inputs`: how the producer enumerates a page's inputs, for D2.
- `check`: the command that runs D3, or `external` (D7).

The `hand-edited` verdict is how ownership is enforced. A generated page is not
edited in place.

ADR-0083 noted three readers that still recognise a page by its stamp alone: the
edit link, the RSS hub filter, and `okfGenerated`. They route through the
registry's `ownerOfPage`, so a stamp outside its scope is ignored everywhere, not
only in the frontmatter gate.

### D5. `at` is committed data, and is masked only where it would be regenerated

- **`at` never comes from the clock at build time.**
  - It is written by the generate command, not by `astro build`.
  - It is carried over unchanged while `content_hash` is unchanged. That is
    `makeStamp`'s current rule, now keyed on the rendered hash.
  - When it does move, it is `SOURCE_DATE_EPOCH` if that is set, else the clock
    at generation time, in whole seconds, UTC.
- **`--check` masks `at`.**
  - Regenerating in memory would write a new instant for a page whose content
    changed.
  - So the comparison for `stale-render` substitutes the committed `at` before it
    compares.
  - `at` is the only stamp key masked. `by`, `source_digest` and `content_hash`
    always compare.
- **The two-builds check (#300) needs no mask for `generated.at`.**
  - A build only reads it, so two builds of one commit emit the same value.
  - #300's mask list stays limited to fields that really come from the build
    clock, such as feed dates for pages with no `updated`.
  - A test asserts that `generated.at` is equal across the two builds.
- **Artifacts derived at build time follow the same rule.** An artifact doc-kitty
  derives from committed pages during the build may report when its inputs last
  changed. One example is a JSON index such as #401's evidence index. Its instant
  is the latest `generated.at` or `updated` among its inputs, never the build
  clock. A field that cannot meet this must be added, by name, to #300's mask
  list in the same PR.

### D6. doc-kitty reads committed data; it never runs a producing repository's code

At build time doc-kitty reads committed files: data files, schemas, and
already-generated pages with their stamps.

- **External producers stay in their own repositories.** It never imports,
  installs, shells out to, or fetches a producing repository's code. That
  covers events' `schema_pages.py`, core's `build_cli_reference.py` and
  open-packs' `gen_pack_reference.py`. They run in their own repository and CI,
  and commit their output.
- **doc-kitty's own generators** (Gherkin, glossary, the ADR index, and future
  in-tree producers) are toolkit code. They may run as explicit `generate:*`
  commands, and where a pipeline already regenerates in the build, as Gherkin's
  does, the output must be committed and #410's clean-tree CI step must hold.
- **This is ADR-0042's "no runtime dependency" rule**, applied to generated
  content.

### D7. External producers register, and the check splits

A page committed by another repository's tool, or rendered by doc-kitty from data
files that tool committed, has a registry entry with `check: external`.

- **What doc-kitty can verify itself:**
  - `content_hash` against the body, for hand edits;
  - `source_digest` against the committed data files, for a stale page beside
    fresh data;
  - scope.
- **What stays with the producing repository:** whether those data files are
  current against their own source. That check is the producer's own `--check`,
  in its CI.

The stamp, the verdict names and the output line are the same on both sides. So
an external producer that adopts this contract reports the same way.

### D8. Migration

- Adopting D1 changes the Gherkin hash from source bytes to the rendered page.
- The first regeneration after the toolkit release rewrites every Gherkin page's
  `content_hash`, and its `by` and `at` with it, once.
- For one minor release, a page with no `source_digest` passes the gate with a
  warning that names the regenerate command. After that it is an error, the way
  #210 retired the pre-0.4.0 stamps.

## Consequences

### Positive

- One stamp, one gate, one set of verdicts for every generated section. A new
  producer is a registry entry plus an input enumerator.
- "Last changed by" is true for every producer, because `by` follows the
  rendered hash.
- Hand edits to generated output are caught by the same gate, not by review.
- Builds stay byte-stable without masking `generated.at`, because it is committed
  data.
- The full `source_digest` is a stable, quotable reference for evidence uses
  (#401, #404).

### Negative

- Every Gherkin page is rewritten once on adoption (D8). Consumers see one large,
  mechanical diff.
- Each producer must declare its inputs. Forgetting a config input hides a real
  change; D2 makes config an explicit input to keep that visible.
- External producers must adopt the stamp in their own repositories before the
  split check (D7) is complete. Until then doc-kitty can verify hand edits and
  scope, but not freshness.

### Risks

- An input enumerator that is not a pure function of committed files gives
  digests that differ by machine. Producers are tested by generating twice in two
  checkouts and comparing digests.
- A producer that writes `at` during `astro build` would break #300 silently. The
  two-builds test of D5 is the guard.

## Alternatives considered

### Replace `content_hash` with `source_digest`

This would match #359's three keys literally. But the gate could no longer detect
hand edits, the OKF export would lose its content hash, and the stale-`by`
problem would spread from Gherkin to every producer.

### Keep one hash and change only its meaning per producer

This is the status quo. It is why `by` is stale and why `--check` differs per
generator.

### Generate external reference pages at build time

doc-kitty could run or fetch the producing tool during the build. That is
rejected by ADR-0042 and D6: it couples a docs build to another repository's
runtime and network, and it breaks byte stability.

### Mask `generated.at` in the two-builds comparison

It is simpler, but it would hide exactly the regression D5 guards against: an
`at` taken from the build clock.

## References

- Issues #359 (this ADR), #353 (epic), #330 and ADR-0083 (registry), ADR-0079 D6,
  ADR-0042, ADR-0046 decision 4, #300 (two builds), #210 (retired stamps), #410
  (clean tree after build), #360–#363, #338, #413, #401, #404
- `src/lib/generator-stamp.mjs`, `src/lib/producers.mjs`,
  `src/lib/producer-output.mjs`, `src/scripts/generate-feature-pages.mjs`
