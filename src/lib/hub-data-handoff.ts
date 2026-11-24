/**
 * The `DK_HUB_DATA` handoff (#342): every hub's data, from the route-shaping
 * integration to the routes that cannot import `virtual:doc-kitty/route-shaping`
 * (the agent API, llms.txt, the build identity). fs-only, so the integration
 * (plain Node at config time) and the routes (Vite SSR) share it.
 *
 * The handoff is a FILE, its path in the env, never the data: Linux refuses
 * `execve` for any one environment string over 128 KiB (`E2BIG`), Windows caps a
 * variable at 32,767 characters, and every child the build spawns afterwards
 * (Pagefind at build:done, the OpenAPI bundler) inherits the env. A site with a
 * couple of thousand hub children would pass that. Same shape as `DK_OPENAPI`
 * (`writePublication`).
 */
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import process from 'node:process';
import { DK_HUB_DATA_ENV } from './internal-env.mjs';
import { writeCacheAtomic } from './openapi/cache.mjs';
import type { HubCap } from './child-cap.js';

/**
 * Write the hub data to `<cacheDir>/<sha256>.hubs.json` (atomically, by the shared
 * cache writer) and return the absolute path. The name is the digest of the JSON,
 * so the same data always lands at the same path.
 */
export function writeHubData(cacheDir: string, hubs: ReadonlyArray<readonly [string, HubCap]>): string {
  const bytes = Buffer.from(JSON.stringify(hubs), 'utf8');
  const digest = createHash('sha256').update(bytes).digest('hex');
  return writeCacheAtomic(cacheDir, digest, 'hubs.json', bytes);
}

/** Parsed hub data by path: a file is read and parsed once (it is content-addressed). */
const memo = new Map<string, Array<[string, HubCap]>>();

/**
 * The build's hub data, from the file `DK_HUB_DATA` names. Empty without the
 * handoff (a route run outside a DocKitty build, as in unit tests): every surface
 * then emits exactly what it did before the paged listing existed.
 */
export function readHubData(): Array<[string, HubCap]> {
  const file = process.env[DK_HUB_DATA_ENV];
  if (!file) return [];
  const known = memo.get(file);
  if (known) return known;
  const value = JSON.parse(readFileSync(file, 'utf8')) as Array<[string, HubCap]>;
  memo.set(file, value);
  return value;
}
