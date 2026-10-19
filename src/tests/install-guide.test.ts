/**
 * The on-site install guide (#193) must not drift from what the toolkit
 * declares (src/package.json) or from what the consumption-test fixture
 * actually installs and configures (tests/consumption/consumer-fixture).
 */
import { describe, it, expect } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO_ROOT = fileURLToPath(new URL('../../', import.meta.url));
const GUIDE = path.join(REPO_ROOT, 'example/docs/guides/install.md');
const GETTING_STARTED = path.join(REPO_ROOT, 'example/docs/guides/getting-started.md');
const FIXTURE = path.join(REPO_ROOT, 'tests/consumption/consumer-fixture');

interface Manifest {
  name: string;
  version: string;
  engines?: { node?: string };
  peerDependencies?: Record<string, string>;
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
  publishConfig?: { registry?: string };
}
const readJson = (p: string): Manifest => JSON.parse(readFileSync(p, 'utf8')) as Manifest;
const toolkit = readJson(path.join(REPO_ROOT, 'src/package.json'));
const fixture = readJson(path.join(FIXTURE, 'package.json'));
const fixtureDeps = { ...fixture.dependencies, ...fixture.devDependencies };
const PEERS = Object.keys(toolkit.peerDependencies ?? {});

const guide = (): string => (existsSync(GUIDE) ? readFileSync(GUIDE, 'utf8') : '');

/** The `pnpm add …` line of the guide, as `name -> spec`. */
function pnpmAdd(text: string): Map<string, string> {
  const line = text.split('\n').find((l) => l.trim().startsWith('pnpm add '));
  const specs = new Map<string, string>();
  for (const token of (line ?? '').trim().split(/\s+/).slice(2)) {
    const at = token.lastIndexOf('@');
    if (at > 0) specs.set(token.slice(0, at), token.slice(at + 1));
    else specs.set(token, '');
  }
  return specs;
}

describe('install guide (#193)', () => {
  it('is published in the example site', () => {
    expect(existsSync(GUIDE), `${GUIDE} is missing`).toBe(true);
  });

  it('states the Node floor of engines.node', () => {
    expect(toolkit.engines?.node).toBeTruthy();
    expect(guide()).toContain(`\`${toolkit.engines!.node}\``);
  });

  it('lists every peer with its declared range', () => {
    expect(PEERS.length).toBeGreaterThan(0);
    for (const peer of PEERS) {
      expect(guide(), peer).toContain(`| \`${peer}\` | \`${toolkit.peerDependencies![peer]}\` |`);
    }
  });

  it('installs the current release and the peers at the fixture versions', () => {
    const specs = pnpmAdd(guide());
    expect(specs.get(toolkit.name)).toBe(toolkit.version);
    for (const peer of PEERS) {
      expect(specs.get(peer), peer).toBe(fixtureDeps[peer]);
    }
  });

  it('maps the package scope to the publishConfig registry', () => {
    const scope = toolkit.name.split('/')[0];
    expect(guide()).toContain(`${scope}:registry=${toolkit.publishConfig?.registry}`);
  });

  it('wires the same entry points the fixture uses', () => {
    const astroConfig = readFileSync(path.join(FIXTURE, 'astro.config.mjs'), 'utf8');
    const contentConfig = readFileSync(path.join(FIXTURE, 'src/content.config.ts'), 'utf8');
    for (const source of [astroConfig, contentConfig]) {
      for (const [, names, from] of source.matchAll(/import \{([^}]+)\} from '(@spec-kitty\/doc-toolkit[^']*)'/g)) {
        expect(guide(), from).toContain(`from '${from}'`);
        for (const name of names.split(',').map((n) => n.trim()).filter(Boolean)) {
          expect(guide(), name).toContain(name);
        }
      }
    }
  });

  it('links the 0.3 to 0.4 migration guide', () => {
    expect(guide()).toContain('docs/migrations/0.3-to-0.4.md');
  });

  it('is where getting started sends a consumer', () => {
    expect(readFileSync(GETTING_STARTED, 'utf8')).toContain('](/guides/install/)');
  });
});
