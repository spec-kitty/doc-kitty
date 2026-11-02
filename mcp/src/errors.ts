/**
 * The named error taxonomy of the doc-kitty MCP server (NFR-005, data-model.md
 * section "Error taxonomy", contracts/mcp-surface.md). This module is the ONE
 * place error names are defined; no other error names may appear in later WPs.
 *
 * Every class carries a stable string `code` (the contract-facing identity a
 * client can switch on) and forwards `cause` so diagnostics keep the original
 * failure (fetch status, node error, guard detail).
 */
export type ErrorCode =
  | 'UNKNOWN_CONTRACT_MAJOR'
  | 'UNREACHABLE_ENDPOINT'
  | 'MALFORMED_CORPUS'
  | 'PAGES_LINKS_GATED'
  | 'BUILD_IDENTITY_MISMATCH'
  | 'PAGE_NOT_FOUND'
  | 'UNSUPPORTED_CLIENT_REVISION';

export class DocKittyMcpError extends Error {
  readonly code: ErrorCode;

  constructor(code: ErrorCode, message: string, options?: { cause?: unknown }) {
    super(message, options);
    this.name = 'DocKittyMcpError';
    this.code = code;
  }
}

/** Index `version` major is not in the supported set (or not numeric). */
export class UnknownContractMajorError extends DocKittyMcpError {
  constructor(message: string, options?: { cause?: unknown }) {
    super('UNKNOWN_CONTRACT_MAJOR', message, options);
    this.name = 'UnknownContractMajorError';
  }
}

/** Source fetch failed after the one documented retry. */
export class UnreachableEndpointError extends DocKittyMcpError {
  constructor(message: string, options?: { cause?: unknown }) {
    super('UNREACHABLE_ENDPOINT', message, options);
    this.name = 'UnreachableEndpointError';
  }
}

/** An artifact failed the hand-rolled presence/shape validation. */
export class MalformedCorpusError extends DocKittyMcpError {
  constructor(message: string, options?: { cause?: unknown }) {
    super('MALFORMED_CORPUS', message, options);
    this.name = 'MalformedCorpusError';
  }
}

/** Index lacks per-page links; the server degrades to index-only tools. */
export class PagesLinksGatedError extends DocKittyMcpError {
  constructor(message: string, options?: { cause?: unknown }) {
    super('PAGES_LINKS_GATED', message, options);
    this.name = 'PagesLinksGatedError';
  }
}

/** Torn corpus read: artifacts carry diverging `buildId` values. */
export class BuildIdentityMismatchError extends DocKittyMcpError {
  constructor(message: string, options?: { cause?: unknown }) {
    super('BUILD_IDENTITY_MISMATCH', message, options);
    this.name = 'BuildIdentityMismatchError';
  }
}

/** Identifier not present in the loaded snapshot. */
export class PageNotFoundError extends DocKittyMcpError {
  constructor(message: string, options?: { cause?: unknown }) {
    super('PAGE_NOT_FOUND', message, options);
    this.name = 'PageNotFoundError';
  }
}

/**
 * The connecting client negotiates an MCP spec revision older than the one the
 * SDK supports (NFR-004): announced, never silently degraded.
 */
export class UnsupportedClientRevisionError extends DocKittyMcpError {
  constructor(message: string, options?: { cause?: unknown }) {
    super('UNSUPPORTED_CLIENT_REVISION', message, options);
    this.name = 'UnsupportedClientRevisionError';
  }
}

export function isDocKittyMcpError(error: unknown): error is DocKittyMcpError {
  return error instanceof DocKittyMcpError;
}
