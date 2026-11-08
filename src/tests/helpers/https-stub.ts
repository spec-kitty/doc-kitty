/**
 * A local-only HTTPS server for the WP10 remote-source tests.
 *
 * The server runs in a child process: the production materialisation seam is
 * synchronous and waits for its fetch child, so an in-process server would be
 * blocked too. A throwaway localhost certificate is generated with the system
 * OpenSSL; the CA file is trusted only by fetch children through
 * NODE_EXTRA_CA_CERTS. No test ever needs a real network host.
 */
import { execFileSync, spawn, type ChildProcess } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { createServer } from 'node:https';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = fileURLToPath(import.meta.url);

// The WP01 rejection rows run through the real config seam. They opt into this
// standard child-process import through NODE_OPTIONS, replacing global fetch in
// the fetch child only. Production has no scenario switch and no test import.
const fetchScenario = process.env.DK_TEST_FETCH_STUB;
if (fetchScenario) {
  globalThis.fetch = async (input, init) => {
    const url = String(input);
    const signal = init?.signal;
    if (fetchScenario === 'redirects') return new Response(null, { status: 302, headers: { location: url } });
    if (fetchScenario === 'timeout') {
      return new Promise<Response>((_resolve, reject) => {
        if (signal?.aborted) reject(signal.reason);
        else signal?.addEventListener('abort', () => reject(signal.reason), { once: true });
      });
    }
    return new Response(process.env.DK_TEST_OPENAPI_YAML ?? '', {
      status: 200,
      headers: { 'content-type': 'application/yaml' },
    });
  };
}

export interface HttpsRequest {
  path: string;
  authorization?: string;
}

export interface HttpsStub {
  origin: string;
  caFile: string;
  requests(): Promise<HttpsRequest[]>;
  clearRequests(): Promise<void>;
  close(): Promise<void>;
}

interface ChildMessage {
  type: 'ready' | 'requests' | 'cleared' | 'closed';
  port?: number;
  requests?: HttpsRequest[];
}

function generateCertificate(directory: string): { key: string; cert: string; caFile: string } {
  const key = path.join(directory, 'key.pem');
  const caFile = path.join(directory, 'cert.pem');
  execFileSync(
    'openssl',
    [
      'req', '-x509', '-newkey', 'rsa:2048', '-nodes', '-days', '1',
      '-subj', '/CN=localhost',
      '-addext', 'subjectAltName=DNS:localhost,IP:127.0.0.1',
      '-keyout', key, '-out', caFile,
    ],
    { stdio: 'ignore' },
  );
  return { key: readFileSync(key, 'utf8'), cert: readFileSync(caFile, 'utf8'), caFile };
}

function reply(port: number, requestPath: string): { status: number; headers?: Record<string, string>; body?: Buffer | string } {
  if (requestPath.startsWith('/redirect/')) {
    const match = /^\/redirect\/(\d+)\.yaml/.exec(requestPath);
    const remaining = Number(match?.[1] ?? 0);
    if (remaining > 0) {
      return { status: 302, headers: { location: `/redirect/${remaining - 1}.yaml` } };
    }
  }
  if (requestPath.startsWith('/http-hop.yaml')) {
    return { status: 302, headers: { location: `http://localhost:${port}/api.yaml` } };
  }
  if (requestPath.startsWith('/redirect-query.yaml')) {
    return { status: 302, headers: { location: '/missing.yaml?redirect-secret=1' } };
  }
  if (requestPath.startsWith('/content-length-lie.yaml')) {
    return {
      status: 200,
      headers: { 'content-type': 'application/yaml', 'content-length': String(10 * 1024 * 1024 + 1) },
      body: 'openapi: 3.1.0',
    };
  }
  if (requestPath.startsWith('/oversize.yaml')) {
    return {
      status: 200,
      headers: { 'content-type': 'application/yaml' },
      body: Buffer.alloc(10 * 1024 * 1024 + 1, 120),
    };
  }
  if (requestPath.startsWith('/missing.yaml')) {
    return { status: 404, body: 'not found' };
  }
  return {
    status: 200,
    headers: { 'content-type': 'application/yaml' },
    body: process.env.DK_TEST_OPENAPI_YAML ?? '',
  };
}

function serve(): void {
  const directory = process.env.DK_TEST_HTTPS_DIR;
  if (!directory) throw new Error('DK_TEST_HTTPS_DIR is required');
  const certificate = generateCertificate(directory);
  const requests: HttpsRequest[] = [];
  const timers = new Set<NodeJS.Timeout>();
  const server = createServer({ key: certificate.key, cert: certificate.cert }, (request, response) => {
    const requestPath = request.url ?? '/';
    requests.push({ path: requestPath, authorization: request.headers.authorization });
    if (requestPath.startsWith('/slow.yaml')) {
      const timer = setTimeout(() => {
        timers.delete(timer);
        response.writeHead(200, { 'content-type': 'application/yaml' });
        response.end(process.env.DK_TEST_OPENAPI_YAML ?? '');
      }, 35_000);
      timers.add(timer);
      request.on('close', () => {
        clearTimeout(timer);
        timers.delete(timer);
      });
      return;
    }
    const address = server.address();
    const answer = reply(address && typeof address === 'object' ? address.port : 0, requestPath);
    response.writeHead(answer.status, answer.headers);
    response.end(answer.body);
  });

  server.listen(0, '127.0.0.1', () => {
    const address = server.address();
    if (address && typeof address === 'object') process.send?.({ type: 'ready', port: address.port } satisfies ChildMessage);
  });

  process.on('message', (message: { type?: string }) => {
    if (message.type === 'requests') process.send?.({ type: 'requests', requests } satisfies ChildMessage);
    if (message.type === 'clear') {
      requests.length = 0;
      process.send?.({ type: 'cleared' } satisfies ChildMessage);
    }
    if (message.type === 'close') {
      for (const timer of timers) clearTimeout(timer);
      server.closeAllConnections();
      server.close(() => {
        process.send?.({ type: 'closed' } satisfies ChildMessage);
        process.disconnect();
      });
    }
  });
}

function awaitMessage(child: ChildProcess, type: ChildMessage['type']): Promise<ChildMessage> {
  return new Promise((resolve, reject) => {
    const onMessage = (message: ChildMessage) => {
      if (message.type !== type) return;
      cleanup();
      resolve(message);
    };
    const onError = (error: Error) => {
      cleanup();
      reject(error);
    };
    const onExit = (code: number | null) => {
      cleanup();
      reject(new Error(`HTTPS stub exited before ${type} (${code ?? 'no exit code'})`));
    };
    const cleanup = () => {
      child.off('message', onMessage);
      child.off('error', onError);
      child.off('exit', onExit);
    };
    child.on('message', onMessage);
    child.on('error', onError);
    child.on('exit', onExit);
    child.send?.({ type: type === 'ready' ? 'ready' : type === 'requests' ? 'requests' : type === 'cleared' ? 'clear' : 'close' });
  });
}

export async function startHttpsStub(yaml: string): Promise<HttpsStub & { directory: string }> {
  const directory = mkdtempSync(path.join(tmpdir(), 'dk-openapi-https-'));
  const certificate = generateCertificate(directory);
  rmSync(path.join(directory, 'key.pem'), { force: true });
  rmSync(path.join(directory, 'cert.pem'), { force: true });
  const child = spawn(process.execPath, [HERE, '--serve'], {
    env: { ...process.env, DK_TEST_HTTPS_DIR: directory, DK_TEST_OPENAPI_YAML: yaml },
    stdio: ['ignore', 'ignore', 'inherit', 'ipc'],
  });
  try {
    const ready = await awaitMessage(child, 'ready');
    const origin = `https://localhost:${ready.port}`;
    return {
      origin,
      directory,
      caFile: certificate.caFile,
      async requests() {
        return (await awaitMessage(child, 'requests')).requests ?? [];
      },
      async clearRequests() {
        await awaitMessage(child, 'cleared');
      },
      async close() {
        await awaitMessage(child, 'closed');
        rmSync(directory, { recursive: true, force: true });
      },
    };
  } catch (error) {
    child.kill();
    rmSync(directory, { recursive: true, force: true });
    throw error;
  }
}

if (process.argv.includes('--serve') && process.argv[1] && path.resolve(process.argv[1]) === HERE) serve();
