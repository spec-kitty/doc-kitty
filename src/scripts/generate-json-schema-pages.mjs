#!/usr/bin/env node
/**
 * Rewrite the JSON Schema Markdown folder from a directory of JSON files.
 *
 *   node src/scripts/generate-json-schema-pages.mjs
 *   node src/scripts/generate-json-schema-pages.mjs --source path/to/json --docs docs --out json-files-output
 *
 * `--source` defaults to `json-files` at the project root. `--out` is
 * relative to `--docs` and defaults to `json-files-output`. The generator rewrites
 * pages it owns and refuses anything else in that folder.
 */
import path from 'node:path';
import {
  DEFAULT_JSON_SCHEMA_OUT,
  DEFAULT_JSON_SCHEMA_SOURCE,
  generateJsonSchemaPages,
} from '../lib/json-schema/generate.mjs';

function parseArgs(argv) {
  /** @type {{ source: string, docs: string, out: string }} */
  const args = { source: DEFAULT_JSON_SCHEMA_SOURCE, docs: 'docs', out: DEFAULT_JSON_SCHEMA_OUT };
  for (let i = 2; i < argv.length; i++) {
    const flag = argv[i];
    const value = argv[++i];
    if (flag === '--source') args.source = value;
    else if (flag === '--docs') args.docs = value;
    else if (flag === '--out') args.out = value;
    else {
      console.error(`[dk-json-schema] unknown argument ${flag}`);
      process.exit(2);
    }
  }
  if (!args.source) {
    console.error('[dk-json-schema] --source must be a path');
    process.exit(2);
  }
  return args;
}

const { source, docs, out } = parseArgs(process.argv);
const docsRoot = path.resolve(docs);
const result = generateJsonSchemaPages({
  sourceDir: path.resolve(source),
  docsRoot,
  outDir: path.resolve(docsRoot, out),
});
console.log(`[dk-json-schema] ${result.sources.length} JSON file(s) → ${result.pages} page(s) in ${path.join(docs, out)}`);
