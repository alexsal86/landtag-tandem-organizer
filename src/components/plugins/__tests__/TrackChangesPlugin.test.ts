import { describe, expect, it } from 'vitest';
import { ElementNode, TextNode, type EditorConfig, type LexicalNode, type NodeKey } from 'lexical';

import { isElementNode } from '@/components/plugins/TrackChangesPlugin';

class DummyElementNode extends ElementNode {
  static getType(): string {
    return 'dummy-element';
  }

  static clone(node: DummyElementNode): DummyElementNode {
    return new DummyElementNode(node.__key);
  }

  constructor(key?: NodeKey) {
    super(key);
  }

  createDOM(_config: EditorConfig): HTMLElement {
    return document.createElement('div');
  }

  updateDOM(): false {
    return false;
  }
}

describe('isElementNode', () => {
  it('detects lexical element nodes and excludes text nodes', () => {
    const element = new DummyElementNode();
    const text = new TextNode('abc');

    expect(isElementNode(element as LexicalNode)).toBe(true);
    expect(isElementNode(text as LexicalNode)).toBe(false);
  });
});
