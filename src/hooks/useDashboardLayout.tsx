import { useState, useEffect, useRef } from 'react';
import { toast } from 'sonner';
import { useAuth } from './useAuth';
import { useTenant } from './useTenant';
import { supabase } from '@/integrations/supabase/client';
import type { Database, Json } from '@/integrations/supabase/types';
import { getGridColumns, getGridRows, findAvailablePosition } from './useDashboardGrid';
import { debugConsole } from '@/utils/debugConsole';
import type {
  DashboardLayout,
  DashboardWidget,
  DashboardWidgetType,
  WidgetConfigMap,
  WidgetSize,
} from '@/types/dashboardWidgets';
import { isDashboardWidgetType } from '@/types/dashboardWidgets';

export type { DashboardLayout, DashboardWidget, DashboardWidgetType, WidgetConfigMap, WidgetSize } from '@/types/dashboardWidgets';


type DashboardLayoutRow = Pick<Database['public']['Tables']['team_dashboards']['Row'], 'id' | 'name' | 'layout_data'>;

const isDashboardPosition = (value: unknown): value is DashboardWidget['position'] => {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Record<string, unknown>;
  return typeof candidate.x === 'number' && typeof candidate.y === 'number';
};

const isDashboardSize = (value: unknown): value is DashboardWidget['size'] => {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Record<string, unknown>;
  return typeof candidate.width === 'number' && typeof candidate.height === 'number';
};

const isWidgetSize = (value: unknown): value is WidgetSize =>
  typeof value === 'string' && /^[1-8]x[1-4]$/.test(value);

const isDashboardWidgetConfiguration = (value: unknown): value is WidgetConfigMap[DashboardWidgetType] =>
  value == null || (typeof value === 'object' && !Array.isArray(value));

const isDashboardWidget = (value: unknown): value is DashboardWidget => {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Record<string, unknown>;
  return (
    typeof candidate.id === 'string' &&
    typeof candidate.title === 'string' &&
    typeof candidate.type === 'string' &&
    isDashboardWidgetType(candidate.type) &&
    isDashboardPosition(candidate.position) &&
    isDashboardSize(candidate.size) &&
    isWidgetSize(candidate.widgetSize) &&
    isDashboardWidgetConfiguration(candidate.configuration)
  );
};

const parseStoredLayout = (value: string | null): DashboardLayout | null => {
  if (!value) return null;
  try {
    const parsed: unknown = JSON.parse(value);
    if (!parsed || typeof parsed !== 'object') return null;
    const candidate = parsed as Record<string, unknown>;
    if (typeof candidate.name !== 'string' || !Array.isArray(candidate.widgets) || typeof candidate.isActive !== 'boolean') {
      return null;
    }
    const widgets = candidate.widgets.filter(isDashboardWidget);
    return {
      id: typeof candidate.id === 'string' ? candidate.id : undefined,
      name: candidate.name,
      widgets,
      isActive: candidate.isActive,
    };
  } catch {
    return null;
  }
};

const parseLayoutData = (value: Json): DashboardWidget[] =>
  Array.isArray(value) ? (value as unknown[]).filter(isDashboardWidget) : [];

export function useDashboardLayout() {
  const [layouts, setLayouts] = useState<DashboardLayout[]>([]);
  const [currentLayout, setCurrentLayout] = useState<DashboardLayout | null>(null);
  const [loading, setLoading] = useState(false);
  const [pendingWidgetType, setPendingWidgetType] = useState<string | null>(null);
  const { user } = useAuth();
  const { currentTenant } = useTenant();
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);

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
        id: 'appointmentfeedback',
        type: 'appointmentfeedback',
        title: 'Termin-Feedback',
        position: { x: 6, y: 3 },
        size: { width: 2, height: 2 },
        widgetSize: '2x2',
        configuration: { theme: 'default' }
      },
      {
        id: 'actions',
        type: 'actions',
        title: 'Schnellaktionen',
        position: { x: 0, y: 5 },
        size: { width: 6, height: 1 },
        widgetSize: '6x1',
        configuration: { theme: 'default', showIcons: true }
      },
      {
        id: 'news',
        type: 'news',
        title: 'News Feed',
        position: { x: 6, y: 5 },
        size: { width: 2, height: 2 },
        widgetSize: '2x2',
        configuration: { theme: 'default', refreshInterval: 300 }
      }
    ]
  };

  // Initialize with default layout and load from database with fallback
  // Only load once when user/tenant first become available
  const [hasInitialized, setHasInitialized] = useState(false);
  
  useEffect(() => {
    if (hasInitialized) return; // Prevent reloading after initialization
    
    if (user?.id && currentTenant?.id) {
      loadLayoutFromDatabase();
      setHasInitialized(true);
    } else if (!user) {
      // Try to load from localStorage for anonymous users
      try {
        const saved = localStorage.getItem(`dashboard-layout-anonymous`);
        if (saved) {
          const layout = parseStoredLayout(saved);
          if (layout) {
            setCurrentLayout(layout);
            setLayouts([layout, defaultLayout]);
          } else {
            setCurrentLayout(defaultLayout);
            setLayouts([defaultLayout]);
          }
        } else {
          setCurrentLayout(defaultLayout);
          setLayouts([defaultLayout]);
        }
        setHasInitialized(true);
      } catch (error) {
        setCurrentLayout(defaultLayout);
        setLayouts([defaultLayout]);
        setHasInitialized(true);
      }
    }
  }, [user, currentTenant, hasInitialized]);

  // Load layout from database with localStorage fallback
  const loadLayoutFromDatabase = async () => {
    if (!user || !currentTenant) return;

    try {
      setLoading(true);
      
      const { data, error } = await supabase
        .from('team_dashboards')
        .select('id, name, description, layout_data, is_public')
        .eq('owner_id', user.id)
        .eq('tenant_id', currentTenant.id)
        .order('updated_at', { ascending: false })
        .limit(1)
        .single();

      if (error && error.code !== 'PGRST116') {
        debugConsole.error('Database query error:', error);
        throw error;
      }

      if (data?.layout_data) {
        // Filter out quickactions widget from loaded layout
        const filteredWidgets = parseLayoutData((data as DashboardLayoutRow).layout_data)
          .filter((widget) => widget.type !== 'quickactions');
        
        const layout: DashboardLayout = {
          id: data.id,
          name: data.name,
          widgets: filteredWidgets,
          isActive: true
        };
        setCurrentLayout(layout);
        setLayouts([layout, defaultLayout]);
      } else {
        // Try localStorage fallback
        try {
          const saved = localStorage.getItem(`dashboard-layout-${user.id}`);
          if (saved) {
            const layout = parseStoredLayout(saved);
            if (layout) {
              setCurrentLayout(layout);
              setLayouts([layout, defaultLayout]);
            } else {
              setCurrentLayout(defaultLayout);
              setLayouts([defaultLayout]);
            }
            // Save to Supabase for future use
            setTimeout(() => saveCurrentLayout(), 1000);
          } else {
            setCurrentLayout(defaultLayout);
            setLayouts([defaultLayout]);
          }
        } catch (localError) {
          setCurrentLayout(defaultLayout);
          setLayouts([defaultLayout]);
        }
      }
    } catch (error) {
      debugConsole.error('Failed to load layout from Supabase:', error);
      // Fallback to localStorage
      try {
        const saved = localStorage.getItem(`dashboard-layout-${user.id}`);
        if (saved) {
          const layout = parseStoredLayout(saved);
          if (layout) {
            setCurrentLayout(layout);
            setLayouts([layout, defaultLayout]);
          } else {
            setCurrentLayout(defaultLayout);
            setLayouts([defaultLayout]);
          }
        } else {
          setCurrentLayout(defaultLayout);
          setLayouts([defaultLayout]);
        }
      } catch (localError) {
        debugConsole.warn('Failed to load from localStorage fallback:', localError);
        setCurrentLayout(defaultLayout);
        setLayouts([defaultLayout]);
      }
    } finally {
      setLoading(false);
    }
  };

  // Update widget position/size with improved persistence
  const updateWidget = (widgetId: string, updates: Partial<DashboardWidget>) => {
    if (!currentLayout) {
      return;
    }

    const updatedWidgets = currentLayout.widgets.map(widget =>
      widget.id === widgetId ? { ...widget, ...updates } : widget
    );

    const updatedLayout = { ...currentLayout, widgets: updatedWidgets };
    setCurrentLayout(updatedLayout);
    
    // Immediate local storage backup
    try {
      localStorage.setItem(`dashboard-layout-${user?.id || 'anonymous'}`, JSON.stringify(updatedLayout));
    } catch (error) {
      // silently fail
    }
    
    // Clear existing timeout and set new one for debounced save
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }
    
    saveTimeoutRef.current = setTimeout(async () => {
      try {
        await saveCurrentLayout();
      } catch (error) {
        toast.error('Änderungen konnten nicht gespeichert werden - lokal gespeichert');
      }
    }, 1000);
  };

  // Update entire layout (for batch updates)
  const updateLayout = (updatedLayout: DashboardLayout) => {
    setCurrentLayout(updatedLayout);
    
    // Immediate local storage backup
    try {
      localStorage.setItem(`dashboard-layout-${user?.id || 'anonymous'}`, JSON.stringify(updatedLayout));
    } catch (error) {
      // silently fail
    }
    
    // Clear existing timeout and set new one for debounced save
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }
    
    saveTimeoutRef.current = setTimeout(async () => {
      try {
        await saveCurrentLayout();
      } catch (error) {
        toast.error('Änderungen konnten nicht gespeichert werden - lokal gespeichert');
      }
    }, 1000);
  };

  // Save current layout to database with retry mechanism
  const saveCurrentLayout = async (name?: string) => {
    if (!currentLayout) {
      debugConsole.log('❌ No currentLayout available');
      toast.error('Kein Layout zum Speichern verfügbar');
      return false;
    }

    if (!user?.id) {
      
      toast.error('Benutzer nicht angemeldet oder User-ID fehlt');
      return false;
    }

    if (!currentTenant?.id) {
      
      toast.error('Kein Mandant ausgewählt');
      return false;
    }

    try {
      // Generate a valid UUID for the layout if it doesn't have one
      const layoutId = currentLayout.id && currentLayout.id !== '' 
        ? currentLayout.id 
        : crypto.randomUUID();

      const tenantId = currentTenant.id;

      

      const layoutToSave = name 
        ? { ...currentLayout, name, id: crypto.randomUUID() }
        : { ...currentLayout, id: layoutId };

      // Ensure we have a valid name
      if (!layoutToSave.name || layoutToSave.name === '') {
        layoutToSave.name = 'Standard Layout';
      }

      // Clean and validate layout data
      const cleanWidgets = layoutToSave.widgets.map(widget => ({
        id: widget.id,
        type: widget.type,
        title: widget.title,
        position: widget.position || { x: 0, y: 0 },
        size: widget.size || { width: 2, height: 2 },
        widgetSize: widget.widgetSize || '2x2',
        configuration: widget.configuration || {}
      }));

      // Validate all required fields before saving
      if (!layoutToSave.id || layoutToSave.id === '') {
        throw new Error('Layout ID is missing');
      }
      if (!user.id || user.id === '') {
        throw new Error('User ID is missing');
      }
      if (!tenantId || tenantId === '') {
        throw new Error('Tenant ID is missing');
      }


      // Save to Supabase with validated data
      const { data, error } = await supabase
        .from('team_dashboards')
        .upsert({
          id: layoutToSave.id,
          owner_id: user.id,
          name: layoutToSave.name,
          description: 'Custom Dashboard',
          layout_data: cleanWidgets,
          is_public: false,
          tenant_id: tenantId
        }, {
          onConflict: 'id'
        })
        .select();

      if (error) {
        throw error;
      }

      if (!data || data.length === 0) {
        throw new Error('No data returned from database');
      }

      // Update local state only if database save was successful
      if (name) {
        setLayouts(prev => [...prev, layoutToSave]);
        setCurrentLayout(layoutToSave);
      } else {
        // Update current layout with the saved ID
        setCurrentLayout(layoutToSave);
      }

      // Save to localStorage as backup
      localStorage.setItem(`dashboard-layout-${user.id}`, JSON.stringify(layoutToSave));
      
      toast.success('Layout erfolgreich gespeichert');
      return true;
      
    } catch (error) {
      
      
      // Fallback: save to localStorage only
      try {
        localStorage.setItem(`dashboard-layout-${user.id}`, JSON.stringify(currentLayout));
        toast.error('Layout nur lokal gespeichert - Server-Fehler');
      } catch (localError) {
        toast.error('Speichern komplett fehlgeschlagen');
      }
      return false;
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
    if (!currentLayout) {
      toast.error('Layout nicht verfügbar');
      return;
    }

    // Validiere Type
    if (!isDashboardWidgetType(type)) {
      toast.error(`Ungültiger Widget-Typ: ${type}`);
      return;
    }
    
    // Widget titles mapping für korrekte deutsche Titel
    const widgetTitles: Record<string, string> = {
      'stats': 'Schnellstatistiken',
      'tasks': 'Ausstehende Aufgaben',
      'schedule': 'Terminplan',
      'appointmentfeedback': 'Termin-Feedback',
      'messages': 'Nachrichten',
      'combined-messages': 'Chat',
      'quicknotes': 'Quick Notes',
      'pomodoro': 'Pomodoro Timer',
      'habits': 'Habit Tracker',
      'calllog': 'Anrufliste',
      'teamchat': 'Team Chat',
      'quickactions': 'Quick Actions',
      'news': 'News Feed',
      'blackboard': 'Pinnwand',
      'actions': 'Aktionen',
      'stakeholder-network': 'Stakeholder-Netzwerk'
    };
    
    // Find next available position
    const existingPositions = currentLayout.widgets.map(w => ({
      x: w.position.x,
      y: w.position.y,
      w: 2,
      h: 2
    }));

    const defaultPosition = position || findAvailablePosition(existingPositions);

    const newWidget: DashboardWidget = {
      id: `widget-${Date.now()}`,
      type,
      title: widgetTitles[type] || type.charAt(0).toUpperCase() + type.slice(1),
      position: defaultPosition,
      size: { width: 400, height: 400 },
      widgetSize: '2x2'
    };
    
    
    
    // Verwende React's setState callback pattern um sicherzustellen, dass das Update ankommt
    setCurrentLayout(prev => {
      if (!prev) return prev;
      const newLayout = {
        ...prev,
        widgets: [...prev.widgets, newWidget]
      };
      
      return newLayout;
    });
    
    // Set pending widget type für Toast-Nachricht nach Render
    setPendingWidgetType(widgetTitles[type] || type);
    
    // Auto-save after a delay to ensure state is updated
    setTimeout(() => {
      
      saveCurrentLayout();
    }, 500);
  };

  // Show success toast after widget is added
  useEffect(() => {
    if (pendingWidgetType && currentLayout) {
      
      toast.success(`${pendingWidgetType} Widget hinzugefügt`);
      setPendingWidgetType(null);
    }
  }, [pendingWidgetType, currentLayout]);

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

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
    };
  }, []);

  return {
    layouts,
    currentLayout,
    loading,
    updateWidget,
    updateLayout,
    addWidget,
    removeWidget,
    saveCurrentLayout,
    switchLayout,
    deleteLayout,
    defaultLayout
  };
}
