import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext';
import { HorizontalRuleNode } from '@lexical/react/LexicalHorizontalRuleNode';
import { INSERT_HORIZONTAL_RULE_COMMAND } from '@lexical/react/LexicalHorizontalRuleNode';
import { useEffect } from 'react';
import { $getSelection, $isRangeSelection } from 'lexical';

export function HorizontalRulePlugin(): JSX.Element | null {
  const [editor] = useLexicalComposerContext();

  useEffect(() => {
    if (!editor.hasNodes([HorizontalRuleNode])) {
      throw new Error('HorizontalRulePlugin: HorizontalRuleNode not registered on editor');
    }

    return editor.registerCommand(
      INSERT_HORIZONTAL_RULE_COMMAND,
      () => {
        editor.update(() => {
          const selection = $getSelection();
          if ($isRangeSelection(selection)) {
            selection.insertNodes([new HorizontalRuleNode()]);
          }
        });
        return true;
      },
      4, // COMMAND_PRIORITY_CRITICAL
    );
  }, [editor]);

  return null;
}