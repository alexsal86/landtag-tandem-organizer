import React, { useState, useEffect, useRef } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Settings, Save, Layout, Plus, Grid3X3, Zap } from 'lucide-react';
import { useDashboardLayout } from '@/hooks/useDashboardLayout';
import { DashboardWidget } from '../DashboardWidget';
import { WidgetPalette } from './WidgetPalette';
import { WidgetResizeHandle } from './WidgetResizeHandle';
import { WidgetHoverControls } from './WidgetHoverControls';
import { PerformanceMonitor } from './PerformanceMonitor';
import { ContextAwareSuggestions } from './ContextAwareSuggestions';
import { UndoRedoSystem } from './UndoRedoSystem';
import { RealTimeSync } from './RealTimeSync';
import { EditModeProvider, useEditMode } from './EditModeProvider';
import { toast } from 'sonner';
import { DashboardWidget as WidgetType, WidgetSize } from '@/hooks/useDashboardLayout';

function HybridDashboardContent() {
  const {
    layouts,
    currentLayout,
    loading,
    updateWidget,
    addWidget,
    removeWidget,
    saveCurrentLayout,
    switchLayout,
    deleteLayout
  } = useDashboardLayout();

  const { isEditMode, toggleEditMode } = useEditMode();
  
  const [draggedWidget, setDraggedWidget] = useState<string | null>(null);
  const [hoveredWidget, setHoveredWidget] = useState<string | null>(null);
  const [showPalette, setShowPalette] = useState(false);
  const [gridSnap, setGridSnap] = useState(true);
  const [autoSaveEnabled, setAutoSaveEnabled] = useState(true);
  const [showPerformanceIssues, setShowPerformanceIssues] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);
  
  const dashboardRef = useRef<HTMLDivElement>(null);
  const autoSaveTimeoutRef = useRef<NodeJS.Timeout>();

  // Auto-save in edit mode
  useEffect(() => {
    if (isEditMode && autoSaveEnabled && currentLayout) {
      if (autoSaveTimeoutRef.current) {
        clearTimeout(autoSaveTimeoutRef.current);
      }
      autoSaveTimeoutRef.current = setTimeout(() => {
        saveCurrentLayout();
        toast.success('Automatisch gespeichert', { duration: 2000 });
      }, 3000);
    }
    return () => {
      if (autoSaveTimeoutRef.current) {
        clearTimeout(autoSaveTimeoutRef.current);
      }
    };
  }, [currentLayout, isEditMode, autoSaveEnabled, saveCurrentLayout]);

  // Close palette when exiting edit mode
  useEffect(() => {
    if (!isEditMode) {
      setShowPalette(false);
      setHoveredWidget(null);
    }
  }, [isEditMode]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-subtle p-6 flex items-center justify-center">
        <div className="text-muted-foreground">Dashboard wird geladen...</div>
      </div>
    );
  }

  if (!currentLayout) {
    return (
      <div className="min-h-screen bg-gradient-subtle p-6 flex items-center justify-center">
        <div className="text-muted-foreground">Kein Layout verfügbar</div>
      </div>
    );
  }

  const handleWidgetDragStart = (widgetId: string, event: React.DragEvent) => {
    if (!isEditMode) return;
    setDraggedWidget(widgetId);
    event.dataTransfer.effectAllowed = 'move';
    event.dataTransfer.setData('text/plain', widgetId);
  };

  const handleWidgetDrop = (event: React.DragEvent, targetGridArea?: { column: number; row: number }) => {
    event.preventDefault();
    if (!draggedWidget || !dashboardRef.current || !isEditMode) return;

    const widget = currentLayout.widgets.find(w => w.id === draggedWidget);
    if (!widget) return;

    // Calculate grid position for CSS Grid layout
    let gridColumn = 1;
    let gridRow = 1;

    if (targetGridArea) {
      gridColumn = targetGridArea.column;
      gridRow = targetGridArea.row;
    } else {
      const rect = dashboardRef.current.getBoundingClientRect();
      const containerWidth = rect.width;
      const containerHeight = rect.height;
      
      // Calculate based on 6-column grid
      const columnWidth = containerWidth / 6;
      const dropX = event.clientX - rect.left;
      const dropY = event.clientY - rect.top;
      
      gridColumn = Math.max(1, Math.min(6, Math.ceil(dropX / columnWidth)));
      gridRow = Math.max(1, Math.ceil(dropY / 200)); // 200px row height
    }

    // Update widget with new grid position
    updateWidget(draggedWidget, { 
      position: { x: gridColumn - 1, y: gridRow - 1 }
    });

    setDraggedWidget(null);
    toast.success('Widget-Position aktualisiert');
  };

  const handleDragOver = (event: React.DragEvent) => {
    if (!isEditMode) return;
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
  };

  const handleWidgetResize = (widgetId: string, newSize: WidgetSize) => {
    updateWidget(widgetId, { widgetSize: newSize });
    toast.success('Widget-Größe geändert');
  };

  const handleWidgetMinimize = (widgetId: string) => {
    const widget = currentLayout.widgets.find(w => w.id === widgetId);
    if (!widget) return;
    
    updateWidget(widgetId, {
      configuration: {
        ...widget.configuration,
        minimized: !widget.configuration?.minimized
      }
    });
  };

  const handleWidgetHide = (widgetId: string) => {
    removeWidget(widgetId);
    toast.success('Widget ausgeblendet');
  };

  const handleAddWidget = (type: string, position?: { x: number; y: number }) => {
    addWidget(type, position);
    toast.success(`Widget "${type}" hinzugefügt`);
  };

  const getWidgetTitle = (type: WidgetType['type']): string => {
    const titles = {
      stats: 'Statistiken',
      tasks: 'Aufgaben',
      schedule: 'Terminplan',
      actions: 'Schnellaktionen',
      messages: 'Nachrichten',
      quicknotes: 'Notizen',
      pomodoro: 'Pomodoro Timer',
      habits: 'Gewohnheiten',
      calllog: 'Anrufliste',
      teamchat: 'Team Chat'
    };
    return titles[type] || 'Widget';
  };

  return (
    <div className="min-h-screen bg-gradient-subtle p-6 relative">
      {/* Header with proper Z-index */}
      <div className="relative z-40 mb-8 flex items-center justify-between bg-background/80 backdrop-blur-sm rounded-lg p-4 border">
        <div>
          <h1 className="text-3xl font-bold text-foreground mb-2">
            Dashboard {isEditMode && '(Bearbeiten)'}
          </h1>
          <p className="text-muted-foreground">
            {currentLayout.name} - {isEditMode ? 'Bearbeitungsmodus aktiv' : 'Willkommen zurück!'}
          </p>
        </div>
        
        <div className="flex items-center gap-2">
          {/* Performance Issues Indicator */}
          {showPerformanceIssues && (
            <Button
              variant="destructive"
              size="sm"
              onClick={() => setShowPerformanceIssues(false)}
            >
              Performance-Probleme
            </Button>
          )}

          {/* Context Suggestions */}
          {isEditMode && (
            <Button
              variant={showSuggestions ? "default" : "outline"}
              size="sm"
              onClick={() => setShowSuggestions(!showSuggestions)}
            >
              Vorschläge
            </Button>
          )}

          {/* Edit Mode Tools */}
          {isEditMode && (
            <>
              <Button
                variant={showPalette ? "default" : "outline"}
                size="sm"
                onClick={() => setShowPalette(!showPalette)}
              >
                <Plus className="h-4 w-4 mr-2" />
                Widget
              </Button>
              
              <Button
                variant={gridSnap ? "default" : "outline"}
                size="sm"
                onClick={() => setGridSnap(!gridSnap)}
              >
                <Grid3X3 className="h-4 w-4 mr-2" />
                Raster
              </Button>
              
              <Button
                variant={autoSaveEnabled ? "default" : "outline"}
                size="sm"
                onClick={() => setAutoSaveEnabled(!autoSaveEnabled)}
              >
                <Zap className="h-4 w-4 mr-2" />
                Auto-Save
              </Button>
            </>
          )}

          {/* Edit Mode Toggle */}
          <Button
            variant={isEditMode ? "default" : "outline"}
            size="sm"
            onClick={toggleEditMode}
          >
            <Settings className="h-4 w-4 mr-2" />
            {isEditMode ? 'Fertig' : 'Bearbeiten'}
          </Button>
        </div>
      </div>

      {/* Dashboard Grid */}
      <div
        ref={dashboardRef}
        className={`relative min-h-[800px] transition-all duration-200 ${
          isEditMode ? 'border-2 border-dashed border-primary/30 rounded-lg p-4' : 'p-2'
        }`}
        onDrop={handleWidgetDrop}
        onDragOver={handleDragOver}
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(6, 1fr)',
          gridTemplateRows: 'repeat(auto-fit, 200px)',
          gap: '1rem',
          alignContent: 'start',
          backgroundImage: isEditMode && gridSnap ? `
            linear-gradient(to right, hsl(var(--border)) 1px, transparent 1px),
            linear-gradient(to bottom, hsl(var(--border)) 1px, transparent 1px)
          ` : 'none',
          backgroundSize: isEditMode && gridSnap ? 'calc(100% / 6) 200px' : 'auto'
        }}
      >
        {currentLayout.widgets.map((widget) => {
          // Convert widget position to CSS Grid placement
          const gridColumnStart = (widget.position?.x || 0) + 1;
          const gridRowStart = (widget.position?.y || 0) + 1;
          
          return (
            <div
              key={widget.id}
              className={`
                relative 
                ${getGridSpan(widget.widgetSize)}
                ${widget.configuration?.minimized ? 'h-12' : getWidgetHeight(widget.widgetSize)}
                ${draggedWidget === widget.id ? 'opacity-50 scale-95 z-30' : 'z-10'}
                ${isEditMode && hoveredWidget === widget.id ? 'ring-2 ring-primary/50 shadow-lg' : ''}
                ${isEditMode ? 'cursor-move' : 'cursor-default'}
                transition-all duration-200
              `}
              style={{
                gridColumn: `${gridColumnStart} / span ${getGridColumns(widget.widgetSize)}`,
                gridRow: `${gridRowStart} / span ${getGridRows(widget.widgetSize)}`,
                minHeight: `${getGridRows(widget.widgetSize) * 200}px`
              }}
              draggable={isEditMode}
              onDragStart={(e) => handleWidgetDragStart(widget.id, e)}
              onMouseEnter={() => isEditMode && setHoveredWidget(widget.id)}
              onMouseLeave={() => isEditMode && setHoveredWidget(null)}
            >
              {/* Widget Hover Controls - Only in Edit Mode */}
              {isEditMode && hoveredWidget === widget.id && (
                <WidgetHoverControls
                  widget={widget}
                  onResize={(size) => handleWidgetResize(widget.id, size)}
                  onMinimize={() => handleWidgetMinimize(widget.id)}
                  onHide={() => handleWidgetHide(widget.id)}
                  onConfigure={() => {}}
                />
              )}

              {/* Widget Resize Handles - Only in Edit Mode */}
              {isEditMode && hoveredWidget === widget.id && !widget.configuration?.minimized && (
                <WidgetResizeHandle
                  widget={widget}
                  onResize={(size) => handleWidgetResize(widget.id, size)}
                  gridSnap={gridSnap}
                />
              )}

              {/* Widget Content */}
              <DashboardWidget 
                widget={widget} 
                isDragging={draggedWidget === widget.id}
                isEditMode={isEditMode}
              />
            </div>
          );
        })}
      </div>

      {/* Widget Palette - Positioned near button */}
      {isEditMode && showPalette && (
        <div className="fixed inset-0 z-overlay bg-black/20 backdrop-blur-sm" onClick={() => setShowPalette(false)}>
          <div className="absolute top-20 right-6" onClick={(e) => e.stopPropagation()}>
            <WidgetPalette
              onAddWidget={handleAddWidget}
              onClose={() => setShowPalette(false)}
              suggestions={[]}
            />
          </div>
        </div>
      )}

      {/* Context-Aware Suggestions - Proper Z-index */}
      {isEditMode && showSuggestions && (
        <div className="fixed bottom-20 left-6 z-modal max-w-sm">
          <ContextAwareSuggestions
            currentLayout={currentLayout}
            onSuggestionApply={(suggestion) => {
              toast.success('Vorschlag angewendet');
            }}
            onSuggestionsUpdate={() => {}}
          />
        </div>
      )}

      {/* Edit Mode System Components - Only when in edit mode */}
      {isEditMode && (
        <>
          {/* Undo/Redo System */}
          <div className="fixed bottom-6 right-24 z-modal">
            <UndoRedoSystem />
          </div>

          {/* Real-Time Sync */}
          <RealTimeSync
            currentLayout={currentLayout}
            onLayoutUpdate={(updatedLayout) => {
              // Handle real-time updates
            }}
          />
        </>
      )}

      {/* Performance Monitor - Only show when issues exist */}
      {showPerformanceIssues && (
        <div className="fixed bottom-6 left-6 z-modal max-w-xs">
          <PerformanceMonitor
            widgets={currentLayout.widgets}
            onPerformanceAlert={(alert) => {
              setShowPerformanceIssues(true);
              toast.warning(alert.message);
            }}
          />
        </div>
      )}

      {/* Edit Mode Status Card */}
      {isEditMode && (
        <Card className="fixed bottom-6 right-6 border-primary/20 bg-background/95 backdrop-blur-sm shadow-elegant z-modal">
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <Settings className="h-4 w-4 text-primary" />
                <span className="text-sm font-medium">Bearbeitungsmodus</span>
              </div>
              <div className="flex gap-2">
                <Button size="sm" onClick={() => saveCurrentLayout()}>
                  <Save className="h-4 w-4 mr-2" />
                  Speichern
                </Button>
                <Button size="sm" variant="outline" onClick={toggleEditMode}>
                  Fertig
                </Button>
              </div>
            </div>
            
            {/* Status Indicators */}
            <div className="flex gap-2 text-xs">
              {autoSaveEnabled && (
                <span className="bg-primary/10 text-primary px-2 py-1 rounded">
                  Auto-Save
                </span>
              )}
              {gridSnap && (
                <span className="bg-accent px-2 py-1 rounded">
                  Raster
                </span>
              )}
            </div>
            
            <p className="text-xs text-muted-foreground mt-2">
              Widgets ziehen, Größe ändern oder neue hinzufügen
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

export function HybridDashboard() {
  return (
    <EditModeProvider>
      <HybridDashboardContent />
    </EditModeProvider>
  );
}

// Helper functions
function getGridSpan(size: WidgetSize): string {
  const spans = {
    '1x1': 'col-span-1 row-span-1',
    '2x1': 'col-span-2 row-span-1',
    '1x2': 'col-span-1 row-span-2',
    '2x2': 'col-span-2 row-span-2',
    '3x1': 'col-span-3 row-span-1',
    '1x3': 'col-span-1 row-span-3',
    '3x2': 'col-span-3 row-span-2',
    '2x3': 'col-span-2 row-span-3',
    '3x3': 'col-span-3 row-span-3',
    '4x1': 'col-span-4 row-span-1',
    '1x4': 'col-span-1 row-span-4',
    '4x2': 'col-span-4 row-span-2',
    '2x4': 'col-span-2 row-span-4'
  };
  return spans[size] || 'col-span-1 row-span-1';
}

function getWidgetHeight(size: WidgetSize): string {
  const heights = {
    '1x1': 'h-48',
    '2x1': 'h-48',
    '1x2': 'h-96',
    '2x2': 'h-96',
    '3x1': 'h-48',
    '1x3': 'h-[600px]',
    '3x2': 'h-96',
    '2x3': 'h-[600px]',
    '3x3': 'h-[600px]',
    '4x1': 'h-48',
    '1x4': 'h-[800px]',
    '4x2': 'h-96',
    '2x4': 'h-[800px]'
  };
  return heights[size] || 'h-48';
}

function getGridColumns(size: WidgetSize): number {
  const [columns] = size.split('x').map(Number);
  return columns;
}

function getGridRows(size: WidgetSize): number {
  const [, rows] = size.split('x').map(Number);
  return rows;
}