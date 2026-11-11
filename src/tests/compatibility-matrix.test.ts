/**
 * T027 (#147) — the compatibility matrix. The toolkit's peer ranges and Node
 * floor are the promise adopters install against; this test pins them so a
 * change is deliberate and lands with a changelog entry and a migration note
 * (docs/migrations/). Update the expected values here only together with those.
 */
import { describe, it, expect } from 'vitest';
import toolkit from '../package.json' with { type: 'json' };
import root from '../../package.json' with { type: 'json' };

const EXPECTED_PEERS = {
  '@astrojs/markdown-remark': '>=7.3.0 <8',
  '@astrojs/starlight': '>=0.42.0 <0.43.0',
  astro: '>=7.2.10 <8',
  // Optional peers (peerDependenciesMeta), exact-pinned: only sites that set `openapi` install them.
  '@astrojs/markdown-satteri': '0.4.4',
  'starlight-openapi': '0.27.0',
  // Optional, exact-pinned: only sites that render diagrams in build mode install it (#314).
  playwright: '1.62.1',
};

const NODE_FLOOR = '>=22.22.0';

describe('compatibility matrix', () => {
  it('pins the peer ranges adopters install against', () => {
    expect(toolkit.peerDependencies).toEqual(EXPECTED_PEERS);
  });

  it('keeps the playwright peer on the exact @playwright/test the toolkit tests with (#314)', () => {
    // Build mode drives the consumer's playwright; the toolkit's own builds and
    // a11y run use @playwright/test. Bump both together, or a consumer pins a
    // version the toolkit never rendered with.
    expect(toolkit.peerDependencies.playwright).toBe(root.devDependencies['@playwright/test']);
    expect(toolkit.peerDependenciesMeta.playwright).toEqual({ optional: true });
  });

  it('keeps Starlight on one 0.x minor, since Starlight minors break', () => {
    expect(toolkit.peerDependencies['@astrojs/starlight']).toMatch(/^>=0\.(\d+)\.\d+ <0\.(\d+)\.0$/);
    const [, from, to] = /^>=0\.(\d+)\.\d+ <0\.(\d+)\.0$/.exec(toolkit.peerDependencies['@astrojs/starlight'])!;
    expect(Number(to) - Number(from)).toBe(1);
  });

  it('declares the same Node floor for the toolkit and the workspace root', () => {
    expect(toolkit.engines.node).toBe(NODE_FLOOR);
    expect(root.engines.node).toBe(NODE_FLOOR);
  });
});
