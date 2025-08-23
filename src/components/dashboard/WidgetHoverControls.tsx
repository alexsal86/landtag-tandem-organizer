import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { 
  Settings,
  Minimize2,
  Maximize2,
  EyeOff,
  MoreVertical,
  Move,
  Copy,
  Trash2,
  Palette
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { DashboardWidget, WidgetSize } from '@/hooks/useDashboardLayout';
import { WidgetConfigDialog } from './WidgetConfigDialog';

interface WidgetHoverControlsProps {
  widget: DashboardWidget;
  onResize: (size: WidgetSize) => void;
  onMinimize: () => void;
  onHide: () => void;
  onConfigure: () => void;
}

const SIZE_OPTIONS: { size: WidgetSize; label: string }[] = [
  { size: '1x1', label: 'Klein (1×1)' },
  { size: '2x1', label: 'Breit (2×1)' },
  { size: '1x2', label: 'Hoch (1×2)' },
  { size: '2x2', label: 'Mittel (2×2)' },
  { size: '3x1', label: 'Extra Breit (3×1)' },
  { size: '1x3', label: 'Extra Hoch (1×3)' },
  { size: '3x2', label: 'Groß (3×2)' },
  { size: '2x3', label: 'Hoch-Groß (2×3)' },
  { size: '3x3', label: 'Extra Groß (3×3)' },
  { size: '4x1', label: 'Vollbreit (4×1)' },
  { size: '4x2', label: 'Vollbreit-Groß (4×2)' }
];

export function WidgetHoverControls({
  widget,
  onResize,
  onMinimize,
  onHide,
  onConfigure
}: WidgetHoverControlsProps) {
  const [showConfigDialog, setShowConfigDialog] = useState(false);
  const [showSizeMenu, setShowSizeMenu] = useState(false);

  const isMinimized = widget.configuration?.minimized;

  return (
    <>
      {/* Main Controls Bar */}
      <div className="absolute -top-12 left-0 right-0 flex items-center justify-between p-2 bg-background/95 backdrop-blur border rounded-lg shadow-lg z-20">
        <div className="flex items-center gap-1">
          {/* Move Handle */}
          <div className="p-1 hover:bg-accent rounded cursor-move">
            <Move className="h-3 w-3 text-muted-foreground" />
          </div>
          
          {/* Size Selector */}
          <DropdownMenu open={showSizeMenu} onOpenChange={setShowSizeMenu}>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm" className="h-6 px-2 text-xs">
                {widget.widgetSize}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent>
              {SIZE_OPTIONS.map((option) => (
                <DropdownMenuItem
                  key={option.size}
                  onClick={() => onResize(option.size)}
                  className={widget.widgetSize === option.size ? 'bg-accent' : ''}
                >
                  {option.label}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        <div className="flex items-center gap-1">
          {/* Quick Actions */}
          <Button
            variant="ghost"
            size="sm"
            className="h-6 w-6 p-0"
            onClick={onMinimize}
            title={isMinimized ? 'Maximieren' : 'Minimieren'}
          >
            {isMinimized ? (
              <Maximize2 className="h-3 w-3" />
            ) : (
              <Minimize2 className="h-3 w-3" />
            )}
          </Button>

          <Button
            variant="ghost"
            size="sm"
            className="h-6 w-6 p-0"
            onClick={() => setShowConfigDialog(true)}
            title="Konfigurieren"
          >
            <Settings className="h-3 w-3" />
          </Button>

          {/* More Options */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className="h-6 w-6 p-0"
              >
                <MoreVertical className="h-3 w-3" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => setShowConfigDialog(true)}>
                <Settings className="h-4 w-4 mr-2" />
                Konfigurieren
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => {}}>
                <Copy className="h-4 w-4 mr-2" />
                Duplizieren
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => {}}>
                <Palette className="h-4 w-4 mr-2" />
                Theme ändern
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={onHide} className="text-destructive">
                <EyeOff className="h-4 w-4 mr-2" />
                Ausblenden
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => {}} className="text-destructive">
                <Trash2 className="h-4 w-4 mr-2" />
                Löschen
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Widget Configuration Dialog */}
      <WidgetConfigDialog
        widget={widget}
        open={showConfigDialog}
        onOpenChange={setShowConfigDialog}
        onSave={(config) => {
          // Handle configuration save
          console.log('Save config:', config);
          setShowConfigDialog(false);
        }}
      />
    </>
  );
}