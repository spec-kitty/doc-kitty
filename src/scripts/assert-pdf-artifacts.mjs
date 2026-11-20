#!/usr/bin/env node
/**
 * The PDF gate (ADR-0081, #395): `node src/scripts/assert-pdf-artifacts.mjs <dist>`.
 *
 * Run after `dockitty-pdf`. One PDF per document in `<dist>/print/manifest.json` and
 * no other file in `<dist>/pdf/`. Each PDF has at least one page, a structure tree and
 * mark info (tagged), the document's language, and one outline entry per printed page:
 * the page titles appear, in order, at the page-title level of the bookmark outline.
 * The gate does not claim PDF/UA (#384), and checks no fonts (no `pdffonts` on runners).
 * Same `ok`/`FAIL` reporting as `assert-build-artifacts`; exit 1 on the first failure,
 * 2 on a usage error.
 */
import { existsSync, readFileSync, readdirSync, realpathSync } from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { pathToFileURL } from 'node:url';
import { inspectPdf } from './pdf-inspect.mjs';

/** Is `wanted` a subsequence of `items` (in order, gaps allowed)? */
export function inOrder(items, wanted) {
  let at = 0;
  for (const item of items) if (at < wanted.length && item === wanted[at]) at += 1;
  return at === wanted.length;
}

/**
 * Check the PDFs of one dist. Returns the failure messages (empty when it passes) and
 * reports each passing document through `ok`.
 */
export function checkPdfs(distDir, ok = () => {}) {
  const failures = [];
  const root = path.resolve(distDir);
  const manifestPath = path.join(root, 'print', 'manifest.json');
  if (!existsSync(manifestPath)) return [`${manifestPath} is missing: no print documents were built`];
  const listed = JSON.parse(readFileSync(manifestPath, 'utf8')).documents ?? [];
  // A document name is a section id or `site`: never a path. Refuse anything else
  // before it is joined into a file path.
  const documents = listed.filter((doc) => typeof doc.name === 'string' && /^[\w-]+$/.test(doc.name));
  for (const doc of listed.filter((d) => !documents.includes(d))) failures.push(`pdf: the manifest names ${JSON.stringify(doc.name)}, not a document name`);
  const pdfDir = path.join(root, 'pdf');
  const byName = (a, b) => a.localeCompare(b);
  const present = existsSync(pdfDir) ? readdirSync(pdfDir).filter((f) => f.endsWith('.pdf')).sort(byName) : [];
  const expected = documents.map((doc) => `${doc.name}.pdf`).sort(byName);
  const missing = expected.filter((f) => !present.includes(f));
  const extra = present.filter((f) => !expected.includes(f));
  if (missing.length) failures.push(`pdf: missing ${missing.join(', ')}`);
  if (extra.length) failures.push(`pdf: unexpected ${extra.join(', ')} (no print document for it)`);
  for (const doc of documents) {
    const file = path.join(pdfDir, `${doc.name}.pdf`);
    if (!existsSync(file)) continue;
    const where = `pdf: ${doc.name}.pdf`;
    let info;
    try {
      info = inspectPdf(readFileSync(file));
    } catch (err) {
      failures.push(`${where}: unreadable (${err instanceof Error ? err.message : String(err)})`);
      continue;
    }
    const before = failures.length;
    if (!Number.isInteger(doc.pages) || doc.pages < 0) failures.push(`${where}: the manifest gives no page count (pages: ${doc.pages})`);
    if (info.pages < 1) failures.push(`${where}: no page`);
    if (!info.structTreeRoot) failures.push(`${where}: not tagged (no /StructTreeRoot)`);
    if (!info.markInfo) failures.push(`${where}: not tagged (no /MarkInfo /Marked true)`);
    if (info.lang !== doc.lang) failures.push(`${where}: /Lang is ${JSON.stringify(info.lang)}, the site language is ${JSON.stringify(doc.lang)}`);
    const titles = doc.titles ?? [];
    if (titles.length !== doc.pages) failures.push(`${where}: the manifest lists ${titles.length} title(s) for ${doc.pages} page(s)`);
    // Chromium builds a bookmark title from the laid-out heading text, so a title that
    // wraps can lose the space at the line break: compare without whitespace.
    const squash = (text) => text.replace(/\s+/g, '');
    // Page titles sit at `titleLevel`; a top-level page of the whole-site document sits
    // one up, beside the section dividers. Read the outline in order over those depths.
    const flatten = (nodes, depth) =>
      nodes.flatMap((node) => [...(depth >= 2 ? [node] : []), ...(depth < doc.titleLevel ? flatten(node.children, depth + 1) : [])]);
    const level = flatten(info.outline, 1).map((node) => squash(node.title));
    if (!inOrder(level, titles.map(squash))) {
      failures.push(`${where}: the outline does not list the ${titles.length} page title(s) in order at level ${doc.titleLevel}`);
    }
    if (failures.length === before) {
      ok(`${where}: ${info.pages} sheet(s), tagged, /Lang ${info.lang}, ${titles.length} page title(s) in the outline`);
    }
  }
  return failures;
}

function isMain() {
  try {
    return import.meta.url === pathToFileURL(realpathSync(process.argv[1] ?? '')).href;
  } catch {
    return false;
  }
}

if (isMain()) {
  const arg = process.argv[2];
  // The gate reads only a build inside the working directory: resolve the argument and
  // refuse anything that climbs out of it (`..`, another drive, an absolute path elsewhere).
  const cwd = path.resolve(process.cwd());
  const dist = path.resolve(cwd, arg ?? '');
  if (!arg || !(dist === cwd || dist.startsWith(cwd + path.sep)) || !existsSync(dist)) {
    process.stderr.write('usage: assert-pdf-artifacts <dist> (a directory inside the working directory)\n');
    process.exit(2);
  }
  const failures = checkPdfs(dist, (m) => process.stdout.write(`assert:pdf: ok — ${m}\n`));
  if (failures.length) {
    process.stderr.write(`assert:pdf: FAIL — ${failures[0]}\n`);
    for (const more of failures.slice(1)) process.stderr.write(`assert:pdf: also — ${more}\n`);
    process.exit(1);
  }
  process.stdout.write(`assert:pdf: PASS — every PDF in ${arg}/pdf is present, tagged and outlined\n`);
}
