/*
 * Ambient types for the build-time virtual module `virtual:doc-kitty/print-route`
 * (served by the `doc-kitty:print-route` integration, ADR-0081): what the injected
 * print route needs that only the config knows.
 */
declare module 'virtual:doc-kitty/print-route' {
  export const printRouteOptions: { siteTitle: string; siteDescription: string | undefined };
}
