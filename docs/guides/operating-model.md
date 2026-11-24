---
title: Documenting your operating model
description: Start the pages that describe how your organisation runs, from twelve templates with preset measures, and record accountable roles with the Role kind.
doc_status: active
updated: 2026-11-24T00:00:00Z
type: Guide
kind: How-To
authors:
  - process:doc-kitty
tags: [operating-model, templates, tom, compliance, consumer]
related:
  - adr/0085-role-kind
  - adr/0080-tom-classification-field-and-measures-catalog
  - architecture/research/eu-dpa-compatibility
  - guides/authoring
---

# Documenting your operating model

**Audience.** A team that documents how its organisation runs: its structure,
roles, governance, processes and policies. Many teams do this to support the
organisational measures in a data processing agreement (see the
[EU DPA compatibility research](../architecture/research/eu-dpa-compatibility.md)).

**What the toolkit gives you.** It gives you structure, not content: twelve page
templates, an opt-in `operating-model` section, and a `Role` kind for
accountable functions. Each template holds headings, frontmatter and authoring
prompts. You write the facts.

> **Not legal advice.** The templates state no policy and make no legal claim.
> Whether your documentation meets a contract or a regulation is for you and
> your counsel to decide.

## Start one page

`new-doc --template <id>` writes one template page. With no slug, the page goes
to the template's default path.

```bash
pnpm exec dockitty-new-doc --template incident-response
pnpm exec dockitty-new-doc --template role operating-model/roles/dpo --title "Data Protection Officer"
```

The tool never overwrites a file that already exists. It refuses with exit 1
and leaves the file as it was.

The template fixes the page's kind, so `--template` cannot be combined with
`--kind` or `--section`. A title must fit on one line: a title with a newline
or another control character is refused.

## Start the whole set

`scaffold --preset operating-model` writes an `operating-model/` section index
and all twelve template pages. It writes nothing else.

```bash
pnpm exec dockitty-scaffold docs --preset operating-model
```

Existing files are skipped and counted, never overwritten, so you can run the
preset again on a tree you have already started. It cannot be combined with
`--sections`.

## The templates

Each template presets its `tom_classification` entries at
`scope: organisation`. The measure ids come from the default measures catalog
([ADR-0080](../adr/0080-tom-classification-field-and-measures-catalog.md)).

| Template id | Page | Kind | Preset measures |
|---|---|---|---|
| `organisation` | Organisation and teams | Explanation | `it-security-governance` |
| `role` | Accountable role | Role | `accountability` |
| `governance-forums` | Governance forums and decision rights | Reference | `it-security-governance`, `accountability` |
| `policy-index` | Policy index | Hub | `it-security-governance` |
| `access-management` | Access management | How-To | `user-identification-authorisation` |
| `change-management` | Change and release management | How-To | `system-configuration`, `testing-evaluation` |
| `incident-response` | Incident and breach response | How-To | `availability-restoration`, `accountability` |
| `business-continuity` | Business continuity and recovery | How-To | `availability-restoration`, `confidentiality-integrity-availability-resilience` |
| `supplier-management` | Supplier and sub-processor management | How-To | `certification-assurance` |
| `people` | People: onboarding, training, confidentiality and offboarding | How-To | `it-security-governance` |
| `data-lifecycle` | Data lifecycle: retention and deletion | How-To | `limited-retention`, `portability-erasure` |
| `assurance-audits` | Assurance and audits | Reference | `testing-evaluation`, `certification-assurance` |

The incident and continuity pages go to `operations/runbooks/`, so their `type`
is `Runbook`. The other pages go to `operating-model/`.

Keep the preset measures that your page evidences, and remove the rest. If you
replace the measures catalog with your own `docs/_meta/measures.yaml`, a preset
id that your catalog drops fails `pnpm exec dockitty-validate-catalog docs` and the build. Remove
it from the page, or keep the record in your catalog.

## Opt into the section

The `operating-model` section is not in the default section registry. To add it
to your information architecture, add this entry under `sections:` in
`docs/_meta/sections.yaml`:

```yaml
sections:
  # … your existing sections …
  - id: operating-model
    label: Operating model
    order: 105
    type: Operations
    purpose: How the organisation runs, including structure, roles, governance, processes and policies.
```

The same entry ships in the toolkit as
`lib/templates/operating-model/sections.snippet.yaml`, already indented to paste
at the end of a two-space `sections:` list.

Without the entry, the pages still validate. With it, the gate also warns when
an operating-model page's `type` is not `Operations`, or the type you set
through the vocabulary.

Both tools take a page's `type` from your section registry, the way the gate
does. Without an entry for the section, the index and the `operating-model/`
pages are `Operations`, and the two runbooks are `Runbook`. If you place a
template page somewhere else, it takes that section's type.

## Record a role

A role is an accountable function, such as a data protection officer or an
incident owner. Give it a page of kind `Role`
([ADR-0085](../adr/0085-role-kind.md)). The gate requires two fields:

- `role`, the name of the function;
- `responsibilities`, a list with one duty per entry.

`goals` is optional, because a role is not a reader. For a reader of your
documentation, use a `Persona` page instead.

A process page names the roles it involves in `related`:

```yaml
related:
  - operating-model/roles/dpo
  - operating-model/roles/incident-owner
```

A generated responsibility (RACI) matrix built from roles and processes is not
available yet.
