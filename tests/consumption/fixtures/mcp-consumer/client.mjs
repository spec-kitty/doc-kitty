#!/usr/bin/env node
/**
 * client.mjs - the clean-room MCP client driver (doc-kitty-mcp-server
 * WP06/T025). Runs INSIDE the installed fixture project, so its one import,
 * `@modelcontextprotocol/server`, resolves to the tarball's own pinned SDK
 * dependency - this is the "client built only from the pinned SDK" of
 * NFR-004, driven over REAL stdio against the bin a consumer would run.
 *
 *   node client.mjs <bin-path> [--site <base-url> | --dir <dist>] --pages <id>[,<id>...]
 *
 * <bin-path> is the fixture's `node_modules/.bin/doc-kitty-mcp` shim: spawning
 * it DIRECTLY (never `node <path>`) proves the shim + shebang launch chain an
 * MCP client config relies on (T025's headline requirement).
 *
 * Protocol: newline-delimited JSON-RPC over the child's stdio, implemented
 * here against the SDK's exported LATEST_PROTOCOL_VERSION constant - no client
 * package exists in the closure (NFR-003), so the client speaks the wire
 * format the SDK documents, like the WP03/WP08 in-repo harnesses.
 *
 * stdout: exactly ONE JSON document (machine-read by the test):
 *   { initialize, tools, siteInfo, pages: { <id>: ... }, exitCode, stderr }
 * stderr of the child is collected and reported in the envelope - never
 * interleaved on stdout (the server's own protocol channel stays clean).
 */
import { spawn } from 'node:child_process';
import { realpathSync } from 'node:fs';
import { createRequire } from 'node:module';
// The pinned SDK is the tarball's own dependency, not a fixture dependency:
// resolve it THROUGH the installed package so this client speaks the exact
// wire constants of the version the tarball pins (NFR-004), and so the clean
// room proves a consumer needs nothing but the tarball itself. REALPATH first:
// pnpm lays the package's dependency links next to its real location under
// .pnpm/, which a symlinked logical path cannot reach.
const pkgManifest = realpathSync(new URL('./node_modules/@spec-kitty/doc-kitty-mcp/package.json', import.meta.url));
const sdkRequire = createRequire(pkgManifest);
const { LATEST_PROTOCOL_VERSION } = await import(sdkRequire.resolve('@modelcontextprotocol/server'));

const args = process.argv.slice(2);
const bin = args[0];
if (bin === undefined) {
  console.error('client.mjs: missing <bin-path>');
  process.exit(64);
}
const pagesFlag = args.indexOf('--pages');
const pageIds = pagesFlag === -1 ? [] : (args[pagesFlag + 1] ?? '').split(',').filter(Boolean);
const binArgs = args.slice(1, pagesFlag === -1 ? undefined : pagesFlag);

const child = spawn(bin, binArgs, { stdio: ['pipe', 'pipe', 'pipe'] });
const childStderr = [];
child.stderr.on('data', (chunk) => {
  for (const line of String(chunk).split('\n')) {
    if (line.length > 0) childStderr.push(line);
  }
});

let nextId = 0;
let buffer = '';
const pending = new Map();
let exitCode = null;
let exitSeen;
const exited = new Promise((resolve) => {
  exitSeen = resolve;
});
const failures = [];
child.on('error', (error) => failures.push(String(error.message ?? error)));
child.on('exit', (code) => {
  exitCode = code;
  for (const entry of pending.values()) entry.reject(new Error(`server exited (code ${code}) with a pending request`));
  pending.clear();
  exitSeen();
});
child.stdout.on('data', (chunk) => {
  buffer += String(chunk);
  for (;;) {
    const newline = buffer.indexOf('\n');
    if (newline < 0) return;
    const line = buffer.slice(0, newline);
    buffer = buffer.slice(newline + 1);
    if (line.trim().length === 0) continue;
    let message;
    try {
      message = JSON.parse(line);
    } catch {
      continue; // the SDK's stdio binding never emits non-JSON; ignore defensively
    }
    if (typeof message.id !== 'number') continue; // server notifications: none expected
    const entry = pending.get(message.id);
    if (entry === undefined) continue;
    pending.delete(message.id);
    if (message.error !== undefined && message.error !== null) {
      entry.reject(new Error(`${message.error.code}: ${message.error.message}`));
    } else {
      entry.resolve(message.result);
    }
  }
});

function request(method, params) {
  const id = ++nextId;
  return new Promise((resolve, reject) => {
    pending.set(id, { resolve, reject });
    child.stdin.write(`${JSON.stringify({ jsonrpc: '2.0', id, method, params })}\n`, (error) => {
      if (error) {
        pending.delete(id);
        reject(error);
      }
    });
  });
}

function notify(method) {
  return new Promise((resolve, reject) => {
    child.stdin.write(`${JSON.stringify({ jsonrpc: '2.0', method })}\n`, (error) =>
      error ? reject(error) : resolve(),
    );
  });
}

/** The text payload of a tool call result (the contract's JSON text block). */
function toolText(result) {
  if (result.isError) throw new Error(`tool call returned isError: ${JSON.stringify(result.content)}`);
  const block = result.content?.[0];
  if (block?.type !== 'text') throw new Error(`tool call returned no text block: ${JSON.stringify(result.content)}`);
  return JSON.parse(block.text);
}

try {
  const initialize = await request('initialize', {
    protocolVersion: LATEST_PROTOCOL_VERSION,
    capabilities: {},
    clientInfo: { name: 'doc-kitty-mcp clean-room consumer (WP06/T025)', version: '0.0.0' },
  });
  await notify('notifications/initialized');
  const { tools } = await request('tools/list', {});
  const siteInfo = toolText(await request('tools/call', { name: 'get_site_info', arguments: {} }));
  const pages = {};
  for (const id of pageIds) {
    pages[id] = toolText(await request('tools/call', { name: 'get_page', arguments: { id } }));
  }
  child.stdin.end(); // closing stdin is the stdio binding's clean-shutdown signal
  const KILLED = Symbol('killed');
  await Promise.race([exited, new Promise((resolve) => setTimeout(() => resolve(KILLED), 10_000))]);
  if (exitCode === null) child.kill('SIGKILL');
  process.stdout.write(
    `${JSON.stringify({
      initialize,
      tools: tools.map((tool) => tool.name),
      siteInfo,
      pages,
      exitCode,
      stderr: childStderr,
      spawnFailures: failures,
    })}\n`,
  );
} catch (error) {
  child.kill('SIGKILL');
  process.stdout.write(
    `${JSON.stringify({ clientError: String(error.message ?? error), spawnFailures: failures, stderr: childStderr })}\n`,
  );
  process.exitCode = 1;
}
