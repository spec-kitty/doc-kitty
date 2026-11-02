/**
 * Conformance-suite wiring (T020/T021): fixture locations, snapshot +
 * server construction per launch mode, and the in-process client hookup.
 *
 * The harness deliberately feeds the server through the REAL adapters
 * (FsCorpusSource / HttpCorpusSource over the local static server) and the
 * REAL createServer - only the launch configuration is composed by hand, the
 * way the cli would.
 *
 * Resources surface is unconditional since WP04 (hybrid ruling Q-P1);
 * assertions run in every branch - a server that drops the capability fails
 * the suite, not skips it.
 */
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { LaunchConfiguration } from '../../src/cli.js';
import { FsCorpusSource } from '../../src/corpus/fs-source.js';
import { HttpCorpusSource } from '../../src/corpus/http-source.js';
import { loadSnapshot } from '../../src/corpus/snapshot.js';
import type { CorpusSnapshot } from '../../src/corpus/snapshot.js';
import type { LoadLogger } from '../../src/corpus/source.js';
import { createServer } from '../../src/server.js';
import type { ServerFaults } from '../../src/server.js';
import { SurfaceClient } from '../surface/harness.js';
import { fixture } from '../corpus/helpers.js';
import { pageUriFor, siteSlugFromContract } from './projection.js';
import type { LaunchView, ProjectedCorpus } from './projection.js';
import { serveFixture } from './serve-fixture.js';
import type { ServedFixture } from './serve-fixture.js';

/** WP05's own fixture tree (mcp/tests/fixtures/). */
const WP05_FIXTURES = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'fixtures');

export function wp05Fixture(name: string): string {
  return path.join(WP05_FIXTURES, name);
}

/** The committed copy of a real example build (WP02's corpus fixture tree). */
export function exampleFixtureDir(): string {
  return fixture('example');
}

/** The baked origin of the committed example fixture (test-server rewrite anchor). */
export const EXAMPLE_BAKED_ORIGIN = 'https://spec-kitty.github.io/doc-kitty';

/** The baked origin of every WP05-authored fixture (test-server rewrite anchor). */
export const WP05_BAKED_ORIGIN = 'https://conformance.example.net/library';

export interface RunningServer {
  client: SurfaceClient;
  snapshot: CorpusSnapshot;
  config: LaunchConfiguration;
  view: LaunchView;
  served?: ServedFixture;
  close(): Promise<void>;
}

export interface RunOptions {
  linkBase?: string;
  resourceListingThreshold?: number;
  faults?: ServerFaults;
  logger?: LoadLogger;
}

/** Load + serve one fixture in fs mode (the documented `--dir` path). */
export async function runFsServer(fixtureDir: string, options: RunOptions = {}): Promise<RunningServer> {
  const dir = path.resolve(fixtureDir);
  const source =
    options.linkBase === undefined ? new FsCorpusSource(dir) : new FsCorpusSource(dir, { linkBase: options.linkBase });
  const snapshot = await loadSnapshot(source, { logger: options.logger });
  const config: LaunchConfiguration = {
    source: { kind: 'fs', dir },
    ...(options.linkBase === undefined ? {} : { linkBase: options.linkBase }),
    resourceListingThreshold: options.resourceListingThreshold ?? 1000,
    siteSlug: siteSlugFromContract(dir),
  };
  const server = createServer(
    snapshot,
    options.faults === undefined ? config : { ...config, faults: options.faults },
  );
  const client = await SurfaceClient.connect(server);
  const view: LaunchView = {
    kind: 'fs',
    dir,
    ...(options.linkBase === undefined ? {} : { linkBase: options.linkBase }),
  };
  return { client, snapshot, config, view, close: () => client.close() };
}

/** Load + serve one fixture through the https adapter over a local static server. */
export async function runHttpServer(
  fixtureDir: string,
  rewriteFrom: string,
  options: RunOptions = {},
): Promise<RunningServer> {
  const served = await serveFixture(fixtureDir, { rewriteFrom });
  try {
    const snapshot = await loadSnapshot(new HttpCorpusSource(served.base), { logger: options.logger });
    const config: LaunchConfiguration = {
      source: { kind: 'https', url: served.base },
      resourceListingThreshold: options.resourceListingThreshold ?? 1000,
      siteSlug: siteSlugFromContract(served.base),
    };
    const server = createServer(
      snapshot,
      options.faults === undefined ? config : { ...config, faults: options.faults },
    );
    const client = await SurfaceClient.connect(server);
    const view: LaunchView = { kind: 'https', url: served.base };
    const close = async (): Promise<void> => {
      await client.close();
      await served.stop();
    };
    return { client, snapshot, config, view, served, close };
  } catch (error) {
    await served.stop();
    throw error;
  }
}

/** fs mode with faults (the seeded-fault self-test's entry point). */
export async function runFsServerWithFaults(
  fixtureDir: string,
  faults: ServerFaults,
  options: RunOptions = {},
): Promise<RunningServer> {
  return runFsServer(fixtureDir, { ...options, faults });
}

/** Deterministic >=10-page sample: every 7th index slot plus the empty-slug home. */
export function samplePageIds(corpus: ProjectedCorpus, minimum = 10): string[] {
  const ids = corpus.pages.map((p) => p.id);
  const sample: string[] = [];
  const step = Math.max(1, Math.floor(ids.length / minimum));
  for (let i = 0; i < ids.length && sample.length < minimum; i += step) {
    sample.push(ids[i]!);
  }
  const homeIndex = corpus.index.pages
    ? (corpus.index.pages as Array<{ slug?: unknown }>).findIndex((r) => r.slug === '')
    : -1;
  if (homeIndex >= 0) {
    const homeId = ids[homeIndex];
    if (homeId !== undefined && !sample.includes(homeId)) sample.push(homeId);
  }
  return sample;
}

export { pageUriFor };
