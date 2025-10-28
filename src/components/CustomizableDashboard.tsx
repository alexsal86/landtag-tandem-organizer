import React, { useState, useEffect, useMemo } from 'react';
import { cn } from '@/lib/utils';
import { Responsive, WidthProvider, Layout } from 'react-grid-layout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { useDashboardLayout, type WidgetSize } from '@/hooks/useDashboardLayout';
import { useAuth } from '@/hooks/useAuth';
import { DashboardWidget } from './DashboardWidget';
import { DashboardGreetingSection } from './dashboard/DashboardGreetingSection';
import { DashboardCoverImage } from './dashboard/DashboardCoverImage';
import { QuickActionsWidget } from './widgets/QuickActionsWidget';
import { NewsWidget } from './widgets/NewsWidget';
import { toast } from 'sonner';
import {
  Settings,
  Save,
  LayoutGrid,
  Plus,
  Edit,
  Trash2,
  Download,
  Upload,
  Grid3X3,
  CheckSquare,
  Calendar,
  MessageSquare,
  FileText,
  Clock,
  Phone,
  Users,
  Rss,
  ClipboardCheck
} from 'lucide-react';

// CSS imports for react-grid-layout
import 'react-grid-layout/css/styles.css';
import 'react-resizable/css/styles.css';

const ResponsiveGridLayout = WidthProvider(Responsive);

type DashboardMode = 'classic' | 'hybrid' | 'realtime';

export const CustomizableDashboard: React.FC = () => {
  const {
    layouts,
    currentLayout,
    loading,
    updateWidget,
    updateLayout,
    saveCurrentLayout,
    switchLayout,
    deleteLayout,
    addWidget,
    removeWidget,
  } = useDashboardLayout();
  
  const { user } = useAuth();

  const [isEditMode, setIsEditMode] = useState(false);
  const [showSaveDialog, setShowSaveDialog] = useState(false);
  const [showAddWidgetDialog, setShowAddWidgetDialog] = useState(false);
  const [newLayoutName, setNewLayoutName] = useState('');
  const [showLayoutDialog, setShowLayoutDialog] = useState(false);
  const [dashboardMode, setDashboardMode] = useState<DashboardMode>('classic');

  // Convert our widget format to react-grid-layout format
  const gridLayouts = useMemo(() => {
    if (!currentLayout?.widgets) return { lg: [] };
    
    const gridItems: Layout[] = currentLayout.widgets.map(widget => {
      // Parse size string (e.g., "3x2" -> {w: 3, h: 2})
      const sizeString = widget.widgetSize || '2x2';
      const [w, h] = sizeString.split('x').map(Number);
      
      return {
        i: widget.id,
        x: widget.position.x,
        y: widget.position.y,
        w: w || 2,
        h: h || 2,
        minW: 1,
        minH: 1,
        maxW: 6,
        maxH: 4,
      };
    });

    return {
      lg: gridItems,
      md: gridItems,
      sm: gridItems,
      xs: gridItems.map(item => ({ ...item, w: Math.min(item.w, 4) })),
      xxs: gridItems.map(item => ({ ...item, w: Math.min(item.w, 2) })),
    };
  }, [currentLayout?.widgets]);

  // Handle layout changes (drag & drop, resize)
  const handleLayoutChange = (layout: Layout[], layouts: { [key: string]: Layout[] }) => {
    if (!currentLayout || !isEditMode) return;

    console.log('🔄 Layout change detected:', layout);

    // Update all widgets with new positions and sizes at once
    const updatedWidgets = currentLayout.widgets.map(widget => {
      const gridItem = layout.find(item => item.i === widget.id);
      if (!gridItem) return widget;

      return {
        ...widget,
        position: { x: gridItem.x, y: gridItem.y },
        widgetSize: `${gridItem.w}x${gridItem.h}` as WidgetSize,
      };
    });

    // Update the entire layout at once instead of individual widgets
    const updatedLayout = { ...currentLayout, widgets: updatedWidgets };
    updateLayout(updatedLayout);
  };

  // Widget management handlers
  const handleSaveLayout = async (name?: string) => {
    try {
      await saveCurrentLayout(name);
      toast.success('Layout gespeichert');
      setShowSaveDialog(false);
    } catch (error) {
      toast.error('Fehler beim Speichern des Layouts');
    }
  };

  const handleSaveAsNew = async () => {
    if (!newLayoutName.trim()) {
      toast.error('Bitte geben Sie einen Namen ein');
      return;
    }
    await handleSaveLayout(newLayoutName.trim());
    setNewLayoutName('');
  };

  const handleDeleteLayout = async (layoutId: string) => {
    if (layouts.length <= 1) {
      toast.error('Das letzte Layout kann nicht gelöscht werden');
      return;
    }
    try {
      await deleteLayout(layoutId);
      toast.success('Layout gelöscht');
    } catch (error) {
      toast.error('Fehler beim Löschen des Layouts');
    }
  };

  // Handle manual resize from widget overlay
  const handleWidgetResize = (widgetId: string, newSize: string) => {
    console.log('Manual resize:', widgetId, newSize);
    updateWidget(widgetId, { widgetSize: newSize } as any);
  };

  // Available widget types for adding
  const availableWidgets = [
    { type: 'stats', title: 'Statistiken', icon: CheckSquare, description: 'Zeigt wichtige Statistiken und KPIs' },
    { type: 'tasks', title: 'Aufgaben', icon: CheckSquare, description: 'Zeigt ausstehende Aufgaben' },
    { type: 'schedule', title: 'Terminplan', icon: Calendar, description: 'Zeigt anstehende Termine' },
    { type: 'appointmentfeedback', title: 'Termin-Feedback', icon: ClipboardCheck, description: 'Schnelle Rückmeldung zu vergangenen Terminen' },
    { type: 'messages', title: 'Nachrichten', icon: MessageSquare, description: 'Nachrichtensystem' },
    { type: 'combined-messages', title: 'Chat', icon: MessageSquare, description: 'Kombinierte Nachrichten' },
    { type: 'quicknotes', title: 'Notizen', icon: FileText, description: 'Schnelle Notizen' },
    { type: 'pomodoro', title: 'Pomodoro Timer', icon: Clock, description: 'Produktivitäts-Timer' },
    { type: 'habits', title: 'Gewohnheiten', icon: CheckSquare, description: 'Habit Tracker' },
    { type: 'calllog', title: 'Anrufliste', icon: Phone, description: 'Anruf-Protokoll' },
    { type: 'news', title: 'News Feed', icon: Rss, description: 'Aktuelle Nachrichten aus verschiedenen Quellen' }
  ];

  const handleAddWidget = (widgetType: string) => {
    console.log('🎯 handleAddWidget START:', widgetType);
    console.log('🔍 addWidget function type:', typeof addWidget);
    console.log('📋 Current layout widgets:', currentLayout?.widgets.length);
    
    const widgetInfo = availableWidgets.find(w => w.type === widgetType);
    if (!widgetInfo) {
      console.error('❌ Widget type not found:', widgetType);
      toast.error('Widget-Typ nicht gefunden');
      return;
    }

    console.log('✅ Found widget info:', widgetInfo);

    // Einfache Position-Berechnung - platziere am Ende
    const existingWidgets = currentLayout?.widgets || [];
    let x = 0;
    let y = 0;

    if (existingWidgets.length > 0) {
      // Finde die maximale Y-Position
      const maxY = Math.max(
        ...existingWidgets.map(widget => {
          const [, h] = (widget.widgetSize || '2x2').split('x').map(Number);
          return widget.position.y + h;
        })
      );
      y = maxY;
    }

    console.log('📍 Calculated position:', { x, y });
    console.log('🚀 Calling addWidget with:', { type: widgetType, position: { x, y } });
    
    // Widget hinzufügen - Toast wird im Hook gemacht
    addWidget(widgetType, { x, y });
    
    // Dialog SOFORT schließen - State-Update passiert asynchron
    setShowAddWidgetDialog(false);
  };

  useEffect(() => {
    if (!isEditMode) {
      setShowLayoutDialog(false);
    }
  }, [isEditMode]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-lg text-muted-foreground">Dashboard wird geladen...</div>
      </div>
    );
  }

  if (!layouts.length) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-lg text-muted-foreground">Keine Layouts verfügbar</div>
      </div>
    );
  }

  // Render different dashboard modes
  if (dashboardMode === 'hybrid') {
    return <div className="p-6 text-center">Hybrid Dashboard wird noch entwickelt...</div>;
  }

  if (dashboardMode === 'realtime') {
    return <div className="p-6 text-center">Real-Time Dashboard wird noch entwickelt...</div>;
  }

  // Classic dashboard mode
  return (
    <div className="min-h-screen bg-background">
      {/* Cover Image */}
      {user?.id && <DashboardCoverImage userId={user.id} />}
      
      {/* Content Container */}
      <div className="p-6">
        {/* Dynamic Greeting Section */}
        <div className="mb-8">
          <DashboardGreetingSection />
        </div>

        {/* Quick Actions - Full Width Separator */}
        <div className="mb-6">
          <QuickActionsWidget 
            className="shadow-sm"
            widgetSize="full-width"
          />
        </div>

        {/* News Section */}
        <div className="mb-6">
          <h2 className="text-2xl font-bold text-foreground mb-4">
            Aktuelle Nachrichten
          </h2>
          <NewsWidget />
        </div>

      <Separator className="my-8" />

      {false && ( // Widgets-Sektion vorübergehend ausgeblendet
        <>
          {/* Dashboard Header */}
          <div className="mb-8 flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-foreground mb-2">
                Widgets
              </h1>
              <p className="text-muted-foreground">
                {currentLayout?.name || 'Standard Layout'}
              </p>
            </div>

            <div className="flex items-center gap-2">
              {/* Dashboard Mode Selector */}
              <Select value={dashboardMode} onValueChange={(value: DashboardMode) => setDashboardMode(value)}>
                <SelectTrigger className="w-40">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="classic">Standard</SelectItem>
                  <SelectItem value="hybrid">Hybrid</SelectItem>
                  <SelectItem value="realtime">Echtzeit</SelectItem>
                </SelectContent>
              </Select>

              {/* Layout Management */}
              {currentLayout && (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline" size="sm">
                      <LayoutGrid className="h-4 w-4 mr-2" />
                      Layout
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent>
                    {layouts.map((layout) => (
                      <DropdownMenuItem
                        key={layout.id}
                        onClick={() => switchLayout(layout.id!)}
                        className={currentLayout.id === layout.id ? 'bg-accent' : ''}
                      >
                        {layout.name}
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>
              )}

              {/* Save Layout */}
              <Dialog open={showSaveDialog} onOpenChange={setShowSaveDialog}>
                <DialogTrigger asChild>
                  <Button variant="outline" size="sm">
                    <Save className="h-4 w-4 mr-2" />
                    Speichern
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Layout speichern</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-4">
                    <div>
                      <Label htmlFor="layout-name">Layout Name</Label>
                      <Input
                        id="layout-name"
                        value={newLayoutName}
                        onChange={(e) => setNewLayoutName(e.target.value)}
                        placeholder="Mein neues Layout"
                      />
                    </div>
                  </div>
                  <DialogFooter>
                    <Button variant="outline" onClick={() => setShowSaveDialog(false)}>
                      Abbrechen
                    </Button>
                    <Button onClick={() => handleSaveLayout()}>
                      Aktuelles überschreiben
                    </Button>
                    <Button onClick={handleSaveAsNew}>
                      Als neu speichern
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>

              {/* Add Widget Button */}
              {isEditMode && (
                <Dialog open={showAddWidgetDialog} onOpenChange={setShowAddWidgetDialog}>
                  <DialogTrigger asChild>
                    <Button variant="outline" size="sm">
                      <Plus className="h-4 w-4 mr-2" />
                      Widget hinzufügen
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="max-w-2xl">
                    <DialogHeader>
                      <DialogTitle>Widget hinzufügen</DialogTitle>
                    </DialogHeader>
                    <div className="grid grid-cols-2 gap-4 max-h-96 overflow-y-auto">
                      {availableWidgets.map((widget) => (
                        <Card key={widget.type} className="cursor-pointer hover:bg-accent/50 transition-colors" onClick={() => handleAddWidget(widget.type)}>
                          <CardContent className="p-4">
                            <div className="flex items-start gap-3">
                              <widget.icon className="h-5 w-5 mt-1 text-primary" />
                              <div className="flex-1">
                                <h4 className="font-medium text-sm">{widget.title}</h4>
                                <p className="text-xs text-muted-foreground mt-1">{widget.description}</p>
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  </DialogContent>
                </Dialog>
              )}

              {/* Edit Mode Toggle */}
              <Button
                variant={isEditMode ? "default" : "outline"}
                size="sm"
                onClick={() => setIsEditMode(!isEditMode)}
              >
                <Edit className="h-4 w-4 mr-2" />
                {isEditMode ? 'Fertig' : 'Bearbeiten'}
              </Button>
            </div>
          </div>

          {/* Dashboard Content with React Grid Layout */}
          <div className="relative">
            <ResponsiveGridLayout
              className="layout"
              layouts={gridLayouts}
              onLayoutChange={handleLayoutChange}
              breakpoints={{ lg: 1200, md: 996, sm: 768, xs: 480, xxs: 0 }}
              cols={{ lg: 6, md: 6, sm: 4, xs: 2, xxs: 1 }}
              rowHeight={180}
              isDraggable={isEditMode}
              isResizable={isEditMode}
              margin={[16, 16]}
              containerPadding={[0, 0]}
              useCSSTransforms={true}
              preventCollision={false}
              compactType="vertical"
            >
              {currentLayout?.widgets
                .filter(widget => widget.type !== 'quickactions')
                .map((widget) => (
                  <div key={widget.id} className="grid-item">
                    <DashboardWidget
                      widget={widget}
                      isDragging={false}
                      isEditMode={isEditMode}
                      onResize={handleWidgetResize}
                      onDelete={removeWidget}
                    />
                  </div>
                ))}
            </ResponsiveGridLayout>
          </div>
        </>
      )}
      </div>
    </div>
  );
};