---
title: EU DPA compatibility
description: "What an EU DPA asks a processor to describe, the gaps against DocKitty, a tom_classification field, organisational reuse and operating-model templates."
doc_status: draft
updated: 2026-11-20T00:00:00Z
type: Architecture
kind: Explanation
tags: [gdpr, dpa, tom, compliance, security, metadata, templates, operating-model]
related:
  - adr/0009-finalize-metadata-contract
  - adr/0018-citation-catalog-collections
  - adr/0019-persona-attribute-fields
  - adr/0031-vocabulary-override
  - adr/0042-native-documentation-charter
  - adr/0059-content-graph-and-okf-alignment
  - adr/0065-kind-required-again
  - adr/0067-schematic-pages-reference-a-schema
  - adr/0079-kitty-packs-through-a-charter-contract-reader
  - adr/0080-tom-classification-field-and-measures-catalog
  - architecture/metadata-model
  - architecture/section-registry
  - architecture/content-graph
---

# EU DPA compatibility

> [!CAUTION]
> **This page is not legal advice.** It is an engineering reading of public
> texts, written for doc-kitty maintainers. Items marked **⚖ counsel** need review
> by qualified data-protection counsel before anyone relies on them, in the
> product or in a contract.

An EU data processing agreement (DPA) asks a processor to describe three things:
the processing, the system that performs it, and the technical and organisational
measures (TOMs) that protect it. This page answers four questions:

- what that description must contain;
- whether a formal or machine-readable definition of it exists;
- how DocKitty's default structure covers it;
- what DocKitty should add.

It also covers three follow-ups:

- a `tom_classification` frontmatter field;
- reusing organisational descriptions across TOM descriptions;
- templates for an organisation's operating model.

Audience: maintainers deciding the next metadata ADR, and consumers who document
a service that a customer will name in a DPA.

> **How the sources were checked.** Page fetches were blocked in the research
> session, including EUR-Lex, so web search was the only check. Each claim is
> tagged:
>
> - **[S]** means a search result quoted or summarised the source;
> - **[K]** means the claim comes from the published text as known, and was not
>   re-read. Re-read [K] items on EUR-Lex before quoting them.

## Summary

- **No formal EU format exists.** The EU defines no normative, machine-readable
  format for a DPA or a TOM description. The only binding structure is the annex
  layout of the Commission's standard contractual clauses (SCCs), and it is
  prose.
- **The machine-readable options are not normative in the EU.**
  - W3C DPV is a Community Group report, not a W3C standard.
  - NIST OSCAL is a US data model.
  - ISO/IEC 27001 and 27701 and BSI C5 bind only inside their own
    certification or attestation schemes.
- **DocKitty already covers most of the structure.** Its sections, its provenance
  metadata and its machine-readable surfaces fit a TOM description. The gaps are:
  - a way to classify a page by TOM category;
  - a data inventory and a sub-processor list;
  - a generated annex export;
  - reuse of organisational content;
  - templates.
- **Recommendation:**
  - an optional `tom_classification` field, backed by a measures catalog;
  - a generated TOM annex export;
  - an opt-in sub-processor catalog;
  - an opt-in operating-model template set.

  Nothing in these ships legal text.

## What a processor must describe

### GDPR

**Article 28(3), the processor contract.** [S]

- The contract sets out:
  - the subject-matter and duration of the processing;
  - its nature and purpose;
  - the type of personal data and the categories of data subjects;
  - the controller's obligations and rights.
- The processor must:
  - **(a)** act only on documented instructions;
  - **(b)** bind authorised persons to confidentiality;
  - **(c)** take the measures Article 32 requires;
  - **(d)** follow the sub-processor rules;
  - **(e)** help with data subject rights;
  - **(f)** help with Articles 32 to 36;
  - **(g)** delete or return the data at the end;
  - **(h)** provide the information that demonstrates compliance, and allow
    audits.

**Article 28(2) and 28(4), sub-processors.** These require prior authorisation,
notice of changes, and the same obligations flowed down to each sub-processor.
[K]

**Article 28(5).** An approved code of conduct or certification can serve as an
element of sufficient guarantees. [S]

**Article 30(2), the processor's records.** [K]

- **(a)** contacts;
- **(b)** categories of processing per controller;
- **(c)** third-country transfers;
- **(d)** "where possible, a general description of the technical and
  organisational security measures referred to in Article 32(1)".

**Article 32(1), security of processing.** [K] It calls for measures appropriate
to the risk, including:

- **(a)** pseudonymisation and encryption;
- **(b)** ongoing confidentiality, integrity, availability and resilience of
  processing systems and services;
- **(c)** timely restoration after an incident;
- **(d)** regular testing, assessing and evaluating of the measures.

Related provisions [K]:

- Article 32(2) requires the risk assessment behind the measures.
- Article 32(4) covers people acting under the processor's authority.
- Article 33(2) requires the processor to notify the controller of a breach
  without undue delay.

### The SCCs

**Decision (EU) 2021/915: SCCs between controllers and processors.** [S]

| Annex | Content |
|-------|---------|
| I | List of parties |
| II | Description of the processing: categories of data subjects and personal data, sensitive data and safeguards, nature, purposes, duration [K] |
| **III** | **Technical and organisational measures**, including the measures that help the controller and those of sub-processors |
| IV | List of sub-processors: name, address, contact, processing and division of responsibilities |

Clause 7.7 offers two ways to authorise sub-processors [S]:

- prior specific authorisation;
- general written authorisation, with notice of changes in advance.

> In 2021/915 the TOMs are Annex III, not Annex II. Annex II there describes the
> processing.

**Decision (EU) 2021/914: transfer SCCs.**

- Annex I describes the parties, the transfer and the supervisory authority. [K]
- Annex III lists sub-processors. [K]
- Annex II holds the TOMs, which must be described "in specific (and not generic)
  terms". It gives 17 example headings. [S] confirms the first four; the rest are
  [K]:

1. Pseudonymisation and encryption
2. Confidentiality, integrity, availability and resilience of systems and services
3. Restoring availability and access after an incident
4. Regular testing, assessing and evaluating of the measures
5. User identification and authorisation
6. Protection of data during transmission
7. Protection of data during storage
8. Physical security of processing locations
9. Events logging
10. System configuration, including default configuration
11. Internal IT and IT security governance and management
12. Certification and assurance of processes and products
13. Data minimisation
14. Data quality
15. Limited data retention
16. Accountability
17. Data portability and erasure

Headings 13 to 17 lean towards controller duties. [S] **⚖ counsel**: decide which
of them a processor's documentation should claim.

### Guidance and national methods

- **EDPB Guidelines 07/2020** (v2.0, July 2021) [S] read Article 28 as requiring:
  - measures stated specifically, not as boilerplate;
  - controller approval of changes to the measures;
  - regular review.

  These three points are the ones that matter most for a documentation toolkit.
- **DSK Standard-Datenschutzmodell (SDM) 3.1** (DE, adopted May 2024) groups
  measures under seven protection goals and keeps a catalog of reference
  measures. [S] It is in prose.
- **CNIL security guide** (FR, 2024 edition) has 25 factsheets. The CNIL uses it
  as its own Article 32 reference. [S]
- **EU Cloud Code of Conduct** (Article 40, approved by the Belgian authority in
  2021) and the **Europrivacy** seal (EDPB Opinion 28/2022) are voluntary
  evidence of guarantees. [S]

### Architecture is evidence, not a required section

No provision reviewed requires a software architecture description. **⚖ counsel**.
Architecture is still the evidence behind several required items:

- the nature of the processing;
- the "systems and services" of Article 32(1)(b);
- transmission, storage, logging and configuration (headings 6, 7, 9 and 10);
- processing locations;
- the sub-processor boundary.

## Formal and machine-readable definitions

| Candidate | Standing | Normative for a DPA | Machine-readable |
|-----------|----------|---------------------|------------------|
| GDPR Articles 28, 30 and 32 | EU regulation | Yes | No |
| SCCs 2021/915 and 2021/914 | Commission implementing decisions | Yes, when used: the annex structure is binding and the parties fill it in | No; prose annexes |
| EDPB Guidelines 07/2020 | Authoritative interpretation | No | No |
| W3C DPV, including its TOM module and EU-GDPR extension | Final Community Group report (2.0 in 2024, 2.1 in 2025); "not a W3C Standard" [S] | No | Yes: RDF and OWL with stable `w3id.org/dpv` IRIs. Measures are typed as technical, organisational, legal or physical [S] |
| NIST OSCAL (SSP and component definition) | NIST; 1.1.x and 1.2.x releases [S] | No (a US context) | Yes: JSON, XML and YAML. The SSP models the system boundary, network architecture and data flow [K] |
| ISO/IEC 27001:2022 Annex A | Voluntary standard | Only inside its certification | No; the text is paywalled |
| ISO/IEC 27701:2025 | Standalone since October 2025 [S] | Only inside its certification | No |
| BSI C5 | German cloud criteria; C5:2025 was a community draft in 2025 [S] | Only where German rules mandate it **⚖ counsel** | No |
| ENISA guidance | EU agency guidance | No | No |
| CEN/CENELEC EN 17529:2022 | Voluntary EN on privacy by design (JTC 13 WG 5) [S] | No | No |

**Conclusion.** DocKitty should take three things from these:

- the SCC annex structure, for grouping;
- DPV IRIs, as optional identifiers;
- OSCAL, as a later export target.

## Gaps against DocKitty

Status legend:

- ✅ **covered**: works today;
- 🔁 **mappable**: works today through sections, tags, `related` or a template;
- 🆕 **new**: needs a new field, catalog or export;
- ⛔ **out of scope**: legal content the toolkit does not author.

| DPA element | Source | DocKitty home today | Status |
|-------------|--------|---------------------|--------|
| Parties, contacts, instructions, legal purpose | Article 28(3), Article 30(2)(a), Annex I | none | ⛔ |
| Nature of processing | Article 28(3), 2021/915 Annex II | Architecture | 🔁 |
| Data categories, data subjects, sensitive data, retention, locations | 2021/915 Annex II, Article 30(2)(c) | none | 🆕 data inventory |
| Sub-processors and change notices | Article 28(2) and 28(4), 2021/915 Annex IV, Clause 7.7 | Integrations (prose), changelog | 🆕 catalog; 🔁 notices |
| Transfer assessment, risk assessment | Articles 32(2) and 44 to 46 | none | ⛔; 🔁 link to it |
| TOM headings 1 to 17 and Article 32(1) | Article 32, 2021/914 Annex II | Security, Architecture, Operations (`Runbook`), Configuration | 🔁 pages; 🆕 classification |
| Testing and review evidence | Article 32(1)(d), EDPB | `verified`, `updated`, `stale_after` | ✅ |
| Certification and assurance | Articles 28(5), 32(3), 40, 42 | `external_references` and the bibliography catalog | 🔁 |
| Rights, breach and deletion processes | Article 28(3)(e) to (g), Article 33(2) | Operations runbooks | 🔁 |
| Information that demonstrates compliance | Article 28(3)(h) | agent API, content graph, OKF export | ✅ |
| General description of TOMs, versioned | Article 30(2)(d), EDPB | none | 🆕 generated annex |
| Organisational measures reused across products | Organisational headings below | none (no transclusion; one tree per repository) | 🆕 reuse |
| Operating model (roles, governance, processes) | Article 28(3)(b), headings 4, 11 and 16 | `Persona` fields, `new-doc.mjs` and `scaffold.mjs` stubs | 🆕 templates |
| Specific, non-generic wording | 2021/914 Annex II, EDPB | none | ⛔ (a template can prompt for it) |

No new top-level section is needed. The section registry already has security,
architecture, integrations, operations and configuration.

> Side observation: doc-kitty's own tree has no `security/`, `integrations/` or
> `operations/` folder (it uses `ops/`), although `sections.yaml` declares them.

## A `tom_classification` field

**Proposal: an optional `tom_classification` field.** It names the measure
categories a page provides evidence for. It is a field, not a new `kind`. A
`kind` says how to read the page
([ADR-0009](../../adr/0009-finalize-metadata-contract.md)): a TOM page is still a
Reference, a How-To or a Runbook. The TOM category says what the page is about.

The key is spelled in lowercase snake case, as every field in the contract is
(`doc_status`, `stale_after`, `external_references`). YAML keys are
case-sensitive, and the vocabulary seam
([ADR-0031](../../adr/0031-vocabulary-override.md)) aliases values, not keys. A
`TOM_classification` spelling would therefore be a second key to support, not an
alias. **Decided:** lowercase only, with no uppercase alias. The field is drafted
as [ADR-0080](../../adr/0080-tom-classification-field-and-measures-catalog.md).

### Shape

The field follows the `related` precedent: a bare id, or an object.

```yaml
tom_classification:
  - transmission-protection                  # bare id
  - measure: events-logging
    scope: system                            # system | organisation
    note: Audit log of every admin action, kept 13 months.
```

- `measure` is an id in the measures catalog.
- `scope` says whether the measure belongs to this system or to the whole
  organisation. The organisation scope drives reuse (see the next section). The
  default is `system`.
- `note` gives the specific detail the SCCs and the EDPB ask for.

### The measures catalog

The catalog is `_meta/measures.yaml`, built like the bibliography and tools
catalogs ([ADR-0018](../../adr/0018-citation-catalog-collections.md)):

```yaml
- id: transmission-protection
  label: Protection of data during transmission
  nature: technical                 # technical | organisational | legal | physical (DPV)
  frameworks:
    - { framework: scc-2021-914-annex-ii, ref: "6" }
    - { framework: gdpr-art-32-1, ref: "b" }
  dpv: https://w3id.org/dpv#...     # optional DPV concept IRI
```

**Default catalog.** DocKitty ships the 17 SCC headings and the four Article
32(1) items, as short labels with DPV IRIs.

- The labels are identifiers taken from public legislation, not authored legal
  text. **⚖ counsel** should confirm that shipping them is fine.
- A consumer extends the catalog, or replaces it, through the charter. It can
  add ISO/IEC 27001 Annex A, C5 or SDM ids, keeping its own licence obligations.

**Validation** follows the catalog rule: an id that does not resolve fails the
build, as a missing citation does. The nature (technical or organisational) lives
on the catalog entry, not on the page, so authors do not repeat it.

**Contract cost.** The field and catalog need a new ADR, since adding a field
takes one (ADR-0009). The Astro schema stays lenient and the gate validates, as
with other fields ([ADR-0065](../../adr/0065-kind-required-again.md)). The content
graph gains a `classified-as` edge.

## Reusing organisational descriptions

About half of the TOM headings describe the organisation, not the product:

- governance (11);
- certification and assurance (12);
- accountability (16);
- testing and evaluation as a process (4);
- personnel confidentiality (Article 28(3)(b));
- training;
- incident and breach handling;
- supplier and sub-processor management;
- often physical security (8).

These descriptions are identical for every product and every DPA the
organisation signs. Writing them once and referencing them everywhere is where
documentation pays off most for TOMs. It also helps with change control: one
edit, one review, one date.

DocKitty has no transclusion directive. Each repository renders its own tree. So
reuse means linking, not copying.

| Option | How | Fit | Verdict |
|--------|-----|-----|---------|
| **Link, do not copy** | Organisational pages carry `tom_classification` entries with `scope: organisation`. System pages point at them through `related`. The annex export follows those edges and lists the organisational measures once. | Uses `related`, the content graph and the new field; no new mechanism | **Recommend** now |
| **Shared organisation bundle** | The organisation keeps one docs tree, an "operating model" site, and publishes its `api/tom-annex.json`. A product site's annex export reads that file by URL from config and merges it, marked as inherited. | Exports and metadata only, like the OKF bundle | **Recommend** next; it is the reuse-at-scale path |
| Transclusion directive | Inline another page's body | Copies text into many pages and blurs ownership and freshness | Defer |
| An operating-model pack | Ship the organisational pages as a kitty pack ([ADR-0079](../../adr/0079-kitty-packs-through-a-charter-contract-reader.md)) | The charter's packs contract defines packs, not DocKitty | Possible later; out of DocKitty's control |

A DPA annex then becomes two layers. The organisation's measures are inherited
and referenced. The system's measures are specific to the product. Both carry
review dates and reviewers.

## Operating-model templates

An operating model describes how the organisation runs:

- its structure and teams;
- its roles and who is accountable for what;
- its governance forums and decision rights;
- its core processes;
- its policies.

The organisational TOMs are a view of it. A template set for it serves TOM
descriptions and also stands alone as documentation.

### What DocKitty has

- **Fields.** `kind: Persona` carries `role`, `goals` and `responsibilities`
  ([ADR-0019](../../adr/0019-persona-attribute-fields.md)). A persona is a
  reader, though, not an accountable function.
- **Templates.** `Template` is a known `type`; the ADR template is one.
- **Stub tools.** `src/scripts/new-doc.mjs` and `src/scripts/scaffold.mjs` write
  pages with correct frontmatter but no body template.

### Proposal

1. **An opt-in `operating-model` section preset.** It is a documented
   `sections.yaml` entry, not a default section. Its default `type` is
   `Operations`, or a consumer type set through the vocabulary.
2. **Template support in the stub tools.** Add `new-doc.mjs --template <id>` and
   `scaffold.mjs --preset operating-model`. A template is a Markdown file with:
   - frontmatter, including preset `tom_classification` entries with
     `scope: organisation`;
   - a heading skeleton;
   - authoring prompts in HTML comments, such as "name the forum, its cadence and
     who decides".

   Templates hold structure and prompts only, never policy wording, which keeps
   them inside the charter's scope.
3. **A `Role` kind.** It reuses the ADR-0019 `role` and `responsibilities` fields
   for an accountable function, kept separate from `Persona`. Processes can then
   name roles through `related`. A generated responsibility (RACI) matrix is a
   later option.

### Starter set

| Template | `kind` | Preset `tom_classification` (organisation scope) |
|----------|--------|--------------------------------------------------|
| Organisation and teams | Explanation | governance |
| Role (one per role) | Role | accountability |
| Governance forums and decision rights | Reference | governance, accountability |
| Policy index | Hub | governance |
| Access management process | How-To | user identification and authorisation |
| Change and release management | How-To | system configuration, testing and evaluation |
| Incident and breach response | Runbook | restoring availability, accountability |
| Business continuity and recovery | Runbook | restoring availability, CIA and resilience |
| Supplier and sub-processor management | How-To | certification and assurance |
| People: onboarding, training, confidentiality, offboarding | How-To | governance (Article 28(3)(b)) |
| Data lifecycle: retention and deletion | How-To | limited retention, portability and erasure |
| Assurance and audits | Reference | testing and evaluation, certification and assurance |

## Options, ranked against the charter

The charter puts structure, metadata and exports in scope, and authoring content
out of scope.

| Rank | Option | Verdict |
|------|--------|---------|
| 1 | Consumer guide and opt-in presets (compliance, operating model) | Recommend first; usable today with tags and `related` |
| 2 | `tom_classification` field and measures catalog | Recommend; needs an ADR |
| 3 | Generated TOM annex export (`api/tom-annex.json`, an optional hub page, OKF inclusion). It groups pages by measure and scope, lists uncovered measures, and is versioned per release under the generated-section contract proposed in issue #359 | Recommend after rank 2. Label it an evidence index, not the contractual annex **⚖ counsel** |
| 4 | Operating-model templates: `--template` and `--preset` in the stub tools, plus a `Role` kind | Recommend with rank 2, since the templates preset the field |
| 5 | Opt-in sub-processor catalog (`_meta/subprocessors.yaml`) and a generated list page | Recommend as opt-in |
| 6 | Shared organisation bundle: merge another site's annex by URL | Next, once ranks 2 and 3 exist |
| 7 | Data-inventory schema page ([ADR-0067](../../adr/0067-schematic-pages-reference-a-schema.md)) | Later **⚖ counsel** |
| 8 | DPV JSON-LD in the content graph | Defer; cheap after rank 2 |
| 9 | OSCAL export | Defer; revisit if an EU body adopts OSCAL |
| — | TOM categories as `kind` values | Reject: conflicts with ADR-0009 |
| — | A default compliance section | Reject: offer the preset instead |
| — | DPA or policy text templates with legal wording | Reject: out of the charter's scope, and a liability |

## Open questions

1. **⚖ counsel** Which of headings 13 to 17 should a processor's catalog flag
   as controller duties?
2. **⚖ counsel** Can a DPA annex reference a living evidence index, or must it
   attach a dated snapshot? A snapshot per release with a digest is the safe
   default.
3. **Maintainers.** Should `Role` be a new kind, or a Persona sub-use?
4. **Maintainers.** Which consumer can validate the annex shape first?
5. **Research.** Is BSI moving IT-Grundschutz to an OSCAL-based format? Not
   verified here.
6. **Research.** Confirm the DPV 2.x class tree for measures, and whether the
   ISO/IEC 27701:2025 edition keeps a GDPR mapping annex.
7. **Verification.** Re-read every [K] item on EUR-Lex.

## Sources

Legal texts and authorities:

- [GDPR, Regulation (EU) 2016/679](https://eur-lex.europa.eu/eli/reg/2016/679/oj)
  and an [Article 28 text mirror](https://gdpr-text.com/en/read/article-28/)
- [Decision (EU) 2021/915](https://eur-lex.europa.eu/eli/dec_impl/2021/915/oj)
  and [Decision (EU) 2021/914](https://eur-lex.europa.eu/eli/dec_impl/2021/914/oj/eng)
- [ICO: what a processor contract must include](https://ico.org.uk/for-organisations/uk-gdpr-guidance-and-resources/accountability-and-governance/contracts-and-liabilities-between-controllers-and-processors-multi/what-needs-to-be-included-in-the-contract/)
- [Irish DPC: controller-processor contracts](https://www.dataprotection.ie/en/dpc-guidance/data-processing-agreements)
- [SCL: the 2021 SCCs in practice](https://www.scl.org/12497-the-2021-eu-sccs-practical-issues-some-solutions/)
- [EDPB Guidelines 07/2020, final](https://www.edpb.europa.eu/system/files/2021-07/eppb_guidelines_202007_controllerprocessor_final_en.pdf)
- [DSK SDM method](https://www.datenschutzzentrum.de/uploads/sdm/SDM-Methode.pdf)
- [CNIL security guide, 2024](https://www.cnil.fr/fr/guide-de-la-securite-des-donnees-personnelles-nouvelle-edition-2024)
- [Belgian DPA decision 05/2021 on the EU Cloud Code of Conduct](https://dataprotectionauthority.be/publications/decision-n05-2021-of-20-may-2021.pdf)
- [EDPB Opinion 28/2022 on Europrivacy](https://collab.dpa.gr/wp-content/uploads/2023/07/EDPB-Opinion-28-2022-on-the-Europrivacy-criteria-of-certification_en.pdf)

Formats and standards:

- [W3C DPV TOM module](https://w3c.github.io/dpv/2.3/dpv/modules/TOM) and
  [DPV EU legal concepts](https://w3c.github.io/dpv/2.1/legal/eu)
- [NIST OSCAL SSP](https://pages.nist.gov/OSCAL/learn/concepts/layer/implementation/ssp)
  and the [OSCAL 1.2.2 reference](https://pages.nist.gov/OSCAL-Reference/models/v1.2.2/)
- [ISO/IEC 27701:2025 revision (DNV)](https://www.dnv.com/assurance/Management-Systems/new-iso/transition/revision-of-iso-iec-27701/)
- [BSI C5:2025 community draft (Coalfire)](https://coalfire.com/the-coalfire-blog/c52025-community-draft)
- [EN 17529 (CEN/CENELEC)](https://www.cencenelec.eu/news-events/news/2022/eninthespotlight/2022-03-28-discover-new-en-17529-on-data-protection-and-privacy-by-design-and-by-default/)
- [ENISA: data pseudonymisation](https://www.enisa.europa.eu/publications/data-pseudonymisation-advanced-techniques-and-use-cases)
