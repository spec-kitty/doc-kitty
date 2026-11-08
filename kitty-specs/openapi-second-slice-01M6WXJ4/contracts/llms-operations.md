# Contract: `llms.txt` operation summary (FR-014)

Off (default): `## OpenAPI documents` section byte-identical to today.

On (`openapi.llmsOperations: true`), under each version line:

```
- [v2](https://example.com/reference/api/v2/openapi.yaml)
  - GET /pets: List pets
  - POST /pets: createPet
  - DELETE /pets/{id}
```

Summary = `summary`, else `operationId`, else omitted (no colon). Order: path then uppercase method, bytewise. Zero operations: version line only.

Summary, operationId and label are flattened to one line (newlines to spaces) and `[`, `]`, `(`, `)` escaped with a backslash (FR-028).
