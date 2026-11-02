/**
 * Derive the mutated corpus fixtures from `fixtures/example/` (the committed,
 * byte-faithful copy of a real `pnpm --filter example build`'s dist/api).
 *
 *   node mcp/tests/corpus/fixtures/derive.mjs
 *
 * Re-run after re-minting the example fixture to keep the mutants in lockstep.
 * Node-only, dependency-free by design (NFR-003 posture extends to test code).
 */
import { cpSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const EXAMPLE_API = path.join(HERE, 'example', 'api');

/** The three-page slice every small fixture shares: home (empty slug), a nested page, a plain one. */
const SLICE_SLUGS = ['', 'context/audience', 'guides/getting-started'];

const readJson = (p) => JSON.parse(readFileSync(p, 'utf8'));
const writeJson = (p, v) => {
  mkdirSync(path.dirname(p), { recursive: true });
  writeFileSync(p, `${JSON.stringify(v, null, 2)}`);
};

const pageIdOf = (record) => record._links.self.href.split('/api/pages/')[1].replace(/\.json$/, '');

function writeFixture(name, mutate) {
  const dir = path.join(HERE, name, 'api');
  rmSync(path.join(HERE, name), { recursive: true, force: true });
  mkdirSync(dir, { recursive: true });

  const index = readJson(path.join(EXAMPLE_API, 'index.json'));
  const scenarios = readJson(path.join(EXAMPLE_API, 'scenarios.json'));

  const records = SLICE_SLUGS.map((slug) => {
    const record = index.pages.find((p) => p.slug === slug);
    if (!record) throw new Error(`slice member '${slug}' missing from the example fixture - re-mint or re-pick SLICE_SLUGS`);
    return structuredClone(record);
  });
  index.pages = records;
  index.count = records.length;

  const pages = records.map((record) => {
    const id = pageIdOf(record);
    return [id, readJson(path.join(EXAMPLE_API, 'pages', `${id}.json`))];
  });

  mutate({ index, pages, scenarios });

  writeJson(path.join(dir, 'index.json'), index);
  for (const [id, artifact] of pages) {
    writeJson(path.join(dir, 'pages', `${id}.json`), artifact);
  }
  writeJson(path.join(dir, 'scenarios.json'), scenarios);
}

// Handshake fixtures: the major is unknown / not numeric (FR-005 fail-closed).
writeFixture('unknown-major', ({ index }) => {
  index.version = '99';
});

writeFixture('non-numeric-version', ({ index }) => {
  index.version = 'beta';
});

// FR-008: one page artifact carries another build's identity -> torn corpus.
writeFixture('torn-build', ({ pages }) => {
  pages[1][1].buildId = '0'.repeat(64);
});

// Migration allowance: a pre-FR-008 corpus carries no buildId anywhere, and a
// pre-WP01 one no sections[]; both must LOAD (with warnings), not refuse.
writeFixture('pre-buildid', ({ index, pages, scenarios }) => {
  delete index.buildId;
  delete index.sections;
  for (const [, artifact] of pages) delete artifact.buildId;
  delete scenarios.buildId;
});

// Pages surface gated off (links.pages: false): records lose _links.self; the
// snapshot must load degraded and announce PAGES_LINKS_GATED, never 404.
writeFixture('gated-pages', ({ index }) => {
  for (const record of index.pages) delete record._links.self;
});

// Shape-guard fixture: a record without its title -> MALFORMED_CORPUS naming
// the path and the offending key.
writeFixture('malformed-title', ({ index }) => {
  delete index.pages[0].title;
});

console.log('derived fixtures written under', HERE);
