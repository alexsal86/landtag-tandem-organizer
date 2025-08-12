import { useState, useEffect } from 'react';
import { toast } from 'sonner';

export interface DashboardWidget {
  id: string;
  type: 'stats' | 'tasks' | 'schedule' | 'actions' | 'messages';
  title: string;
  position: { x: number; y: number };
  size: { width: number; height: number };
  data?: any;
}

export interface DashboardLayout {
  id?: string;
  name: string;
  widgets: DashboardWidget[];
  isActive: boolean;
}

export function useDashboardLayout() {
  const [layouts, setLayouts] = useState<DashboardLayout[]>([]);
  const [currentLayout, setCurrentLayout] = useState<DashboardLayout | null>(null);
  const [loading, setLoading] = useState(false);

  // Default layout
  const defaultLayout: DashboardLayout = {
    name: 'Standard Layout',
    isActive: true,
    widgets: [
      {
        id: 'stats',
        type: 'stats',
        title: 'Schnellstatistiken',
        position: { x: 0, y: 0 },
        size: { width: 12, height: 1 }
      },
      {
        id: 'tasks',
        type: 'tasks',
        title: 'Ausstehende Aufgaben',
        position: { x: 0, y: 1 },
        size: { width: 6, height: 2 }
      },
      {
        id: 'schedule',
        type: 'schedule',
        title: 'Heutiger Terminplan',
        position: { x: 6, y: 1 },
        size: { width: 6, height: 2 }
      },
      {
        id: 'actions',
        type: 'actions',
        title: 'Schnellaktionen',
        position: { x: 0, y: 3 },
        size: { width: 4, height: 1 }
      },
      {
        id: 'messages',
        type: 'messages',
        title: 'Nachrichten',
        position: { x: 4, y: 3 },
        size: { width: 8, height: 2 }
      }
    ]
  };

  // Initialize with default layout
  useEffect(() => {
    setCurrentLayout(defaultLayout);
    setLayouts([defaultLayout]);
  }, []);

  // Update widget position/size
  const updateWidget = (widgetId: string, updates: Partial<DashboardWidget>) => {
    if (!currentLayout) return;

    const updatedWidgets = currentLayout.widgets.map(widget =>
      widget.id === widgetId ? { ...widget, ...updates } : widget
    );

    const updatedLayout = { ...currentLayout, widgets: updatedWidgets };
    setCurrentLayout(updatedLayout);
  };

  // Save current layout (for now just store locally)
  const saveCurrentLayout = async (name?: string) => {
    if (!currentLayout) return;
    
    const layoutToSave = name 
      ? { ...currentLayout, name, id: Math.random().toString() }
      : currentLayout;

    if (name) {
      setLayouts(prev => [...prev, layoutToSave]);
      setCurrentLayout(layoutToSave);
    }
    
    toast.success('Layout gespeichert');
  };

  // Switch to different layout
  const switchLayout = async (layoutId: string) => {
    const layout = layouts.find(l => l.id === layoutId);
    if (!layout) return;

    setCurrentLayout(layout);
  };

  // Delete layout
  const deleteLayout = async (layoutId: string) => {
    setLayouts(prev => prev.filter(l => l.id !== layoutId));
    
    // If deleted layout was current, switch to default
    if (currentLayout?.id === layoutId) {
      setCurrentLayout(defaultLayout);
    }
    
    toast.success('Layout gelöscht');
  };

  return {
    layouts,
    currentLayout,
    loading,
    updateWidget,
    saveCurrentLayout,
    switchLayout,
    deleteLayout,
    defaultLayout
  };
}