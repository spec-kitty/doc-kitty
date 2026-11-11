#!/usr/bin/env node
/**
 * The consumer-facing no-plantuml.com guard (#13 C-001, #314).
 *
 *   dockitty-plantuml-guard [--astro-config <path to the site's astro.config.*>]
 *
 * Checks, before a build, that no PlantUML diagram can be sent to the public
 * plantuml.com server:
 *
 *   1. the installed toolkit's own PlantUML stage (every source file under its
 *      `lib/`) names no plantuml.com URL and defaults to a self-hosted server;
 *   2. the server the build will use, DK_PLANTUML_SERVER_URL or that default, is
 *      not plantuml.com;
 *   3. with `--astro-config`, the site's config file names no plantuml.com URL.
 *      The file is read as text, not evaluated, so no site dependency is needed.
 *
 * Exits 0 on pass, 1 on a failed check, 2 on a usage error. Node built-ins only.
 */
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { checkPlantumlServerUrl, checkPlantumlSources, checkSiteConfigSource } from './plantuml-guard.mjs';

const NAME = 'plantuml-guard';
const TOOLKIT_LIB = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'lib');

function usage(message) {
  console.error(`${NAME}: ${message}`);
  console.error(`usage: dockitty-plantuml-guard [--astro-config <astro.config.mjs>]`);
  process.exit(2);
}

const argv = process.argv.slice(2);
let astroConfig;
for (let i = 0; i < argv.length; i += 1) {
  if (argv[i] !== '--astro-config') usage(`unknown argument: ${argv[i]}`);
  astroConfig = argv[i + 1];
  if (astroConfig === undefined || astroConfig === '') usage('--astro-config needs a path');
  i += 1;
}
if (astroConfig !== undefined && !existsSync(astroConfig)) usage(`no such config file: ${astroConfig}`);

const failures = [];
const sources = checkPlantumlSources(TOOLKIT_LIB);
if (sources.ok) console.log(`${NAME}: toolkit ok — ${sources.files} source file(s), self-hosted default ${sources.defaultServer}`);
else failures.push(sources.message);

const server = checkPlantumlServerUrl(process.env.DK_PLANTUML_SERVER_URL, sources.ok ? sources.defaultServer : undefined);
if (server.ok) console.log(`${NAME}: server ok — ${server.url} (${server.source})`);
else failures.push(server.message);

if (astroConfig !== undefined) {
  const config = checkSiteConfigSource(readFileSync(astroConfig, 'utf8'), astroConfig);
  if (config.ok) console.log(`${NAME}: site config ok — ${astroConfig} names no plantuml.com URL`);
  else failures.push(config.message);
}

for (const message of failures) console.error(`${NAME}: FAIL — ${message}`);
process.exit(failures.length === 0 ? 0 : 1);
