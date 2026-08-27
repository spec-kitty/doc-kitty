# Contract — Glossary page generation (codegen-into-collection)

**Owner**: IC-03 `src/lib/glossary/generate.ts`, wired by IC-08 (config.ts). ADR-0026 (AS-6).

## Behavior

```ts
function generateGlossaryPages(index: SharedTermIndex, outDocsDir: string): string[];
// returns the list of written file paths (empty when index absent)
```

## Rules

1. **Codegen INTO the docs collection** (FR-013, AS-6): write real Markdown files under
   `outDocsDir/glossary/`:
   - `glossary/index.md` — the hub, `kind: Hub`, listing contexts.
   - `glossary/<slug(context)>/index.md` — one per context, `kind: Glossary`,
     `glossary_context: <context>`, `title`, `doc_status: active`.
   Because they live under `docs/`, the existing `glob({ base: 'docs' })` loader ingests
   them, so the sidebar, sitemap draft-filter, agent API, and `llms.txt` pick them up with
   **no new wiring**.
2. **Render definitions/meta through the real markdown pipeline** (FR-003/FR-004): each
   term's `definition` and `meta` are emitted as Markdown body (never pre-escaped plain
   text); each term at a deterministic `#<anchor>` (`slug(name)`); a context's
   `domainVisionStatement` rendered if present.
3. **Self-declared context**: each generated context page sets its own `glossary_context`,
   so cross-references between glossary terms resolve unambiguously (ADR-0026 Decision 4).
4. **Deterministic + idempotent** (INV-G2): same `index` → byte-identical files; re-running
   overwrites identically.
5. **Presence-gated**: absent index → writes nothing, returns `[]` (INV-G4); this is why all
   infra WPs stay dormant until the terminal example WP lands `.contextive/definitions.yaml`.
6. **Nav default** (D7): the default Reference-group placement folds in here; the example's
   `_meta/sections.yaml` override lands in the terminal WP.

## Invariants

- No `/glossary/` route unless the definitions file is present.
- Generated tree is deterministic; the terminal WP's count-pins assert the generated set
  matches the fixture.
