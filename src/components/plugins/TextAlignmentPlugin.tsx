import React, { useState, useCallback, useEffect } from 'react';
import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext';
import { 
  $getSelection, 
  $isRangeSelection, 
  SELECTION_CHANGE_COMMAND, 
  COMMAND_PRIORITY_NORMAL,
  FORMAT_ELEMENT_COMMAND,
  ElementFormatType
} from 'lexical';
import { mergeRegister } from '@lexical/utils';
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { AlignLeft, AlignCenter, AlignRight, AlignJustify } from 'lucide-react';

const ALIGNMENT_OPTIONS = [
  { label: 'Links', value: 'left', icon: AlignLeft },
  { label: 'Zentriert', value: 'center', icon: AlignCenter },
  { label: 'Rechts', value: 'right', icon: AlignRight },
  { label: 'Blocksatz', value: 'justify', icon: AlignJustify },
] as const;

interface TextAlignmentPluginProps {
  disabled?: boolean;
}

export function TextAlignmentPlugin({ disabled = false }: TextAlignmentPluginProps) {
  const [editor] = useLexicalComposerContext();
  const [currentAlignment, setCurrentAlignment] = useState<string>('left');

  const updateAlignment = useCallback(
    (alignment: ElementFormatType) => {
      editor.dispatchCommand(FORMAT_ELEMENT_COMMAND, alignment);
    },
    [editor]
  );

  const handleAlignmentChange = useCallback(
    (alignment: ElementFormatType) => {
      updateAlignment(alignment);
      setCurrentAlignment(alignment);
    },
    [updateAlignment]
  );

  const getCurrentAlignmentOption = () => {
    return ALIGNMENT_OPTIONS.find(option => option.value === currentAlignment) || ALIGNMENT_OPTIONS[0];
  };

  const currentOption = getCurrentAlignmentOption();
  const CurrentIcon = currentOption.icon;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          disabled={disabled}
          className="flex items-center gap-1 px-2"
          title={`Ausrichtung: ${currentOption.label}`}
        >
          <CurrentIcon className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start">
        {ALIGNMENT_OPTIONS.map((option) => {
          const IconComponent = option.icon;
          return (
            <DropdownMenuItem
              key={option.value}
              onClick={() => handleAlignmentChange(option.value as ElementFormatType)}
              className={`flex items-center gap-2 ${
                currentAlignment === option.value ? 'bg-accent' : ''
              }`}
            >
              <IconComponent className="h-4 w-4" />
              {option.label}
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}