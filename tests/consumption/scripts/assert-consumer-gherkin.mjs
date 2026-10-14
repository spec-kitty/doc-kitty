#!/usr/bin/env node
/**
 * assert-consumer-gherkin.mjs — in-page Gherkin from the PACKED tarball
 * (gherkin-in-any-page, ADR-0051).
 *
 * Usage:
 *   node tests/consumption/scripts/assert-consumer-gherkin.mjs <distDir>
 *
 * Auto-discovered by run-consumption-test.mjs (the `assert-consumer-*.mjs` glob).
 * The fixture sets `gherkin: { includeRoots: ['scenarios'] }`, and
 * `docs/guides/scenarios.md` holds one ```gherkin fence and one
 * `::gherkin{src scenario}` include. Built from the tarball, that proves the
 * in-page stage, the include resolver (realpath containment against the
 * consumer's own project root) and the agent-payload splice all ship and work
 * outside this repository:
 *
 *   - the page has two `div.dk-gherkin` blocks and no `gherkin` code block (no
 *     fence fell back to Expressive Code);
 *   - the include ends in its source line and holds only the selected scenario;
 *   - no `::gherkin` text survives outside `pre`/`code` (no include was restored
 *     as a literal directive line);
 *   - `/api/pages/guides/scenarios.json` lists the include and carries its steps.
 *
 * Exits NON-ZERO with a precise message on the FIRST failure.
 */
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';

function fail(message) {
  process.stderr.write(`assert:consumer-gherkin: FAIL — ${message}\n`);
  process.exit(1);
}

function ok(message) {
  process.stdout.write(`assert:consumer-gherkin: ok — ${message}\n`);
}

async function readOrFail(absPath, label) {
  try {
    return await readFile(absPath, 'utf8');
  } catch (err) {
    return fail(`${label}: could not read ${absPath} (${err.code ?? err.message})`);
  }
}

const count = (text, needle) => text.split(needle).length - 1;

const SRC = 'scenarios/study/read-a-chapter.feature';
const SELECTED = 'Scenario: Look up a term while reading';
const PRUNED = 'Open a chapter from the book index';

async function main() {
  const distArg = process.argv[2];
  if (!distArg) fail('usage: assert-consumer-gherkin.mjs <distDir>');
  const distDir = path.resolve(distArg);

  const label = 'guides/scenarios/index.html';
  const html = await readOrFail(path.join(distDir, 'guides', 'scenarios', 'index.html'), label);
  const blocks = count(html, '<div class="dk-gherkin">');
  if (blocks !== 2) fail(`${label}: ${blocks} div.dk-gherkin block(s), expected 2 (one fence, one include)`);
  if (html.includes('<pre data-language="gherkin"')) {
    fail(`${label}: a gherkin fence rendered as a code block — the in-page stage did not run`);
  }
  if (!html.includes('<strong class="dk-gherkin__kw">Given</strong>')) {
    fail(`${label}: no step keyword element — the step list did not render`);
  }
  const source = /<p class="dk-gherkin__source">([\s\S]*?)<\/p>/.exec(html);
  if (!source || !source[1].startsWith('From Read a chapter, ') || !source[1].includes(`>${SRC}</code>`)) {
    fail(`${label}: the include's source line is ${JSON.stringify(source?.[1] ?? null)}, expected "From Read a chapter, ${SRC}"`);
  }
  if (!html.includes(SELECTED)) fail(`${label}: the include lacks "${SELECTED}"`);
  if (html.includes(PRUNED)) fail(`${label}: the include kept "${PRUNED}", which scenario= excludes`);

  const main = /<main\b[^>]*>([\s\S]*)<\/main>/.exec(html)?.[1] ?? html;
  const text = main.replace(/<(pre|code|script|style)\b[\s\S]*?<\/\1>/g, ' ').replace(/<[^>]*>/g, ' ');
  const leaked = /::gherkin[^\n]{0,80}/.exec(text);
  if (leaked) fail(`${label}: literal ${JSON.stringify(leaked[0])} outside pre/code — an include was not rendered`);

  const apiLabel = 'api/pages/guides/scenarios.json';
  const payload = JSON.parse(await readOrFail(path.join(distDir, 'api', 'pages', 'guides', 'scenarios.json'), apiLabel));
  const expected = [{ src: SRC, scenario: 'Look up a term while reading' }];
  if (JSON.stringify(payload.includes) !== JSON.stringify(expected)) {
    fail(`${apiLabel}: includes is ${JSON.stringify(payload.includes)}, expected ${JSON.stringify(expected)}`);
  }
  const markdown = String(payload.markdown ?? '');
  for (const needle of [SELECTED, '- **When** the student hovers over', `From Read a chapter, \`${SRC}\``]) {
    if (!markdown.includes(needle)) fail(`${apiLabel}: the markdown lacks ${JSON.stringify(needle)}`);
  }
  if (/^::gherkin/m.test(markdown)) fail(`${apiLabel}: the markdown still holds the ::gherkin directive line`);

  ok(
    `${label}: a fence and an include render as .dk-gherkin with the source line and the selection; ` +
      `${apiLabel} expands the include`,
  );
}

main().catch((err) => {
  fail(`unexpected error — ${err.stack ?? err.message ?? String(err)}`);
});
