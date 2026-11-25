/**
 * `dockitty-pdf` waits for client-mode diagrams through the renderer's own markers, so
 * the renderer that every site ships carries no PDF-only signal (SC-004, ADR-0081).
 * `clientDiagramsDrawn` runs in the page; here it runs against stub nodes.
 */
import { afterEach, describe, it, expect } from 'vitest';
import { clientDiagramsDrawn } from '../scripts/dockitty-pdf.mjs';

interface StubNode {
  boxed: boolean;
  processed: boolean;
  svg: boolean;
}

function withNodes(nodes: StubNode[]): void {
  const elements = nodes.map((node) => ({
    getClientRects: () => (node.boxed ? [{}] : []),
    hasAttribute: (name: string) => name === 'data-processed' && node.processed,
    querySelector: (selector: string) => (selector === 'svg' && node.svg ? {} : null),
  }));
  (globalThis as { document?: unknown }).document = {
    querySelectorAll: (selector: string) => (selector === 'pre.mermaid' ? elements : []),
  };
}

afterEach(() => {
  delete (globalThis as { document?: unknown }).document;
});

describe('clientDiagramsDrawn', () => {
  it('holds when every laid-out diagram is processed and drawn', () => {
    withNodes([
      { boxed: true, processed: true, svg: true },
      { boxed: true, processed: true, svg: true },
    ]);
    expect(clientDiagramsDrawn()).toBe(true);
  });

  it('waits for a diagram the renderer has not reached', () => {
    withNodes([
      { boxed: true, processed: true, svg: true },
      { boxed: true, processed: false, svg: false },
    ]);
    expect(clientDiagramsDrawn()).toBe(false);
  });

  it('waits for a diagram that is processed but not drawn yet', () => {
    withNodes([{ boxed: true, processed: true, svg: false }]);
    expect(clientDiagramsDrawn()).toBe(false);
  });

  it('ignores a diagram without a box, which the renderer skips', () => {
    withNodes([
      { boxed: true, processed: true, svg: true },
      { boxed: false, processed: false, svg: false },
    ]);
    expect(clientDiagramsDrawn()).toBe(true);
  });
});
