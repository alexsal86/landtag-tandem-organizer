import React, { useState, useRef, useEffect } from 'react';
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
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { DashboardWidget, WidgetSize } from '@/hooks/useDashboardLayout';
import { WidgetConfigDialog } from './WidgetConfigDialog';

interface WidgetHoverControlsProps {
  widget: DashboardWidget;
  onResize: (size: WidgetSize) => void;
  onMinimize: () => void;
  onHide: () => void;
  onDelete: () => void;
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
  onDelete,
  onConfigure
}: WidgetHoverControlsProps) {
  const [showConfigDialog, setShowConfigDialog] = useState(false);
  const [showSizeMenu, setShowSizeMenu] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [isHoverExtended, setIsHoverExtended] = useState(false);
  const [menuPosition, setMenuPosition] = useState<'left' | 'right'>('right');
  
  const controlsRef = useRef<HTMLDivElement>(null);
  const widgetRef = useRef<HTMLDivElement>(null);

  // Detect screen edge and adjust menu position
  useEffect(() => {
    const updatePosition = () => {
      if (!controlsRef.current) return;
      
      const rect = controlsRef.current.getBoundingClientRect();
      const viewportWidth = window.innerWidth;
      
      // If menu would go off-screen on the right, position it on the left
      if (rect.right + 200 > viewportWidth) {
        setMenuPosition('left');
      } else {
        setMenuPosition('right');
      }
    };

    updatePosition();
    window.addEventListener('resize', updatePosition);
    return () => window.removeEventListener('resize', updatePosition);
  }, [isHoverExtended]);

  const isMinimized = widget.configuration?.minimized;

  return (
    <>
      {/* Extended Hover Zone - invisible but captures hover */}
      <div 
        ref={widgetRef}
        className="absolute -inset-4 z-50"
        onMouseEnter={() => setIsHoverExtended(true)}
        onMouseLeave={() => setIsHoverExtended(false)}
      />
      
      {/* Main Controls Bar - position dynamically based on screen edge */}
      <div 
        ref={controlsRef}
        className={`absolute top-0 w-14 bg-background/98 backdrop-blur-sm border-2 border-primary/20 rounded-lg shadow-elegant z-[100] transition-all duration-200 ${
          menuPosition === 'right' ? '-right-16' : '-left-16'
        }`}
        style={{ 
          opacity: isHoverExtended ? 1 : 0,
          pointerEvents: isHoverExtended ? 'auto' : 'none',
          transform: isHoverExtended ? 'scale(1)' : 'scale(0.95)'
        }}
        onMouseEnter={() => setIsHoverExtended(true)}
        onMouseLeave={() => setIsHoverExtended(false)}
      >
        <div className="flex flex-col p-1 gap-1">
          {/* Move Handle */}
          <div className="p-1 hover:bg-accent rounded cursor-move flex items-center justify-center" title="Verschieben">
            <Move className="h-3 w-3 text-muted-foreground" />
          </div>
          
          {/* Size Selector */}
          <DropdownMenu open={showSizeMenu} onOpenChange={setShowSizeMenu}>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm" className="h-6 w-12 px-1 text-xs" title="Größe ändern">
                {widget.widgetSize}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent 
              side={menuPosition === 'right' ? 'left' : 'right'} 
              align="start" 
              className="z-[110] bg-background/98 backdrop-blur-sm border-primary/20"
              sideOffset={8}
            >
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
                title="Weitere Optionen"
              >
                <MoreVertical className="h-3 w-3" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent 
              side={menuPosition === 'right' ? 'left' : 'right'} 
              align="start" 
              className="z-[110] bg-background/98 backdrop-blur-sm border-primary/20"
              sideOffset={8}
            >
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
              <DropdownMenuItem onClick={() => setShowDeleteDialog(true)} className="text-destructive">
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

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent className="z-[110] bg-background/98 backdrop-blur-sm border-primary/20">
          <AlertDialogHeader>
            <AlertDialogTitle>Widget löschen</AlertDialogTitle>
            <AlertDialogDescription>
              Möchten Sie das Widget "{widget.title}" wirklich löschen? Diese Aktion kann nicht rückgängig gemacht werden.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Abbrechen</AlertDialogCancel>
            <AlertDialogAction 
              onClick={() => {
                onDelete();
                setShowDeleteDialog(false);
              }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Löschen
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}