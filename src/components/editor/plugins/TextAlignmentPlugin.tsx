import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext';
import { $getSelection, $isRangeSelection } from 'lexical';
import { $setBlocksType } from '@lexical/selection';
import { $createParagraphNode } from 'lexical';
import { useCallback, useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { AlignLeft, AlignCenter, AlignRight, AlignJustify } from 'lucide-react';

type AlignmentType = 'left' | 'center' | 'right' | 'justify';

export function TextAlignmentPlugin() {
  const [editor] = useLexicalComposerContext();
  const [alignment, setAlignment] = useState<AlignmentType>('left');

  const applyAlignment = useCallback(
    (alignType: AlignmentType) => {
      editor.update(() => {
        const selection = $getSelection();
        if ($isRangeSelection(selection)) {
          const nodes = selection.getNodes();
          nodes.forEach((node) => {
            const parent = node.getParent();
            if (parent) {
              const style = parent.getStyle();
              const newStyle = style.replace(/text-align:\s*[^;]+;?/g, '') + 
                              (alignType !== 'left' ? `text-align: ${alignType};` : '');
              parent.setStyle(newStyle.trim());
            }
          });
        }
      });
      setAlignment(alignType);
    },
    [editor]
  );

  const updateToolbar = useCallback(() => {
    const selection = $getSelection();
    if ($isRangeSelection(selection)) {
      const node = selection.getNodes()[0];
      const parent = node?.getParent();
      if (parent) {
        const style = parent.getStyle();
        const alignMatch = style.match(/text-align:\s*([^;]+)/);
        if (alignMatch) {
          setAlignment(alignMatch[1].trim() as AlignmentType);
        } else {
          setAlignment('left');
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
    <div className="flex items-center gap-1">
      <Button
        variant={alignment === 'left' ? 'default' : 'ghost'}
        size="sm"
        onClick={() => applyAlignment('left')}
        className="h-8 w-8 p-0"
      >
        <AlignLeft className="h-4 w-4" />
      </Button>
      <Button
        variant={alignment === 'center' ? 'default' : 'ghost'}
        size="sm"
        onClick={() => applyAlignment('center')}
        className="h-8 w-8 p-0"
      >
        <AlignCenter className="h-4 w-4" />
      </Button>
      <Button
        variant={alignment === 'right' ? 'default' : 'ghost'}
        size="sm"
        onClick={() => applyAlignment('right')}
        className="h-8 w-8 p-0"
      >
        <AlignRight className="h-4 w-4" />
      </Button>
      <Button
        variant={alignment === 'justify' ? 'default' : 'ghost'}
        size="sm"
        onClick={() => applyAlignment('justify')}
        className="h-8 w-8 p-0"
      >
        <AlignJustify className="h-4 w-4" />
      </Button>
    </div>
  );
}