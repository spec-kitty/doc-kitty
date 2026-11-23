import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';

/** Every file under `root`, keyed by its POSIX path from `root`, with its UTF-8 text. */
export function readTree(root: string, rel = ''): Map<string, string> {
  const out = new Map<string, string>();
  for (const e of readdirSync(path.join(root, rel), { withFileTypes: true })) {
    const next = path.posix.join(rel, e.name);
    if (e.isDirectory()) readTree(root, next).forEach((v, k) => out.set(k, v));
    else out.set(next, readFileSync(path.join(root, next), 'utf8'));
  }
  return out;
}
