/*
 * Ambient types for the build-time virtual module `virtual:doc-kitty/content-graph`
 * (served by the `doc-kitty:content-graph` integration): the options the injected
 * content-graph route needs.
 */
declare module 'virtual:doc-kitty/content-graph' {
  export const contentGraphOptions: {
    docsDir: string;
    indexBasename?: string | string[];
  };
}
