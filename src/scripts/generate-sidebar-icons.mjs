#!/usr/bin/env node
/**
 * Generate `lib/sidebar-icons-builtin.json`: Starlight's built-in icons, names and
 * bodies (page-chrome WP07). Starlight has no public export for them: `BuiltInIcons` is
 * in `dist/components-internals/Icons.js`, which its `exports` map does not reach, so
 * this script reads the file from the toolkit's own dev install.
 *
 *   node src/scripts/generate-sidebar-icons.mjs           # rewrite the file
 *   node src/scripts/generate-sidebar-icons.mjs --check   # exit 1 when it has drifted
 *
 * `sidebar-icons.test.ts` runs the same comparison, so a Starlight upgrade fails until
 * this has been run.
 */
import { readFileSync, realpathSync, writeFileSync } from 'node:fs';
import process from 'node:process';
import { fileURLToPath, pathToFileURL } from 'node:url';

export const BUILTIN_ICONS_FILE = fileURLToPath(new URL('../lib/sidebar-icons-builtin.json', import.meta.url));
const STARLIGHT = new URL('../node_modules/@astrojs/starlight/', import.meta.url);

/** The file's contents as Starlight's installed version would generate them. */
export async function generateBuiltinIcons() {
  const { version } = JSON.parse(readFileSync(new URL('package.json', STARLIGHT), 'utf8'));
  const { BuiltInIcons } = await import(/* @vite-ignore */ new URL('dist/components-internals/Icons.js', STARLIGHT).href);
  const icons = Object.fromEntries(Object.keys(BuiltInIcons).sort().map((name) => [name, BuiltInIcons[name]]));
  return `${JSON.stringify({ starlight: version, icons }, null, 2)}\n`;
}

function invokedDirectly() {
  try {
    return import.meta.url === pathToFileURL(realpathSync(process.argv[1] ?? '')).href;
  } catch {
    return false;
  }
}

if (invokedDirectly()) {
  const generated = await generateBuiltinIcons();
  if (process.argv.includes('--check')) {
    if (readFileSync(BUILTIN_ICONS_FILE, 'utf8') !== generated) {
      console.error('✖ lib/sidebar-icons-builtin.json has drifted from Starlight: run pnpm generate:sidebar-icons');
      process.exit(1);
    }
  } else {
    writeFileSync(BUILTIN_ICONS_FILE, generated);
  }
}
