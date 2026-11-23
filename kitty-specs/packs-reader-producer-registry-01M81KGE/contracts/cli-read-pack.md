# Contract: `dockitty-read-pack`

```
dockitty-read-pack <dir> [--json] [--charter-lock <file>] [--contract <dir>] [--repo-root <dir>]
```

- `--json`: prints one `PackModel` as JSON (2-space indent, trailing newline), deterministic.
- Without `--json`: a short summary (identity, inventory per kind, manifest state) and one line per problem.
- Exit 0 when a model is printed, problems included. Exit 2 for a usage error, a directory with no `pack.yaml`, or a contract snapshot whose lock fails.
