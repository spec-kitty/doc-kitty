---
title: "ADR-0080: A tom_classification field and a measures catalogue"
description: "Pages classify the technical and organisational measures they evidence through an optional tom_classification field, resolved against a measures catalogue."
doc_status: draft
updated: 2026-11-18T00:00:00Z
type: ADR
kind: ADR
authors:
  - process:claude-code
related:
  - architecture/research/eu-dpa-compatibility
  - adr/0009-finalize-metadata-contract
  - adr/0018-citation-catalog-collections
  - adr/0031-vocabulary-override
  - adr/0042-native-documentation-charter
  - adr/0059-content-graph-and-okf-alignment
---

# ADR-0080: A tom_classification field and a measures catalogue

> [!CAUTION]
> **This ADR is not legal advice.** It decides a metadata contract, not what a
> data processing agreement must contain. Items marked **⚖ counsel** need review
> by data-protection counsel before the default catalogue ships.

## Status

Proposed. It follows the research in
[EU DPA compatibility](../architecture/research/eu-dpa-compatibility.md). The
operator chose the lowercase key `tom_classification`, with no uppercase alias.

## Context

A processor that signs an EU data processing agreement (DPA) describes its
technical and organisational measures (TOMs):

- GDPR Article 32(1) names four kinds of measure.
- The standard contractual clauses list 17 example headings: Annex III of
  Decision (EU) 2021/915, and Annex II of Decision (EU) 2021/914.
- Article 30(2)(d) asks for a general description of the measures in the
  processor's records.

The EU defines no machine-readable format for any of this. W3C DPV gives stable
identifiers for measure concepts, but it is a Community Group report, not a
standard.

DocKitty already holds most of the evidence: architecture, security, operations
and configuration pages, plus review metadata (`updated`, `verified`,
`stale_after`). What it lacks is a way to say which measure a page evidences.
Without that, the evidence cannot be gathered, checked for gaps or exported.

About half of the measures describe the organisation, not one product:

- governance, assurance and accountability;
- staff confidentiality and training;
- incident handling and supplier management.

These descriptions are the same in every DPA the organisation signs. If each
product copies them, the copies drift apart and lose their review history.

## Decision

1. **Add an optional `tom_classification` field.** It lists the measures a page
   provides evidence for.
   - **Shape.** Each entry is a bare measure id, or an object
     `{ measure, scope?, note? }`, following the `related` precedent:

     ```yaml
     tom_classification:
       - transmission-protection
       - measure: events-logging
         scope: system
         note: Every admin action is logged and kept for 13 months.
     ```

   - **`scope`** is `system` (the default) or `organisation`.
   - **`note`** carries the specific detail the clauses and the EDPB ask for.
   - **Spelling.** The key is lowercase snake case, like every other field in
     the contract. There is no `TOM_classification` alias.
   - **Why a field.** It is not a `kind`. A `kind` says how to read a page
     ([ADR-0009](0009-finalize-metadata-contract.md)), and a TOM page is still a
     Reference, a How-To or a Runbook. The measure is what the page is about.

2. **Ids resolve against a measures catalogue, `_meta/measures.yaml`.** It
   follows the catalogue pattern of
   [ADR-0018](0018-citation-catalog-collections.md).
   - **Entries.** Each entry is
     `{ id, label, nature, frameworks: [{ framework, ref }], dpv? }`. `nature` is
     `technical`, `organisational`, `legal` or `physical`, after DPV's four
     groups. The nature lives on the entry, so pages do not repeat it.
   - **Validation.** An id that does not resolve fails the build and the
     build-free catalogue gate, exactly as a missing citation does.

3. **DocKitty ships a default catalogue.** It holds:
   - the 17 example headings of 2021/914 Annex II;
   - the four items of GDPR Article 32(1);

   each as a short label with its framework reference and a DPV concept IRI.
   - The labels are identifiers taken from public legislation, not authored
     legal text. **⚖ counsel**: confirm that shipping them is fine.
   - **⚖ counsel**: decide whether headings 13 to 17 should be marked as
     controller-leaning.

4. **Consumers extend or replace the catalogue through the charter**
   ([ADR-0042](0042-native-documentation-charter.md)).
   - A consumer can add ISO/IEC 27001 Annex A, BSI C5 or SDM ids under its own
     licence terms, or drop the default.
   - An absent catalogue means the shipped default.
   - A docs tree that never uses the field is unaffected.

5. **Organisational measures are linked, not copied.**
   - A page that describes an organisation-wide measure carries entries with
     `scope: organisation`.
   - A system page that relies on the measure points to that page through
     `related`. It does not restate it.
   - Any later export lists an organisation-scope measure once, as inherited.

6. **The build schema stays lenient; the gate validates.** This matches how the
   other optional fields are handled
   ([ADR-0065](0065-kind-required-again.md)). The content graph
   ([ADR-0059](0059-content-graph-and-okf-alignment.md)) gains a `classified-as`
   edge from a page to its measure ids.

### Out of this decision (follow-ups)

- **A generated TOM annex export** (`api/tom-annex.json` and an optional hub
  page). It groups pages by measure and scope and lists uncovered measures. It
  waits for the generated-section contract proposed in issue #359, so it
  inherits that contract's stamp and drift check.
- **Operating-model templates:** `new-doc.mjs --template`,
  `scaffold.mjs --preset operating-model` and a `Role` kind.
- **A sub-processor catalogue** (`_meta/subprocessors.yaml`) with a generated
  list page.
- **A shared organisation bundle.** A product site would merge an organisation
  site's annex by URL.

## Consequences

### Positive

- TOM evidence becomes queryable. The agent API, the content graph and a later
  export can gather it without parsing prose.
- Organisation-wide measures are written, reviewed and dated once.
- The default catalogue gives every consumer the same ids. DPV IRIs keep a path
  open to linked-data tools.

### Negative

- A new optional field and a new catalogue grow the metadata contract.
- The default catalogue is DocKitty's to maintain if the clauses or DPV change.

### Risks

- A consumer could read a classified page as a complete TOM description. The
  field marks evidence; it does not make the description specific or
  sufficient. **⚖ counsel**.
- Shipping legislative headings as defaults may need counsel's sign-off first.

## Alternatives considered

### Option A: TOM categories as `kind` values

Rejected. `kind` drives the layout and names how to read a page (ADR-0009).
Seventeen measure kinds would replace that reading axis, and a page could hold
only one.

### Option B: Free-form `tags` with a prefix (`tom:encryption`)

Rejected. Tags are not validated, carry no scope or note, and cannot map to a
framework or DPV.

### Option C: Reuse `external_references` with a catalogue `type: measure`

Rejected. It needs no new key, but a citation is not a classification. The
content graph would mix "cites" and "evidences", and scope would have no home.

### Option D: Accept `TOM_classification` as well

Rejected by the operator. Keys are case-sensitive, and the contract is
lowercase snake case throughout.

## References

- [EU DPA compatibility research](../architecture/research/eu-dpa-compatibility.md)
- GDPR Articles 28, 30(2)(d) and 32(1)
- Decision (EU) 2021/915, Annex III; Decision (EU) 2021/914, Annex II
- [W3C DPV TOM module](https://w3c.github.io/dpv/2.3/dpv/modules/TOM)
- Issue #359: the generated-section contract
