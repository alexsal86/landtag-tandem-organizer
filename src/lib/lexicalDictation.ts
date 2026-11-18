import {
  $findMatchingParent,
  $isBlockElementNode,
  $isElementNode,
  $isRootOrShadowRoot,
  $isTextNode,
  type LexicalNode,
  type RangeSelection,
} from 'lexical';
import { findLastDictatedSentenceStart, type SpeechCommand } from './speechCommandUtils';

export function $editDictationBlock(
  selection: RangeSelection,
  command: Extract<SpeechCommand, { type: 'delete-last-word' | 'delete-last-sentence' | 'select-last-sentence' | 'replace-text' }>,
) {
  const anchor = selection.isBackward() ? selection.focus : selection.anchor;
  const block = $findMatchingParent(anchor.getNode(), $isBlockElementNode);
  if (!block || !$isElementNode(block) || $isRootOrShadowRoot(block)) return;

  let text = '';
  let cursor = 0;
  const leaves: { node: LexicalNode; start: number; end: number }[] = [];
  const collectText = (node: LexicalNode) => {
    if ($isElementNode(node)) {
      const children = node.getChildren();
      for (const [index, child] of children.entries()) {
        if (node.getKey() === anchor.key && index === anchor.offset) cursor = text.length;
        collectText(child);
      }
      if (node.getKey() === anchor.key && anchor.offset === children.length) cursor = text.length;
      return;
    }

    const start = text.length;
    if (node.getKey() === anchor.key) cursor = start + anchor.offset;
    text += node.getTextContent();
    if (text.length > start) leaves.push({ node, start, end: text.length });
  };
  collectText(block);

  let start: number;
  let end: number;
  if (command.type === 'replace-text') {
    const escapedSearch = command.search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const match = new RegExp(escapedSearch, 'iu').exec(text);
    if (!match?.[0]) return;
    start = match.index;
    end = start + match[0].length;
  } else {
    end = cursor;
    const beforeCursor = text.slice(0, cursor).trimEnd();
    if (!beforeCursor) return;
    if (command.type === 'select-last-sentence') end = beforeCursor.length;
    if (command.type === 'delete-last-word') {
      start = beforeCursor.search(/\S+$/);
    } else {
      start = findLastDictatedSentenceStart(beforeCursor);
    }
  }

  const first = leaves.find(leaf => leaf.start <= start && start < leaf.end);
  const last = leaves.find(leaf => leaf.start < end && end <= leaf.end);
  if (!first || !last) return;

  const setPoint = (point: RangeSelection['anchor'], leaf: typeof first, offset: number) => {
    const { node } = leaf;
    if ($isTextNode(node)) {
      point.set(node.getKey(), offset - leaf.start, 'text');
    } else {
      point.set(node.getParentOrThrow().getKey(), node.getIndexWithinParent() + Number(offset > leaf.start), 'element');
    }
  };
  setPoint(selection.anchor, first, start);
  setPoint(selection.focus, last, end);
  if (command.type === 'replace-text') {
    selection.insertText(command.replacement);
  } else if (command.type !== 'select-last-sentence') {
    selection.removeText();
  }
}
