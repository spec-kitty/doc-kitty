/*
 * Ambient types for the build-time virtual module `virtual:doc-kitty/openapi`
 * (served by the `openapi` option's Vite plugin, `lib/openapi/adapters.ts`).
 */
declare module 'virtual:doc-kitty/openapi' {
  export const openApi: {
    /** Mount point of the reference pages, without slashes at the ends. */
    section: string;
    versions: Array<{ label: string; released: boolean }>;
  };
}

/** The version nav the route middleware sets for a reference page (`PageTitle` reads it). */
declare namespace App {
  interface Locals {
    dkOpenApi?: import('./openapi/adapters.js').OpenApiNav;
    /** Links the route-shaping middleware relabelled, for a later middleware that rebuilds prev/next. */
    dkRelabelled?: Map<string, import('./route-shaping.js').Relabelled>;
  }
}
