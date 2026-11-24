---
title: "ADR-0087: A generated-section contract: one stamp, one drift gate, registry ownership"
description: "One generated stamp with a source digest, one --check drift gate and registry ownership for every generated section; doc-kitty reads committed data only."
doc_status: active
updated: 2026-11-24T00:00:00Z
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

D3 is amended by operator approval on 2026-11-23 (ruling R81): it adds the
`unowned` verdict and allows producer-specific verdicts. Both were recorded as
open in the review of PR #445.

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
2. **`by` does not mean "last changed by".** On `main`, `makeStamp`
   (`src/lib/generator-stamp.mjs`) carries over only `at` while `content_hash` is
   unchanged, and always writes the current toolkit version into `by`
   (`schema-validator-parity.test.ts` pins this). So `by` means "last regenerated
   by": it changes on every toolkit release even when the page did not, which is
   the dirty tree #398 reports after a test run. PR #410 proposes keeping the
   whole stamp instead. Then, where the hash covers the source, a release that
   changes only the renderer would change the page body but keep the older `by`
   (the follow-up comment on #359). Neither rule makes `by` mean what the OKF
   export reports it as.

Byte-stable output is a stated gate (#300). The in-tree producers regenerate
during the build: Gherkin and the glossary today, pack pages (ADR-0079 D6) and the
missions and Ops pages (ADR-0082) next. A regenerated `at` that moved on every
build would break that gate.

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
that changes only the renderer updates `by` on the pages whose content it
changed, and a release that changes nothing leaves every stamp alone. "Last
changed by" is then true for every producer.

**This changes `makeStamp`.** Today it carries over `at` and always rewrites
`by`. Under D1 it carries over `by` **and** `at` while the new `content_hash`
equals the previous one, and writes both afresh only when it differs. The test
that pins today's rule (`schema-validator-parity.test.ts`, "keeps `at` … even
across a version bump") changes with it: across a version bump with unchanged
content, the whole stamp is kept.

The serializer writes the keys in the order `by`, `at`, `source_digest`,
`content_hash`. `serializeStamp` stays the one serializer. #359 names the stamp
`{by, at, source_digest}`; `content_hash` is kept beside it because it already
exists, the OKF export reads it, and only it can detect hand edits.

### D2. The source digest is over declared, committed inputs

A producer declares, per page, the inputs that page is generated from: committed
files (a feature file, a JSON schema, a CLI-reference data file), the child list
of a hub, and the generator configuration that changes the output.
`source_digest` is a **drift digest** over that input set. It answers "were these
inputs used?". It is not an identity digest of a pack or any other artifact, so
it does not conflict with ADR-0079 D6's "doc-kitty computes no digest of its
own" for pack identity. The algorithm below is normative: two independent
implementations (JavaScript here, Python in the producing repositories) must
compute the same value.

#### Algorithm

1. **Entries.** Each input becomes one entry, a pair of a **key** and a **value**:
   - **A file.** The key is its repo-relative POSIX path (`/` separators, no
     leading `./`). The value is the lowercase hex sha256 of the file's bytes as
     read from the working tree when the producer or the check runs.
   - **A hub's children.** One entry. The key is `children:` followed by the hub
     page's repo-relative POSIX path. The value is the lowercase hex sha256 of
     the children's repo-relative POSIX paths, sorted as in step 2 and joined
     with `\n`, with no trailing newline, encoded as UTF-8. An edit inside a child
     page does not stale the hub's source; a change to what the hub renders is
     caught by `stale-render` (D3).
   - **Configuration.** At most one entry per producer. The key is
     `config:<producer id>`. The value is the lowercase hex sha256 of the
     configuration object serialised by RFC 8785 (JSON Canonicalization Scheme),
     encoded as UTF-8. The object holds exactly the options that can change the
     producer's rendered output, as the producer's registry entry names them
     (for Gherkin: the section, the titles, `defaultGlossaryContext` and
     `sourceUrlPrefix`). An option left at its default is included with its
     default value. A producer with no such option has no configuration entry.
2. **Order.** Entries are sorted by the **UTF-8 bytes** of their key, ascending.
   This equals Unicode code-point order, so Python's `sorted()` over `str` and a
   byte comparison in JavaScript agree. JavaScript's default string comparison
   (UTF-16 code units) does not agree for keys outside the Basic Multilingual
   Plane, so it must not be used. Keys are unique.
3. **Payload.** Each entry is written as its key, one NUL byte, and its value.
   The lines are joined with `\n`, with no trailing newline, and the whole payload
   is encoded as UTF-8.
4. **Digest.** `source_digest` is `sha256:` followed by the lowercase hex sha256
   of the payload: all 64 digits. Unlike `content_hash`, it may be quoted as
   evidence (#401), so it is not truncated. An empty input set gives the digest of
   the empty payload,
   `sha256:e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855`.

**Working tree, not blob.** Inputs are read from the working tree, so `--check`
on a dirty tree reports drift against the uncommitted edit, which is what an
author wants before committing. In CI the tree is a clean checkout, where the
working tree equals the committed blob provided the inputs are not converted on
checkout. A producer whose inputs are text therefore pins `eol=lf` for them in
`.gitattributes` and uses no smudge or clean filter on them, as Gherkin already
does. That closes the "config-only changes" limit in the Gherkin architecture
page too, through the configuration entry.

#### `content_hash`

`content_hash` is computed over the page **as written**, minus its stamp:

1. Take the page's bytes, decoded as UTF-8, with LF line endings.
2. In the frontmatter, remove the line `generated:` and every following line that
   begins with a space: the whole block, exactly as `serializeStamp` writes it.
   Nothing else changes, so the blank lines, the key order and the body stay as
   written.
3. Hash the result, encoded as UTF-8, with sha256. `content_hash` is `sha256:`
   followed by the **first 12** lowercase hex digits. That is a hand-edit and
   drift check, not a security property.

A producer that writes JSON instead of Markdown (such as #401's evidence index)
hashes the document as its format's documented serialiser writes it with the
`generated` member omitted.

#### Worked example

Inputs:

- `features/shipping.feature`, holding `Feature: Ship an order` and a newline;
- `features/returns.feature`, holding `Feature: Return an order` and a newline;
- the Gherkin configuration
  `{"section":"behaviour","titles":{"hr":"HR"},"sourceUrlPrefix":"https://example.org/src/","defaultGlossaryContext":{"shipping":"shipping"}}`,
  which holds all four options D2 names for Gherkin.

| Key | Value (sha256 of the input) |
|---|---|
| `config:doc-kitty-gherkin` | `4e9ce5abbe8cb14f8719f94547084b6bd4e4d7f7a1c66e6aaa03844beaea0974` (over the JCS bytes `{"defaultGlossaryContext":{"shipping":"shipping"},"section":"behaviour","sourceUrlPrefix":"https://example.org/src/","titles":{"hr":"HR"}}`) |
| `features/returns.feature` | `4706fe2220c95abef8076225ef261f4ccc6ff2ecd608fb062050918aaee92a4f` |
| `features/shipping.feature` | `602cc601811283c683edd47f62a25fabd760959d848805bef9983c72fc0b93d4` |

The rows are in the step-2 order. The digest is
`sha256:3f1cb1c1bfbeb5922c739057e9987407df7396829d97682420aee0ea94d823d2`.

A page whose bytes are

```text
---
title: "Ship an order"
generated:
  by: "doc-kitty-gherkin/0.8.0"
  at: "2026-11-23T09:30:00Z"
  source_digest: "sha256:…"
  content_hash: "sha256:…"
kind: Reference
---

# Ship an order
```

has the stamp-free text `---`, `title: "Ship an order"`, `kind: Reference`, `---`,
a blank line and `# Ship an order`, each followed by a newline. Its
`content_hash` is `sha256:3ebe501730db`.

Both values were computed independently in JavaScript (`node:crypto`, byte-order
sort) and in Python (`hashlib`, `sorted()` over UTF-8 keys).

### D3. One `--check` drift gate, same verdicts everywhere

Every producer that doc-kitty can run exposes `--check`. It regenerates in memory,
writes nothing, and reports each page with one verdict. When several conditions
hold, the first in this table wins, so a hand edit is never hidden behind a
"regenerate" hint:

| Verdict | Condition | Meaning |
|---|---|---|
| `missing` | an expected page is absent | regenerate |
| `orphan` | a page carries the producer's stamp and is in its scope, but no input produces it | regenerate (prunes it) |
| `unowned` | an expected output path holds a page without the producer's ownership stamp, such as a deleted or mistyped stamp (a page owned by scope alone is never `unowned`) | regenerate after moving the edit to the source, or delete the page |
| `hand-edited` | the committed body's hash differs from the stamp's `content_hash` | someone edited generated output; move the edit to the source |
| `stale-source` | the committed `source_digest` differs from the recomputed one | the inputs changed; regenerate |
| `stale-render` | digests match, but the regenerated page differs from the committed one with `at` masked (D5) | the renderer changed; regenerate |
| `ok` | none of the above | |

**Producer-specific verdicts.** A producer may report a verdict of its own
beyond this table, such as ADR-0082's leak check, provided that it exits `1`,
uses the same output line, and is documented in the producer's own ADR. Such a
verdict ranks after `stale-render`. The table's verdicts keep their meaning for
every producer.

The output and exit codes are the same for every producer:

- Output is one line per non-`ok` page: `<producer> <verdict> <path>`, then the
  producer's regenerate hint from the registry.
- `0` means every page is `ok`.
- `1` means drift.
- `2` means a usage or input error, the repository's existing convention.

`pnpm validate:generated` runs the check of every registered producer that has
one. It reads the registry, so a new producer joins the gate by registering.

The existing `validate:features` and `dockitty-generate-pack-pages --check` keep
their commands. They report through the same verdicts once their producers adopt
the stamp.

**The contract covers whole pages.** A frontmatter stamp cannot cover a region of
an authored page. So the ADR index, a generated table inside the authored
`docs/adr/README.md` and regenerated after merge (ADR-0072 D2), is outside this
contract and keeps its own check.

### D4. Ownership comes from the registry, and hand edits are flagged

Ownership is ADR-0083's, unchanged. A page is generated when it carries an
ownership producer's versioned stamp **and** sits inside that producer's scope,
except for a producer recognised by its scope alone (ADR-0083 D4; today only the
glossary), whose pages are generated by their scope even without a stamp. This
ADR adds the following to a registry entry:

- `inputs`: how the producer enumerates a page's inputs, for D2.
- `check`: the command that runs D3, or `external` (D7).

The `hand-edited` verdict is how ownership is enforced. A generated page is not
edited in place. A page owned by scope alone that carries no stamp has no
`content_hash` to compare. Its check is `stale-render` only, and its generator
writes a stamp the next time it runs.

**Retiring a producer.** A registry entry is never deleted while its pages
exist. A producer is retired the way #210 retired the unversioned stamps: its
entry stays, with a new `retired` field naming the release that retired it and
the command that replaces or removes its pages. The existing `retiredBy` field
is not this: it names an older unversioned stamp of a producer that is still
live. A retired producer owns nothing. The frontmatter gate names each page
still carrying its stamp and that command, instead of silently treating them as
authored pages that carry a foreign stamp.

ADR-0083 noted three readers that still recognise a page by its stamp alone: the
edit link, the RSS hub filter, and `okfGenerated`. They route through the
registry's `ownerOfPage`, so a stamp outside its scope is ignored everywhere, not
only in the frontmatter gate.

### D5. `at` is committed data, and is masked only where it would be regenerated

- **When `at` moves.**
  - `at` is written whenever a producer regenerates: by a `generate:*` command,
    or during `astro build` / `astro dev` for the in-tree producers that
    regenerate there (Gherkin, the glossary, and next pack pages and the missions
    and Ops pages).
  - It is carried over unchanged, with `by`, while `content_hash` is unchanged
    (D1's `makeStamp` rule).
  - When it does move, it is the clock at generation time, in whole seconds,
    UTC. A pipeline that must reproduce a past generation may set
    `SOURCE_DATE_EPOCH`, which then wins. That is usually the previous commit's
    time, so `at` can predate the change. That is accepted for reproducible
    rebuilds and is not the default.
- **Byte stability (#300) rests on two things, not on builds never writing `at`.**
  - Carry-over: regenerating unchanged content keeps the whole stamp.
  - #410's clean-tree step: CI fails when a build leaves a tracked file changed,
    so a committed tree is regeneration-clean and a build of it rewrites nothing.
  - So two builds of one commit emit the same `generated.at` without a mask, and
    the two-builds test does not mask it. On a tree that is **not**
    regeneration-clean, the first build rewrites the stale pages: the two-builds
    test may still pass, since both builds see the same rewritten files, but the
    clean-tree step fails the run. That failure is the intended signal, and the
    two-builds test must not mask it away.
  - #300's mask list stays limited to fields that really come from the build
    clock, such as feed dates for pages with no `updated`.
- **`--check` masks `at`.**
  - Regenerating in memory would write a new instant for a page whose content
    changed.
  - So the comparison for `stale-render` substitutes the committed `at` before it
    compares.
  - `at` is the only stamp key masked. `by`, `source_digest` and `content_hash`
    always compare.
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
  - scope;
  - for a page doc-kitty renders from data files the producer committed here,
    also `source_digest` against those files, for a stale page beside fresh
    data. A page committed whole by another repository's tool has its inputs in
    that repository, so doc-kitty checks only `content_hash` and scope for it.
- **What stays with the producing repository:** whether those data files are
  current against their own source. That check is the producer's own `--check`,
  in its CI.

The stamp, the verdict names and the output line are the same on both sides. So
an external producer that adopts this contract reports the same way.

### D8. Migration

- Adopting D1 changes the Gherkin hash from source bytes to the rendered page.
- The first regeneration after the toolkit release rewrites every Gherkin page's
  `content_hash`, and its `by` and `at` with it, once.
- For one minor release, a page with no `source_digest` is a pre-contract page.
  It is checked under the rule it was written with: its `content_hash` is
  compared the old way, not under the D2 rule. For Gherkin that is the source
  `.feature` bytes for a feature page, and the sorted child-path list for a
  hub. It passes with a warning that names the regenerate command. Without
  that, every Gherkin page would read `hand-edited` before its first
  regeneration. After that release a page with no `source_digest` is an error,
  the way #210 retired the pre-0.4.0 stamps.
- The `makeStamp` change of D1 lands with it, so the first regeneration is also
  the last time a toolkit release alone rewrites a stamp.

## Consequences

### Positive

- One stamp, one gate, one set of verdicts for every generated section. A new
  producer is a registry entry plus an input enumerator.
- "Last changed by" is true for every producer, because `by` follows the
  rendered hash.
- Hand edits to generated output are caught by the same gate, not by review.
- Builds of a regeneration-clean tree stay byte-stable without masking
  `generated.at`, because the stamp is carried over and #410's clean-tree step
  keeps the tree clean (D5).
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
- A producer that regenerates during the build but does not carry the stamp over
  for unchanged content would write a new `at` on every build. The clean-tree
  step (#410) and the unmasked two-builds test of D5 are the guards.

## Alternatives considered

### Replace `content_hash` with `source_digest`

This would match #359's three keys literally. But the gate could no longer detect
hand edits, the OKF export would lose its content hash, and `by` could not be
tied to a change in what the page is.

### Keep one hash and change only its meaning per producer

This is the status quo. It is why `by` does not mean "last changed by" and why
`--check` differs per generator.

### Generate external reference pages at build time

doc-kitty could run or fetch the producing tool during the build. That is
rejected by ADR-0042 and D6: it couples a docs build to another repository's
runtime and network, and it breaks byte stability.

### Mask `generated.at` in the two-builds comparison

It is simpler, but it would hide exactly the regression D5 guards against: a
producer that writes a new `at` on every build.

## Follow-ups

Recorded from the review of PR #445; none changes a decision here.

- **The OKF export and `source_digest`.** `docs/guides/export-okf-bundle.md`
  lists `by`, `at` and `content_hash` for a generated page. Whether the export
  also carries `source_digest`, which #401 wants as evidence, is decided with
  the evidence index (#401), not here.
- **ADR-0080** still says the evidence index waits for the generated-section
  contract "proposed in issue #359". That changes with ADR-0080's next edit.
- **Issue #359** names a three-key stamp. Its closing note should point to D1's
  last paragraph, so the criterion is not read as unmet.

## References

- Issues #359 (this ADR), #353 (epic), #330 and ADR-0083 (registry), ADR-0079 D6,
  ADR-0082, ADR-0072 D2, ADR-0042, ADR-0046 decision 4, #300 (two builds), #210
  (retired stamps), #398 and #410 (clean tree after build), #360–#363, #338,
  #413, #401, #404
- RFC 8785, JSON Canonicalization Scheme (D2)
- `src/lib/generator-stamp.mjs`, `src/lib/producers.mjs`,
  `src/lib/producer-output.mjs`, `src/scripts/generate-feature-pages.mjs`
