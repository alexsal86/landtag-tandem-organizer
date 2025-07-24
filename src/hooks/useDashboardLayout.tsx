import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';

export interface DashboardWidget {
  id: string;
  type: 'stats' | 'tasks' | 'schedule' | 'actions';
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
  const { user } = useAuth();
  const [layouts, setLayouts] = useState<DashboardLayout[]>([]);
  const [currentLayout, setCurrentLayout] = useState<DashboardLayout | null>(null);
  const [loading, setLoading] = useState(true);

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
      }
    ]
  };

  // Load layouts from database
  const loadLayouts = async () => {
    if (!user) return;

    try {
      const { data, error } = await supabase
        .from('dashboard_layouts')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (error) throw error;

      if (data && data.length > 0) {
        const mappedLayouts = data.map(layout => ({
          id: layout.id,
          name: layout.name,
          isActive: layout.is_active,
          widgets: layout.layout_data.widgets
        }));
        setLayouts(mappedLayouts);
        
        // Set current active layout
        const activeLayout = mappedLayouts.find(l => l.isActive) || mappedLayouts[0];
        setCurrentLayout(activeLayout);
      } else {
        // Create default layout
        setCurrentLayout(defaultLayout);
        await saveLayout(defaultLayout);
      }
    } catch (error) {
      console.error('Error loading layouts:', error);
      toast.error('Fehler beim Laden der Layouts');
      setCurrentLayout(defaultLayout);
    } finally {
      setLoading(false);
    }
  };

  // Save layout to database
  const saveLayout = async (layout: DashboardLayout, setAsActive = true) => {
    if (!user) return;

    try {
      if (setAsActive) {
        // Deactivate all other layouts first
        await supabase
          .from('dashboard_layouts')
          .update({ is_active: false })
          .eq('user_id', user.id);
      }

      const layoutData = {
        user_id: user.id,
        name: layout.name,
        layout_data: { widgets: layout.widgets },
        is_active: setAsActive
      };

      if (layout.id) {
        // Update existing layout
        const { error } = await supabase
          .from('dashboard_layouts')
          .update(layoutData)
          .eq('id', layout.id);

        if (error) throw error;
      } else {
        // Create new layout
        const { data, error } = await supabase
          .from('dashboard_layouts')
          .insert(layoutData)
          .select()
          .single();

        if (error) throw error;
        layout.id = data.id;
      }

      if (setAsActive) {
        setCurrentLayout({ ...layout, isActive: true });
      }
      
      await loadLayouts();
      toast.success('Layout gespeichert');
    } catch (error) {
      console.error('Error saving layout:', error);
      toast.error('Fehler beim Speichern des Layouts');
    }
  };

  // Update widget position/size
  const updateWidget = (widgetId: string, updates: Partial<DashboardWidget>) => {
    if (!currentLayout) return;

    const updatedWidgets = currentLayout.widgets.map(widget =>
      widget.id === widgetId ? { ...widget, ...updates } : widget
    );

    const updatedLayout = { ...currentLayout, widgets: updatedWidgets };
    setCurrentLayout(updatedLayout);
  };

  // Save current layout
  const saveCurrentLayout = async (name?: string) => {
    if (!currentLayout) return;
    
    const layoutToSave = name 
      ? { ...currentLayout, name, id: undefined } // Save as new layout
      : currentLayout; // Update existing layout

    await saveLayout(layoutToSave);
  };

  // Switch to different layout
  const switchLayout = async (layoutId: string) => {
    const layout = layouts.find(l => l.id === layoutId);
    if (!layout) return;

    // Deactivate current layout
    if (currentLayout?.id) {
      await supabase
        .from('dashboard_layouts')
        .update({ is_active: false })
        .eq('id', currentLayout.id);
    }

    // Activate new layout
    await supabase
      .from('dashboard_layouts')
      .update({ is_active: true })
      .eq('id', layoutId);

    setCurrentLayout({ ...layout, isActive: true });
    await loadLayouts();
  };

  // Delete layout
  const deleteLayout = async (layoutId: string) => {
    try {
      const { error } = await supabase
        .from('dashboard_layouts')
        .delete()
        .eq('id', layoutId);

      if (error) throw error;

      // If deleted layout was current, switch to default
      if (currentLayout?.id === layoutId) {
        setCurrentLayout(defaultLayout);
      }

      await loadLayouts();
      toast.success('Layout gelöscht');
    } catch (error) {
      console.error('Error deleting layout:', error);
      toast.error('Fehler beim Löschen des Layouts');
    }
  };

  useEffect(() => {
    if (user) {
      loadLayouts();
    }
  }, [user]);

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