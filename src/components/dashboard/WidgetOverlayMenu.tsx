import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { WidgetConfigDialog } from './WidgetConfigDialog';
import { Settings, Palette, Eye, EyeOff, Trash2, Copy, X } from 'lucide-react';

interface WidgetOverlayMenuProps {
  widget: any;
  isVisible: boolean;
  onClose: () => void;
  onResize: (widgetId: string, newSize: string) => void;
  onMinimize: (widgetId: string) => void;
  onHide: (widgetId: string) => void;
  onDelete: (widgetId: string) => void;
  onConfigure: (widgetId: string) => void;
  widgetSize?: string; // Neue Prop für die Widget-Größe
}

const WIDGET_SIZES = [
  { label: '1x1', value: '1x1' },
  { label: '2x1', value: '2x1' },
  { label: '3x1', value: '3x1' },
  { label: '1x2', value: '1x2' },
  { label: '2x2', value: '2x2' },
  { label: '3x2', value: '3x2' },
  { label: '1x3', value: '1x3' },
  { label: '2x3', value: '2x3' },
  { label: '3x3', value: '3x3' },
];

export const WidgetOverlayMenu: React.FC<WidgetOverlayMenuProps> = ({
  widget,
  isVisible,
  onClose,
  onResize,
  onMinimize,
  onHide,
  onDelete,
  onConfigure,
  widgetSize,
}) => {
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [showConfigDialog, setShowConfigDialog] = useState(false);

  if (!isVisible) return null;

  // Bestimme die Menügröße basierend auf der Widget-Größe
  const getMenuSize = () => {
    const currentSize = widgetSize || widget.widgetSize || widget.size || '2x2';
    const [w, h] = currentSize.split('x').map(Number);
    
    // Für sehr kleine Widgets
    if (w === 1 && h === 1) {
      return {
        minWidth: '200px',
        maxWidth: '250px',
        gridCols: 2,
        compact: true
      };
    }
    // Für kleine Widgets
    if (w <= 2 && h <= 2) {
      return {
        minWidth: '260px',
        maxWidth: '300px',
        gridCols: 2,
        compact: true
      };
    }
    // Für normale/große Widgets
    return {
      minWidth: '300px',
      maxWidth: '400px',
      gridCols: 3,
      compact: false
    };
  };

  const menuSize = getMenuSize();

  return (
    <div 
      className="absolute inset-0 z-50 bg-background/80 backdrop-blur-sm border-2 border-primary/20 rounded-lg flex items-center justify-center"
      onClick={(e) => {
        e.stopPropagation();
        e.nativeEvent.stopImmediatePropagation();
      }}
      onMouseDown={(e) => {
        e.stopPropagation();
        e.nativeEvent.stopImmediatePropagation();
      }}
      style={{ pointerEvents: 'all' }}
    >
      <div 
        className="bg-card border border-border rounded-lg p-4 shadow-lg"
        style={{ 
          minWidth: menuSize.minWidth,
          maxWidth: menuSize.maxWidth,
          width: '90%'
        }}
      >
        <div className="flex items-center justify-between mb-3">
          <h3 className={`font-semibold text-foreground ${menuSize.compact ? 'text-sm' : 'text-lg'}`}>
            Widget-Einstellungen
          </h3>
          <Button
            variant="ghost"
            size="sm"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              e.nativeEvent.stopImmediatePropagation();
              onClose();
            }}
            onMouseDown={(e) => {
              e.stopPropagation();
              e.nativeEvent.stopImmediatePropagation();
            }}
            className="h-6 w-6 p-0"
            style={{ pointerEvents: 'all' }}
          >
            <X className="h-3 w-3" />
          </Button>
        </div>

        <div className={`space-y-${menuSize.compact ? '2' : '4'}`}>
          {/* Widget Size Selection */}
          <div>
            <label className={`font-medium text-foreground mb-1 block ${menuSize.compact ? 'text-xs' : 'text-sm'}`}>
              Widget-Größe
            </label>
            <div className={`grid grid-cols-${menuSize.gridCols} gap-1`}>
              {WIDGET_SIZES.map((size) => (
                <Button
                  key={size.value}
                  variant={widget.size === size.value || widget.widgetSize === size.value ? "default" : "outline"}
                  size={menuSize.compact ? "sm" : "sm"}
                  onClick={(e) => {
                    e.stopPropagation();
                    e.nativeEvent.stopImmediatePropagation();
                    console.log('Size button clicked:', size.value, 'for widget:', widget.id);
                    onResize(widget.id, size.value);
                  }}
                  className={menuSize.compact ? "text-xs px-1 py-0.5" : "text-xs"}
                  style={{ pointerEvents: 'all' }}
                >
                  {size.label}
                </Button>
              ))}
            </div>
          </div>

          {/* Quick Actions */}
          {!menuSize.compact && (
            <div className="flex flex-wrap gap-1">
              <Button
                variant="outline"
                size="sm"
                onClick={(e) => {
                  e.stopPropagation();
                  setShowConfigDialog(true);
                }}
                className="flex items-center gap-1 text-xs"
                style={{ pointerEvents: 'all' }}
              >
                <Settings className="h-3 w-3" />
                Konfigurieren
              </Button>
              
              <Button
                variant="outline"
                size="sm"
                onClick={(e) => {
                  e.stopPropagation();
                  onMinimize(widget.id);
                }}
                className="flex items-center gap-1 text-xs"
                style={{ pointerEvents: 'all' }}
              >
                <EyeOff className="h-3 w-3" />
                Minimieren
              </Button>

              <Button
                variant="outline"
                size="sm"
                onClick={(e) => {
                  e.stopPropagation();
                  onHide(widget.id);
                }}
                className="flex items-center gap-1 text-xs"
                style={{ pointerEvents: 'all' }}
              >
                <Eye className="h-3 w-3" />
                Ausblenden
              </Button>
            </div>
          )}

          {/* Quick Actions */}
          {/* Danger Zone */}
          <div className={`pt-1 border-t border-border ${menuSize.compact ? 'mt-2' : 'mt-4'}`}>
            <Button
              variant="destructive"
              size={menuSize.compact ? "sm" : "sm"}
              onClick={(e) => {
                e.stopPropagation();
                e.nativeEvent.stopImmediatePropagation();
                setShowDeleteDialog(true);
              }}
              className={`flex items-center gap-1 w-full ${menuSize.compact ? 'text-xs px-2 py-1' : 'text-sm'}`}
              style={{ pointerEvents: 'all' }}
            >
              <Trash2 className={menuSize.compact ? "h-3 w-3" : "h-4 w-4"} />
              Widget löschen
            </Button>
          </div>
        </div>
      </div>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Widget löschen?</AlertDialogTitle>
            <AlertDialogDescription>
              Sind Sie sicher, dass Sie dieses Widget löschen möchten? Diese Aktion kann nicht rückgängig gemacht werden.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Abbrechen</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                onDelete(widget.id);
                setShowDeleteDialog(false);
                onClose();
              }}
            >
              Löschen
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Config Dialog */}
      {showConfigDialog && (
        <WidgetConfigDialog
          widget={widget}
          open={showConfigDialog}
          onOpenChange={setShowConfigDialog}
          onSave={(config) => {
            onConfigure(widget.id);
            setShowConfigDialog(false);
          }}
        />
      )}
    </div>
  );
};