/*
 * Ambient types for the build-time virtual module `virtual:doc-kitty/tom-annex`
 * (served by the `doc-kitty:tom-annex` integration, #401): the options the
 * injected evidence-index route needs.
 */
declare module 'virtual:doc-kitty/tom-annex' {
  export const tomAnnexOptions: {
    docsDir: string;
    indexBasename?: string | string[];
  };
}
