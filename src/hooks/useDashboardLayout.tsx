import { useState, useEffect } from 'react';
import { toast } from 'sonner';
import { useAuth } from './useAuth';
import { supabase } from '@/integrations/supabase/client';

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
  const { user } = useAuth();

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

  // Initialize with default layout and load from database with fallback
  useEffect(() => {
    if (user) {
      loadLayoutFromDatabase();
    } else {
      // Try to load from localStorage for anonymous users
      try {
        const saved = localStorage.getItem(`dashboard-layout-anonymous`);
        if (saved) {
          const layout = JSON.parse(saved);
          setCurrentLayout(layout);
          setLayouts([layout, defaultLayout]);
        } else {
          setCurrentLayout(defaultLayout);
          setLayouts([defaultLayout]);
        }
      } catch (error) {
        console.warn('Failed to load from localStorage:', error);
        setCurrentLayout(defaultLayout);
        setLayouts([defaultLayout]);
      }
    }
  }, [user]);

  // Load layout from database with localStorage fallback
  const loadLayoutFromDatabase = async () => {
    if (!user) return;

    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('team_dashboards')
        .select('layout_data')
        .eq('owner_id', user.id)
        .single();

      if (error && error.code !== 'PGRST116') {
        throw error;
      }

      if (data?.layout_data) {
        const layout = data.layout_data as unknown as DashboardLayout;
        setCurrentLayout(layout);
        setLayouts([layout, defaultLayout]);
      } else {
        // Try localStorage fallback
        try {
          const saved = localStorage.getItem(`dashboard-layout-${user.id}`);
          if (saved) {
            const layout = JSON.parse(saved);
            setCurrentLayout(layout);
            setLayouts([layout, defaultLayout]);
            // Save to Supabase for future use
            setTimeout(() => saveCurrentLayout(), 1000);
          } else {
            setCurrentLayout(defaultLayout);
            setLayouts([defaultLayout]);
          }
        } catch (localError) {
          console.warn('Failed to load from localStorage:', localError);
          setCurrentLayout(defaultLayout);
          setLayouts([defaultLayout]);
        }
      }
    } catch (error) {
      console.error('Failed to load layout from Supabase:', error);
      // Fallback to localStorage
      try {
        const saved = localStorage.getItem(`dashboard-layout-${user.id}`);
        if (saved) {
          const layout = JSON.parse(saved);
          setCurrentLayout(layout);
          setLayouts([layout, defaultLayout]);
        } else {
          setCurrentLayout(defaultLayout);
          setLayouts([defaultLayout]);
        }
      } catch (localError) {
        console.warn('Failed to load from localStorage fallback:', localError);
        setCurrentLayout(defaultLayout);
        setLayouts([defaultLayout]);
      }
    } finally {
      setLoading(false);
    }
  };

  // Update widget position/size with improved persistence
  const updateWidget = (widgetId: string, updates: Partial<DashboardWidget>) => {
    if (!currentLayout) return;

    const updatedWidgets = currentLayout.widgets.map(widget =>
      widget.id === widgetId ? { ...widget, ...updates } : widget
    );

    const updatedLayout = { ...currentLayout, widgets: updatedWidgets };
    setCurrentLayout(updatedLayout);
    
    // Immediate local storage backup
    try {
      localStorage.setItem(`dashboard-layout-${user?.id || 'anonymous'}`, JSON.stringify(updatedLayout));
    } catch (error) {
      console.warn('Failed to save to localStorage:', error);
    }
    
    // Debounced Supabase save with retry mechanism
    setTimeout(async () => {
      try {
        await saveCurrentLayout();
      } catch (error) {
        console.error('Failed to save to Supabase, retrying...', error);
        // Retry once after 2 seconds
        setTimeout(() => {
          saveCurrentLayout().catch(console.error);
        }, 2000);
      }
    }, 1000);
  };

  // Save current layout to database
  const saveCurrentLayout = async (name?: string) => {
    if (!currentLayout || !user) return;
    
    try {
      const layoutToSave = name 
        ? { ...currentLayout, name, id: Math.random().toString() }
        : currentLayout;

      // Save to Supabase with proper serialization
      const { error } = await supabase
        .from('team_dashboards')
        .upsert({
          owner_id: user.id,
          name: layoutToSave.name,
          layout_data: JSON.parse(JSON.stringify(layoutToSave)),
          updated_at: new Date().toISOString()
        }, {
          onConflict: 'owner_id'
        });

      if (error) throw error;

      if (name) {
        setLayouts(prev => [...prev, layoutToSave]);
        setCurrentLayout(layoutToSave);
      } else {
        // Update the current layout in state to reflect saved changes
        setCurrentLayout({ ...layoutToSave });
      }
      
      toast.success('Layout gespeichert');
    } catch (error) {
      console.error('Failed to save layout:', error);
      toast.error('Layout konnte nicht gespeichert werden');
    }
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

  // Add new widget
  const addWidget = (widget: DashboardWidget) => {
    if (!currentLayout) return;
    
    const updatedLayout = {
      ...currentLayout,
      widgets: [...currentLayout.widgets, widget]
    };
    setCurrentLayout(updatedLayout);
    
    // Auto-save after a delay to ensure state is updated
    setTimeout(() => {
      saveCurrentLayout();
    }, 100);
  };

  // Remove widget
  const removeWidget = (widgetId: string) => {
    if (!currentLayout) return;
    
    const updatedLayout = {
      ...currentLayout,
      widgets: currentLayout.widgets.filter(w => w.id !== widgetId)
    };
    setCurrentLayout(updatedLayout);
    
    // Auto-save after a delay to ensure state is updated
    setTimeout(() => {
      saveCurrentLayout();
    }, 100);
  };

  return {
    layouts,
    currentLayout,
    loading,
    updateWidget,
    addWidget,
    removeWidget,
    saveCurrentLayout,
    switchLayout,
    deleteLayout,
    defaultLayout
  };
}