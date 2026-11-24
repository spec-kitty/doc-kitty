/**
 * The evidence-index endpoint the `doc-kitty:tom-annex` integration injects at
 * `/api/tom-annex.json`, only on a site with a published classified page
 * (#401). It is `tomAnnexRoute()` with the `docsDir` and `indexBasename` the
 * integration was given, read from a virtual module. A site mounts nothing.
 */
import { tomAnnexOptions } from 'virtual:doc-kitty/tom-annex';
import { tomAnnexRoute } from './tom-annex.js';

export const GET = tomAnnexRoute(tomAnnexOptions);
