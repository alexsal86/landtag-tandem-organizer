import { useState, useEffect } from 'react';
import { toast } from 'sonner';
import { useAuth } from './useAuth';
import { supabase } from '@/integrations/supabase/client';
import { getGridColumns, getGridRows, findAvailablePosition } from './useDashboardGrid';

export type WidgetSize = 
  | '1x1' | '2x1' | '1x2' | '2x2' | '3x1' | '1x3' | '3x2' | '2x3' | '3x3' 
  | '4x1' | '1x4' | '4x2' | '2x4' | '4x3' | '3x4' | '4x4' | '5x1' | '5x2' 
  | '6x1' | '6x2' | '7x1' | '7x2' | '8x1' | '8x2';

export interface DashboardWidget {
  id: string;
  type: 'stats' | 'tasks' | 'schedule' | 'actions' | 'messages' | 'blackboard' | 'quicknotes' | 'pomodoro' | 'habits' | 'calllog' | 'teamchat';
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
        size: { width: 3, height: 1 },
        widgetSize: '3x1',
        configuration: { theme: 'default', refreshInterval: 300 }
      },
      {
        id: 'pomodoro',
        type: 'pomodoro',
        title: 'Pomodoro Timer',
        position: { x: 3, y: 0 },
        size: { width: 2, height: 1 },
        widgetSize: '2x1',
        configuration: { theme: 'default', notifications: true }
      },
      {
        id: 'messages',
        type: 'messages',
        title: 'Nachrichten',
        position: { x: 5, y: 0 },
        size: { width: 3, height: 1 },
        widgetSize: '3x1',
        configuration: { theme: 'default', notifications: true }
      },
      {
        id: 'tasks',
        type: 'tasks',
        title: 'Ausstehende Aufgaben',
        position: { x: 0, y: 1 },
        size: { width: 3, height: 2 },
        widgetSize: '3x2',
        configuration: { theme: 'default', showHeader: true }
      },
      {
        id: 'quicknotes',
        type: 'quicknotes',
        title: 'Quick Notes',
        position: { x: 3, y: 1 },
        size: { width: 2, height: 2 },
        widgetSize: '2x2',
        configuration: { theme: 'default', autoSave: true, compact: false }
      },
      {
        id: 'habits',
        type: 'habits',
        title: 'Habit Tracker',
        position: { x: 5, y: 1 },
        size: { width: 3, height: 2 },
        widgetSize: '3x2',
        configuration: { theme: 'default', showStreak: true }
      },
      {
        id: 'schedule',
        type: 'schedule',
        title: 'Heutiger Terminplan',
        position: { x: 0, y: 3 },
        size: { width: 3, height: 2 },
        widgetSize: '3x2',
        configuration: { theme: 'default', compact: false }
      },
      {
        id: 'calllog',
        type: 'calllog',
        title: 'Call Log',
        position: { x: 3, y: 3 },
        size: { width: 3, height: 2 },
        widgetSize: '3x2',
        configuration: { theme: 'default', showFollowUps: true }
      },
      {
        id: 'actions',
        type: 'actions',
        title: 'Schnellaktionen',
        position: { x: 0, y: 5 },
        size: { width: 8, height: 1 },
        widgetSize: '8x1',
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
      console.log('Loading dashboard layout from database...');
      
      const { data, error } = await supabase
        .from('team_dashboards')
        .select('id, name, description, layout_data, is_public')
        .eq('owner_id', user.id)
        .order('updated_at', { ascending: false })
        .limit(1)
        .single();

      if (error && error.code !== 'PGRST116') {
        console.error('Database query error:', error);
        throw error;
      }

      if (data?.layout_data) {
        console.log('Successfully loaded layout from database');
        const layout: DashboardLayout = {
          id: data.id,
          name: data.name,
          widgets: (data.layout_data as any) as DashboardWidget[],
          isActive: true
        };
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

  // Save current layout to database with retry mechanism
  const saveCurrentLayout = async (name?: string) => {
    if (!currentLayout || !user) return;
    
    let retryCount = 0;
    const maxRetries = 3;
    
    const attemptSave = async (): Promise<boolean> => {
      try {
        const layoutToSave = name 
          ? { ...currentLayout, name, id: crypto.randomUUID() }
          : currentLayout;

        // Save to Supabase with proper error handling
        const { error } = await supabase
          .from('team_dashboards')
          .upsert({
            id: layoutToSave.id || crypto.randomUUID(),
            owner_id: user.id,
            name: layoutToSave.name,
            description: 'Custom Dashboard',
            layout_data: JSON.parse(JSON.stringify(layoutToSave.widgets)) as any,
            is_public: false
          }, {
            onConflict: 'id',
            ignoreDuplicates: false
          });

        if (error) {
          console.error('Database save error:', error);
          throw error;
        }

        if (name) {
          setLayouts(prev => [...prev, layoutToSave]);
          setCurrentLayout(layoutToSave);
        }
        
        return true;
      } catch (error) {
        console.error(`Save attempt ${retryCount + 1} failed:`, error);
        retryCount++;
        
        if (retryCount < maxRetries) {
          // Exponential backoff
          await new Promise(resolve => setTimeout(resolve, Math.pow(2, retryCount) * 1000));
          return attemptSave();
        }
        return false;
      }
    };

    const success = await attemptSave();
    
    // Always save to localStorage as fallback
    try {
      localStorage.setItem(`dashboard-layout-${user.id}`, JSON.stringify(currentLayout));
    } catch (error) {
      console.warn('Failed to save to localStorage:', error);
    }

    if (success) {
      toast.success('Layout gespeichert');
    } else {
      toast.error('Layout konnte nicht gespeichert werden - wird lokal gespeichert');
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

  // Add new widget with position parameter
  const addWidget = (type: string, position?: { x: number; y: number }) => {
    if (!currentLayout) return;
    
    // Find next available position
    const existingPositions = currentLayout.widgets.map(w => ({
      x: w.position.x,
      y: w.position.y,
      w: getGridColumns(w.widgetSize),
      h: getGridRows(w.widgetSize)
    }));

    const defaultPosition = position || findAvailablePosition(existingPositions);

    const newWidget: DashboardWidget = {
      id: `widget-${Date.now()}`,
      type: type as any,
      title: type.charAt(0).toUpperCase() + type.slice(1),
      position: defaultPosition,
      size: { width: 400, height: 400 },
      widgetSize: '2x2'
    };
    
    const updatedLayout = {
      ...currentLayout,
      widgets: [...currentLayout.widgets, newWidget]
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