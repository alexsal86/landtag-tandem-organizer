import React from 'react';
import {
  DecoratorNode,
  type DOMConversionMap,
  type DOMExportOutput,
  type EditorConfig,
  type LexicalNode,
  type NodeKey,
  type SerializedLexicalNode,
  type Spread,
} from 'lexical';

export type SerializedPageBreakSpacerNode = Spread<
  { height: number },
  SerializedLexicalNode
>;

export class PageBreakSpacerNode extends DecoratorNode<React.ReactElement> {
  __height: number; // height in mm

  static getType(): string {
    return 'page-break-spacer';
  }

  static clone(node: PageBreakSpacerNode): PageBreakSpacerNode {
    return new PageBreakSpacerNode(node.__height, node.__key);
  }

  static importJSON(serialized: SerializedPageBreakSpacerNode): PageBreakSpacerNode {
    return new PageBreakSpacerNode(serialized.height);
  }

  constructor(height: number, key?: NodeKey) {
    super(key);
    this.__height = height;
  }

  exportJSON(): SerializedPageBreakSpacerNode {
    return {
      ...super.exportJSON(),
      height: this.__height,
      type: 'page-break-spacer',
      version: 1,
    };
  }

  createDOM(_config: EditorConfig): HTMLElement {
    const div = document.createElement('div');
    div.style.height = `${this.__height}mm`;
    div.style.width = '100%';
    div.style.userSelect = 'none';
    div.style.pointerEvents = 'none';
    div.setAttribute('data-page-break-spacer', 'true');
    div.contentEditable = 'false';
    return div;
  }

  updateDOM(prevNode: PageBreakSpacerNode, dom: HTMLElement): boolean {
    if (prevNode.__height !== this.__height) {
      dom.style.height = `${this.__height}mm`;
      return false;
    }
    return false;
  }

  exportDOM(): DOMExportOutput {
    const element = document.createElement('div');
    element.setAttribute('data-page-break-spacer', 'true');
    element.style.height = `${this.__height}mm`;
    return { element };
  }

  static importDOM(): DOMConversionMap | null {
    return {
      div: (domNode: HTMLElement) => {
        if (!domNode.hasAttribute('data-page-break-spacer')) return null;
        return {
          conversion: () => ({
            node: new PageBreakSpacerNode(50),
          }),
          priority: 2,
        };
      },
    };
  }

  getTextContent(): string {
    return '';
  }

  isInline(): false {
    return false;
  }

  decorate(): React.ReactElement {
    return (
      <div
        data-page-break-spacer="true"
        style={{
          height: `${this.__height}mm`,
          width: '100%',
          userSelect: 'none',
          pointerEvents: 'none',
        }}
        contentEditable={false}
      />
    );
  }
}

export function $createPageBreakSpacerNode(height: number): PageBreakSpacerNode {
  return new PageBreakSpacerNode(height);
}

export function $isPageBreakSpacerNode(
  node: LexicalNode | null | undefined,
): node is PageBreakSpacerNode {
  return node instanceof PageBreakSpacerNode;
}
