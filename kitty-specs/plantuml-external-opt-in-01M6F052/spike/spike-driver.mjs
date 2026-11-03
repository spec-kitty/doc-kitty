// #268 WP01 spike driver (throwaway, never merged). Node built-ins only.
// Starts the canary on 0.0.0.0:18091, probes it from inside the PlantUML
// container, renders the include fixtures through the service, and prints
// every result plus the canary's request log. Never fails the job on a
// behavioural answer: it records, it does not assert.
import { createServer } from 'node:http';
import { execFile } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { encodePlantuml } from '../src/scripts/plantuml-include-guard.mjs';

const arg = (name, dflt) => {
  const i = process.argv.indexOf(`--${name}`);
  return i === -1 ? dflt : process.argv[i + 1];
};
const container = arg('container');
const server = arg('server', 'http://localhost:8091/svg/');
const leg = arg('leg', 'unnamed');
const PORT = Number(arg('port', '18091'));
const BASE = `http://dk-canary:${PORT}`;

const ALLOWED_BODY = '@startuml\nAlice -> Bob : DK-CANARY-FETCHED\n@enduml\n';
const DENIED_BODY = '@startuml\nAlice -> Bob : DK-CANARY-DENIED-FETCHED\n@enduml\n';
const SUB_BODY = '@startuml\n!startsub PART\nAlice -> Bob : DK-CANARY-FETCHED\n!endsub\n@enduml\n';
const zipBytes = readFileSync(new URL('./x.zip', import.meta.url));

const log = [];
const canary = createServer((req, res) => {
  const p = req.url;
  log.push(p);
  console.log(`[canary] ${req.method} ${p} host=${req.headers.host} ua=${req.headers['user-agent'] ?? ''}`);
  if (p.startsWith('/dk-canary/allowed/redirect/')) {
    const rest = p.slice('/dk-canary/allowed/redirect/'.length);
    res.writeHead(302, { Location: `${BASE}/dk-canary/denied/redirected/${rest}` });
    return res.end();
  }
  if (p.endsWith('.zip') && p.startsWith('/dk-canary/')) {
    res.writeHead(200, { 'Content-Type': 'application/zip' });
    return res.end(zipBytes);
  }
  if (p.endsWith('sub.puml') && p.startsWith('/dk-canary/allowed/')) {
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    return res.end(SUB_BODY);
  }
  if (p.startsWith('/dk-canary/allowed/')) {
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    return res.end(ALLOWED_BODY);
  }
  if (p.startsWith('/dk-canary/denied/')) {
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    return res.end(DENIED_BODY);
  }
  res.writeHead(404);
  res.end('not found');
});
await new Promise((r) => canary.listen(PORT, '0.0.0.0', r));
console.log(`[spike] leg=${leg} canary listening on 0.0.0.0:${PORT}`);

// Async on purpose: a synchronous exec blocks this process's event loop, so
// the in-process canary could not answer the probe (run 1 showed curl exit 28
// while the canary logged the request only after the timeout).
function sh(cmd, args) {
  return new Promise((resolve) => {
    execFile(cmd, args, { encoding: 'utf8' }, (e, stdout, stderr) => {
      if (e) resolve({ ok: false, code: e.code, out: `${stdout ?? ''}${stderr ?? ''}`.trim() });
      else resolve({ ok: true, out: stdout.trim() });
    });
  });
}

const results = { leg, probes: {}, renders: {} };

if (container) {
  results.etcHosts = (await sh('docker', ['exec', container, 'cat', '/etc/hosts'])).out;
  console.log(`[spike] /etc/hosts in container:\n${results.etcHosts}`);
  for (const side of ['allowed', 'denied']) {
    const url = `${BASE}/dk-canary/${side}/probe`;
    const r = await sh('docker', ['exec', container, 'curl', '-sf', '--max-time', '5', '-o', '/dev/null', url]);
    results.probes[side] = { url, ok: r.ok, code: r.code ?? 0, out: r.out };
    console.log(`[probe] ${side}: ok=${r.ok} code=${r.code ?? 0} ${r.out} canaryLogSoFar=${JSON.stringify(log)}`);
  }
}

const cases = {
  control: '@startuml\nAlice -> Bob : CONTROL\n@enduml',
  'include-allowed': `@startuml\n!include ${BASE}/dk-canary/allowed/include/x\n@enduml`,
  'include-denied': `@startuml\n!include ${BASE}/dk-canary/denied/include/x\n@enduml`,
  'includeurl-allowed': `@startuml\n!includeurl ${BASE}/dk-canary/allowed/include/y\n@enduml`,
  'includeurl-denied': `@startuml\n!includeurl ${BASE}/dk-canary/denied/include/y\n@enduml`,
  'redirect-include': `@startuml\n!include ${BASE}/dk-canary/allowed/redirect/x\n@enduml`,
  'redirect-includeurl': `@startuml\n!includeurl ${BASE}/dk-canary/allowed/redirect/y\n@enduml`,
  'import-allowed': `@startuml\n!import ${BASE}/dk-canary/allowed/include/x.zip\n!include inner.puml\n@enduml`,
  'includesub-allowed': `@startuml\n!includesub ${BASE}/dk-canary/allowed/include/sub.puml!PART\n@enduml`,
};

for (const [name, text] of Object.entries(cases)) {
  const before = log.length;
  const t0 = Date.now();
  let status, err, body;
  try {
    const res = await fetch(server + encodePlantuml(text), { signal: AbortSignal.timeout(30000) });
    status = res.status;
    err = res.headers.get('x-plantuml-diagram-error');
    body = await res.text();
  } catch (e) {
    status = `fetch-error: ${e.message}`;
    body = '';
  }
  const hits = log.slice(before);
  const textOnly = body.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
  const r = {
    status,
    diagramError: err ?? null,
    allowedMarker: body.includes('DK-CANARY-FETCHED'),
    deniedMarker: body.includes('DK-CANARY-DENIED-FETCHED'),
    canaryHits: hits,
    ms: Date.now() - t0,
    text: textOnly.slice(0, 400),
  };
  results.renders[name] = r;
  console.log(`[render] ${name}: ${JSON.stringify(r)}`);
}

if (container) {
  const insp = await sh('docker', ['inspect', '-f', '{{json .Config.Env}}', container]);
  writeFileSync('inspect-capture.json', insp.out + '\n');
  console.log('----- BEGIN inspect-capture.json -----');
  console.log(insp.out);
  console.log('----- END inspect-capture.json -----');
}

console.log('----- BEGIN results.json -----');
console.log(JSON.stringify(results, null, 2));
console.log('----- END results.json -----');
console.log(`[spike] full canary log: ${JSON.stringify(log)}`);
writeFileSync(`results-${leg}.json`, JSON.stringify(results, null, 2));
canary.close();
