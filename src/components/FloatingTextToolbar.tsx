import React, { useEffect, useState, useRef } from 'react';
import { Bold, Italic, Underline, Strikethrough, Link, Type, MessageSquare } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface FloatingTextToolbarProps {
  textareaRef: React.RefObject<HTMLDivElement>;
  onFormatText: (format: string) => void;
  isVisible: boolean;
  selectedText: string;
}

const FloatingTextToolbar: React.FC<FloatingTextToolbarProps> = ({
  textareaRef,
  onFormatText,
  isVisible,
  selectedText
}) => {
  const [position, setPosition] = useState({ top: 0, left: 0 });
  const toolbarRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isVisible || !textareaRef.current) return;

    const editor = textareaRef.current;
    const selection = window.getSelection();
    
    if (!selection || selection.rangeCount === 0) return;

    // Calculate position based on selection
    const editorRect = editor.getBoundingClientRect();
    const range = selection.getRangeAt(0);
    const rangeRect = range.getBoundingClientRect();
    
    const top = rangeRect.top - 50;
    const left = rangeRect.left + (rangeRect.width / 2) - 150;

    setPosition({
      top: Math.max(10, top),
      left: Math.min(window.innerWidth - 300, Math.max(10, left))
    });
  }, [isVisible, textareaRef]);

  const formatButtons = [
    { icon: Bold, action: 'bold', label: 'Fett' },
    { icon: Italic, action: 'italic', label: 'Kursiv' },
    { icon: Underline, action: 'underline', label: 'Unterstrichen' },
    { icon: Strikethrough, action: 'strikethrough', label: 'Durchgestrichen' },
    { icon: Link, action: 'link', label: 'Link' },
    { icon: Type, action: 'heading', label: 'Überschrift' },
    { icon: MessageSquare, action: 'comment', label: 'Kommentar' }
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