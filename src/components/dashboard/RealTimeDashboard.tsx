import React, { useState, useEffect, useRef } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useDashboardLayout } from '@/hooks/useDashboardLayout';
import { DashboardWidget } from '../DashboardWidget';
import { WidgetPalette } from './WidgetPalette';
import { WidgetResizeSystem } from './WidgetResizeSystem';
import { WidgetOverlayMenu } from './WidgetOverlayMenu';
import { AutoLayoutEngine } from './AutoLayoutEngine';
import { UndoRedoSystem } from './UndoRedoSystem';
import { RealTimeSync } from './RealTimeSync';
import { PerformanceMonitor } from './PerformanceMonitor';
import { ContextAwareSuggestions } from './ContextAwareSuggestions';
import { toast } from 'sonner';
import { DashboardWidget as WidgetType, WidgetSize } from '@/hooks/useDashboardLayout';

export function RealTimeDashboard() {
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

  const [draggedWidget, setDraggedWidget] = useState<string | null>(null);
  const [hoveredWidget, setHoveredWidget] = useState<string | null>(null);
  const [resizingWidget, setResizingWidget] = useState<string | null>(null);
  const [showPalette, setShowPalette] = useState(false);
  const [gridSnap, setGridSnap] = useState(true);
  const [autoSaveEnabled, setAutoSaveEnabled] = useState(true);
  const [suggestions, setSuggestions] = useState<any[]>([]);
  
  const dashboardRef = useRef<HTMLDivElement>(null);
  const autoSaveTimeoutRef = useRef<NodeJS.Timeout>();

  // Auto-save functionality
  useEffect(() => {
    if (autoSaveEnabled && currentLayout) {
      if (autoSaveTimeoutRef.current) {
        clearTimeout(autoSaveTimeoutRef.current);
      }
      autoSaveTimeoutRef.current = setTimeout(() => {
        saveCurrentLayout();
      }, 2000);
    }
    return () => {
      if (autoSaveTimeoutRef.current) {
        clearTimeout(autoSaveTimeoutRef.current);
      }
    };
  }, [currentLayout, autoSaveEnabled, saveCurrentLayout]);

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
    setDraggedWidget(widgetId);
    event.dataTransfer.effectAllowed = 'move';
    event.dataTransfer.setData('text/plain', widgetId);
  };

  const handleWidgetDrop = (event: React.DragEvent) => {
    event.preventDefault();
    if (!draggedWidget || !dashboardRef.current) return;

    const rect = dashboardRef.current.getBoundingClientRect();
    const x = Math.floor((event.clientX - rect.left) / 200); // 200px grid
    const y = Math.floor((event.clientY - rect.top) / 200);

    if (gridSnap) {
      updateWidget(draggedWidget, { 
        position: { x: x * 200, y: y * 200 } 
      });
    } else {
      updateWidget(draggedWidget, { 
        position: { x: event.clientX - rect.left, y: event.clientY - rect.top } 
      });
    }

    setDraggedWidget(null);
    toast.success('Widget position updated');
  };

  const handleDragOver = (event: React.DragEvent) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
  };

  const handleWidgetResize = (widgetId: string, newSize: WidgetSize) => {
    updateWidget(widgetId, { widgetSize: newSize });
    toast.success('Widget size updated');
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
    toast.success('Widget hidden');
  };

  const handleAddWidget = (type: WidgetType['type'], position?: { x: number; y: number }) => {
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
      {/* Header */}
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground mb-2">
            Real-Time Dashboard
          </h1>
          <p className="text-muted-foreground">
            {currentLayout.name} - Live editing enabled
          </p>
        </div>
        
        <div className="flex items-center gap-2">
          <Button
            variant={showPalette ? "default" : "outline"}
            size="sm"
            onClick={() => setShowPalette(!showPalette)}
          >
            Widget hinzufügen
          </Button>
          
          <Button
            variant={gridSnap ? "default" : "outline"}
            size="sm"
            onClick={() => setGridSnap(!gridSnap)}
          >
            Grid Snap
          </Button>
          
          <Button
            variant={autoSaveEnabled ? "default" : "outline"}
            size="sm"
            onClick={() => setAutoSaveEnabled(!autoSaveEnabled)}
          >
            Auto-Save
          </Button>
        </div>
      </div>

      {/* Dashboard Grid */}
      <div
        ref={dashboardRef}
        className="relative min-h-[800px] grid grid-cols-6 gap-4 auto-rows-min"
        onDrop={handleWidgetDrop}
        onDragOver={handleDragOver}
        style={{
          backgroundImage: gridSnap ? `
            linear-gradient(to right, hsl(var(--border)) 1px, transparent 1px),
            linear-gradient(to bottom, hsl(var(--border)) 1px, transparent 1px)
          ` : 'none',
          backgroundSize: gridSnap ? '200px 200px' : 'auto'
        }}
      >
        {currentLayout.widgets.map((widget) => (
          <div
            key={widget.id}
            className={`
              relative 
              ${getGridSpan(widget.widgetSize)}
              ${widget.configuration?.minimized ? 'h-12' : getWidgetHeight(widget.widgetSize)}
              ${draggedWidget === widget.id ? 'opacity-50 scale-95' : ''}
              ${hoveredWidget === widget.id ? 'ring-2 ring-primary/50' : ''}
              transition-all duration-200
            `}
            draggable
            onDragStart={(e) => handleWidgetDragStart(widget.id, e)}
            onMouseEnter={() => setHoveredWidget(widget.id)}
            onMouseLeave={() => setHoveredWidget(null)}
          >
            {/* Widget controls are now handled within DashboardWidget */}

            {/* Widget Content */}
            <DashboardWidget 
              widget={widget} 
              isDragging={draggedWidget === widget.id}
              isEditMode={true}
              onResize={(widgetId, newSize) => handleWidgetResize(widgetId, newSize)}
              onMinimize={(widgetId) => handleWidgetMinimize(widgetId)}
              onHide={(widgetId) => handleWidgetHide(widgetId)}
              onDelete={(widgetId) => handleWidgetHide(widgetId)}
              onConfigure={(widgetId) => console.log('Configure widget:', widgetId)}
              containerWidth={1200}
            />
          </div>
        ))}
      </div>

      {/* Widget Palette */}
      {showPalette && (
        <WidgetPalette
          onAddWidget={handleAddWidget}
          onClose={() => setShowPalette(false)}
          suggestions={suggestions}
        />
      )}

      {/* Context-Aware Suggestions */}
      <ContextAwareSuggestions
        currentLayout={currentLayout}
        onSuggestionApply={(suggestion) => {
          // Apply suggestion logic
          toast.success('Suggestion applied');
        }}
        onSuggestionsUpdate={setSuggestions}
      />

      {/* Undo/Redo System */}
      <UndoRedoSystem />

      {/* Auto Layout Engine */}
      <AutoLayoutEngine
        currentLayout={currentLayout}
        onLayoutOptimized={(optimizedLayout) => {
          // Apply optimized layout
          toast.success('Layout optimized');
        }}
      />

      {/* Real-Time Sync */}
      <RealTimeSync
        currentLayout={currentLayout}
        onLayoutUpdate={(updatedLayout) => {
          // Handle real-time updates
        }}
      />

      {/* Performance Monitor */}
      <PerformanceMonitor
        widgets={currentLayout.widgets}
        onPerformanceAlert={(alert) => {
          toast.warning(alert.message);
        }}
      />

      {/* Status Indicators */}
      <div className="fixed bottom-6 right-6 flex flex-col gap-2">
        {autoSaveEnabled && (
          <div className="bg-primary/10 text-primary px-3 py-1 rounded-full text-sm">
            Auto-Save ON
          </div>
        )}
        {gridSnap && (
          <div className="bg-accent px-3 py-1 rounded-full text-sm">
            Grid Snap
          </div>
        )}
      </div>
    </div>
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