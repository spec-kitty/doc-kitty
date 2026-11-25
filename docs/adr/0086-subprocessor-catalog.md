---
title: "ADR-0086: A sub-processor catalog"
description: "An optional _meta/subprocessors.yaml catalog, validated by the build and the build-free gate, published as an agent API document and a change feed."
doc_status: active
updated: 2026-11-25T00:00:00Z
type: ADR
kind: ADR
authors:
  - process:claude-code
related:
  - adr/0018-citation-catalog-collections
  - adr/0080-tom-classification-field-and-measures-catalog
  - adr/0087-generated-section-contract
  - architecture/research/eu-dpa-compatibility
---

# ADR-0086: A sub-processor catalog

> [!CAUTION]
> **This ADR is not legal advice.** It decides a file format and the outputs built
> from it, not what a data processing agreement must say about sub-processors.
> The facts in a catalog and the terms under which sub-processors are authorised
> belong to the site owner, and their contract governs. Items marked
> **⚖ counsel** await review by data-protection counsel.

## Status

Proposed. Only the operator accepts ADRs.

These **⚖ counsel** items stay open and do not block the decision:

- whether the field set is enough to call a catalog DPA-ready;
- whether a change feed satisfies a contract's notice terms;
- whether `EU` should be accepted as a location (decision 2 rejects it).

## Context

Several sources require a processor to keep a current list of its sub-processors:

- GDPR Article 28(2) and 28(4): authorisation, notice of intended changes, and the
  same obligations flowed down to each sub-processor.
- Decision (EU) 2021/915, Annex IV, and Clause 7.7: the name, address and contact
  of each sub-processor, a description of the processing, and the division of
  responsibilities. Under a general written authorisation (Clause 7.7, Option 2)
  the processor informs the controller of changes in advance.
- Decision (EU) 2021/914, Annex III: the list of sub-processors.

A DocKitty site that documents such a service keeps this list as prose, usually
on an integrations page. Nothing validates it, nothing exports it for agents, and
nothing announces a change. [ADR-0080](0080-tom-classification-field-and-measures-catalog.md)
named a sub-processor catalog as a follow-up.

## Decision

1. **Add an optional catalog, `docs/_meta/subprocessors.yaml`.** It follows the
   catalog pattern of [ADR-0018](0018-citation-catalog-collections.md): one
   top-level YAML list, one record per sub-processor.
   - An absent file means no outputs, no links and no errors. A site that never
     authors the file is unaffected.
   - An empty list is valid and publishes an empty catalog.
   - DocKitty ships **no default records**. The facts are each site's content.
     Only the example site carries records, and they are fictional.

2. **Each record has a fixed field set.**

   | Field | Required | Rule |
   |-------|----------|------|
   | `id` | yes | Kebab case, unique in the file |
   | `name` | yes | Non-empty text |
   | `address` | no | Non-empty text |
   | `contact` | no | Non-empty text |
   | `processing` | yes | Non-empty text: what the sub-processor does |
   | `location` | yes | A non-empty list of upper-case ISO 3166-1 alpha-2 codes, no duplicates |
   | `location_note` | no | Non-empty text |
   | `responsibilities` | yes | Non-empty text: the division of responsibilities |
   | `since` | yes | A calendar date, `YYYY-MM-DD` |
   | `until` | no | A calendar date, not before `since` |
   | `external_references` | no | The page shape of [ADR-0009](0009-finalize-metadata-contract.md) |
   | `tom_classification` | no | The page shape of ADR-0080 |

   - **Unknown keys are errors.** The catalog is small and hand-edited, and a typo
     such as `untill` would otherwise drop a removal date without a word.
   - **Locations are codes, not prose.** Codes can be checked, and a later
     transfer analysis can read them. `location_note` carries the detail a code
     cannot. Only officially assigned codes pass, so `UK` (write `GB`) and `EU`
     are rejected. **⚖ counsel**: decide whether `EU` should be allowed.
   - **⚖ counsel**: review the field set before anyone calls it DPA-ready.

3. **References resolve, and a miss fails hard.**
   - An `external_references` entry is inline, or a `{ type: biblio | tool, id }`
     key into the bibliography and tools catalogs.
   - A `tom_classification` entry is a measure id, or `{ measure, scope?, note? }`,
     resolved against the effective measures catalog. That lets a TOM annex
     reference a provider's physical-security and assurance evidence.
   - Both reuse the existing shapes. Neither gets a new one.

4. **One validation core serves both gates.** A pure core and a bare-Node loader
   hold every check.
   - The build-free gate, `validate-catalog.mjs`, imports them, as it already does
     for the measures catalog.
   - The build imports them through a new integration, `doc-kitty:subprocessors`.
     At `astro:config:setup` it validates the file once and throws one error that
     lists every problem, before any page renders.
   - The two give the same messages for the same file.

5. **The build publishes two outputs when the file exists.**
   - `api/subprocessors.json` holds every record and a `changes` list: one
     `added` entry per `since`, one `removed` entry per `until`, newest first.
   - `subprocessors.xml` is an RSS feed with one item per change.
   - Served-surface detection finds both routes, and `api/index.json` links them.
     Without the file neither route exists, so neither link appears.
   - **No output reads the build clock.** The documents carry dates, never a
     "current" or "upcoming" status, so the same catalog builds the same bytes
     on any day. A site gives advance notice by writing a future `since` or
     `until`. **⚖ counsel**: whether that feed meets a given contract's notice
     terms is a legal question, not a format one.

6. **A generated list page follows [ADR-0087](0087-generated-section-contract.md).**
   A page that lists current and past sub-processors separately carries ADR-0087's
   `generated` stamp and its drift gate. It ships as a separate step, after the
   outputs above.

### Out of this decision (follow-ups)

- A transfer-mechanism field (standard contractual clauses, an adequacy decision).
- Deriving changes from changelog fragments instead of the dates.
- Merging a product catalog with an organisation-wide one.
- An Atom variant of the feed.

## Consequences

### Positive

- The sub-processor list has one validated source. A typo, a dangling reference
  or an impossible date fails before the site builds.
- Agents read the list and its history from one link in the agent index.
- Readers can follow additions and removals, including announced ones.

### Negative

- One more catalog contract to maintain.
- The embedded ISO code list must be kept current when ISO assigns or withdraws a
  code.

### Risks

- A reader may treat the feed as the contractual notice. The guide says it is a
  channel, not notice. **⚖ counsel**.
- A site may publish a list that is incomplete. The format cannot detect a
  missing sub-processor.

## Alternatives considered

### Option A: Free-text `location`

Rejected. Text cannot be checked, and a later transfer analysis would have to
parse prose. `location_note` keeps room for detail.

### Option B: Changes from changelog fragments

Rejected. It ties a legal list to release notes and lets the two disagree. The
dates on the record are the single source.

### Option C: Validate when the routes render

Rejected. The error would surface late, and a route missing because there is no
file would look the same as one that failed.

### Option D: A package for country codes

Rejected. One lookup does not justify a new dependency, and `Intl.DisplayNames`
accepts codes that are not assigned.

## References

- [EU DPA compatibility research](../architecture/research/eu-dpa-compatibility.md),
  gap table row "Sub-processors and change notices"
- GDPR Article 28(2) and 28(4)
- Decision (EU) 2021/915, Annex IV and Clause 7.7; Decision (EU) 2021/914, Annex III
- ISO 3166-1, officially assigned alpha-2 codes
- Issue #403; epic #400
