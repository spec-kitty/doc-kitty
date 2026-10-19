/**
 * The installed directory of a package whose exports map exposes neither a main
 * entry nor `./package.json` (Starlight 0.42, B14): walk Node's own resolution
 * paths for `<name>/package.json` on disk, so the lookup follows the same
 * node_modules chain `require.resolve` would.
 */
import { existsSync, realpathSync } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';

export function packageDir(name: string, from: string | URL): string {
  const req = createRequire(from);
  for (const base of req.resolve.paths(name) ?? []) {
    const manifest = path.join(base, name, 'package.json');
    if (existsSync(manifest)) return path.dirname(realpathSync(manifest));
  }
  throw new Error(`packageDir: ${name} is not installed on the resolution path of ${String(from)}`);
}
