import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext';
import { $getSelection, $isRangeSelection } from 'lexical';
import { $patchStyleText } from '@lexical/selection';
import { Button } from '@/components/ui/button';
import { RotateCcw } from 'lucide-react';

export function ClearFormattingPlugin() {
  const [editor] = useLexicalComposerContext();

  const clearFormatting = () => {
    editor.update(() => {
      const selection = $getSelection();
      if ($isRangeSelection(selection)) {
        // Clear all text formatting
        selection.formatText(null);
        
        // Clear all style properties
        $patchStyleText(selection, {
          color: '',
          'background-color': '',
          'font-size': '',
          'font-family': '',
          'text-align': '',
        });
      }
    });
  };

  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={clearFormatting}
      className="h-8 w-8 p-0"
      title="Clear Formatting"
    >
      <RotateCcw className="h-4 w-4" />
    </Button>
  );
}