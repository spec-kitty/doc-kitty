# Contract: `api/subprocessors.json` and agent-index links

Served only when `docs/_meta/subprocessors.yaml` exists and is valid. The route is
prerendered.

## Document

```json
{
  "title": "Sub-processors",
  "source": "_meta/subprocessors.yaml",
  "notice": "Structure only, not legal advice. The site owner's contract governs.",
  "count": 2,
  "records": [
    {
      "id": "acme-hosting",
      "name": "Acme Hosting B.V.",
      "address": "1 Example Street, Amsterdam",
      "contact": "privacy@acme-hosting.example",
      "processing": "Hosting of the production database and backups.",
      "location": ["NL", "DE"],
      "location_note": "Backups replicate to Frankfurt.",
      "responsibilities": "…",
      "since": "2025-01-15",
      "external_references": [{ "type": "biblio", "id": "acme-dpa", "title": "…", "url": "…" }],
      "tom_classification": [{ "measure": "physical-access-control" }, { "measure": "certification-assurance", "note": "…" }]
    }
  ],
  "changes": [
    { "date": "2027-03-01", "kind": "added", "id": "beta-mail", "name": "Beta Mail Ltd" }
  ],
  "_links": {
    "self": { "href": "https://site.example/api/subprocessors.json" },
    "feed": { "href": "https://site.example/subprocessors.xml" }
  }
}
```

Rules:

- **Field order.** Records keep file order. Within each record, keys follow the
  order of the data-model table, and absent optional keys are omitted, never `null`.
- **Resolved references.** `external_references` catalog entries resolve to
  `{type, id, title, url}`. `tom_classification` entries are normalised to
  objects `{measure, scope?, note?}`.
- **Changes.** `changes` follows the ChangeEntry order in the data model.
- **No clock.** There is no timestamp and no per-record status: a document built
  on any day is the same.
- **Base-aware URLs.** URLs are absolute and base-aware, like the other agent surfaces.
- **Serialisation.** JSON is serialised with two-space indentation and no trailing
  newline, matching the other `api/*.json` routes (`JSON.stringify(body, null, 2)`).

## Agent index (`api/index.json`) additions

```json
"_links": {
  "subprocessors": { "href": "https://site.example/api/subprocessors.json" },
  "subprocessorFeed": { "href": "https://site.example/subprocessors.xml" }
}
```

- **When present.** Each link appears only when served-surface detection sees its
  route. Both are absent without the file.
- **Contract version.** `version` stays `"3"`; the change is additive and optional.
- **Site-owned routes.** A site that mounts its own
  `src/pages/api/subprocessors.json.*` keeps it. Injection is skipped and the
  link still appears, because the route is detected.
