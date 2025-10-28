import { useState, useEffect, useRef } from 'react';
import { toast } from 'sonner';
import { useAuth } from './useAuth';
import { useTenant } from './useTenant';
import { supabase } from '@/integrations/supabase/client';
import { getGridColumns, getGridRows, findAvailablePosition } from './useDashboardGrid';

export type WidgetSize = 
  | '1x1' | '2x1' | '1x2' | '2x2' | '3x1' | '1x3' | '3x2' | '2x3' | '3x3' 
  | '4x1' | '1x4' | '4x2' | '2x4' | '4x3' | '3x4' | '4x4' | '5x1' | '5x2' 
  | '6x1' | '6x2' | '7x1' | '7x2' | '8x1' | '8x2';

export interface DashboardWidget {
  id: string;
  type: 'stats' | 'tasks' | 'schedule' | 'actions' | 'messages' | 'blackboard' | 'combined-messages' | 'quicknotes' | 'pomodoro' | 'habits' | 'calllog' | 'teamchat' | 'quickactions' | 'news' | 'appointmentfeedback';
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
    console.log('🔄 Dashboard initialization effect:', { 
      hasInitialized, 
      user: user?.id, 
      currentTenant: currentTenant?.id 
    });
    
    if (hasInitialized) return; // Prevent reloading after initialization
    
    if (user?.id && currentTenant?.id) {
      console.log('✅ User and tenant available, loading from database');
      loadLayoutFromDatabase();
      setHasInitialized(true);
    } else if (!user) {
      console.log('👤 No user, loading anonymous layout');
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
        setHasInitialized(true);
      } catch (error) {
        console.warn('Failed to load from localStorage:', error);
        setCurrentLayout(defaultLayout);
        setLayouts([defaultLayout]);
        setHasInitialized(true);
      }
    } else {
      console.log('⏳ Waiting for user and tenant to be available');
    }
  }, [user, currentTenant, hasInitialized]);

  // Load layout from database with localStorage fallback
  const loadLayoutFromDatabase = async () => {
    if (!user || !currentTenant) return;

    try {
      setLoading(true);
      console.log('🔄 Loading dashboard layout from database...', { userId: user.id, tenantId: currentTenant.id });
      
      const { data, error } = await supabase
        .from('team_dashboards')
        .select('id, name, description, layout_data, is_public')
        .eq('owner_id', user.id)
        .eq('tenant_id', currentTenant.id)
        .order('updated_at', { ascending: false })
        .limit(1)
        .single();

      if (error && error.code !== 'PGRST116') {
        console.error('Database query error:', error);
        throw error;
      }

      if (data?.layout_data) {
        console.log('Successfully loaded layout from database');
        // Filter out quickactions widget from loaded layout
        const filteredWidgets = ((data.layout_data as any) as DashboardWidget[])
          .filter((w: DashboardWidget) => w.type !== 'quickactions');
        
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
    console.log('🔧 updateWidget called:', { widgetId, updates });
    if (!currentLayout) {
      console.log('❌ No current layout available');
      return;
    }

    const updatedWidgets = currentLayout.widgets.map(widget =>
      widget.id === widgetId ? { ...widget, ...updates } : widget
    );

    const updatedLayout = { ...currentLayout, widgets: updatedWidgets };
    console.log('💾 Setting updated layout:', updatedLayout);
    setCurrentLayout(updatedLayout);
    
    // Immediate local storage backup
    try {
      localStorage.setItem(`dashboard-layout-${user?.id || 'anonymous'}`, JSON.stringify(updatedLayout));
      console.log('✅ Saved to localStorage');
    } catch (error) {
      console.warn('Failed to save to localStorage:', error);
    }
    
    // Clear existing timeout and set new one for debounced save
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }
    
    saveTimeoutRef.current = setTimeout(async () => {
      console.log('⏰ Auto-saving layout after debounce...');
      try {
        const success = await saveCurrentLayout();
        console.log('💾 Auto-save result:', success);
      } catch (error) {
        console.error('Failed to save to Supabase:', error);
        toast.error('Änderungen konnten nicht gespeichert werden - lokal gespeichert');
      }
    }, 1000);
  };

  // Update entire layout (for batch updates)
  const updateLayout = (updatedLayout: DashboardLayout) => {
    console.log('🔄 Updating entire layout:', updatedLayout);
    setCurrentLayout(updatedLayout);
    
    // Immediate local storage backup
    try {
      localStorage.setItem(`dashboard-layout-${user?.id || 'anonymous'}`, JSON.stringify(updatedLayout));
      console.log('✅ Saved to localStorage');
    } catch (error) {
      console.warn('Failed to save to localStorage:', error);
    }
    
    // Clear existing timeout and set new one for debounced save
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }
    
    saveTimeoutRef.current = setTimeout(async () => {
      console.log('⏰ Auto-saving layout after debounce...');
      try {
        const success = await saveCurrentLayout();
        console.log('💾 Auto-save result:', success);
      } catch (error) {
        console.error('Failed to save to Supabase:', error);
        toast.error('Änderungen konnten nicht gespeichert werden - lokal gespeichert');
      }
    }, 1000);
  };

  // Save current layout to database with retry mechanism
  const saveCurrentLayout = async (name?: string) => {
    console.log('💾 saveCurrentLayout called', { 
      hasCurrentLayout: !!currentLayout, 
      userId: user?.id, 
      tenantId: currentTenant?.id, 
      name 
    });
    
    if (!currentLayout) {
      console.log('❌ No currentLayout available');
      toast.error('Kein Layout zum Speichern verfügbar');
      return false;
    }

    if (!user?.id) {
      console.log('❌ No user ID available');
      toast.error('Benutzer nicht angemeldet oder User-ID fehlt');
      return false;
    }

    if (!currentTenant?.id) {
      console.log('❌ No tenant ID available');
      toast.error('Kein Mandant ausgewählt');
      return false;
    }

    try {
      // Generate a valid UUID for the layout if it doesn't have one
      const layoutId = currentLayout.id && currentLayout.id !== '' 
        ? currentLayout.id 
        : crypto.randomUUID();

      const tenantId = currentTenant.id;

      console.log('🔧 Preparing layout data:', { layoutId, tenantId, userId: user.id });

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

      console.log('🚀 Saving to Supabase:', {
        layoutId: layoutToSave.id,
        userId: user.id,
        tenantId: tenantId,
        widgetCount: cleanWidgets.length
      });

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
        console.error('Database error:', error);
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
      console.error('Save error:', error);
      
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
    console.log('🆕 useDashboardLayout.addWidget CALLED:', { 
      type, 
      position, 
      hasCurrentLayout: !!currentLayout,
      currentWidgetCount: currentLayout?.widgets.length 
    });
    
    if (!currentLayout) {
      console.error('❌ No currentLayout available');
      toast.error('Layout nicht verfügbar');
      return;
    }

    // Validiere Type
    const validTypes = ['stats', 'tasks', 'schedule', 'appointmentfeedback', 'messages', 'combined-messages', 'quicknotes', 'pomodoro', 'habits', 'calllog', 'teamchat', 'quickactions', 'news', 'blackboard', 'actions'];
    if (!validTypes.includes(type)) {
      console.error('❌ Invalid widget type:', type);
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
      'actions': 'Aktionen'
    };
    
    // Find next available position
    const existingPositions = currentLayout.widgets.map(w => ({
      x: w.position.x,
      y: w.position.y,
      w: 2,
      h: 2
    }));

    const defaultPosition = position || findAvailablePosition(existingPositions);
    console.log('📍 Calculated position for new widget:', defaultPosition);

    const newWidget: DashboardWidget = {
      id: `widget-${Date.now()}`,
      type: type as any,
      title: widgetTitles[type] || type.charAt(0).toUpperCase() + type.slice(1),
      position: defaultPosition,
      size: { width: 400, height: 400 },
      widgetSize: '2x2'
    };
    
    console.log('✨ Creating new widget:', newWidget);
    
    // Verwende React's setState callback pattern um sicherzustellen, dass das Update ankommt
    setCurrentLayout(prev => {
      if (!prev) return prev;
      const newLayout = {
        ...prev,
        widgets: [...prev.widgets, newWidget]
      };
      console.log('🔄 State update callback executed, new widget count:', newLayout.widgets.length);
      return newLayout;
    });
    
    // Set pending widget type für Toast-Nachricht nach Render
    setPendingWidgetType(widgetTitles[type] || type);
    
    // Auto-save after a delay to ensure state is updated
    setTimeout(() => {
      console.log('⏰ Auto-saving layout after widget addition...');
      saveCurrentLayout();
    }, 500);
  };

  // Show success toast after widget is added
  useEffect(() => {
    if (pendingWidgetType && currentLayout) {
      console.log('✅ Widget successfully added to layout:', pendingWidgetType);
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