/**
 * The content-graph endpoint the `doc-kitty:content-graph` integration injects at
 * `/api/content-graph.json` on every site (#176). It is `contentGraphRoute()` with
 * the `docsDir` and `indexBasename` the integration was given, read from a virtual
 * module so the route walks the same tree the site loads. A site mounts nothing.
 */
import { contentGraphOptions } from 'virtual:doc-kitty/content-graph';
import { contentGraphRoute } from './content-graph.js';

export const GET = contentGraphRoute(contentGraphOptions);
