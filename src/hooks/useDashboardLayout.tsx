import { useState, useEffect } from 'react';
import { toast } from 'sonner';

export type WidgetSize = '1x1' | '2x1' | '1x2' | '2x2' | '3x1' | '1x3' | '3x2' | '2x3' | '3x3' | '4x1' | '1x4' | '4x2' | '2x4';

export interface DashboardWidget {
  id: string;
  type: 'stats' | 'tasks' | 'schedule' | 'actions' | 'messages' | 'quicknotes' | 'pomodoro' | 'habits' | 'calllog' | 'teamchat';
  title: string;
  position: { x: number; y: number };
  size: { width: number; height: number };
  widgetSize: WidgetSize;
  configuration?: {
    theme?: string;
    refreshInterval?: number;
    showHeader?: boolean;
    compact?: boolean;
    autoSave?: boolean;
    notifications?: boolean;
    [key: string]: any;
  };
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
        size: { width: 6, height: 1 },
        widgetSize: '3x1',
        configuration: { theme: 'default', refreshInterval: 300 }
      },
      {
        id: 'messages',
        type: 'messages',
        title: 'Nachrichten',
        position: { x: 6, y: 0 },
        size: { width: 6, height: 2 },
        widgetSize: '3x2',
        configuration: { theme: 'default', notifications: true }
      },
      {
        id: 'tasks',
        type: 'tasks',
        title: 'Ausstehende Aufgaben',
        position: { x: 0, y: 1 },
        size: { width: 6, height: 2 },
        widgetSize: '3x2',
        configuration: { theme: 'default', showHeader: true }
      },
      {
        id: 'quicknotes',
        type: 'quicknotes',
        title: 'Quick Notes',
        position: { x: 0, y: 3 },
        size: { width: 4, height: 2 },
        widgetSize: '2x2',
        configuration: { theme: 'default', autoSave: true, compact: false }
      },
      {
        id: 'pomodoro',
        type: 'pomodoro',
        title: 'Pomodoro Timer',
        position: { x: 4, y: 3 },
        size: { width: 4, height: 1 },
        widgetSize: '2x1',
        configuration: { theme: 'default', notifications: true }
      },
      {
        id: 'habits',
        type: 'habits',
        title: 'Habit Tracker',
        position: { x: 8, y: 3 },
        size: { width: 4, height: 2 },
        widgetSize: '2x2',
        configuration: { theme: 'default', showStreak: true }
      },
      {
        id: 'schedule',
        type: 'schedule',
        title: 'Heutiger Terminplan',
        position: { x: 0, y: 5 },
        size: { width: 6, height: 2 },
        widgetSize: '3x2',
        configuration: { theme: 'default', compact: false }
      },
      {
        id: 'calllog',
        type: 'calllog',
        title: 'Call Log',
        position: { x: 6, y: 5 },
        size: { width: 6, height: 2 },
        widgetSize: '3x2',
        configuration: { theme: 'default', showFollowUps: true }
      },
      {
        id: 'actions',
        type: 'actions',
        title: 'Schnellaktionen',
        position: { x: 4, y: 4 },
        size: { width: 8, height: 1 },
        widgetSize: '4x1',
        configuration: { theme: 'default', showIcons: true }
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