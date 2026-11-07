#!/usr/bin/env node
/**
 * `pnpm build:chrome-dists`: build the chrome fixture dists Playwright serves
 * (`CHROME_DISTS` in harness.mjs) into `example/dist-chrome-<name>`. Exits non-zero
 * and prints the build's output when one fails.
 */
import { cpSync, rmSync } from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { buildChromeFixture, CHROME_DISTS, chromeDistPath, REPO_ROOT } from './harness.mjs';

for (const [name, options] of Object.entries(CHROME_DISTS)) {
  const started = Date.now();
  const build = buildChromeFixture({ options });
  if (build.status !== 0) {
    console.error(build.output);
    console.error(`build-dists: the ${name} fixture failed to build (exit ${build.status})`);
    process.exit(1);
  }
  const target = path.join(REPO_ROOT, chromeDistPath(name));
  rmSync(target, { recursive: true, force: true });
  cpSync(build.dist, target, { recursive: true });
  console.log(`${chromeDistPath(name)}: ${build.cached ? 'reused' : `built in ${Math.round((Date.now() - started) / 1000)}s`}`);
}
