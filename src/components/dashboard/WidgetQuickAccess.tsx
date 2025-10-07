import { Phone, Timer, FileText, Plus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { QuickNotesWidget } from '@/components/widgets/QuickNotesWidget';
import { CallLogWidget } from '@/components/widgets/CallLogWidget';
import { PomodoroWidget } from '@/components/widgets/PomodoroWidget';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useState } from "react";

interface WidgetQuickAccessProps {
  activeWidget: string;
  onWidgetChange: (widgetId: string) => void;
}

export function WidgetQuickAccess({ activeWidget, onWidgetChange }: WidgetQuickAccessProps) {
  const [dialogOpen, setDialogOpen] = useState(false);
  
  const allAvailableWidgets = [
    {
      id: 'quicknotes',
      name: 'Notizen',
      icon: FileText,
      description: 'Schnelle Notizen erstellen und verwalten',
    },
    {
      id: 'calllog',
      name: 'Anrufe',
      icon: Phone,
      description: 'Anrufprotokolle verwalten',
    },
    {
      id: 'pomodoro',
      name: 'Timer',
      icon: Timer,
      description: 'Pomodoro-Timer für produktives Arbeiten',
    },
  ];

  const [activeWidgets, setActiveWidgets] = useState<string[]>(['quicknotes', 'calllog', 'pomodoro']);

  const toggleWidget = (widgetId: string) => {
    setActiveWidgets(prev => {
      if (prev.includes(widgetId)) {
        // Mindestens ein Widget muss aktiv bleiben
        if (prev.length === 1) return prev;
        // Wenn das aktuelle aktive Widget entfernt wird, zum ersten wechseln
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

  const activeWidgetsList = allAvailableWidgets.filter(w => activeWidgets.includes(w.id));

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
            className="w-[40px] h-[40px] p-0 flex items-center justify-center transition-colors"
            aria-label={widget.name}
          >
            <widget.icon className="h-5 w-5" />
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
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Widgets verwalten</DialogTitle>
            </DialogHeader>
            <div className="space-y-2 mt-4">
              {allAvailableWidgets.map((widget) => (
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
                    variant={activeWidgets.includes(widget.id) ? "destructive" : "default"}
                    size="sm"
                    onClick={() => toggleWidget(widget.id)}
                    disabled={activeWidgets.includes(widget.id) && activeWidgets.length === 1}
                  >
                    {activeWidgets.includes(widget.id) ? (
                      <>
                        <X className="h-4 w-4 mr-1" />
                        Entfernen
                      </>
                    ) : (
                      <>
                        <Plus className="h-4 w-4 mr-1" />
                        Hinzufügen
                      </>
                    )}
                  </Button>
                </div>
              ))}
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Widget content below buttons */}
      <div className="rounded-lg border bg-card shadow-sm h-[700px] overflow-auto">
        {activeWidget === 'quicknotes' && <QuickNotesWidget />}
        {activeWidget === 'calllog' && <CallLogWidget />}
        {activeWidget === 'pomodoro' && <PomodoroWidget />}
      </div>
    </div>
  );
}
