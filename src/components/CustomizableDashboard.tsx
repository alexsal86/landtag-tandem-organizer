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

  const onDragEnd = (result: any) => {
    if (!result.destination) return;

    const newWidgets = Array.from(currentLayout?.widgets || []);
    const [reorderedWidget] = newWidgets.splice(result.source.index, 1);
    newWidgets.splice(result.destination.index, 0, reorderedWidget);

    if (currentLayout) {
      updateWidget(reorderedWidget.id, {} as any);
    }
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

      {/* Dashboard Content with Drag and Drop */}
      <DragDropContext onDragEnd={onDragEnd}>
        <Droppable droppableId="dashboard-widgets" isDropDisabled={!isEditMode}>
          {(provided, snapshot) => (
            <div
              {...provided.droppableProps}
              ref={provided.innerRef}
              className={`space-y-6 ${snapshot.isDraggingOver ? 'bg-muted/30 rounded-lg p-2' : ''}`}
            >
              {/* Responsive Grid Layout */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 auto-rows-min">
                {currentLayout?.widgets.map((widget, index) => (
                  <Draggable 
                    key={widget.id} 
                    draggableId={widget.id} 
                    index={index}
                    isDragDisabled={!isEditMode}
                  >
                    {(provided, snapshot) => (
                      <div
                        ref={provided.innerRef}
                        {...provided.draggableProps}
                        {...provided.dragHandleProps}
                        className={cn(
                          "transition-all duration-200",
                          snapshot.isDragging && "scale-105 rotate-2 z-10",
                          isEditMode && "ring-2 ring-primary/20 hover:ring-primary/40"
                        )}
                        style={{
                          ...provided.draggableProps.style,
                          height: "200px",
                        }}
                      >
                        <DashboardWidget
                          widget={widget}
                          isDragging={snapshot.isDragging}
                          isEditMode={isEditMode}
                          onResize={(widgetId, newSize) => {
                            console.log('Dashboard resize called:', widgetId, newSize);
                            updateWidget(widgetId, { size: newSize } as any);
                          }}
                        />
                      </div>
                    )}
                  </Draggable>
                ))}
                {provided.placeholder}
              </div>
            </div>
          )}
        </Droppable>
      </DragDropContext>
    </div>
  );
};