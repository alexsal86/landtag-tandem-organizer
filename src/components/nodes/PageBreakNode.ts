/**
 * PageBreakNode – ein nicht-editierbarer Dekorations-Node der eine
 * visuelle Seitentrennlinie im Editor darstellt.
 *
 * Wird vom PageLayoutPlugin automatisch eingefügt/entfernt.
 * Nutzer können ihn nicht direkt bearbeiten oder löschen.
 */

import {
  DecoratorNode,
  type EditorConfig,
  type LexicalNode,
  type NodeKey,
  type SerializedLexicalNode,
  type Spread,
  $createParagraphNode,
  $isDecoratorNode,
} from 'lexical';
import React from 'react';

export type SerializedPageBreakNode = Spread<
  { pageNumber: number },
  SerializedLexicalNode
>;

export class PageBreakNode extends DecoratorNode<React.ReactElement> {
  __pageNumber: number;

  static getType(): string {
    return 'page-break';
  }

  static clone(node: PageBreakNode): PageBreakNode {
    return new PageBreakNode(node.__pageNumber, node.__key);
  }

  constructor(pageNumber: number, key?: NodeKey) {
    super(key);
    this.__pageNumber = pageNumber;
  }

  static importJSON(json: SerializedPageBreakNode): PageBreakNode {
    return new PageBreakNode(json.pageNumber);
  }

  exportJSON(): SerializedPageBreakNode {
    return {
      ...super.exportJSON(),
      type: 'page-break',
      version: 1,
      pageNumber: this.__pageNumber,
    };
  }

  createDOM(): HTMLElement {
    const div = document.createElement('div');
    div.setAttribute('data-page-break', String(this.__pageNumber));
    div.style.cssText = [
      'user-select: none',
      'pointer-events: none',
      'contenteditable: false',
      'position: relative',
      'height: 1px',
      'margin: 0',
      'padding: 0',
    ].join(';');
    return div;
  }

  updateDOM(prevNode: PageBreakNode, dom: HTMLElement): boolean {
    if (prevNode.__pageNumber !== this.__pageNumber) {
      dom.setAttribute('data-page-break', String(this.__pageNumber));
    }
    return false;
  }

  isInline(): boolean {
    return false;
  }

  isKeyboardSelectable(): boolean {
    return false;
  }

  decorate(): React.ReactElement {
    return React.createElement(PageBreakComponent, { pageNumber: this.__pageNumber });
  }
}

// ── React-Komponente für die visuelle Darstellung ──

function PageBreakComponent({ pageNumber }: { pageNumber: number }) {
  return React.createElement(
    'div',
    {
      contentEditable: false,
      style: {
        userSelect: 'none',
        pointerEvents: 'none',
        position: 'relative',
        height: '28px',
        margin: '0 -999px', // bleeding edge-to-edge
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      },
      'data-page-break-visual': pageNumber,
    },
    // Gestrichelte Linie
    React.createElement('div', {
      style: {
        position: 'absolute',
        left: 0,
        right: 0,
        top: '50%',
        height: '2px',
        borderTop: '2px dashed rgba(0, 0, 0, 0.15)',
      },
    }),
    // Seiten-Label
    React.createElement(
      'span',
      {
        style: {
          position: 'relative',
          zIndex: 1,
          fontSize: '8pt',
          color: 'rgba(0,0,0,0.3)',
          backgroundColor: 'white',
          padding: '0 8px',
          fontFamily: 'Arial, sans-serif',
          letterSpacing: '0.5px',
        },
      },
      `Seite ${pageNumber}`,
    ),
  );
}

export function $createPageBreakNode(pageNumber: number): PageBreakNode {
  return new PageBreakNode(pageNumber);
}

export function $isPageBreakNode(
  node: LexicalNode | null | undefined,
): node is PageBreakNode {
  return node instanceof PageBreakNode;
}
