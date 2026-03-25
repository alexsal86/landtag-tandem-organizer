// Lexical node type compatibility shim for version 0.40.0.
// Narrows cross-package node APIs to lexical primitives used in this app.

import type { LexicalNode, RangeSelection } from 'lexical';
import 'lexical';
import '@lexical/rich-text';
import '@lexical/code';
import '@lexical/link';

interface ReplaceableLexicalNode {
  selectEnd(): RangeSelection;
  replace(node: LexicalNode): LexicalNode;
}

declare module '@lexical/rich-text' {
  interface HeadingNode extends ReplaceableLexicalNode {}
  interface QuoteNode extends ReplaceableLexicalNode {}
}

declare module '@lexical/code' {
  interface CodeNode extends ReplaceableLexicalNode {}
}

declare module '@lexical/link' {
  interface LinkNode {
    append(...nodes: LexicalNode[]): this;
  }
}
