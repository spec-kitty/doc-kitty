# Contract: `openapi` option additions

```ts
openapi: {
  renderer: typeof starlightOpenAPI;
  section?: string;                 // default 'reference/api'
  specs?: Array<
    | { path: string; label: string; released: boolean; sha256?: string }
    | { url: `https://${string}`; sha256: string; label: string; released: boolean }
  >;
  archive?: { glob: string; labelPattern: string; released?: boolean }; // released defaults true
  llmsOperations?: boolean;         // default false (FR-014)
  offline?: boolean;                // default: process.env.DOCKITTY_OFFLINE === '1'
}
```

- At least one version must result from `specs` plus `archive`.
- Static checks (eager, in `normaliseOpenApiOptions`): types, label rule, `https` scheme, sha256 format, `labelPattern` compiles and has exactly one capturing group.
- Materialisation checks: see [rejected-inputs.md](./rejected-inputs.md).
- A site without `openapi` sees no change in any output (NFR-002).
