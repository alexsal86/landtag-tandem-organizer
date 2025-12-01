import { Phone, Timer, FileText, Plus, X, ClipboardCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { NavigationBadge } from "@/components/NavigationBadge";
import { useAppointmentFeedback } from "@/hooks/useAppointmentFeedback";
import { QuickNotesWidget } from '@/components/widgets/QuickNotesWidget';
import { CallLogWidget } from '@/components/widgets/CallLogWidget';
import { PomodoroWidget } from '@/components/widgets/PomodoroWidget';
import { HabitsWidget } from '@/components/widgets/HabitsWidget';
import { NewsWidget } from '@/components/widgets/NewsWidget';
import { QuickActionsWidget } from '@/components/widgets/QuickActionsWidget';
import { ExpenseWidget } from '@/components/widgets/ExpenseWidget';
import { WeatherWidget } from '@/components/dashboard/WeatherWidget';
import { AppointmentFeedbackWidget } from '@/components/dashboard/AppointmentFeedbackWidget';
import { TasksSummary } from '@/components/dashboard/TasksSummary';
import { TodaySchedule } from '@/components/dashboard/TodaySchedule';
import { CombinedMessagesWidget } from '@/components/CombinedMessagesWidget';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { WidgetPalette } from '@/components/dashboard/WidgetPalette';
import { useState, useEffect } from "react";

interface WidgetQuickAccessProps {
  activeWidget: string;
  onWidgetChange: (widgetId: string) => void;
}

const WIDGET_REGISTRY = [
  { id: 'quicknotes', name: 'Notizen', icon: FileText, description: 'Schnelle Notizen erstellen und verwalten' },
  { id: 'calllog', name: 'Anrufe', icon: Phone, description: 'Anrufprotokolle verwalten' },
  { id: 'pomodoro', name: 'Timer', icon: Timer, description: 'Pomodoro-Timer für produktives Arbeiten' },
  { id: 'tasks', name: 'Aufgaben', icon: FileText, description: 'Aufgaben-Übersicht' },
  { id: 'schedule', name: 'Zeitplan', icon: Timer, description: 'Heutiger Terminplan' },
  { id: 'messages', name: 'Nachrichten', icon: Phone, description: 'Nachrichten-Widget' },
  { id: 'weather', name: 'Wetter', icon: Timer, description: 'Wetter-Informationen' },
  { id: 'habits', name: 'Gewohnheiten', icon: FileText, description: 'Gewohnheiten tracken' },
  { id: 'news', name: 'News', icon: FileText, description: 'Aktuelle Nachrichten' },
  { id: 'quickactions', name: 'Schnellaktionen', icon: Plus, description: 'Schnelle Aktionen' },
  { id: 'expenses', name: 'Ausgaben', icon: FileText, description: 'Ausgaben-Übersicht' },
  { id: 'appointmentfeedback', name: 'Termin-Feedback', icon: ClipboardCheck, description: 'Feedback zu vergangenen Terminen' },
];

export function WidgetQuickAccess({ activeWidget, onWidgetChange }: WidgetQuickAccessProps) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [activeWidgets, setActiveWidgets] = useState<string[]>(() => {
    const saved = localStorage.getItem('widgetQuickAccess');
    return saved ? JSON.parse(saved) : ['quicknotes', 'calllog', 'pomodoro'];
  });
  const { pendingFeedbackCount } = useAppointmentFeedback();

  useEffect(() => {
    localStorage.setItem('widgetQuickAccess', JSON.stringify(activeWidgets));
  }, [activeWidgets]);

  const toggleWidget = (widgetId: string) => {
    setActiveWidgets(prev => {
      if (prev.includes(widgetId)) {
        if (prev.length === 1) return prev;
        if (activeWidget === widgetId) {
          const remaining = prev.filter(id => id !== widgetId);
          onWidgetChange(remaining[0]);
        }
        return prev.filter(id => id !== widgetId);
      } else {
        return [...prev, widgetId];
      }
    });
  };

  const handleAddWidget = (widgetType: string) => {
    if (!activeWidgets.includes(widgetType)) {
      setActiveWidgets(prev => [...prev, widgetType]);
      onWidgetChange(widgetType);
    }
    setDialogOpen(false);
  };

  const activeWidgetsList = WIDGET_REGISTRY.filter(w => activeWidgets.includes(w.id));

  return (
    <div className="flex flex-col gap-2">
      {/* Button row */}
      <div className="flex gap-2">
        {activeWidgetsList.map((widget) => (
          <Button
            key={widget.id}
            variant={activeWidget === widget.id ? "default" : "outline"}
            size="sm"
            onClick={() => onWidgetChange(widget.id)}
            className="w-[40px] h-[40px] p-0 flex items-center justify-center transition-colors relative"
            aria-label={widget.name}
          >
            <widget.icon className="h-5 w-5" />
            {widget.id === 'appointmentfeedback' && pendingFeedbackCount > 0 && (
              <div className="absolute -top-1 -right-1">
                <NavigationBadge count={pendingFeedbackCount} size="sm" />
              </div>
            )}
          </Button>
        ))}
        
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button
              variant="outline"
              size="sm"
              className="w-[40px] h-[40px] p-0 flex items-center justify-center transition-colors"
              aria-label="Widget hinzufügen"
            >
              <Plus className="h-5 w-5" />
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-3xl max-h-[80vh] overflow-hidden flex flex-col">
            <DialogHeader>
              <DialogTitle>Widgets</DialogTitle>
            </DialogHeader>
            <Tabs defaultValue="manage" className="flex-1 flex flex-col min-h-0">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="manage">Aktive verwalten</TabsTrigger>
                <TabsTrigger value="add">Hinzufügen</TabsTrigger>
              </TabsList>
              <TabsContent value="manage" className="flex-1 overflow-auto mt-4">
                <div className="space-y-2">
                  {activeWidgetsList.map((widget) => (
                    <div
                      key={widget.id}
                      className="flex items-center justify-between p-3 border rounded-lg hover:bg-accent/50 transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        <widget.icon className="h-5 w-5 text-muted-foreground" />
                        <div>
                          <p className="font-medium">{widget.name}</p>
                          <p className="text-sm text-muted-foreground">{widget.description}</p>
                        </div>
                      </div>
                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={() => toggleWidget(widget.id)}
                        disabled={activeWidgets.length === 1}
                      >
                        <X className="h-4 w-4 mr-1" />
                        Entfernen
                      </Button>
                    </div>
                  ))}
                </div>
              </TabsContent>
              <TabsContent value="add" className="flex-1 overflow-auto mt-4">
                <WidgetPalette 
                  onAddWidget={handleAddWidget}
                  onClose={() => setDialogOpen(false)}
                  suggestions={[]}
                />
              </TabsContent>
            </Tabs>
          </DialogContent>
        </Dialog>
      </div>

      {/* Widget content below buttons */}
      <div className="rounded-lg border bg-card shadow-sm h-[700px] overflow-auto">
        {activeWidget === 'quicknotes' && <QuickNotesWidget />}
        {activeWidget === 'calllog' && <CallLogWidget />}
        {activeWidget === 'pomodoro' && <PomodoroWidget />}
        {activeWidget === 'tasks' && <TasksSummary />}
        {activeWidget === 'schedule' && <TodaySchedule />}
        {activeWidget === 'messages' && <CombinedMessagesWidget />}
        {activeWidget === 'weather' && <WeatherWidget />}
        {activeWidget === 'habits' && <HabitsWidget />}
        {activeWidget === 'news' && <NewsWidget />}
        {activeWidget === 'quickactions' && <QuickActionsWidget />}
        {activeWidget === 'expenses' && <ExpenseWidget />}
        {activeWidget === 'appointmentfeedback' && <AppointmentFeedbackWidget />}
      </div>
    </div>
  );
}
