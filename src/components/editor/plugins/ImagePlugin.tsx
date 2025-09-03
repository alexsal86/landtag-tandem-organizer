import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext';
import { $getSelection, $isRangeSelection, COMMAND_PRIORITY_LOW } from 'lexical';
import { mergeRegister } from '@lexical/utils';
import { useEffect } from 'react';
import { $createImageNode, ImageNode } from '../nodes/ImageNode';

import { createCommand, LexicalCommand } from 'lexical';

export const INSERT_IMAGE_COMMAND: LexicalCommand<{ src: string; alt: string; width?: number; height?: number }> = createCommand();

export function ImagePlugin(): JSX.Element | null {
  const [editor] = useLexicalComposerContext();

  useEffect(() => {
    if (!editor.hasNodes([ImageNode])) {
      throw new Error('ImagePlugin: ImageNode not registered on editor');
    }

    return mergeRegister(
      editor.registerCommand(
        INSERT_IMAGE_COMMAND,
        (payload: { src: string; alt: string; width?: number; height?: number }) => {
          const { src, alt, width, height } = payload;
          const imageNode = $createImageNode(src, alt, width, height);
          
          const selection = $getSelection();
          if ($isRangeSelection(selection)) {
            selection.insertNodes([imageNode]);
          }
          
          return true;
        },
        COMMAND_PRIORITY_LOW,
      ),
    );
  }, [editor]);

  return null;
}