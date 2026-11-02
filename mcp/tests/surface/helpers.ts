/**
 * Surface-test helpers: load a corpus fixture into a snapshot and launch
 * configuration exactly the way the cli would, then stand up a WP03 server
 * with an in-process client connected.
 */
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { fixture } from '../corpus/helpers.js';
import type { LaunchConfiguration } from '../../src/cli.js';
import { FsCorpusSource } from '../../src/corpus/fs-source.js';
import { loadSnapshot, siteSlugFor } from '../../src/corpus/snapshot.js';
import type { CorpusSnapshot } from '../../src/corpus/snapshot.js';
import { createServer } from '../../src/server.js';
import { SurfaceClient } from './harness.js';

/** This directory's own small authored corpus fixtures (distinct from WP02's corpus set). */
const SURFACE_FIXTURES = path.join(path.dirname(fileURLToPath(import.meta.url)), 'fixtures');

export function surfaceFixture(name: string): string {
  return path.join(SURFACE_FIXTURES, name);
}

/** WP02's corpus fixtures resolve straight; this suite's own fixtures fall back to the surface dir. */
function resolveCorpusDir(fixtureName: string): string {
  const direct = fixture(fixtureName);
  if (existsSync(direct)) return direct;
  return surfaceFixture(fixtureName);
}

export interface LoadedCorpus {
  snapshot: CorpusSnapshot;
  config: LaunchConfiguration;
}

/**
 * Load a committed corpus fixture through the REAL fs adapter + loader, with
 * the launch configuration the cli would derive for `--dir <fixture>`
 * (in particular: config.siteSlug slugs the local DIRECTORY, which the
 * surface layer must never use for fs-mode URI minting - uris.ts's job).
 */
export async function loadFsCorpus(fixtureName: string, options: { linkBase?: string } = {}): Promise<LoadedCorpus> {
  const dir = resolveCorpusDir(fixtureName);
  const snapshot = await loadSnapshot(new FsCorpusSource(dir, options), {});
  const config: LaunchConfiguration = {
    source: { kind: 'fs', dir },
    ...(options.linkBase === undefined ? {} : { linkBase: options.linkBase }),
    resourceListingThreshold: 1000,
    siteSlug: siteSlugFor(dir),
  };
  return { snapshot, config };
}

/** Wire one fixture corpus into a connected in-process client. */
export async function connectFixture(fixtureName: string, options: { linkBase?: string } = {}): Promise<SurfaceClient> {
  const { snapshot, config } = await loadFsCorpus(fixtureName, options);
  return SurfaceClient.connect(createServer(snapshot, config));
}

/** Parse the single JSON text block every tool result carries. */
export function resultJson(result: { content?: Array<{ type: string; text?: string }> }): unknown {
  const block = result.content?.[0];
  if (block === undefined || block.type !== 'text' || block.text === undefined) {
    throw new Error('expected one text content block');
  }
  return JSON.parse(block.text);
}
