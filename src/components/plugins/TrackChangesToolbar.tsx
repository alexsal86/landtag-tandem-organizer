/**
 * TrackChangesToolbar – Banner for review mode + accept/reject controls.
 */

import { useState, useCallback, useEffect } from 'react';
import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext';
import { $getRoot, type LexicalNode } from 'lexical';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { CheckCircle, XCircle, Eye } from 'lucide-react';
import {
  $isTrackInsertNode,
  $isTrackDeleteNode,
} from '../nodes/TrackChangeNode';

interface TrackChangesToolbarProps {
  /** True when the reviewer is actively editing */
  isReviewMode: boolean;
  /** True when the creator can accept/reject changes (revision_requested status) */
  showAcceptReject: boolean;
}

export function TrackChangesToolbar({ isReviewMode, showAcceptReject }: TrackChangesToolbarProps) {
  const [editor] = useLexicalComposerContext();
  const [changeCount, setChangeCount] = useState(0);

  // Count track change nodes
  const countChanges = useCallback(() => {
    editor.getEditorState().read(() => {
      let count = 0;
      const root = $getRoot();
      const iterate = (node: LexicalNode) => {
        if ($isTrackInsertNode(node) || $isTrackDeleteNode(node)) {
          count++;
        }
        if ('getChildren' in node && typeof (node as unknown as { getChildren: () => LexicalNode[] }).getChildren === 'function') {
          (node as unknown as { getChildren: () => LexicalNode[] }).getChildren().forEach(iterate);
        }
      };
      iterate(root);
      setChangeCount(count);
    });
  }, [editor]);

  useEffect(() => {
    countChanges();
    return editor.registerUpdateListener(() => countChanges());
  }, [editor, countChanges]);

  const acceptAll = useCallback(() => {
    editor.update(() => {
      const root = $getRoot();
      const processNode = (node: LexicalNode) => {
        // Process children first (depth-first)
        if (typeof (node as { getChildren?: () => LexicalNode[] }).getChildren === 'function') {
          [...(node as { getChildren: () => LexicalNode[] }).getChildren()].forEach(processNode);
        }

        if ($isTrackInsertNode(node)) {
          // Keep inserted text: unwrap children
          const children = node.getChildren();
          for (const child of children) {
            node.insertBefore(child);
          }
          node.remove();
        } else if ($isTrackDeleteNode(node)) {
          // Remove deleted text entirely
          node.remove();
        }
      };
      processNode(root);
    });
  }, [editor]);

  const rejectAll = useCallback(() => {
    editor.update(() => {
      const root = $getRoot();
      const processNode = (node: LexicalNode) => {
        if (typeof (node as { getChildren?: () => LexicalNode[] }).getChildren === 'function') {
          [...(node as { getChildren: () => LexicalNode[] }).getChildren()].forEach(processNode);
        }

        if ($isTrackInsertNode(node)) {
          // Reject insertion: remove the node and its children
          node.remove();
        } else if ($isTrackDeleteNode(node)) {
          // Reject deletion: keep the text, unwrap
          const children = node.getChildren();
          for (const child of children) {
            node.insertBefore(child);
          }
          node.remove();
        }
      };
      processNode(root);
    });
  }, [editor]);

  if (!isReviewMode && !showAcceptReject) return null;
  if (changeCount === 0 && isReviewMode) {
    return (
      <div className="flex items-center gap-2 px-3 py-1.5 bg-blue-50 dark:bg-blue-950/30 border-b text-xs text-blue-700 dark:text-blue-300">
        <Eye className="h-3.5 w-3.5" />
        <span>Prüfmodus aktiv – Änderungen werden nachverfolgt</span>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2 px-3 py-1.5 bg-blue-50 dark:bg-blue-950/30 border-b text-xs">
      <Eye className="h-3.5 w-3.5 text-blue-600" />
      {isReviewMode && (
        <span className="text-blue-700 dark:text-blue-300">
          Prüfmodus aktiv – Änderungen werden nachverfolgt
        </span>
      )}
      {changeCount > 0 && (
        <Badge variant="secondary" className="text-xs h-5">
          {changeCount} {changeCount === 1 ? 'Änderung' : 'Änderungen'}
        </Badge>
      )}
      {showAcceptReject && changeCount > 0 && (
        <>
          <div className="flex-1" />
          <Button variant="outline" size="sm" className="h-6 text-xs gap-1" onClick={acceptAll}>
            <CheckCircle className="h-3 w-3 text-green-600" />
            Alle annehmen
          </Button>
          <Button variant="outline" size="sm" className="h-6 text-xs gap-1" onClick={rejectAll}>
            <XCircle className="h-3 w-3 text-red-600" />
            Alle ablehnen
          </Button>
        </>
      )}
    </div>
  );
}
