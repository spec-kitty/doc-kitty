/*
 * Ambient types for the build-time virtual module `virtual:doc-kitty/subprocessors`
 * (served by the `doc-kitty:subprocessors` integration, ADR-0086): the checked
 * catalog the injected API and feed routes render.
 */
declare module 'virtual:doc-kitty/subprocessors' {
  export const subprocessorsData: {
    records: import('./subprocessors-core.mjs').ResolvedSubprocessor[];
    changes: import('./subprocessors-core.mjs').ChangeEntry[];
    siteTitle: string;
  };
}
