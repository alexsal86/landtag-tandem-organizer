import React, { useState, useCallback, useEffect, useMemo } from 'react';
import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext';
import { $getSelection, $isRangeSelection, SELECTION_CHANGE_COMMAND, COMMAND_PRIORITY_NORMAL } from 'lexical';
import { $patchStyleText } from '@lexical/selection';
import { mergeRegister } from '@lexical/utils';
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Palette, Type, Highlighter } from 'lucide-react';

const TEXT_COLORS = [
  { label: 'Schwarz', value: '#000000' },
  { label: 'Dunkelgrau', value: '#374151' },
  { label: 'Grau', value: '#6B7280' },
  { label: 'Hellgrau', value: '#9CA3AF' },
  { label: 'Rot', value: '#EF4444' },
  { label: 'Orange', value: '#F97316' },
  { label: 'Gelb', value: '#EAB308' },
  { label: 'Grün', value: '#22C55E' },
  { label: 'Blau', value: '#3B82F6' },
  { label: 'Indigo', value: '#6366F1' },
  { label: 'Lila', value: '#A855F7' },
  { label: 'Rosa', value: '#EC4899' },
];

const BACKGROUND_COLORS = [
  { label: 'Transparent', value: 'transparent' },
  { label: 'Hellgrau', value: '#F3F4F6' },
  { label: 'Hellrot', value: '#FEF2F2' },
  { label: 'Hellorange', value: '#FFF7ED' },
  { label: 'Hellgelb', value: '#FEFCE8' },
  { label: 'Hellgrün', value: '#F0FDF4' },
  { label: 'Hellblau', value: '#EFF6FF' },
  { label: 'Hellindigo', value: '#EEF2FF' },
  { label: 'Helllila', value: '#FAF5FF' },
  { label: 'Hellrosa', value: '#FDF2F8' },
];

interface TextColorPluginProps {
  disabled?: boolean;
}

export function TextColorPlugin({ disabled = false }: TextColorPluginProps) {
  const [editor] = useLexicalComposerContext();
  const [currentTextColor, setCurrentTextColor] = useState('#000000');
  const [currentBackgroundColor, setCurrentBackgroundColor] = useState('transparent');

  const updateTextColorInSelection = useCallback(
    (color: string) => {
      editor.update(() => {
        const selection = $getSelection();
        if ($isRangeSelection(selection)) {
          $patchStyleText(selection, { color });
        }
      });
    },
    [editor]
  );

  const updateBackgroundColorInSelection = useCallback(
    (backgroundColor: string) => {
      editor.update(() => {
        const selection = $getSelection();
        if ($isRangeSelection(selection)) {
          $patchStyleText(selection, { 'background-color': backgroundColor });
        }
      });
    },
    [editor]
  );

  const updateCurrentColors = useCallback(() => {
    editor.getEditorState().read(() => {
      const selection = $getSelection();
      if ($isRangeSelection(selection)) {
        const node = selection.anchor.getNode();
        const style = node.getStyle();
        
        // Extract color and background-color from style
        const colorMatch = style.match(/color:\s*([^;]+)/);
        const bgColorMatch = style.match(/background-color:\s*([^;]+)/);
        
        if (colorMatch) {
          setCurrentTextColor(colorMatch[1].trim());
        } else {
          setCurrentTextColor('#000000');
        }
        
        if (bgColorMatch) {
          setCurrentBackgroundColor(bgColorMatch[1].trim());
        } else {
          setCurrentBackgroundColor('transparent');
        }
      }
    });
  }, [editor]);

  useEffect(() => {
    return mergeRegister(
      editor.registerCommand(
        SELECTION_CHANGE_COMMAND,
        () => {
          updateCurrentColors();
          return false;
        },
        COMMAND_PRIORITY_NORMAL
      )
    );
  }, [editor, updateCurrentColors]);

  const handleTextColorChange = useCallback(
    (color: string) => {
      updateTextColorInSelection(color);
      setCurrentTextColor(color);
    },
    [updateTextColorInSelection]
  );

  const handleBackgroundColorChange = useCallback(
    (color: string) => {
      updateBackgroundColorInSelection(color);
      setCurrentBackgroundColor(color);
    },
    [updateBackgroundColorInSelection]
  );

  const getCurrentTextColorLabel = useMemo(() => {
    const colorOption = TEXT_COLORS.find(option => option.value === currentTextColor);
    return colorOption ? colorOption.label : 'Benutzerdefiniert';
  }, [currentTextColor]);

  const getCurrentBackgroundColorLabel = useMemo(() => {
    const colorOption = BACKGROUND_COLORS.find(option => option.value === currentBackgroundColor);
    return colorOption ? colorOption.label : 'Benutzerdefiniert';
  }, [currentBackgroundColor]);

  return (
    <div className="flex gap-1">
      {/* Text Color */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="sm"
            disabled={disabled}
            className="flex items-center gap-1 px-2"
          >
            <Type className="h-4 w-4" />
            <div 
              className="w-4 h-4 border border-border rounded"
              style={{ backgroundColor: currentTextColor }}
            />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-48">
          <div className="grid grid-cols-4 gap-1 p-2">
            {TEXT_COLORS.map((color) => (
              <button
                key={color.value}
                onClick={() => handleTextColorChange(color.value)}
                className={`w-8 h-8 rounded border border-border hover:scale-110 transition-transform ${
                  currentTextColor === color.value ? 'ring-2 ring-primary' : ''
                }`}
                style={{ backgroundColor: color.value }}
                title={color.label}
              />
            ))}
          </div>
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Background Color */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="sm"
            disabled={disabled}
            className="flex items-center gap-1 px-2"
          >
            <Highlighter className="h-4 w-4" />
            <div 
              className="w-4 h-4 border border-border rounded"
              style={{ 
                backgroundColor: currentBackgroundColor === 'transparent' ? '#ffffff' : currentBackgroundColor,
                backgroundImage: currentBackgroundColor === 'transparent' ? 'linear-gradient(45deg, #ccc 25%, transparent 25%), linear-gradient(-45deg, #ccc 25%, transparent 25%), linear-gradient(45deg, transparent 75%, #ccc 75%), linear-gradient(-45deg, transparent 75%, #ccc 75%)' : 'none',
                backgroundSize: currentBackgroundColor === 'transparent' ? '4px 4px' : 'auto',
                backgroundPosition: currentBackgroundColor === 'transparent' ? '0 0, 0 2px, 2px -2px, -2px 0px' : 'auto'
              }}
            />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-48">
          <div className="grid grid-cols-4 gap-1 p-2">
            {BACKGROUND_COLORS.map((color) => (
              <button
                key={color.value}
                onClick={() => handleBackgroundColorChange(color.value)}
                className={`w-8 h-8 rounded border border-border hover:scale-110 transition-transform ${
                  currentBackgroundColor === color.value ? 'ring-2 ring-primary' : ''
                }`}
                style={{ 
                  backgroundColor: color.value === 'transparent' ? '#ffffff' : color.value,
                  backgroundImage: color.value === 'transparent' ? 'linear-gradient(45deg, #ccc 25%, transparent 25%), linear-gradient(-45deg, #ccc 25%, transparent 25%), linear-gradient(45deg, transparent 75%, #ccc 75%), linear-gradient(-45deg, transparent 75%, #ccc 75%)' : 'none',
                  backgroundSize: color.value === 'transparent' ? '4px 4px' : 'auto',
                  backgroundPosition: color.value === 'transparent' ? '0 0, 0 2px, 2px -2px, -2px 0px' : 'auto'
                }}
                title={color.label}
              />
            ))}
          </div>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}