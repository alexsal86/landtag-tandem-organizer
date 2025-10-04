import { useState } from "react";
import { Phone, Timer, FileText, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { CallLogWidget } from "@/components/widgets/CallLogWidget";
import { PomodoroWidget } from "@/components/widgets/PomodoroWidget";
import { QuickNotesWidget } from "@/components/widgets/QuickNotesWidget";

export function WidgetQuickAccess() {
  const [openWidget, setOpenWidget] = useState<string | null>(null);

  const widgets = [
    {
      id: 'calllog',
      name: 'Call Log',
      icon: Phone,
      component: CallLogWidget,
    },
    {
      id: 'pomodoro',
      name: 'Pomodoro',
      icon: Timer,
      component: PomodoroWidget,
    },
    {
      id: 'quicknotes',
      name: 'Quick Notes',
      icon: FileText,
      component: QuickNotesWidget,
    },
  ];

  return (
    <div className="flex flex-col gap-2">
      {widgets.map((widget) => {
        const WidgetComponent = widget.component;
        const isOpen = openWidget === widget.id;

        return (
          <Popover
            key={widget.id}
            open={isOpen}
            onOpenChange={(open) => setOpenWidget(open ? widget.id : null)}
          >
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                className="w-[40px] h-[40px] p-0 flex items-center justify-center hover:bg-accent/50 transition-colors"
                aria-label={`Open ${widget.name}`}
              >
                <widget.icon className="h-5 w-5" />
              </Button>
            </PopoverTrigger>
            
            <PopoverContent
              side="left"
              align="start"
              className="w-80 max-h-[500px] overflow-y-auto p-4 bg-background border shadow-lg"
            >
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-semibold text-base">{widget.name}</h3>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setOpenWidget(null)}
                  className="h-6 w-6 p-0"
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
              
              <div className="space-y-4">
                <WidgetComponent />
              </div>
            </PopoverContent>
          </Popover>
        );
      })}
    </div>
  );
}
