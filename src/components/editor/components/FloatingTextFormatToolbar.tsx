import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext';
import { $getSelection, $isRangeSelection, FORMAT_TEXT_COMMAND, TextFormatType } from 'lexical';
import { Button } from '@/components/ui/button';
import { Bold, Italic, Underline, Strikethrough, Subscript, Superscript, Code } from 'lucide-react';

interface FloatingTextFormatToolbarProps {
  isBold: boolean;
  isCode: boolean;
  isItalic: boolean;
  isStrikethrough: boolean;
  isSubscript: boolean;
  isSuperscript: boolean;
  isUnderline: boolean;
}

export function FloatingTextFormatToolbar({
  isBold,
  isCode,
  isItalic,
  isStrikethrough,
  isSubscript,
  isSuperscript,
  isUnderline,
}: FloatingTextFormatToolbarProps): JSX.Element {
  const [editor] = useLexicalComposerContext();

  const applyStyleText = (format: TextFormatType) => {
    editor.dispatchCommand(FORMAT_TEXT_COMMAND, format);
  };

  return (
    <div className="flex items-center gap-1 p-1">
      <Button
        variant={isBold ? 'default' : 'ghost'}
        size="sm"
        onClick={() => applyStyleText('bold')}
        className="h-8 w-8 p-0"
      >
        <Bold className="h-4 w-4" />
      </Button>
      <Button
        variant={isItalic ? 'default' : 'ghost'}
        size="sm"
        onClick={() => applyStyleText('italic')}
        className="h-8 w-8 p-0"
      >
        <Italic className="h-4 w-4" />
      </Button>
      <Button
        variant={isUnderline ? 'default' : 'ghost'}
        size="sm"
        onClick={() => applyStyleText('underline')}
        className="h-8 w-8 p-0"
      >
        <Underline className="h-4 w-4" />
      </Button>
      <Button
        variant={isStrikethrough ? 'default' : 'ghost'}
        size="sm"
        onClick={() => applyStyleText('strikethrough')}
        className="h-8 w-8 p-0"
      >
        <Strikethrough className="h-4 w-4" />
      </Button>
      <Button
        variant={isCode ? 'default' : 'ghost'}
        size="sm"
        onClick={() => applyStyleText('code')}
        className="h-8 w-8 p-0"
      >
        <Code className="h-4 w-4" />
      </Button>
      <Button
        variant={isSubscript ? 'default' : 'ghost'}
        size="sm"
        onClick={() => applyStyleText('subscript')}
        className="h-8 w-8 p-0"
      >
        <Subscript className="h-4 w-4" />
      </Button>
      <Button
        variant={isSuperscript ? 'default' : 'ghost'}
        size="sm"
        onClick={() => applyStyleText('superscript')}
        className="h-8 w-8 p-0"
      >
        <Superscript className="h-4 w-4" />
      </Button>
    </div>
  );
}