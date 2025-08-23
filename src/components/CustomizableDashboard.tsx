import React, { useState } from 'react';
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { 
  Settings, 
  Save, 
  Layout, 
  Trash2, 
  GripVertical 
} from 'lucide-react';
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogTrigger 
} from '@/components/ui/dialog';
import { DashboardWidget } from './DashboardWidget';
import { useDashboardLayout } from '@/hooks/useDashboardLayout';
import { toast } from 'sonner';

export function CustomizableDashboard() {
  const {
    layouts,
    currentLayout,
    loading,
    updateWidget,
    saveCurrentLayout,
    switchLayout,
    deleteLayout
  } = useDashboardLayout();

  const [isEditMode, setIsEditMode] = useState(false);
  const [showSaveDialog, setShowSaveDialog] = useState(false);
  const [newLayoutName, setNewLayoutName] = useState('');
  const [showLayoutDialog, setShowLayoutDialog] = useState(false);

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-subtle p-6 flex items-center justify-center">
        <div>Dashboard wird geladen...</div>
      </div>
    );
  }

  if (!currentLayout) {
    return (
      <div className="min-h-screen bg-gradient-subtle p-6 flex items-center justify-center">
        <div>Kein Layout verfügbar</div>
      </div>
    );
  }

  // Drag and Drop Handler with proper reordering
  const onDragEnd = (result: any) => {
    if (!result.destination || !currentLayout) return;

    const sourceIndex = result.source.index;
    const destinationIndex = result.destination.index;

    if (sourceIndex === destinationIndex) return;

    const widgets = Array.from(currentLayout.widgets);
    const [reorderedWidget] = widgets.splice(sourceIndex, 1);
    widgets.splice(destinationIndex, 0, reorderedWidget);

    // Update positions for all widgets
    widgets.forEach((widget, index) => {
      updateWidget(widget.id, { position: { ...widget.position, y: index } });
    });

    toast.success('Widget-Reihenfolge aktualisiert');
  };

  const handleSaveLayout = async () => {
    if (newLayoutName.trim()) {
      await saveCurrentLayout(newLayoutName);
      setNewLayoutName('');
      setShowSaveDialog(false);
    } else {
      await saveCurrentLayout();
    }
  };

  const handleSaveAsNew = async () => {
    if (!newLayoutName.trim()) {
      toast.error('Bitte geben Sie einen Namen ein');
      return;
    }
    await saveCurrentLayout(newLayoutName);
    setNewLayoutName('');
    setShowSaveDialog(false);
  };

  const handleDeleteLayout = async (layoutId: string) => {
    if (layouts.length <= 1) {
      toast.error('Sie können nicht das letzte Layout löschen');
      return;
    }
    await deleteLayout(layoutId);
  };

  // Helper functions for responsive grid classes
  function getWidgetGridClass(size: string): string {
    switch (size) {
      case '1x1': return 'col-span-1 row-span-1';
      case '2x1': return 'col-span-1 md:col-span-2 row-span-1';
      case '1x2': return 'col-span-1 row-span-2';
      case '2x2': return 'col-span-1 md:col-span-2 row-span-2';
      case '3x1': return 'col-span-1 md:col-span-2 lg:col-span-3 row-span-1';
      case '1x3': return 'col-span-1 row-span-3';
      case '3x2': return 'col-span-1 md:col-span-2 lg:col-span-3 row-span-2';
      case '2x3': return 'col-span-1 md:col-span-2 row-span-3';
      case '3x3': return 'col-span-1 md:col-span-2 lg:col-span-3 row-span-3';
      case '4x1': return 'col-span-1 md:col-span-2 lg:col-span-3 xl:col-span-4 row-span-1';
      case '1x4': return 'col-span-1 row-span-4';
      case '4x2': return 'col-span-1 md:col-span-2 lg:col-span-3 xl:col-span-4 row-span-2';
      case '2x4': return 'col-span-1 md:col-span-2 row-span-4';
      default: return 'col-span-1 row-span-1';
    }
  }

  function getWidgetHeight(size: string): string {
    switch (size) {
      case '1x1': return '200px';
      case '2x1': return '200px'; 
      case '1x2': return '400px';
      case '2x2': return '400px';
      case '3x1': return '200px';
      case '1x3': return '600px';
      case '3x2': return '400px';
      case '2x3': return '600px';
      case '3x3': return '600px';
      case '4x1': return '200px';
      case '1x4': return '800px';
      case '4x2': return '400px';
      case '2x4': return '800px';
      default: return '200px';
    }
  }

  return (
    <div className="min-h-screen bg-gradient-subtle p-6">
      {/* Header */}
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground mb-2">
            Dashboard {isEditMode && '(Bearbeitungsmodus)'}
          </h1>
          <p className="text-muted-foreground">
            {currentLayout.name} - Willkommen zurück! Hier ist Ihre heutige Übersicht.
          </p>
        </div>
        
        <div className="flex items-center gap-2">
          {/* Layout Selection */}
          <Dialog open={showLayoutDialog} onOpenChange={setShowLayoutDialog}>
            <DialogTrigger asChild>
              <Button variant="outline" size="sm">
                <Layout className="h-4 w-4 mr-2" />
                Layouts
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Layout verwalten</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <Label>Aktuelles Layout: {currentLayout.name}</Label>
                </div>
                
                <div className="space-y-2">
                  <Label>Layout wechseln</Label>
                  <Select
                    value={currentLayout.id || ''}
                    onValueChange={(value) => {
                      switchLayout(value);
                      setShowLayoutDialog(false);
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Layout auswählen" />
                    </SelectTrigger>
                    <SelectContent>
                      {layouts.map((layout) => (
                        <SelectItem key={layout.id || 'default'} value={layout.id || ''}>
                          {layout.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Layouts verwalten</Label>
                  <div className="space-y-2 max-h-48 overflow-y-auto">
                    {layouts.map((layout) => (
                      <div key={layout.id} className="flex items-center justify-between p-2 rounded bg-accent">
                        <span className="text-sm">{layout.name}</span>
                        <div className="flex items-center gap-1">
                          {layout.isActive && (
                            <span className="text-xs text-primary">Aktiv</span>
                          )}
                          {layouts.length > 1 && layout.id && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleDeleteLayout(layout.id!)}
                              className="h-6 w-6 p-0 text-destructive hover:text-destructive"
                            >
                              <Trash2 className="h-3 w-3" />
                            </Button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </DialogContent>
          </Dialog>

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
                <div className="space-y-2">
                  <Label htmlFor="layout-name">Name für neues Layout (optional)</Label>
                  <Input
                    id="layout-name"
                    value={newLayoutName}
                    onChange={(e) => setNewLayoutName(e.target.value)}
                    placeholder="Neuer Layout-Name"
                  />
                </div>
                <div className="flex gap-2">
                  <Button onClick={handleSaveLayout} className="flex-1">
                    Aktuelles Layout aktualisieren
                  </Button>
                  <Button 
                    onClick={handleSaveAsNew} 
                    variant="outline" 
                    className="flex-1"
                    disabled={!newLayoutName.trim()}
                  >
                    Als neues Layout speichern
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>

          {/* Edit Mode Toggle */}
          <Button
            variant={isEditMode ? "default" : "outline"}
            size="sm"
            onClick={() => setIsEditMode(!isEditMode)}
          >
            <Settings className="h-4 w-4 mr-2" />
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
                {currentLayout.widgets.map((widget, index) => (
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
                        className={`
                          relative
                          ${getWidgetGridClass(widget.widgetSize)} 
                          ${snapshot.isDragging ? 'z-50 rotate-1 shadow-2xl scale-105' : ''} 
                          ${isEditMode ? 'ring-2 ring-primary/20 ring-offset-2 hover:ring-primary/40' : ''}
                          transition-all duration-200
                        `}
                        style={{
                          ...provided.draggableProps.style,
                          height: getWidgetHeight(widget.widgetSize)
                        }}
                      >
                        {/* Drag Handle */}
                        {isEditMode && (
                          <div 
                            {...provided.dragHandleProps}
                            className="absolute top-2 right-2 z-10 p-1 bg-background/90 rounded border cursor-grab active:cursor-grabbing hover:bg-accent transition-colors"
                          >
                            <GripVertical className="h-4 w-4 text-muted-foreground" />
                          </div>
                        )}
                        
                        <DashboardWidget 
                          widget={widget} 
                          isDragging={snapshot.isDragging}
                          isEditMode={isEditMode}
                        />
                      </div>
                    )}
                  </Draggable>
                ))}
              </div>
              {provided.placeholder}
            </div>
          )}
        </Droppable>
      </DragDropContext>

      {/* Edit Mode Instructions */}
      {isEditMode && (
        <Card className="fixed bottom-6 right-6 border-primary/20 bg-primary/5 shadow-lg z-50">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <GripVertical className="h-4 w-4 text-primary" />
                <span className="text-sm font-medium">Bearbeitungsmodus aktiv</span>
              </div>
              <div className="flex gap-2">
                <Button size="sm" onClick={() => saveCurrentLayout()}>
                  <Save className="h-4 w-4 mr-2" />
                  Speichern
                </Button>
                <Button size="sm" variant="outline" onClick={() => setIsEditMode(false)}>
                  Fertig
                </Button>
              </div>
            </div>
            <p className="text-xs text-muted-foreground mt-2">
              Ziehen Sie Widgets mit dem Griff-Symbol, um sie neu anzuordnen.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}