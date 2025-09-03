import React from 'react';
import { Button } from '@/components/ui/button';
import { 
  Bold, 
  Italic, 
  Underline, 
  Strikethrough,
  List,
  ListOrdered,
  Code,
  Quote,
  Link,
  Type,
  Heading1,
  Heading2,
  Heading3
} from 'lucide-react';

interface FloatingTextToolbarProps {
  onFormatText: (format: string) => void;
  activeFormats: string[];
  isVisible?: boolean;
  selectedText?: string;
}

const FloatingTextToolbar: React.FC<FloatingTextToolbarProps> = ({
  onFormatText,
  activeFormats = []
}) => {
  const formatButtons = [
    { format: 'bold', icon: Bold, label: 'Fett' },
    { format: 'italic', icon: Italic, label: 'Kursiv' },
    { format: 'underline', icon: Underline, label: 'Unterstrichen' },
    { format: 'strikethrough', icon: Strikethrough, label: 'Durchgestrichen' },
    { format: 'heading1', icon: Heading1, label: 'Überschrift 1' },
    { format: 'heading2', icon: Heading2, label: 'Überschrift 2' },
    { format: 'heading3', icon: Heading3, label: 'Überschrift 3' },
    { format: 'paragraph', icon: Type, label: 'Fließtext' },
    { format: 'bulletlist', icon: List, label: 'Liste' },
    { format: 'numberlist', icon: ListOrdered, label: 'Nummerierte Liste' },
    { format: 'code', icon: Code, label: 'Code' },
    { format: 'quote', icon: Quote, label: 'Zitat' },
    { format: 'link', icon: Link, label: 'Link' },
  ];

  return (
    <div className="flex flex-wrap gap-1 p-3 border-b border-border bg-background/95 backdrop-blur-sm">
      <div className="text-xs text-muted-foreground mb-2 w-full">
        Rich-Text Formatierung
      </div>
      {formatButtons.map(({ format, icon: Icon, label }) => {
        const isActive = activeFormats.includes(format);
        return (
          <Button
            key={format}
            variant={isActive ? "default" : "ghost"}
            size="sm"
            onClick={() => onFormatText(format)}
            title={label}
            className={`h-8 w-8 p-0 transition-all duration-200 ${
              isActive 
                ? "bg-primary text-primary-foreground shadow-sm ring-1 ring-primary/20" 
                : "hover:bg-accent hover:text-accent-foreground"
            }`}
          >
            <Icon className="h-4 w-4" />
          </Button>
        );
      })}
    </div>
  );
};

export default FloatingTextToolbar;