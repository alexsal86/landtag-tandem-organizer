import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext';
import { $getSelection, $isRangeSelection, COMMAND_PRIORITY_LOW } from 'lexical';
import { mergeRegister } from '@lexical/utils';
import { useEffect } from 'react';
import { $createCollapsibleNode, CollapsibleNode } from '../nodes/CollapsibleNode';

import { createCommand, LexicalCommand } from 'lexical';

export const INSERT_COLLAPSIBLE_COMMAND: LexicalCommand<{ title?: string; isOpen?: boolean }> = createCommand();

export function CollapsiblePlugin(): JSX.Element | null {
  const [editor] = useLexicalComposerContext();

  useEffect(() => {
    if (!editor.hasNodes([CollapsibleNode])) {
      throw new Error('CollapsiblePlugin: CollapsibleNode not registered on editor');
    }

    return mergeRegister(
      editor.registerCommand(
        INSERT_COLLAPSIBLE_COMMAND,
        (payload: { title?: string; isOpen?: boolean }) => {
          const { title = 'Collapsible Section', isOpen = false } = payload;
          const collapsibleNode = $createCollapsibleNode(title, isOpen);
          
          const selection = $getSelection();
          if ($isRangeSelection(selection)) {
            selection.insertNodes([collapsibleNode]);
          }
          
          return true;
        },
        COMMAND_PRIORITY_LOW,
      ),
    );
  }, [editor]);

  return null;
}