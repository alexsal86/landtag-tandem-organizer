import React, { useState, useEffect, useRef } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Settings, Save, Layout, Plus, Grid3X3, Zap } from 'lucide-react';
import { useDashboardLayout } from '@/hooks/useDashboardLayout';
import { DashboardWidget } from '../DashboardWidget';
import { WidgetPalette } from './WidgetPalette';
import { WidgetResizeHandle } from './WidgetResizeHandle';
import { WidgetHoverControls } from './WidgetHoverControls';
import { ResponsiveGridSystem } from './ResponsiveGridSystem';
import { PerformanceMonitor } from './PerformanceMonitor';
import { ContextAwareSuggestions } from './ContextAwareSuggestions';
import { UndoRedoSystem } from './UndoRedoSystem';
import { RealTimeSync } from './RealTimeSync';
import { EditModeProvider, useEditMode } from './EditModeProvider';
import { GridDebugOverlay } from './GridDebugOverlay';
import { toast } from 'sonner';
import { DashboardWidget as WidgetType, WidgetSize } from '@/hooks/useDashboardLayout';
import { getGridColumns, getGridRows, isValidPosition, getCSSGridUnit, getResponsiveColumns } from '@/hooks/useDashboardGrid';

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
  const [containerWidth, setContainerWidth] = useState(1200);
  
  const dashboardRef = useRef<HTMLDivElement>(null);
  const autoSaveTimeoutRef = useRef<NodeJS.Timeout>();

  // Debounced auto-save to prevent race conditions
  const lastLayoutRef = useRef<string>('');
  
  useEffect(() => {
    if (isEditMode && autoSaveEnabled && currentLayout) {
      const currentLayoutString = JSON.stringify(currentLayout);
      
      // Only save if layout actually changed
      if (currentLayoutString !== lastLayoutRef.current) {
        if (autoSaveTimeoutRef.current) {
          clearTimeout(autoSaveTimeoutRef.current);
        }
        
        autoSaveTimeoutRef.current = setTimeout(() => {
          saveCurrentLayout();
          lastLayoutRef.current = currentLayoutString;
          toast.success('Automatisch gespeichert', { duration: 2000 });
        }, 2000);
      }
    }
    return () => {
      if (autoSaveTimeoutRef.current) {
        clearTimeout(autoSaveTimeoutRef.current);
      }
    };
  }, [currentLayout, isEditMode, autoSaveEnabled, saveCurrentLayout]);

  // Update container width on resize - sync with ResponsiveGridSystem
  useEffect(() => {
    const updateContainerWidth = () => {
      if (dashboardRef.current) {
        const rect = dashboardRef.current.getBoundingClientRect();
        setContainerWidth(rect.width);
      }
    };

    updateContainerWidth();
    
    const resizeObserver = new ResizeObserver(updateContainerWidth);
    if (dashboardRef.current) {
      resizeObserver.observe(dashboardRef.current);
    }

    return () => resizeObserver.disconnect();
  }, []);

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

  const handleWidgetDrop = (widgetId: string, x: number, y: number) => {
    if (!isEditMode) return;

    const widget = currentLayout.widgets.find(w => w.id === widgetId);
    if (!widget) return;

    // Clamp position to grid boundaries
    const maxColumns = getResponsiveColumns(containerWidth);
    const widgetCols = getGridColumns(widget.widgetSize);
    const clampedX = Math.max(0, Math.min(x, maxColumns - widgetCols));
    const clampedY = Math.max(0, y);

    // Check if position is valid
    const existingWidgets = currentLayout.widgets
      .filter(w => w.id !== widgetId)
      .map(w => ({
        x: w.position?.x || 0,
        y: w.position?.y || 0,
        w: getGridColumns(w.widgetSize),
        h: getGridRows(w.widgetSize),
        id: w.id
      }));

    if (!isValidPosition(clampedX, clampedY, widget.widgetSize, existingWidgets, widgetId, containerWidth)) {
      toast.error('Position nicht verfügbar - Widget kann hier nicht platziert werden');
      return;
    }

    // Update widget with new grid position
    updateWidget(widgetId, { 
      position: { x: clampedX, y: clampedY }
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

  const handleWidgetDelete = (widgetId: string) => {
    removeWidget(widgetId);
    toast.success('Widget gelöscht');
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
      blackboard: 'Schwarzes Brett',
      'combined-messages': 'Nachrichten & Brett',
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
      <ResponsiveGridSystem
        ref={dashboardRef}
        widgets={currentLayout.widgets}
        onWidgetDrop={handleWidgetDrop}
        onDragOver={handleDragOver}
        isEditMode={isEditMode}
        gridSnap={gridSnap}
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
                ${widget.configuration?.minimized ? 'h-12' : ''}
                ${draggedWidget === widget.id ? 'opacity-50 scale-95 z-30' : 'z-10'}
                ${isEditMode && hoveredWidget === widget.id ? 'ring-2 ring-primary/50 shadow-lg' : ''}
                ${isEditMode ? 'cursor-move' : 'cursor-default'}
                transition-all duration-200
              `}
              style={{
                gridColumn: `${gridColumnStart} / span ${getGridColumns(widget.widgetSize)}`,
                gridRow: `${gridRowStart} / span ${getGridRows(widget.widgetSize)}`
              }}
              draggable={isEditMode}
              onDragStart={(e) => {
                if (!isEditMode) return;
                setDraggedWidget(widget.id);
                e.dataTransfer.effectAllowed = 'move';
                e.dataTransfer.setData('text/plain', widget.id);
                // Add visual feedback
                e.currentTarget.style.opacity = '0.5';
              }}
              onDragEnd={(e) => {
                e.currentTarget.style.opacity = '1';
                setDraggedWidget(null);
              }}
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
                  onDelete={() => handleWidgetDelete(widget.id)}
                  onConfigure={() => {}}
                />
              )}

              {/* Widget Resize Handles - Only in Edit Mode */}
              {isEditMode && hoveredWidget === widget.id && !widget.configuration?.minimized && (
                  <WidgetResizeHandle
                    widget={widget}
                    onResize={(widgetId: string, size: WidgetSize) => handleWidgetResize(widgetId, size)}
                    gridSnap={gridSnap}
                    containerWidth={containerWidth}
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
      </ResponsiveGridSystem>

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

// Helper functions maintained for compatibility but moved to useDashboardGrid hook