# Data model: Operating-model templates and a Role kind

## Role page (frontmatter)

| Field | Required | Shape | Rule |
|---|---|---|---|
| `kind` | yes | `Role` | A member of `KINDS` (FR-001) |
| `role` | yes | non-empty string | Enforced by the gate (FR-002) |
| `responsibilities` | yes | non-empty list of non-empty strings | Enforced by the gate (FR-002) |
| `goals` | no | list of strings | Not required for Role (decision Q3) |
| `related` | no | page ids | Process pages name roles here |
| `tom_classification` | no | ADR-0080 shape | The Role template presets `accountability` at organisation scope |

**Invariant**: the Persona rule (`role`, `goals` and `responsibilities` required) is unchanged (FR-003).

## Template record (manifest)

| Field | Shape | Example |
|---|---|---|
| `id` | kebab-case, unique | `incident-response` |
| `title` | string | `Incident and breach response` |
| `kind` | a member of `KINDS` | `How-To` |
| `path` | path under the docs root, without `.md` | `operations/runbooks/incident-response` |
| `defaultType` | a member of `DOC_TYPES` | `Operations` (a runbook's type is derived as `Runbook`) |
| `measures` | non-empty list of catalog ids | `[availability-restoration, accountability]` |
| `body` | file name | `incident-response.md` |

**Invariants**:

- Ids are unique.
- Every measure resolves in the default catalog.
- Every kind is in `KINDS`.
- 12 records.

| id | path | kind | measures |
|---|---|---|---|
| organisation | operating-model/organisation | Explanation | it-security-governance |
| role | operating-model/roles/accountable-role | Role | accountability |
| governance-forums | operating-model/governance-forums | Reference | it-security-governance, accountability |
| policy-index | operating-model/policy-index | Hub | it-security-governance |
| access-management | operating-model/access-management | How-To | user-identification-authorisation |
| change-management | operating-model/change-management | How-To | system-configuration, testing-evaluation |
| incident-response | operations/runbooks/incident-response | How-To | availability-restoration, accountability |
| business-continuity | operations/runbooks/business-continuity | How-To | availability-restoration, confidentiality-integrity-availability-resilience |
| supplier-management | operating-model/supplier-management | How-To | certification-assurance |
| people | operating-model/people | How-To | it-security-governance |
| data-lifecycle | operating-model/data-lifecycle | How-To | limited-retention, portability-erasure |
| assurance-audits | operating-model/assurance-audits | Reference | testing-evaluation, certification-assurance |

## Section preset (snippet)

```yaml
- id: operating-model
  label: Operating model
  order: 105
  type: Operations
  purpose: How the organisation runs, including structure, roles, governance, processes and policies.
```

It is not in `docs/_meta/sections.yaml` or the toolkit default registry (FR-010, C-005).
