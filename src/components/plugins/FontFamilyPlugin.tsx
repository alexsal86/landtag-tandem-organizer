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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Type, ChevronDown } from 'lucide-react';

const FONT_FAMILY_OPTIONS = [
  { label: 'Arial', value: 'Arial, sans-serif' },
  { label: 'Times New Roman', value: 'Times New Roman, serif' },
  { label: 'Helvetica', value: 'Helvetica, sans-serif' },
  { label: 'Georgia', value: 'Georgia, serif' },
  { label: 'Verdana', value: 'Verdana, sans-serif' },
  { label: 'Courier New', value: 'Courier New, monospace' },
  { label: 'Trebuchet MS', value: 'Trebuchet MS, sans-serif' },
  { label: 'Palatino', value: 'Palatino, serif' },
  { label: 'Garamond', value: 'Garamond, serif' },
  { label: 'Bookman', value: 'Bookman, serif' },
  { label: 'Comic Sans MS', value: 'Comic Sans MS, cursive' },
  { label: 'Impact', value: 'Impact, sans-serif' },
  { label: 'Lucida Console', value: 'Lucida Console, monospace' },
  { label: 'Tahoma', value: 'Tahoma, sans-serif' },
  { label: 'Monaco', value: 'Monaco, monospace' },
  { label: 'System UI', value: 'system-ui, -apple-system, sans-serif' }
];

interface FontFamilyPluginProps {
  disabled?: boolean;
}

export function FontFamilyPlugin({ disabled = false }: FontFamilyPluginProps) {
  const [editor] = useLexicalComposerContext();
  const [fontFamily, setFontFamily] = useState<string>('Arial, sans-serif');

  const updateFontFamilyInSelection = useCallback((newFontFamily: string) => {
    editor.update(() => {
      const selection = $getSelection();
      if ($isRangeSelection(selection)) {
        $patchStyleText(selection, {
          'font-family': newFontFamily,
        });
      }
    });
  }, [editor]);

  const updateFontFamily = useCallback(() => {
    editor.getEditorState().read(() => {
      const selection = $getSelection();
      if ($isRangeSelection(selection)) {
        const nodes = selection.getNodes();
        
        if (nodes.length === 0) {
          setFontFamily('Arial, sans-serif');
          return;
        }

        // Get font family from first text node
        const firstNode = nodes[0];
        if ($isTextNode(firstNode)) {
          const style = firstNode.getStyle();
          const fontFamilyMatch = style.match(/font-family:\s*([^;]+)/);
          if (fontFamilyMatch) {
            setFontFamily(fontFamilyMatch[1].trim().replace(/['"]/g, ''));
          } else {
            setFontFamily('Arial, sans-serif');
          }
        } else {
          setFontFamily('Arial, sans-serif');
        }
      }
    });
  }, [editor]);

  useEffect(() => {
    return editor.registerCommand(
      SELECTION_CHANGE_COMMAND,
      () => {
        updateFontFamily();
        return false;
      },
      COMMAND_PRIORITY_CRITICAL,
    );
  }, [editor, updateFontFamily]);

  const handleFontFamilyChange = useCallback((newFontFamily: string) => {
    setFontFamily(newFontFamily);
    updateFontFamilyInSelection(newFontFamily);
  }, [updateFontFamilyInSelection]);

  const getCurrentFontLabel = () => {
    const option = FONT_FAMILY_OPTIONS.find(opt => 
      opt.value.toLowerCase().includes(fontFamily.toLowerCase().split(',')[0])
    );
    return option ? option.label : fontFamily.split(',')[0];
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          disabled={disabled}
          className="h-8 min-w-[120px] justify-between px-2"
        >
          <div className="flex items-center gap-1">
            <Type className="h-4 w-4" />
            <span className="text-xs truncate max-w-[80px]">
              {getCurrentFontLabel()}
            </span>
          </div>
          <ChevronDown className="h-3 w-3 flex-shrink-0" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-48 max-h-64 overflow-y-auto">
        {FONT_FAMILY_OPTIONS.map((option) => (
          <DropdownMenuItem
            key={option.value}
            onClick={() => handleFontFamilyChange(option.value)}
            className={fontFamily.toLowerCase().includes(option.value.toLowerCase().split(',')[0]) ? 'bg-accent' : ''}
          >
            <span style={{ fontFamily: option.value }} className="truncate">
              {option.label}
            </span>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export default FontFamilyPlugin;