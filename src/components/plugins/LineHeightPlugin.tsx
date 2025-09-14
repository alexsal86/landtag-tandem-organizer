import React, { useState, useCallback, useEffect } from 'react';
import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext';
import { $getSelection, $isRangeSelection, SELECTION_CHANGE_COMMAND, COMMAND_PRIORITY_NORMAL } from 'lexical';
import { $patchStyleText } from '@lexical/selection';
import { $findMatchingParent } from '@lexical/utils';
import { $isElementNode } from 'lexical';
import { mergeRegister } from '@lexical/utils';
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { LineChart } from 'lucide-react';

const LINE_HEIGHT_OPTIONS = [
  { label: 'Normal', value: 'normal' },
  { label: '1.0', value: '1.0' },
  { label: '1.15', value: '1.15' },
  { label: '1.25', value: '1.25' },
  { label: '1.5', value: '1.5' },
  { label: '1.75', value: '1.75' },
  { label: '2.0', value: '2.0' },
  { label: '2.5', value: '2.5' },
  { label: '3.0', value: '3.0' },
];

interface LineHeightPluginProps {
  disabled?: boolean;
}

export function LineHeightPlugin({ disabled = false }: LineHeightPluginProps) {
  const [editor] = useLexicalComposerContext();
  const [currentLineHeight, setCurrentLineHeight] = useState('normal');

  const updateLineHeightInSelection = useCallback(
    (lineHeight: string) => {
      editor.update(() => {
        const selection = $getSelection();
        if ($isRangeSelection(selection)) {
          $patchStyleText(selection, { 'line-height': lineHeight });
        }
      });
    },
    [editor]
  );

  const handleLineHeightChange = useCallback(
    (lineHeight: string) => {
      updateLineHeightInSelection(lineHeight);
      setCurrentLineHeight(lineHeight);
    },
    [updateLineHeightInSelection]
  );

  const getCurrentLineHeightLabel = () => {
    const option = LINE_HEIGHT_OPTIONS.find(opt => opt.value === currentLineHeight);
    return option ? option.label : 'Benutzerdefiniert';
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          disabled={disabled}
          className="flex items-center gap-1 px-2"
          title={`Zeilenhöhe: ${getCurrentLineHeightLabel()}`}
        >
          <LineChart className="h-4 w-4" />
          <span className="text-xs">{getCurrentLineHeightLabel()}</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start">
        {LINE_HEIGHT_OPTIONS.map((option) => (
          <DropdownMenuItem
            key={option.value}
            onClick={() => handleLineHeightChange(option.value)}
            className={`${
              currentLineHeight === option.value ? 'bg-accent' : ''
            }`}
          >
            {option.label}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}