#!/usr/bin/env node
/**
 * The PDF determinism check (ADR-0081, #394):
 *   node src/scripts/assert-pdf-determinism.mjs <dist> --base <path>
 *
 * Prints every document twice, into two temporary directories, with the same
 * `SOURCE_DATE_EPOCH` (the environment's, else the last commit time), and compares
 * the files byte for byte. A difference names the file, the first differing byte
 * offset and the PDF object that holds it. It compares raw bytes: a text
 * normalisation (as `diffDist` does for HTML) would be unsound for binary PDF.
 * Exit 0 identical, 1 different or failed, 2 usage error.
 */
import { mkdtempSync, readFileSync, readdirSync, realpathSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import process from 'node:process';
import { pathToFileURL } from 'node:url';
import { UsageError, parseArgs, printPdfs, sourceDateEpoch } from './dockitty-pdf.mjs';
import { firstDifference, objectAt } from './pdf-postprocess.mjs';

/** Compare the PDFs of two output directories; returns difference messages. */
export function comparePdfDirs(a, b) {
  const problems = [];
  const list = (dir) => readdirSync(path.join(dir, 'pdf')).filter((f) => f.endsWith('.pdf')).sort();
  const left = list(a);
  const right = list(b);
  if (JSON.stringify(left) !== JSON.stringify(right)) problems.push(`different file sets: ${left.join(', ')} vs ${right.join(', ')}`);
  for (const name of left.filter((f) => right.includes(f))) {
    const x = readFileSync(path.join(a, 'pdf', name));
    const y = readFileSync(path.join(b, 'pdf', name));
    const at = firstDifference(x, y);
    if (at !== -1) problems.push(`${name}: first difference at byte ${at}, in ${objectAt(x, at)} (sizes ${x.length} and ${y.length})`);
  }
  return problems;
}

function isMain() {
  try {
    return import.meta.url === pathToFileURL(realpathSync(process.argv[1] ?? '')).href;
  } catch {
    return false;
  }
}

if (isMain()) {
  let options;
  let epochSeconds;
  try {
    const [dist, ...rest] = process.argv.slice(2);
    options = parseArgs(['--dist', dist ?? '', ...rest]);
    epochSeconds = sourceDateEpoch();
  } catch (err) {
    process.stderr.write(`assert:pdf-determinism: ${err instanceof Error ? err.message : String(err)}\nusage: assert-pdf-determinism <dist> --base <path>\n`);
    process.exit(2);
  }
  const runs = [mkdtempSync(path.join(tmpdir(), 'dk-pdf-a-')), mkdtempSync(path.join(tmpdir(), 'dk-pdf-b-'))];
  try {
    for (const out of runs) await printPdfs({ ...options, out }, { epochSeconds, log: () => {} });
    const problems = comparePdfDirs(runs[0], runs[1]);
    // `exitCode`, not `exit()`: the `finally` below must still remove the temp dirs.
    if (problems.length) {
      for (const p of problems) process.stderr.write(`assert:pdf-determinism: FAIL — ${p}\n`);
      process.exitCode = 1;
    } else {
      const files = readdirSync(path.join(runs[0], 'pdf'));
      process.stdout.write(`assert:pdf-determinism: PASS — two runs gave byte-identical PDFs (${files.join(', ')})\n`);
    }
  } catch (err) {
    process.stderr.write(`assert:pdf-determinism: FAIL — ${err instanceof Error ? err.message : String(err)}\n`);
    process.exitCode = err instanceof UsageError ? 2 : 1;
  } finally {
    for (const dir of runs) rmSync(dir, { recursive: true, force: true });
  }
}
