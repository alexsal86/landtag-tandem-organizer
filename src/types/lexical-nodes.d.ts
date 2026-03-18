// Lexical node type compatibility shim for version 0.40.0
// Fixes type mismatches when Lexical sub-packages resolve slightly different base types.

import 'lexical';
import '@lexical/rich-text';
import '@lexical/code';
import '@lexical/link';

declare module '@lexical/rich-text' {
  interface HeadingNode {
    selectEnd(): any;
    replace(node: any): any;
  }
  interface QuoteNode {
    selectEnd(): any;
    replace(node: any): any;
  }
}

declare module '@lexical/code' {
  interface CodeNode {
    selectEnd(): any;
    replace(node: any): any;
  }
}

declare module '@lexical/link' {
  interface LinkNode {
    append(...nodes: any[]): this;
  }
}
