#!/usr/bin/env node
/**
 * assert-markua-builds.mjs — the Markua BUILD-RESULT gate (WP10, markua-syntax-
 * support). Two named non-fakeable gates that a single dist read cannot prove
 * because they are about the BUILD itself and a SECOND (preset-off) build:
 *
 *   1. NFR-002 build-exits-0 (the malformed fixture). A COLD `astro build` with
 *      example/docs/guides/markua-malformed.md present (unknown icon
 *      `fa-obscure-name`, an unbalanced `{aside}`, an unsupported `{fullbleed:}`)
 *      must EXIT 0 (assert the build RESULT, not just the page) AND emit the
 *      exact warning `[markua] unknown icon "fa-obscure-name" — dropped`. The
 *      cache is cleared first so the content compile re-runs and the warning is
 *      re-emitted (an incremental build serves the unchanged page from cache and
 *      would not re-warn).
 *
 *   2. SC-003 preset-off literal-text portability (the LOAD-BEARING gate). The
 *      SAME corpus is built with the Markua preset OFF (`DK_MARKUA=off`, the
 *      defined "plain Markdown host" surface) into its own dist, and every Markua
 *      line must render as SENSIBLE LITERAL TEXT — `A>` / `{blurb}` / `{alt: …}`
 *      show as plain text, never broken markup, and NO callout/aside/figure is
 *      emitted. A `:::`-leak grep is also run but is NOTED AS VACUOUS here: with
 *      the preset off the normaliser never runs, so `:::` is never emitted
 *      regardless — portability rests on the literal-text assertion, not the grep.
 *
 * Usage (from the repo root):
 *   node src/scripts/assert-markua-builds.mjs            # both gates
 *   node src/scripts/assert-markua-builds.mjs warning    # only NFR-002
 *   node src/scripts/assert-markua-builds.mjs portability # only SC-003
 *
 * Zero runtime dependencies: it spawns `pnpm --filter example build` and scans
 * the captured output / built HTML at the string level.
 */
import { spawnSync } from 'node:child_process';
import { readFile, rm } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';

const REPO_ROOT = path.resolve(path.dirname(process.argv[1]), '..', '..');
const EXAMPLE_DIR = path.join(REPO_ROOT, 'example');
const SHOWCASE_RELPATH = path.join('guides', 'markua-showcase', 'index.html');

const UNKNOWN_ICON_WARNING = '[markua] unknown icon "fa-obscure-name" — dropped';

function fail(message) {
  process.stderr.write(`assert:markua — FAIL — ${message}\n`);
  process.exit(1);
}
function ok(message) {
  process.stdout.write(`assert:markua — ok — ${message}\n`);
}

/** Run `pnpm --filter example build` with the given extra env + outDir. */
function runBuild(extraEnv) {
  return spawnSync('pnpm', ['--filter', 'example', 'build'], {
    cwd: REPO_ROOT,
    env: { ...process.env, ...extraEnv },
    encoding: 'utf8',
    maxBuffer: 64 * 1024 * 1024,
  });
}

/** Clear Astro's content/build cache so a content compile re-runs (re-warns). */
async function clearAstroCache(outDir) {
  for (const rel of ['node_modules/.astro', 'example/node_modules/.astro', '.astro', `example/${outDir}`]) {
    await rm(path.join(REPO_ROOT, rel), { recursive: true, force: true });
  }
}

async function assertMalformedBuildExitsZero() {
  await clearAstroCache('dist');
  const res = runBuild({ DK_MARKUA: 'true' });
  const output = `${res.stdout ?? ''}${res.stderr ?? ''}`;
  if (res.status !== 0) {
    fail(
      `NFR-002 build-exits-0: a cold markua-ON build with markua-malformed.md present EXITED ${res.status} — the ` +
        `malformed fixture (unknown icon / unbalanced wrapper / unsupported attr) must NEVER fail the build.\n${output.slice(-1200)}`,
    );
  }
  if (!output.includes(UNKNOWN_ICON_WARNING)) {
    fail(
      `NFR-002 build warning: the build exited 0 but did NOT emit the expected unknown-icon warning\n  ` +
        `expected: ${UNKNOWN_ICON_WARNING}\n  the graceful-drop-with-warning path (resolveIcon, FR-010) did not run.`,
    );
  }
  ok(`NFR-002: cold markua-ON build EXITS 0 with malformed.md present and emits \`${UNKNOWN_ICON_WARNING}\``);
}

async function assertPresetOffPortability() {
  const outDir = 'dist-nomarkua';
  await clearAstroCache(outDir);
  const res = runBuild({ DK_MARKUA: 'off', DK_OUTDIR: outDir });
  if (res.status !== 0) {
    fail(`SC-003 portability: the preset-OFF build EXITED ${res.status}\n${`${res.stdout ?? ''}${res.stderr ?? ''}`.slice(-1200)}`);
  }
  const showcaseAbs = path.join(EXAMPLE_DIR, outDir, SHOWCASE_RELPATH);
  let html;
  try {
    html = await readFile(showcaseAbs, 'utf8');
  } catch (err) {
    fail(`SC-003 portability: could not read the preset-off showcase (${showcaseAbs}): ${err.message}`);
  }

  // LOAD-BEARING: every Markua line renders as sensible LITERAL text. A literal
  // `>` may be serialised raw (`A>`) or entity-escaped (`A&gt;`); either is
  // "sensible literal text", so each expectation accepts any of its forms.
  const literalExpectations = [
    { forms: ['A&gt;', 'A>'], what: '`A>` aside line-prefix as literal text' },
    { forms: ['{blurb'], what: '`{blurb …}` wrapper marker as literal text' },
    { forms: ['{alt:'], what: '`{alt: …}` attribute list as literal text' },
    { forms: ['{aside}'], what: '`{aside}` wrapper marker as literal text' },
  ];
  for (const { forms, what } of literalExpectations) {
    if (!forms.some((f) => html.includes(f))) {
      fail(
        `SC-003 portability: with the preset OFF, ${what} did NOT survive as literal text (looked for any of ${JSON.stringify(forms)}) — ` +
          `a plain-Markdown host must show Markua syntax verbatim, never consumed or broken.`,
      );
    }
  }
  // With the preset off, NO Markua construct may be RENDERED (the seam is
  // absent). Match the emitted class-ATTRIBUTE forms, not a bare class-name
  // substring — the showcase prose legitimately mentions `dk-callout--tip` inside
  // a `<code>` span, which must not be mistaken for a rendered callout.
  const forbiddenRendered = [
    { marker: 'class="starlight-aside', what: 'a native Starlight aside' },
    { marker: 'class="dk-callout dk-callout--', what: 'a theme callout' },
    { marker: 'class="dk-figure', what: 'a Markua figure' },
  ];
  for (const { marker, what } of forbiddenRendered) {
    if (html.includes(marker)) {
      fail(`SC-003 portability: preset-off build RENDERED ${what} (found ${JSON.stringify(marker)}) — the Markua seam leaked with the preset OFF.`);
    }
  }
  // Belt-and-braces (NOTED VACUOUS): no raw `:::` directive leaks. This proves
  // nothing on its own preset-off — the normaliser never runs, so `:::` is never
  // emitted regardless. Portability rests on the literal-text assertion above.
  if (html.includes(':::')) {
    fail('SC-003 portability: a raw `:::` directive leaked into the preset-off HTML (belt-and-braces; the literal-text check is the real gate).');
  }
  ok('SC-003: preset-off build renders A>/{blurb}/{alt:}/{aside} as literal text, emits no Markua construct, no `:::` leak (`:::`-grep noted vacuous preset-off)');
}

async function main() {
  const which = process.argv[2] ?? 'both';
  if (which === 'warning' || which === 'both') await assertMalformedBuildExitsZero();
  if (which === 'portability' || which === 'both') await assertPresetOffPortability();
  process.stdout.write('assert:markua — PASS — build-result gates (NFR-002 + SC-003) green\n');
}

main().catch((err) => fail(`unexpected error — ${err.stack ?? err.message ?? String(err)}`));
