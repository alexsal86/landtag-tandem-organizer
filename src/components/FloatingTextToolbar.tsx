import React, { useEffect, useState, useRef } from 'react';
import { Bold, Italic, Underline, Strikethrough, Link, Type, MessageSquare, ChevronDown, Hash, List, ListOrdered, CheckSquare, ToggleLeft, Code, Quote, FileText } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator } from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';

interface FloatingTextToolbarProps {
  editorRef: React.RefObject<HTMLDivElement>;
  onFormatText: (format: string) => void;
  isVisible: boolean;
  selectedText: string;
}

const FloatingTextToolbar: React.FC<FloatingTextToolbarProps> = ({
  editorRef,
  onFormatText,
  isVisible,
  selectedText
}) => {
  const [position, setPosition] = useState({ top: 0, left: 0 });
  const toolbarRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isVisible || !selectedText) return;

    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0) return;

    const range = selection.getRangeAt(0);
    const rangeRect = range.getBoundingClientRect();
    
    // Position toolbar above the selection, accounting for viewport position
    const top = rangeRect.top - 60;
    const left = rangeRect.left + (rangeRect.width / 2) - 150;

    setPosition({
      top: Math.max(10, top),
      left: Math.min(window.innerWidth - 300, Math.max(10, left))
    });
  }, [isVisible, selectedText]);

  const formatButtons = [
    { icon: Bold, action: 'bold', label: 'Fett' },
    { icon: Italic, action: 'italic', label: 'Kursiv' },
    { icon: Underline, action: 'underline', label: 'Unterstrichen' },
    { icon: Strikethrough, action: 'strikethrough', label: 'Durchgestrichen' },
    { icon: Link, action: 'link', label: 'Link' }
  ];

  const turnIntoOptions = [
    { icon: Type, action: 'text', label: 'Text', description: 'Normaler Text' },
    { icon: Hash, action: 'heading1', label: 'Heading 1', description: 'Große Überschrift' },
    { icon: Hash, action: 'heading2', label: 'Heading 2', description: 'Mittlere Überschrift' },
    { icon: Hash, action: 'heading3', label: 'Heading 3', description: 'Kleine Überschrift' },
    { icon: FileText, action: 'page', label: 'Page', description: 'Neue Seite' },
    { icon: List, action: 'bulletlist', label: 'Bulleted list', description: 'Aufzählungsliste' },
    { icon: ListOrdered, action: 'numberlist', label: 'Numbered list', description: 'Nummerierte Liste' },
    { icon: CheckSquare, action: 'todolist', label: 'To-do list', description: 'Aufgabenliste' },
    { icon: ToggleLeft, action: 'togglelist', label: 'Toggle list', description: 'Klappbare Liste' },
    { icon: Code, action: 'code', label: 'Code', description: 'Code-Block' },
    { icon: Quote, action: 'quote', label: 'Quote', description: 'Zitat' }
  ];

  if (!isVisible || !selectedText) return null;

  return (
    <div
      ref={toolbarRef}
      className={cn(
        "fixed z-50 bg-card border border-border rounded-lg shadow-lg p-1 flex items-center gap-1",
        "animate-in fade-in-0 zoom-in-95 duration-200"
      )}
      style={{
        top: position.top,
        left: position.left
      }}
    >
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="sm"
            className="h-8 px-2 hover:bg-muted flex items-center gap-1 text-xs"
          >
            <Type className="h-3 w-3" />
            Turn into
            <ChevronDown className="h-3 w-3" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent 
          align="start" 
          className="w-56 max-h-80 overflow-y-auto bg-popover border-border"
          sideOffset={5}
        >
          {turnIntoOptions.map((option, index) => (
            <div key={option.action}>
              <DropdownMenuItem
                onClick={() => onFormatText(option.action)}
                className="flex items-center gap-3 px-3 py-2 hover:bg-accent cursor-pointer"
              >
                <option.icon className="h-4 w-4 text-muted-foreground" />
                <div className="flex flex-col">
                  <span className="text-sm font-medium">{option.label}</span>
                  <span className="text-xs text-muted-foreground">{option.description}</span>
                </div>
              </DropdownMenuItem>
              {(index === 0 || index === 3 || index === 4) && <DropdownMenuSeparator />}
            </div>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>

      <div className="w-px h-6 bg-border mx-1" />

      {formatButtons.map((button) => (
        <Button
          key={button.action}
          variant="ghost"
          size="sm"
          className="h-8 w-8 p-0 hover:bg-muted"
          onClick={() => onFormatText(button.action)}
          title={button.label}
        >
          <button.icon className="h-4 w-4" />
        </Button>
      ))}
    </div>
  );
};

export default FloatingTextToolbar;