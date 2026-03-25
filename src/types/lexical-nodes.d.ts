// Lexical node type compatibility shim for version 0.40.0
// Fixes type mismatches when Lexical sub-packages resolve slightly different base types.

import type { LexicalNode, RangeSelection } from 'lexical';
import 'lexical';
import '@lexical/rich-text';
import '@lexical/code';
import '@lexical/link';

declare module '@lexical/rich-text' {
  interface HeadingNode {
    selectEnd(): RangeSelection;
    replace(node: LexicalNode): LexicalNode;
  }
  interface QuoteNode {
    selectEnd(): RangeSelection;
    replace(node: LexicalNode): LexicalNode;
  }
}

declare module '@lexical/code' {
  interface CodeNode {
    selectEnd(): RangeSelection;
    replace(node: LexicalNode): LexicalNode;
  }
}

declare module '@lexical/link' {
  interface LinkNode {
    append(...nodes: LexicalNode[]): this;
  }
}
