import React, { useCallback, useEffect, useState } from 'react';
import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext';
import { 
  $getSelection, 
  $isRangeSelection,
  SELECTION_CHANGE_COMMAND,
  FORMAT_TEXT_COMMAND,
  COMMAND_PRIORITY_LOW,
  TextFormatType
} from 'lexical';
import { createPortal } from 'react-dom';
import { Button } from '@/components/ui/button';
import { Bold, Italic, Underline, Strikethrough, Code } from 'lucide-react';

interface FloatingTextFormatToolbarProps {
  anchorElem?: HTMLElement;
}

interface Position {
  x: number;
  y: number;
}

function FloatingTextFormatToolbar({ 
  anchorElem = document.body 
}: FloatingTextFormatToolbarProps): JSX.Element | null {
  const [editor] = useLexicalComposerContext();
  const [isVisible, setIsVisible] = useState(false);
  const [position, setPosition] = useState<Position>({ x: 0, y: 0 });
  const [activeFormats, setActiveFormats] = useState<Set<string>>(new Set());

  const updateToolbar = useCallback(() => {
    const selection = $getSelection();
    
    if (!$isRangeSelection(selection)) {
      setIsVisible(false);
      return;
    }

    const anchorNode = selection.anchor.getNode();
    const focusNode = selection.focus.getNode();
    
    if (anchorNode.getKey() === focusNode.getKey() && 
        selection.anchor.offset === selection.focus.offset) {
      setIsVisible(false);
      return;
    }

    // Get active formats
    const formats = new Set<string>();
    if (selection.hasFormat('bold')) formats.add('bold');
    if (selection.hasFormat('italic')) formats.add('italic');
    if (selection.hasFormat('underline')) formats.add('underline');
    if (selection.hasFormat('strikethrough')) formats.add('strikethrough');
    if (selection.hasFormat('code')) formats.add('code');
    
    setActiveFormats(formats);

    // Calculate position
    const nativeSelection = window.getSelection();
    if (nativeSelection && nativeSelection.rangeCount > 0) {
      const range = nativeSelection.getRangeAt(0);
      const rect = range.getBoundingClientRect();
      
      if (rect.width > 0 && rect.height > 0) {
        const anchorRect = anchorElem.getBoundingClientRect();
        
        setPosition({
          x: rect.left + rect.width / 2 - anchorRect.left - 120, // Center toolbar (240px width / 2)
          y: rect.top - anchorRect.top - 50 // Position above selection
        });
        
        setIsVisible(true);
      } else {
        setIsVisible(false);
      }
    } else {
      setIsVisible(false);
    }
  }, [anchorElem]);

  useEffect(() => {
    const unregisterSelectionListener = editor.registerCommand(
      SELECTION_CHANGE_COMMAND,
      () => {
        updateToolbar();
        return false;
      },
      COMMAND_PRIORITY_LOW
    );

    const unregisterUpdateListener = editor.registerUpdateListener(({ editorState }) => {
      editorState.read(() => {
        updateToolbar();
      });
    });

    return () => {
      unregisterSelectionListener();
      unregisterUpdateListener();
    };
  }, [editor, updateToolbar]);

  const formatText = useCallback((format: string) => {
    editor.dispatchCommand(FORMAT_TEXT_COMMAND, format as TextFormatType);
  }, [editor]);

  if (!isVisible) {
    return null;
  }

  const formatButtons = [
    { format: 'bold', icon: Bold, label: 'Fett' },
    { format: 'italic', icon: Italic, label: 'Kursiv' },
    { format: 'underline', icon: Underline, label: 'Unterstrichen' },
    { format: 'strikethrough', icon: Strikethrough, label: 'Durchgestrichen' },
    { format: 'code', icon: Code, label: 'Code' },
  ];

  const toolbar = (
    <div 
      className="flex items-center gap-1 p-2 bg-popover border rounded-md shadow-lg z-50"
      style={{
        position: 'absolute',
        left: `${position.x}px`,
        top: `${position.y}px`,
        transform: 'translateX(-50%)',
      }}
    >
      {formatButtons.map(({ format, icon: Icon, label }) => (
        <Button
          key={format}
          variant={activeFormats.has(format) ? "default" : "ghost"}
          size="sm"
          onClick={() => formatText(format)}
          title={label}
          className="h-8 w-8 p-0"
        >
          <Icon className="h-3.5 w-3.5" />
        </Button>
      ))}
    </div>
  );

  return createPortal(toolbar, anchorElem);
}

export default FloatingTextFormatToolbar;