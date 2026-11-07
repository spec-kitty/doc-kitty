/*
 * A `--require` preload for a chrome fixture build (WP07, build-time risk): writes
 * `.dk-fa-json-read` in the build's root when anything reads Font Awesome's icon file.
 * Wraps the file reads a build can reach it through; the ESM view of `node:fs` is
 * re-synced so `import { readFileSync } from 'node:fs'` goes through the wrapper too.
 */
const fs = require('node:fs');
const { syncBuiltinESMExports } = require('node:module');
const path = require('node:path');

const MARKER = path.join(process.cwd(), '.dk-fa-json-read');
const original = fs.writeFileSync;
const note = (file) => {
  if (String(file).includes('fa6-solid') && String(file).endsWith('icons.json')) original(MARKER, String(file));
};
for (const [owner, name] of [[fs, 'readFileSync'], [fs, 'readFile'], [fs.promises, 'readFile']]) {
  const read = owner[name];
  owner[name] = function (file, ...rest) {
    note(file);
    return read.call(this, file, ...rest);
  };
}
syncBuiltinESMExports();
