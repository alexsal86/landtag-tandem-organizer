import React, { useState, useEffect } from 'react';
import { cn } from '@/lib/utils';
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { useDashboardLayout } from '@/hooks/useDashboardLayout';
import { DashboardWidget } from './DashboardWidget';
// import { HybridDashboard } from './dashboard/HybridDashboard';
// import { RealTimeDashboard } from './dashboard/RealTimeDashboard';
import { toast } from 'sonner';
import {
  Settings,
  Save,
  LayoutGrid,
  Plus,
  Edit,
  Trash2,
  Download,
  Upload,
  Grid3X3,
} from 'lucide-react';

type DashboardMode = 'classic' | 'hybrid' | 'realtime';

export const CustomizableDashboard: React.FC = () => {
  const {
    layouts,
    currentLayout,
    loading,
    updateWidget,
    saveCurrentLayout,
    switchLayout,
    deleteLayout,
    addWidget,
    removeWidget,
  } = useDashboardLayout();

  const [isEditMode, setIsEditMode] = useState(false);
  const [showSaveDialog, setShowSaveDialog] = useState(false);
  const [newLayoutName, setNewLayoutName] = useState('');
  const [showLayoutDialog, setShowLayoutDialog] = useState(false);
  const [dashboardMode, setDashboardMode] = useState<DashboardMode>('classic');

  // Grid-based drag handling
  const [draggedWidget, setDraggedWidget] = useState<string | null>(null);
  const [dragOverPosition, setDragOverPosition] = useState<{x: number, y: number} | null>(null);

  const handleDragStart = (e: React.DragEvent, widgetId: string) => {
    if (!isEditMode) return;
    setDraggedWidget(widgetId);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    
    // Calculate grid position based on mouse position
    const rect = e.currentTarget.getBoundingClientRect();
    const x = Math.floor((e.clientX - rect.left) / (rect.width / 6));
    const y = Math.floor((e.clientY - rect.top) / 216); // 200px + 16px gap
    setDragOverPosition({ x: Math.max(0, Math.min(5, x)), y: Math.max(0, y) });
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    if (!draggedWidget || !dragOverPosition) return;
    
    updateWidget(draggedWidget, { 
      position: { x: dragOverPosition.x, y: dragOverPosition.y } 
    } as any);
    
    setDraggedWidget(null);
    setDragOverPosition(null);
  };

  const handleDragEnd = () => {
    setDraggedWidget(null);
    setDragOverPosition(null);
  };

  // Widget management handlers
  const handleSaveLayout = async (name?: string) => {
    try {
      await saveCurrentLayout(name);
      toast.success('Layout gespeichert');
      setShowSaveDialog(false);
    } catch (error) {
      toast.error('Fehler beim Speichern des Layouts');
    }
  };

  const handleSaveAsNew = async () => {
    if (!newLayoutName.trim()) {
      toast.error('Bitte geben Sie einen Namen ein');
      return;
    }
    await handleSaveLayout(newLayoutName.trim());
    setNewLayoutName('');
  };

  const handleDeleteLayout = async (layoutId: string) => {
    if (layouts.length <= 1) {
      toast.error('Das letzte Layout kann nicht gelöscht werden');
      return;
    }
    try {
      await deleteLayout(layoutId);
      toast.success('Layout gelöscht');
    } catch (error) {
      toast.error('Fehler beim Löschen des Layouts');
    }
  };

  const getWidgetGridClass = (size: string) => {
    const gridClasses = {
      '1x1': 'col-span-1 row-span-1',
      '2x1': 'col-span-2 row-span-1',
      '3x1': 'col-span-3 row-span-1',
      '1x2': 'col-span-1 row-span-2',
      '2x2': 'col-span-2 row-span-2',
      '3x2': 'col-span-3 row-span-2',
      '1x3': 'col-span-1 row-span-3',
      '2x3': 'col-span-2 row-span-3',
      '3x3': 'col-span-3 row-span-3',
    };
    return gridClasses[size as keyof typeof gridClasses] || 'col-span-1 row-span-1';
  };

  const getWidgetHeight = (size: string) => {
    const heights = {
      '1x1': '200px',
      '2x1': '200px',
      '3x1': '200px',
      '1x2': '416px',
      '2x2': '416px',
      '3x2': '416px',
      '1x3': '632px',
      '2x3': '632px',
      '3x3': '632px',
    };
    return heights[size as keyof typeof heights] || '200px';
  };

  useEffect(() => {
    if (!isEditMode) {
      setShowLayoutDialog(false);
    }
  }, [isEditMode]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-lg text-muted-foreground">Dashboard wird geladen...</div>
      </div>
    );
  }

  if (!layouts.length) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-lg text-muted-foreground">Keine Layouts verfügbar</div>
      </div>
    );
  }

  // Render different dashboard modes
  if (dashboardMode === 'hybrid') {
    return <div className="p-6 text-center">Hybrid Dashboard wird noch entwickelt...</div>;
  }

  if (dashboardMode === 'realtime') {
    return <div className="p-6 text-center">Real-Time Dashboard wird noch entwickelt...</div>;
  }

  // Classic dashboard mode
  return (
    <div className="min-h-screen bg-background p-6">
      {/* Dashboard Header */}
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground mb-2">
            Dashboard
          </h1>
          <p className="text-muted-foreground">
            {currentLayout?.name || 'Standard Layout'} - Willkommen zurück!
          </p>
        </div>

        <div className="flex items-center gap-2">
          {/* Dashboard Mode Selector */}
          <Select value={dashboardMode} onValueChange={(value: DashboardMode) => setDashboardMode(value)}>
            <SelectTrigger className="w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="classic">Standard</SelectItem>
              <SelectItem value="hybrid">Hybrid</SelectItem>
              <SelectItem value="realtime">Echtzeit</SelectItem>
            </SelectContent>
          </Select>

          {/* Layout Management */}
          {currentLayout && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm">
                  <LayoutGrid className="h-4 w-4 mr-2" />
                  Layout
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent>
                {layouts.map((layout) => (
                  <DropdownMenuItem
                    key={layout.id}
                    onClick={() => switchLayout(layout.id!)}
                    className={currentLayout.id === layout.id ? 'bg-accent' : ''}
                  >
                    {layout.name}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          )}

          {/* Save Layout */}
          <Dialog open={showSaveDialog} onOpenChange={setShowSaveDialog}>
            <DialogTrigger asChild>
              <Button variant="outline" size="sm">
                <Save className="h-4 w-4 mr-2" />
                Speichern
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Layout speichern</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <Label htmlFor="layout-name">Layout Name</Label>
                  <Input
                    id="layout-name"
                    value={newLayoutName}
                    onChange={(e) => setNewLayoutName(e.target.value)}
                    placeholder="Mein neues Layout"
                  />
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setShowSaveDialog(false)}>
                  Abbrechen
                </Button>
                <Button onClick={() => handleSaveLayout()}>
                  Aktuelles überschreiben
                </Button>
                <Button onClick={handleSaveAsNew}>
                  Als neu speichern
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          {/* Edit Mode Toggle */}
          <Button
            variant={isEditMode ? "default" : "outline"}
            size="sm"
            onClick={() => setIsEditMode(!isEditMode)}
          >
            <Edit className="h-4 w-4 mr-2" />
            {isEditMode ? 'Fertig' : 'Bearbeiten'}
          </Button>
        </div>
      </div>

      {/* Dashboard Content with Grid-based Drag and Drop */}
      <div 
        className="relative"
        onDragOver={handleDragOver}
        onDrop={handleDrop}
        onDragLeave={handleDragEnd}
      >
        {/* Grid Layout with proper widget sizing */}
        <div className="grid grid-cols-6 gap-4 auto-rows-[200px] relative">
          {/* Drop zone indicator */}
          {draggedWidget && dragOverPosition && (
            <div 
              className="absolute bg-primary/20 border-2 border-primary border-dashed rounded-lg z-10"
              style={{
                gridColumn: `${dragOverPosition.x + 1} / span 1`,
                gridRow: `${dragOverPosition.y + 1} / span 1`,
                width: '100%',
                height: '200px',
              }}
            />
          )}
          
          {currentLayout?.widgets.map((widget) => {
            // Get the size from either widgetSize or size property
            const widgetSizeString = widget.widgetSize || (typeof widget.size === 'string' ? widget.size : '2x2');
            const gridClass = getWidgetGridClass(widgetSizeString);
            const height = getWidgetHeight(widgetSizeString);
            
            return (
              <div
                key={widget.id}
                className={cn(
                  "transition-all duration-200",
                  gridClass,
                  isEditMode && "cursor-move ring-2 ring-primary/20 hover:ring-primary/40",
                  draggedWidget === widget.id && "opacity-50 scale-95"
                )}
                style={{
                  gridColumnStart: widget.position.x + 1,
                  gridRowStart: widget.position.y + 1,
                  height: height,
                }}
                draggable={isEditMode}
                onDragStart={(e) => handleDragStart(e, widget.id)}
                onDragEnd={handleDragEnd}
              >
                <DashboardWidget
                  widget={widget}
                  isDragging={draggedWidget === widget.id}
                  isEditMode={isEditMode}
                  onResize={(widgetId, newSize) => {
                    console.log('Dashboard resize called:', widgetId, newSize);
                    updateWidget(widgetId, { widgetSize: newSize } as any);
                  }}
                />
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};