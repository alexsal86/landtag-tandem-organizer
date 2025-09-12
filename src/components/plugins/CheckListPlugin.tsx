import React from 'react';
import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext';
import { $getSelection, $isRangeSelection, $createTextNode } from 'lexical';

export function CheckListPlugin() {
  const [editor] = useLexicalComposerContext();

  const insertCheckList = () => {
    editor.update(() => {
      const selection = $getSelection();
      if ($isRangeSelection(selection)) {
        const checkboxText = $createTextNode('☐ ');
        selection.insertNodes([checkboxText]);
      }
    });
  };

  return null; // Plugin provides functionality, no UI
}