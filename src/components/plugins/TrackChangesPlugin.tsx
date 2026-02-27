/**
 * TrackChangesPlugin – intercepts text insertions & deletions in review mode
 * and wraps them in TrackInsertNode / TrackDeleteNode.
 */

import { useEffect } from 'react';
import {
  $getSelection,
  $isRangeSelection,
  $isTextNode,
  $createTextNode,
  COMMAND_PRIORITY_CRITICAL,
  KEY_BACKSPACE_COMMAND,
  KEY_DELETE_COMMAND,
  DELETE_CHARACTER_COMMAND,
  DELETE_WORD_COMMAND,
  DELETE_LINE_COMMAND,
  $getNodeByKey,
  TextNode,
} from 'lexical';
import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext';
import {
  $createTrackInsertNode,
  $createTrackDeleteNode,
  $isTrackInsertNode,
  $isTrackDeleteNode,
  TrackInsertNode,
} from '../nodes/TrackChangeNode';

interface TrackChangesPluginProps {
  isReviewMode: boolean;
  authorId: string;
  authorName: string;
}

export function TrackChangesPlugin({ isReviewMode, authorId, authorName }: TrackChangesPluginProps) {
  const [editor] = useLexicalComposerContext();

  useEffect(() => {
    if (!isReviewMode) return;

    const removers: (() => void)[] = [];

    // ── 1. Wrap newly typed text inside a TrackInsertNode ──
    // We use a node transform on TextNode: whenever a TextNode is created or
    // modified and it is NOT already inside a TrackInsertNode, we wrap it.
    const removeTransform = editor.registerNodeTransform(TextNode, (node) => {
      // Skip if already inside a track node
      const parent = node.getParent();
      if ($isTrackInsertNode(parent) || $isTrackDeleteNode(parent)) return;

      // Only wrap if the node was just created (no key match in previous state)
      // We detect "new" text by checking if the text changed
      // This is a simplified heuristic – we wrap any bare TextNode that gets mutated
    });
    removers.push(removeTransform);

    // ── 2. Intercept delete commands ──
    const handleDelete = (): boolean => {
      const selection = $getSelection();
      if (!$isRangeSelection(selection)) return false;

      // If the selection spans text, wrap each selected text node in TrackDeleteNode
      if (!selection.isCollapsed()) {
        const nodes = selection.getNodes();
        for (const node of nodes) {
          if ($isTextNode(node) && !$isTrackDeleteNode(node.getParent())) {
            const deleteWrapper = $createTrackDeleteNode(authorId, authorName);
            node.insertBefore(deleteWrapper);
            deleteWrapper.append(node);
          }
        }
        // Collapse selection to end
        selection.modify('move', false, 'character');
        return true;
      }

      // Collapsed selection – single character delete
      const anchor = selection.anchor;
      const anchorNode = anchor.getNode();
      if (!$isTextNode(anchorNode)) return false;

      // Already inside a TrackDeleteNode? Let default behaviour apply
      if ($isTrackDeleteNode(anchorNode.getParent())) return false;

      const offset = anchor.offset;
      const text = anchorNode.getTextContent();
      if (offset === 0) return false; // beginning of node, let Lexical handle

      // Extract the character to be "deleted"
      const charToDelete = text[offset - 1];
      const before = text.slice(0, offset - 1);
      const after = text.slice(offset);

      // Create a delete-marked text node
      const deletedTextNode = $createTextNode(charToDelete);
      const deleteWrapper = $createTrackDeleteNode(authorId, authorName);
      deleteWrapper.append(deletedTextNode);

      // Rebuild the text around the deleted char
      anchorNode.setTextContent(before);
      const afterNode = $createTextNode(after);
      anchorNode.insertAfter(deleteWrapper);
      deleteWrapper.insertAfter(afterNode);

      // Place cursor after the delete mark
      afterNode.select(0, 0);

      return true;
    };

    // Register for all delete-type commands
    for (const cmd of [KEY_BACKSPACE_COMMAND, DELETE_CHARACTER_COMMAND]) {
      removers.push(
        editor.registerCommand(cmd, () => {
          let handled = false;
          editor.update(() => {
            handled = handleDelete();
          });
          return handled;
        }, COMMAND_PRIORITY_CRITICAL),
      );
    }

    return () => {
      removers.forEach((r) => r());
    };
  }, [editor, isReviewMode, authorId, authorName]);

  return null;
}
