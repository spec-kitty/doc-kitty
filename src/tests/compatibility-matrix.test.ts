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
};

const NODE_FLOOR = '>=22.22.0';

describe('compatibility matrix', () => {
  it('pins the peer ranges adopters install against', () => {
    expect(toolkit.peerDependencies).toEqual(EXPECTED_PEERS);
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
