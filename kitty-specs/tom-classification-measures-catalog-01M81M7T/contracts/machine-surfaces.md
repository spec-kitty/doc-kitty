# Contract: machine surfaces

## `api/content-graph.json` (schema `dockitty.content-graph/1`, additive)

```json
{ "id": "catalog:measure:events-logging", "kind": "catalog",
  "title": "Events logging", "url": "https://w3id.org/dpv#ActivityMonitoring",
  "measure": { "nature": "technical",
               "frameworks": [{ "framework": "eu-scc-2021-914-annex-ii", "ref": "9" }] } }
```

```json
{ "id": "security/audit-log|classified-as|catalog:measure:events-logging",
  "source": "security/audit-log", "target": "catalog:measure:events-logging",
  "rel": "classified-as", "note": "Every admin action is logged.", "scope": "system" }
```

- Nodes and edges keep code-unit order. Drafts and their edges are absent.
- A page without the field contributes no new bytes.

## `/api/pages/<id>.json`

```json
"tom_classification": [
  { "measure": "events-logging", "label": "Events logging", "nature": "technical",
    "scope": "system", "note": "Every admin action is logged." }
]
```

- The key is present only when the page has the field. Order follows the authored order, after de-duplication.

## OKF bundle concept document

```markdown
## Measures

- [Accountability](https://w3id.org/dpv#ComplianceMonitoring) (organisation)
- [Events logging](https://w3id.org/dpv#ActivityMonitoring) - Every admin action is logged.
```

- The section comes after `## References` and before `## Derived from`. Lines follow the graph's edge order, which is code-unit order of the target ids, so measures appear by id, not in authored order. A measure without a DPV IRI is plain text.
