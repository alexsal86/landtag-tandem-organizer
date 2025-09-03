import { HeadingNode, QuoteNode } from '@lexical/rich-text';
import { ListNode, ListItemNode } from '@lexical/list';
import { AutoLinkNode, LinkNode } from '@lexical/link';
import { CodeNode, CodeHighlightNode } from '@lexical/code';
import { TableNode, TableCellNode, TableRowNode } from '@lexical/table';

export const editorNodes = [
  HeadingNode,
  QuoteNode,
  ListNode,
  ListItemNode,
  LinkNode,
  AutoLinkNode,
  CodeNode,
  CodeHighlightNode,
  TableNode,
  TableCellNode,
  TableRowNode,
];