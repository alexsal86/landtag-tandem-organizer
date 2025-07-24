import { useState } from 'react';
import { DragDropContext, Droppable, Draggable, DropResult } from '@hello-pangea/dnd';
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Settings, Save, Layout, Plus, Trash2 } from "lucide-react";
import { DashboardWidget } from '@/components/DashboardWidget';
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

  const handleDragEnd = (result: DropResult) => {
    if (!result.destination || !isEditMode) return;

    const sourceIndex = result.source.index;
    const destinationIndex = result.destination.index;

    if (sourceIndex === destinationIndex) return;

    // Reorder widgets
    const newWidgets = [...currentLayout.widgets];
    const [removed] = newWidgets.splice(sourceIndex, 1);
    newWidgets.splice(destinationIndex, 0, removed);

    // Update positions
    newWidgets.forEach((widget, index) => {
      updateWidget(widget.id, { position: { x: 0, y: index } });
    });
  };

  const handleSaveLayout = async () => {
    if (newLayoutName.trim()) {
      await saveCurrentLayout(newLayoutName);
      setNewLayoutName('');
      setShowSaveDialog(false);
    } else {
      await saveCurrentLayout();
    }
    toast.success('Layout gespeichert!');
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
                          {layouts.length > 1 && (
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

      {/* Dashboard Content */}
      <DragDropContext onDragEnd={handleDragEnd}>
        <Droppable droppableId="dashboard" direction="vertical">
          {(provided) => (
            <div
              {...provided.droppableProps}
              ref={provided.innerRef}
              className="space-y-6"
            >
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
                      {...provided.dragHandleProps}
                      className={`transition-transform ${
                        snapshot.isDragging ? 'z-50' : ''
                      }`}
                    >
                      <DashboardWidget
                        widget={widget}
                        isDragging={snapshot.isDragging}
                        isEditMode={isEditMode}
                      />
                    </div>
                  )}
                </Draggable>
              ))}
              {provided.placeholder}
            </div>
          )}
        </Droppable>
      </DragDropContext>

      {isEditMode && (
        <div className="fixed bottom-6 right-6 bg-card p-4 rounded-lg shadow-lg border">
          <p className="text-sm text-muted-foreground mb-2">
            Ziehen Sie Widgets zum Neuordnen
          </p>
          <Button onClick={() => setShowSaveDialog(true)} size="sm">
            <Save className="h-4 w-4 mr-2" />
            Layout speichern
          </Button>
        </div>
      )}
    </div>
  );
}