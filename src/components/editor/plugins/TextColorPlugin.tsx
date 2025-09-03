import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext';
import { $getSelection, $isRangeSelection, $isTextNode } from 'lexical';
import { $patchStyleText } from '@lexical/selection';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { ColorPicker } from '../components/ColorPicker';
import { Paintbrush, Highlighter } from 'lucide-react';

export function TextColorPlugin() {
  const [editor] = useLexicalComposerContext();
  const [textColor, setTextColor] = useState('#000000');
  const [backgroundColor, setBackgroundColor] = useState('transparent');

  const updateTextColor = useCallback(
    (color: string) => {
      editor.update(() => {
        const selection = $getSelection();
        if ($isRangeSelection(selection)) {
          $patchStyleText(selection, {
            color: color,
          });
        }
      });
    },
    [editor]
  );

  const updateBackgroundColor = useCallback(
    (color: string) => {
      editor.update(() => {
        const selection = $getSelection();
        if ($isRangeSelection(selection)) {
          $patchStyleText(selection, {
            'background-color': color === 'transparent' ? '' : color,
          });
        }
      });
    },
    [editor]
  );

  const updateToolbar = useCallback(() => {
    const selection = $getSelection();
    if ($isRangeSelection(selection)) {
      const node = selection.getNodes()[0];
      if ($isTextNode(node)) {
        const style = node.getStyle();
        const colorMatch = style.match(/color:\s*([^;]+)/);
        const bgColorMatch = style.match(/background-color:\s*([^;]+)/);
        
        if (colorMatch) {
          setTextColor(colorMatch[1].trim());
        }
        if (bgColorMatch) {
          setBackgroundColor(bgColorMatch[1].trim());
        }
      }
    }
  }, []);

  useEffect(() => {
    return editor.registerUpdateListener(({ editorState }) => {
      editorState.read(() => {
        updateToolbar();
      });
    });
  }, [editor, updateToolbar]);

  return (
    <div className="flex items-center gap-2">
      <ColorPicker
        color={textColor}
        onColorChange={(color) => {
          setTextColor(color);
          updateTextColor(color);
        }}
        icon={<Paintbrush className="h-4 w-4" />}
        label="Text"
      />
      <ColorPicker
        color={backgroundColor}
        onColorChange={(color) => {
          setBackgroundColor(color);
          updateBackgroundColor(color);
        }}
        icon={<Highlighter className="h-4 w-4" />}
        label="Background"
      />
    </div>
  );
}