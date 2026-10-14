/**
 * The scenario-index endpoint the `doc-kitty:gherkin` integration injects at
 * `/api/scenarios.json` when generated Gherkin pages are on (#126, ADR-0054).
 * It is `scenarioIndexRoute()` with the `sourceRoot` and `sourceUrlPrefix` the
 * integration was given, read from a virtual module so the route resolves
 * sources exactly as the generator did. A site mounts nothing.
 */
import { scenarioIndexOptions } from 'virtual:doc-kitty/gherkin-scenario-index';
import { scenarioIndexRoute } from './scenario-index.js';

export const GET = scenarioIndexRoute(scenarioIndexOptions);
