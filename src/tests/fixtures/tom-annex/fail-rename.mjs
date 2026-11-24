// Preload for the CLI test: every renameSync fails, as a cross-device or locked
// target would, so the write's error path runs (WP07 review cycle 2, finding 2).
import fs from 'node:fs';
import { syncBuiltinESMExports } from 'node:module';

fs.renameSync = () => {
  throw Object.assign(new Error('simulated rename failure'), { code: 'EXDEV' });
};
syncBuiltinESMExports();
