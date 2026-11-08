/**
 * WP12 exclusion ratchets: the renderer owns OpenAPI pages, so DocKitty's
 * glossary autolinker, feeds and authored-frontmatter gate do not ingest them.
 * Paired controls prove that the same fixture still feeds those pipelines.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  buildOpenApiFixture,
  FIXTURES,
  readAll,
  removeOpenApiFixtureBuilds,
  type OpenApiBuildResult,
} from './helpers/openapi-build';

const VALIDATE = fileURLToPath(new URL('../scripts/validate-frontmatter.mjs', import.meta.url));
const GLOSSARY = `contexts:
  - name: shipping
    domainVisionStatement: The vocabulary of the exclusion fixture.
    terms:
      - name: Cargo
        definition: Goods carried under a single transport arrangement.
`;
const cargoSpec = (label: string) =>
  readFileSync(path.join(FIXTURES, 'two-versions', label), 'utf8')
    .replaceAll('Parcels', 'Cargo')
    .replaceAll('parcels', 'cargo')
    // Keep the spec's guide anchor pointing at the heading the guide fixture has:
    // WP06's build-time link check fails a broken `/guides/#cargo`.
    .replaceAll('/guides/#cargo', '/guides/#parcels');
const guide = readFileSync(path.join(FIXTURES, 'site', 'docs', 'guides', 'README.md'), 'utf8');

function text(files: Map<string, Buffer>, key: string): string {
  const bytes = files.get(key);
  expect(bytes, `${key} exists in the built dist`).toBeDefined();
  return (bytes ?? Buffer.alloc(0)).toString('utf8');
}

afterAll(() => {
  removeOpenApiFixtureBuilds();
});

describe('[WP12] OpenAPI exclusion ratchets', () => {
  let built: OpenApiBuildResult;
  let files: Map<string, Buffer>;

  beforeAll(() => {
    built = buildOpenApiFixture({
      fixture: 'two-versions',
      options: { description: 'WP12 exclusion ratchet fixture' },
      openapi: {
        specs: [
          { path: 'openapi/v1.yaml', label: 'v1', released: true },
          { path: 'openapi/v2.yaml', label: 'v2', released: false },
        ],
      },
      files: {
        '.contextive/definitions.yaml': GLOSSARY,
        'docs/guides/README.md': `${guide}\nCargo on an authored page is the positive autolinker control.\n`,
        'openapi/v1.yaml': cargoSpec('v1.yaml'),
        'openapi/v2.yaml': cargoSpec('v2.yaml'),
      },
    });
    expect(built.status, `astro build output:\n${built.output}`).toBe(0);
    files = readAll(built.dist);
  }, 300_000);

  it('[WP12] no glossary autolink markup in API pages, with an authored-page control', () => {
    const apiPages = [...files.keys()].filter((key) => /^reference\/api\/.*\.html$/.test(key));
    expect(apiPages.length).toBeGreaterThan(0);
    for (const key of apiPages) {
      expect(text(files, key), key).not.toMatch(/<a\b[^>]*\bdata-glossary-term=/);
    }
    expect(text(files, 'guides/index.html')).toMatch(/<a\b[^>]*\bdata-glossary-term="Cargo"/);
  });

  it('[WP12] no RSS or Atom item for a spec version, with the docs feed as control', () => {
    const feeds = [...files.keys()].filter((key) => key === 'rss.xml' || key.endsWith('.atom.xml'));
    expect(feeds).toContain('rss.xml');
    expect(feeds.some((key) => key.endsWith('.atom.xml'))).toBe(true);
    expect(text(files, 'rss.xml')).toContain('<link>https://docs.example.test/guides/</link>');
    for (const key of feeds) {
      expect(text(files, key), key).not.toContain('/reference/api/');
    }
    expect(files.has('api/pages/reference/api/v1.atom.xml')).toBe(false);
    expect(files.has('api/pages/reference/api/v2.atom.xml')).toBe(false);
  });

  it('[WP12] the frontmatter gate rejects API-shaped Markdown if it ever reaches docs', () => {
    // No production path exists: the renderer publishes virtual Astro routes and
    // static HTML, never Markdown under docs/. Prove the boundary and make the
    // gate control real by planting the only output shape that could reach it.
    const apiDocs = path.join(built.root, 'docs', 'reference', 'api');
    expect(existsSync(apiDocs)).toBe(false);
    const gate = spawnSync(process.execPath, [VALIDATE, 'docs'], {
      cwd: built.root,
      encoding: 'utf8',
    });
    expect(gate.status, `${gate.stdout}\n${gate.stderr}`).toBe(0);

    mkdirSync(apiDocs, { recursive: true });
    try {
      writeFileSync(path.join(apiDocs, 'v1.md'), '# Generated API without frontmatter\n');
      const rejected = spawnSync(process.execPath, [VALIDATE, 'docs'], {
        cwd: built.root,
        encoding: 'utf8',
      });
      expect(rejected.status, `${rejected.stdout}\n${rejected.stderr}`).not.toBe(0);
      expect(`${rejected.stdout}\n${rejected.stderr}`).toContain('reference/api/v1.md');
    } finally {
      rmSync(apiDocs, { recursive: true, force: true });
    }
  });

  it('[WP12] a malformed spec still fails the build', () => {
    const rejected = buildOpenApiFixture({
      fixture: 'two-versions',
      options: { description: 'WP12 invalid-spec exclusion control' },
      openapi: { specs: [{ path: 'openapi/v1.yaml', label: 'v1', released: true }] },
      files: { 'openapi/v1.yaml': 'openapi: 3.1.0\ninfo: [\n' },
    });
    expect(rejected.status).not.toBe(0);
    expect(rejected.output).toMatch(/\[dk-openapi\] specs\[0\] "v1": cannot parse/);
  }, 300_000);
});
