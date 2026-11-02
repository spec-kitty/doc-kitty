/**
 * In-process MCP client harness (WP03 testing note): speak the real wire
 * protocol to a WP03 server over the SDK's linked InMemoryTransport pair -
 * initialize handshake, tools/list, tools/call - without spawning a process
 * or touching stdio. Deliberately hand-rolled on the SDK transport: the
 * package's one declared runtime dependency is `@modelcontextprotocol/server`
 * (NFR-003) and tests must not add a client package to the closure.
 */
import { InMemoryTransport, LATEST_PROTOCOL_VERSION } from '@modelcontextprotocol/server';
import type { JSONRPCMessage, McpServer } from '@modelcontextprotocol/server';

/** The JSON-RPC error object of a failed request (id-correlated). */
export class WireError extends Error {
  readonly code: number;
  readonly data?: unknown;

  constructor(error: { code: number; message: string; data?: unknown }) {
    super(error.message);
    this.name = 'WireError';
    this.code = error.code;
    this.data = error.data;
  }
}

/** The wire shape of a tools/call result as these tests consume it. */
export interface ToolResultWire {
  content?: Array<{ type: string; text?: string }>;
  structuredContent?: Record<string, unknown>;
  isError?: boolean;
}

interface InitializeResultWire {
  serverInfo: { name: string; version: string };
  capabilities: Record<string, unknown>;
  protocolVersion: string;
}

export class SurfaceClient {
  /** The negotiated initialize result (serverInfo, capabilities, protocolVersion); set after connect(). */
  initializeResult!: InitializeResultWire;

  private readonly transport: InMemoryTransport;
  private readonly pending = new Map<number, { resolve: (r: unknown) => void; reject: (e: Error) => void }>();
  private nextId = 0;

  private constructor(transport: InMemoryTransport) {
    this.transport = transport;
  }

  /** Connect a fresh client to the server and run the MCP initialize handshake. */
  static async connect(server: McpServer): Promise<SurfaceClient> {
    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
    const client = new SurfaceClient(clientTransport);
    clientTransport.onmessage = (message) => client.dispatch(message);
    await clientTransport.start();
    await server.connect(serverTransport);
    client.initializeResult = (await client.request('initialize', {
      protocolVersion: LATEST_PROTOCOL_VERSION,
      capabilities: {},
      clientInfo: { name: 'doc-kitty-mcp surface tests', version: '0.0.0' },
    })) as InitializeResultWire;
    await client.notify('notifications/initialized');
    return client;
  }

  /** tools/list result. */
  async listTools(): Promise<Array<{ name: string; description?: string; inputSchema?: Record<string, unknown> }>> {
    const result = (await this.request('tools/list', {})) as {
      tools: Array<{ name: string; description?: string; inputSchema?: Record<string, unknown> }>;
    };
    return result.tools;
  }

  /** tools/call result (tool-level success or { isError: true }); wire errors reject instead. */
  async callTool(name: string, args?: Record<string, unknown>): Promise<ToolResultWire> {
    return (await this.request('tools/call', { name, arguments: args ?? {} })) as ToolResultWire;
  }

  /** Send one request and await its id-correlated response; reject on JSON-RPC error. */
  request(method: string, params: Record<string, unknown>): Promise<unknown> {
    const id = ++this.nextId;
    const message = { jsonrpc: '2.0', id, method, params };
    return new Promise<unknown>((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      void this.transport.send(message as JSONRPCMessage).catch((error: Error) => {
        this.pending.delete(id);
        reject(error);
      });
    });
  }

  /** Send a notification (no id, no response expected). */
  async notify(method: string, params?: Record<string, unknown>): Promise<void> {
    const message = params === undefined ? { jsonrpc: '2.0', method } : { jsonrpc: '2.0', method, params };
    await this.transport.send(message as JSONRPCMessage);
  }

  async close(): Promise<void> {
    await this.transport.close(); // closes the linked server side too
    for (const entry of this.pending.values()) {
      entry.reject(new Error('transport closed with a pending request'));
    }
    this.pending.clear();
  }

  /** Route inbound messages: responses settle pending requests; anything else is out of scope here. */
  private dispatch(message: JSONRPCMessage): void {
    if (typeof message !== 'object' || message === null || !('id' in message)) return;
    const id = (message as { id: unknown }).id;
    if (typeof id !== 'number') return;
    const entry = this.pending.get(id);
    if (entry === undefined) return;
    this.pending.delete(id);
    if ('error' in message && message.error !== undefined) {
      entry.reject(new WireError((message as { error: { code: number; message: string; data?: unknown } }).error));
    } else {
      entry.resolve((message as { result: unknown }).result);
    }
  }
}
