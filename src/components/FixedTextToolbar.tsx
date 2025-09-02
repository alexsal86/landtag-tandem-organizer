import React from 'react';
import { Bold, Italic, Underline, Strikethrough, Link, Type, ChevronDown, Hash, List, ListOrdered, CheckSquare, ToggleLeft, Code, Quote, FileText } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator } from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';

interface FixedTextToolbarProps {
  onFormatText: (format: string) => void;
  activeFormats?: string[];
  disabled?: boolean;
}

const FixedTextToolbar: React.FC<FixedTextToolbarProps> = ({
  onFormatText,
  activeFormats = [],
  disabled = false
}) => {
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

  return (
    <div className={cn(
      "flex items-center gap-1 p-2 bg-muted/50 border-b border-border rounded-t-lg",
      disabled && "opacity-50 pointer-events-none"
    )}>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="sm"
            className="h-8 px-2 hover:bg-muted flex items-center gap-1 text-xs"
            disabled={disabled}
          >
            <Type className="h-3 w-3" />
            Format
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

      {formatButtons.map((button) => {
        const isActive = activeFormats.includes(button.action);
        return (
          <Button
            key={button.action}
            variant={isActive ? "default" : "ghost"}
            size="sm"
            className={cn(
              "h-8 w-8 p-0",
              isActive 
                ? "bg-primary text-primary-foreground hover:bg-primary/90" 
                : "hover:bg-muted"
            )}
            onClick={() => onFormatText(button.action)}
            title={button.label}
            disabled={disabled}
          >
            <button.icon className="h-4 w-4" />
          </Button>
        );
      })}
    </div>
  );
};

export default FixedTextToolbar;