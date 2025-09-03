import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext';
import { $getSelection, $isRangeSelection, COMMAND_PRIORITY_LOW } from 'lexical';
import { mergeRegister } from '@lexical/utils';
import { useEffect } from 'react';
import { $createEquationNode, EquationNode } from '../nodes/EquationNode';

import { createCommand, LexicalCommand } from 'lexical';

export const INSERT_EQUATION_COMMAND: LexicalCommand<{ equation: string; inline?: boolean }> = createCommand();

export function EquationPlugin(): JSX.Element | null {
  const [editor] = useLexicalComposerContext();

  useEffect(() => {
    if (!editor.hasNodes([EquationNode])) {
      throw new Error('EquationPlugin: EquationNode not registered on editor');
    }

    return mergeRegister(
      editor.registerCommand(
        INSERT_EQUATION_COMMAND,
        (payload: { equation: string; inline?: boolean }) => {
          const { equation, inline = false } = payload;
          const equationNode = $createEquationNode(equation, inline);
          
          const selection = $getSelection();
          if ($isRangeSelection(selection)) {
            selection.insertNodes([equationNode]);
          }
          
          return true;
        },
        COMMAND_PRIORITY_LOW,
      ),
    );
  }, [editor]);

  return null;
}