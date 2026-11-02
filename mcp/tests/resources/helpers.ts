/**
 * Resource-surface test helpers: stand up a WP03/WP04 server over a corpus
 * fixture with an in-process client, and speak the three resources/* methods
 * over the real wire (re-using WP03's harness - read-only import, no client
 * package added, NFR-003).
 */
import type { LaunchConfiguration } from '../../src/cli.js';
import type { CorpusSnapshot } from '../../src/corpus/snapshot.js';
import { createServer } from '../../src/server.js';
import { SurfaceClient } from '../surface/harness.js';
import { loadFsCorpus } from '../surface/helpers.js';

/** The wire shape of one resources/list entry as these tests consume it. */
export interface ResourceWire {
  uri: string;
  name: string;
  description?: string;
  mimeType?: string;
}

/** The wire shape of one resources/templates/list entry. */
export interface ResourceTemplateWire {
  name: string;
  uriTemplate: string;
  title?: string;
  description?: string;
  mimeType?: string;
}

/** The wire shape of one resources/read content block. */
export interface ResourceContentWire {
  uri: string;
  mimeType?: string;
  text?: string;
}

export interface ConnectedCorpus {
  client: SurfaceClient;
  snapshot: CorpusSnapshot;
  config: LaunchConfiguration;
}

/**
 * Load a committed corpus fixture exactly like the cli would, optionally
 * overriding the listing threshold and/or the FR-007 link base, and connect
 * an in-process client.
 */
export async function connectResources(
  fixtureName: string,
  options: { linkBase?: string; threshold?: number } = {},
): Promise<ConnectedCorpus> {
  const loaded = await loadFsCorpus(
    fixtureName,
    options.linkBase === undefined ? {} : { linkBase: options.linkBase },
  );
  const config: LaunchConfiguration = {
    ...loaded.config,
    ...(options.threshold === undefined ? {} : { resourceListingThreshold: options.threshold }),
  };
  const client = await SurfaceClient.connect(createServer(loaded.snapshot, config));
  return { client, snapshot: loaded.snapshot, config };
}

export async function listResources(client: SurfaceClient): Promise<ResourceWire[]> {
  const result = (await client.request('resources/list', {})) as { resources: ResourceWire[] };
  return result.resources;
}

export async function listResourceTemplates(client: SurfaceClient): Promise<ResourceTemplateWire[]> {
  const result = (await client.request('resources/templates/list', {})) as {
    resourceTemplates: ResourceTemplateWire[];
  };
  return result.resourceTemplates;
}

export async function readResource(client: SurfaceClient, uri: string): Promise<ResourceContentWire[]> {
  const result = (await client.request('resources/read', { uri })) as { contents: ResourceContentWire[] };
  return result.contents;
}
