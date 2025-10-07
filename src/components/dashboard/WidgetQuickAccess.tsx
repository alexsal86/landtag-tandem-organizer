import { useState } from "react";
import { Phone, Timer, FileText } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CallLogWidget } from "@/components/widgets/CallLogWidget";
import { PomodoroWidget } from "@/components/widgets/PomodoroWidget";
import { QuickNotesWidget } from "@/components/widgets/QuickNotesWidget";

export function WidgetQuickAccess() {
  const [activeWidget, setActiveWidget] = useState<string>('quicknotes');

  const widgets = [
    {
      id: 'quicknotes',
      name: 'Notizen',
      icon: FileText,
      component: QuickNotesWidget,
    },
    {
      id: 'calllog',
      name: 'Anrufe',
      icon: Phone,
      component: CallLogWidget,
    },
    {
      id: 'pomodoro',
      name: 'Timer',
      icon: Timer,
      component: PomodoroWidget,
    },
  ];

  return (
    <div className="w-full">
      <Tabs value={activeWidget} onValueChange={setActiveWidget} className="w-full">
        <TabsList className="w-full grid grid-cols-3 gap-1 bg-muted/50 p-1">
          {widgets.map((widget) => (
            <TabsTrigger
              key={widget.id}
              value={widget.id}
              className="flex items-center gap-2 data-[state=active]:bg-background data-[state=active]:shadow-sm"
            >
              <widget.icon className="h-4 w-4" />
              <span className="hidden sm:inline">{widget.name}</span>
            </TabsTrigger>
          ))}
        </TabsList>

        {widgets.map((widget) => {
          const WidgetComponent = widget.component;
          return (
            <TabsContent
              key={widget.id}
              value={widget.id}
              className="mt-4 min-h-[300px] max-h-[500px] overflow-y-auto rounded-lg border bg-card p-4"
            >
              <WidgetComponent />
            </TabsContent>
          );
        })}
      </Tabs>
    </div>
  );
}
