import { createServer } from 'node:http';
import { afterEach, describe, expect, it } from 'vitest';
import {
  CANARY_DENIED_MARKER,
  CANARY_MARKER,
  startCanary,
} from '../scripts/plantuml-include-guard.mjs';
import { canaryPort } from './helpers/plantuml-check-harness';

type Canary = Awaited<ReturnType<typeof startCanary>>;
const open: Canary[] = [];
async function start(opts: Parameters<typeof startCanary>[0] = {}) {
  const c = await startCanary(opts);
  open.push(c);
  return c;
}
afterEach(async () => {
  await Promise.all(open.splice(0).map((c) => c.close()));
});
const get = (port: number, p: string, init: RequestInit = {}) => fetch(`http://127.0.0.1:${port}${p}`, init);

describe('startCanary', () => {
  it('listens on exactly the requested port', async () => {
    const port = await canaryPort();
    const canary = await start({ port });
    expect(canary.port).toBe(port);
  });

  it('serves the allowed marker as valid PlantUML', async () => {
    const canary = await start({ port: await canaryPort() });
    const res = await get(canary.port, '/dk-canary/allowed/include/x.puml');
    const body = await res.text();
    expect(res.status).toBe(200);
    expect(body).toContain(CANARY_MARKER);
    expect(body).toMatch(/^@startuml[\s\S]*@enduml\n$/);
    expect(body).not.toContain('DENIED');
  });

  it('serves a distinguishable denied marker', async () => {
    const canary = await start({ port: await canaryPort() });
    const body = await (await get(canary.port, '/dk-canary/denied/include/x.puml')).text();
    expect(CANARY_DENIED_MARKER).toBe('DK-CANARY-DENIED-FETCHED');
    expect(body).toContain(CANARY_DENIED_MARKER);
    expect(body).not.toContain('DK-CANARY-FETCHED');
  });

  it('answers probes on both prefixes and /reachability', async () => {
    const canary = await start({ port: await canaryPort() });
    for (const p of ['/dk-canary/allowed/probe', '/dk-canary/denied/probe', '/reachability']) {
      expect((await get(canary.port, p)).status).toBe(200);
    }
  });

  it('redirects allowed/redirect/<f> to the denied prefix on the caller base', async () => {
    const canary = await start({ port: await canaryPort(), redirectBase: 'http://dk-canary:18091' });
    const res = await get(canary.port, '/dk-canary/allowed/redirect/x.puml', { redirect: 'manual' });
    expect(res.status).toBe(302);
    expect(res.headers.get('location')).toBe('http://dk-canary:18091/dk-canary/denied/redirected/x.puml');
  });

  it('defaults the redirect base to its own address', async () => {
    const canary = await start({ port: await canaryPort() });
    const res = await get(canary.port, '/dk-canary/allowed/redirect/x.puml', { redirect: 'manual' });
    expect(res.headers.get('location')).toBe(
      `http://127.0.0.1:${canary.port}/dk-canary/denied/redirected/x.puml`,
    );
  });

  it('logs unknown paths and answers 404', async () => {
    const canary = await start({ port: await canaryPort() });
    expect((await get(canary.port, '/somewhere/else')).status).toBe(404);
    expect(canary.log).toEqual(['/somewhere/else']);
  });

  it('logs every request in order, including repeats, 404s and redirects', async () => {
    const canary = await start({ port: await canaryPort() });
    const paths = [
      '/dk-canary/allowed/include/a.puml',
      '/dk-canary/allowed/include/a.puml',
      '/nope',
      '/dk-canary/allowed/redirect/b.puml',
      '/dk-canary/denied/redirected/b.puml',
    ];
    for (const p of paths) await get(canary.port, p, { redirect: 'manual' });
    expect(canary.log).toEqual(paths);
  });

  it('rejects with a clear error when the port is busy', async () => {
    const port = await canaryPort();
    const blocker = createServer();
    await new Promise<void>((r) => blocker.listen(port, '0.0.0.0', () => r()));
    try {
      await expect(startCanary({ port })).rejects.toThrow(`cannot listen on canary port ${port}`);
      await expect(startCanary({ port })).rejects.toMatchObject({ code: 'EADDRINUSE', port });
    } finally {
      await new Promise((r) => blocker.close(r));
    }
  });

  it('picks a random port when none is given', async () => {
    const canary = await start();
    expect(canary.port).toBeGreaterThan(0);
  });

  it('close() frees the port', async () => {
    const port = await canaryPort();
    const canary = await startCanary({ port });
    await canary.close();
    const again = await start({ port });
    expect(again.port).toBe(port);
  });
});
