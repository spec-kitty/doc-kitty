/**
 * The per-page Atom endpoint the `doc-kitty:page-atom` integration injects at
 * `/api/pages/[...slug].atom.xml`. It is `pageAtomRoute()` with the site title the
 * integration was given, read from a virtual module. A site mounts nothing.
 */
import { pageAtomOptions } from 'virtual:doc-kitty/page-atom';
import { pageAtomRoute } from './page-atom.js';

const route = pageAtomRoute(pageAtomOptions);
export const getStaticPaths = route.getStaticPaths;
export const GET = route.GET;
