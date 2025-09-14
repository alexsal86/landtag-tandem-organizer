import React, { useState, useCallback, useEffect } from 'react';
import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext';
import {
  $getSelection,
  $isRangeSelection,
  SELECTION_CHANGE_COMMAND,
  COMMAND_PRIORITY_CRITICAL,
  $createTextNode,
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
  { label: '8px', value: '8px' },
  { label: '9px', value: '9px' },
  { label: '10px', value: '10px' },
  { label: '11px', value: '11px' },
  { label: '12px', value: '12px' },
  { label: '14px', value: '14px' },
  { label: '16px', value: '16px' },
  { label: '18px', value: '18px' },
  { label: '20px', value: '20px' },
  { label: '24px', value: '24px' },
  { label: '28px', value: '28px' },
  { label: '32px', value: '32px' },
  { label: '36px', value: '36px' },
  { label: '48px', value: '48px' },
  { label: '60px', value: '60px' },
  { label: '72px', value: '72px' }
];

interface FontSizePluginProps {
  disabled?: boolean;
}

export function FontSizePlugin({ disabled = false }: FontSizePluginProps) {
  const [editor] = useLexicalComposerContext();
  const [fontSize, setFontSize] = useState<string>('16px');
  const [customSize, setCustomSize] = useState<string>('');
  const [isCustomInputVisible, setIsCustomInputVisible] = useState<boolean>(false);

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
          setFontSize('16px');
          return;
        }

        // Get font size from first text node
        const firstNode = nodes[0];
        if ($isTextNode(firstNode)) {
          const style = firstNode.getStyle();
          const fontSizeMatch = style.match(/font-size:\s*([^;]+)/);
          if (fontSizeMatch) {
            setFontSize(fontSizeMatch[1].trim());
          } else {
            setFontSize('16px');
          }
        } else {
          setFontSize('16px');
        }
      }
    });
  }, [editor]);

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
    if (customSize && customSize.match(/^\d+(?:px|pt|em|rem|%)$/)) {
      setFontSize(customSize);
      updateFontSizeInSelection(customSize);
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
            className="h-8 min-w-[80px] justify-between px-2"
          >
            <div className="flex items-center gap-1">
              <Type className="h-4 w-4" />
              <span className="text-xs">{fontSize}</span>
            </div>
            <ChevronDown className="h-3 w-3" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent className="w-32 max-h-64 overflow-y-auto">
          {FONT_SIZE_OPTIONS.map((option) => (
            <DropdownMenuItem
              key={option.value}
              onClick={() => handleFontSizeChange(option.value)}
              className={fontSize === option.value ? 'bg-accent' : ''}
            >
              <span style={{ fontSize: option.value }}>{option.label}</span>
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
            placeholder="z.B. 20px"
            value={customSize}
            onChange={(e) => setCustomSize(e.target.value)}
            onKeyDown={handleCustomSizeKeyDown}
            className="h-8 w-20 text-xs"
            autoFocus
          />
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