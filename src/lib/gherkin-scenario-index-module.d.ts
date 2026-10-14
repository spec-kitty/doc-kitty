/*
 * Ambient types for the build-time virtual module
 * `virtual:doc-kitty/gherkin-scenario-index` (served by the `doc-kitty:gherkin`
 * integration in `config.ts`): the two gherkin options the injected
 * scenario-index route needs.
 */
declare module 'virtual:doc-kitty/gherkin-scenario-index' {
  export const scenarioIndexOptions: { sourceRoot: string; sourceUrlPrefix?: string };
}
