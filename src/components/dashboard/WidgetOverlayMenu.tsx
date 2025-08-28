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
}) => {
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [showConfigDialog, setShowConfigDialog] = useState(false);

  if (!isVisible) return null;

  return (
    <div className="absolute inset-0 z-50 bg-background/80 backdrop-blur-sm border-2 border-primary/20 rounded-lg flex items-center justify-center">
      <div className="bg-card border border-border rounded-lg p-6 shadow-lg min-w-[300px]">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-foreground">Widget-Einstellungen</h3>
          <Button
            variant="ghost"
            size="sm"
            onClick={onClose}
            className="h-8 w-8 p-0"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>

        <div className="space-y-4">
          {/* Widget Size Selection */}
          <div>
            <label className="text-sm font-medium text-foreground mb-2 block">
              Widget-Größe
            </label>
            <div className="grid grid-cols-3 gap-2">
              {WIDGET_SIZES.map((size) => (
                <Button
                  key={size.value}
                  variant={widget.size === size.value || widget.widgetSize === size.value ? "default" : "outline"}
                  size="sm"
                  onClick={() => {
                    console.log('Size button clicked:', size.value, 'for widget:', widget.id);
                    onResize(widget.id, size.value);
                  }}
                  className="text-xs"
                >
                  {size.label}
                </Button>
              ))}
            </div>
          </div>

          {/* Quick Actions */}
          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowConfigDialog(true)}
              className="flex items-center gap-2"
            >
              <Settings className="h-4 w-4" />
              Konfigurieren
            </Button>
            
            <Button
              variant="outline"
              size="sm"
              onClick={() => onMinimize(widget.id)}
              className="flex items-center gap-2"
            >
              <EyeOff className="h-4 w-4" />
              Minimieren
            </Button>

            <Button
              variant="outline"
              size="sm"
              onClick={() => onHide(widget.id)}
              className="flex items-center gap-2"
            >
              <Eye className="h-4 w-4" />
              Ausblenden
            </Button>
          </div>

          {/* Danger Zone */}
          <div className="pt-2 border-t border-border">
            <Button
              variant="destructive"
              size="sm"
              onClick={() => setShowDeleteDialog(true)}
              className="flex items-center gap-2 w-full"
            >
              <Trash2 className="h-4 w-4" />
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