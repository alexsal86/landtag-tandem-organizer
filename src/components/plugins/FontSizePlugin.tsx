import React, { useState, useCallback, useEffect } from 'react';
import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext';
import {
  $getSelection,
  $isRangeSelection,
  SELECTION_CHANGE_COMMAND,
  COMMAND_PRIORITY_CRITICAL,
  $isTextNode
} from 'lexical';
import { $patchStyleText } from '@lexical/selection';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Type, ChevronDown } from 'lucide-react';

const FONT_SIZE_OPTIONS = [
  { label: '8', value: '8pt' },
  { label: '9', value: '9pt' },
  { label: '10', value: '10pt' },
  { label: '11', value: '11pt' },
  { label: '12', value: '12pt' },
  { label: '14', value: '14pt' },
  { label: '16', value: '16pt' },
  { label: '18', value: '18pt' },
  { label: '20', value: '20pt' },
  { label: '24', value: '24pt' },
  { label: '28', value: '28pt' },
  { label: '32', value: '32pt' },
  { label: '36', value: '36pt' },
  { label: '48', value: '48pt' },
];

/** Extract a readable display label from a font-size value (e.g. "11pt" → "11") */
const toDisplayLabel = (value: string): string => {
  const m = value.match(/^([\d.]+)/);
  return m ? m[1] : value;
};

interface FontSizePluginProps {
  disabled?: boolean;
  /** Default font size used when no explicit style is set on a node (e.g. "11pt") */
  defaultFontSize?: string;
}

export function FontSizePlugin({ disabled = false, defaultFontSize = '11pt' }: FontSizePluginProps) {
  const [editor] = useLexicalComposerContext();
  const [fontSize, setFontSize] = useState<string>(defaultFontSize);
  const [customSize, setCustomSize] = useState<string>('');
  const [isCustomInputVisible, setIsCustomInputVisible] = useState<boolean>(false);

  // Keep default in sync when prop changes
  useEffect(() => {
    setFontSize(prev => {
      // Only update if the current value was the old default (i.e. user hasn't changed it)
      return prev === defaultFontSize ? prev : prev;
    });
  }, [defaultFontSize]);

  const updateFontSizeInSelection = useCallback((newFontSize: string) => {
    editor.update(() => {
      const selection = $getSelection();
      if ($isRangeSelection(selection)) {
        $patchStyleText(selection, {
          'font-size': newFontSize,
        });
      }
    });
  }, [editor]);

  const updateFontSize = useCallback(() => {
    editor.getEditorState().read(() => {
      const selection = $getSelection();
      if ($isRangeSelection(selection)) {
        const nodes = selection.getNodes();
        
        if (nodes.length === 0) {
          setFontSize(defaultFontSize);
          return;
        }

        const firstNode = nodes[0];
        if ($isTextNode(firstNode)) {
          const style = firstNode.getStyle();
          const fontSizeMatch = style.match(/font-size:\s*([^;]+)/);
          if (fontSizeMatch) {
            setFontSize(fontSizeMatch[1].trim());
          } else {
            // No explicit font-size → use template default
            setFontSize(defaultFontSize);
          }
        } else {
          setFontSize(defaultFontSize);
        }
      }
    });
  }, [editor, defaultFontSize]);

  useEffect(() => {
    return editor.registerCommand(
      SELECTION_CHANGE_COMMAND,
      () => {
        updateFontSize();
        return false;
      },
      COMMAND_PRIORITY_CRITICAL,
    );
  }, [editor, updateFontSize]);

  const handleFontSizeChange = useCallback((newFontSize: string) => {
    if (newFontSize === 'custom') {
      setIsCustomInputVisible(true);
      return;
    }
    
    setFontSize(newFontSize);
    updateFontSizeInSelection(newFontSize);
    setIsCustomInputVisible(false);
  }, [updateFontSizeInSelection]);

  const handleCustomSizeApply = useCallback(() => {
    if (!customSize) return;
    // Accept plain numbers as pt, or explicit units
    let value = customSize.trim();
    if (/^\d+(\.\d+)?$/.test(value)) {
      value = value + 'pt';
    }
    if (value.match(/^\d+(?:\.\d+)?(?:px|pt|em|rem|%)$/)) {
      setFontSize(value);
      updateFontSizeInSelection(value);
      setIsCustomInputVisible(false);
      setCustomSize('');
    }
  }, [customSize, updateFontSizeInSelection]);

  const handleCustomSizeKeyDown = useCallback((event: React.KeyboardEvent) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      handleCustomSizeApply();
    } else if (event.key === 'Escape') {
      setIsCustomInputVisible(false);
      setCustomSize('');
    }
  }, [handleCustomSizeApply]);

  return (
    <div className="flex items-center gap-1">
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="sm"
            disabled={disabled}
            className="h-8 min-w-[70px] justify-between px-2"
          >
            <div className="flex items-center gap-1">
              <Type className="h-4 w-4" />
              <span className="text-xs">{toDisplayLabel(fontSize)} pt</span>
            </div>
            <ChevronDown className="h-3 w-3" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent className="w-28 max-h-64 overflow-y-auto">
          {FONT_SIZE_OPTIONS.map((option) => (
            <DropdownMenuItem
              key={option.value}
              onClick={() => handleFontSizeChange(option.value)}
              className={fontSize === option.value ? 'bg-accent' : ''}
            >
              {option.label} pt
            </DropdownMenuItem>
          ))}
          <DropdownMenuItem
            onClick={() => handleFontSizeChange('custom')}
            className="border-t"
          >
            <span className="text-xs">Benutzerdefiniert...</span>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      {isCustomInputVisible && (
        <div className="flex items-center gap-1 ml-2">
          <Input
            type="text"
            placeholder="z.B. 12"
            value={customSize}
            onChange={(e) => setCustomSize(e.target.value)}
            onKeyDown={handleCustomSizeKeyDown}
            className="h-8 w-16 text-xs"
            autoFocus
          />
          <span className="text-xs text-muted-foreground">pt</span>
          <Button
            size="sm"
            onClick={handleCustomSizeApply}
            className="h-8 px-2 text-xs"
          >
            OK
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => {
              setIsCustomInputVisible(false);
              setCustomSize('');
            }}
            className="h-8 px-2 text-xs"
          >
            ✕
          </Button>
        </div>
      )}
    </div>
  );
}

export default FontSizePlugin;
