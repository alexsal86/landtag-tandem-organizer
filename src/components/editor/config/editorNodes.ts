import { HeadingNode, QuoteNode } from '@lexical/rich-text';
import { ListNode, ListItemNode } from '@lexical/list';
import { AutoLinkNode, LinkNode } from '@lexical/link';
import { CodeNode, CodeHighlightNode } from '@lexical/code';
import { TableNode, TableCellNode, TableRowNode } from '@lexical/table';
import { HashtagNode } from '@lexical/hashtag';
import { HorizontalRuleNode } from '@lexical/react/LexicalHorizontalRuleNode';
import { EquationNode } from '../nodes/EquationNode';
import { ImageNode } from '../nodes/ImageNode';
import { CollapsibleNode } from '../nodes/CollapsibleNode';

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
  HashtagNode,
  HorizontalRuleNode,
  EquationNode,
  ImageNode,
  CollapsibleNode,
];