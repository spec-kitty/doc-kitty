# Contracts

This mission adds no contract. It documents two that already ship:

- The `diagrams?: boolean` option of `defineDocKittyIntegrations`
  (`src/lib/config.ts`), now described in its doc comment.
- The `DK_DIAGRAM_BUILD_RENDER` and `DK_PLANTUML_SERVER_URL` environment
  variables, read by `resolveDiagramMode` and `resolvePlantumlServerUrl`.

Both are recorded in [ADR-0040](../../../docs/adr/0040-build-time-diagram-render-dual-mode.md).
The adopter-facing description is the consumer guide's
"Optional: Diagrams" section.
