import { Phone, Timer, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";

interface WidgetQuickAccessProps {
  activeWidget: string;
  onWidgetChange: (widgetId: string) => void;
}

export function WidgetQuickAccess({ activeWidget, onWidgetChange }: WidgetQuickAccessProps) {
  const widgets = [
    {
      id: 'quicknotes',
      name: 'Notizen',
      icon: FileText,
    },
    {
      id: 'calllog',
      name: 'Anrufe',
      icon: Phone,
    },
    {
      id: 'pomodoro',
      name: 'Timer',
      icon: Timer,
    },
  ];

  return (
    <div className="flex flex-col gap-2">
      {widgets.map((widget) => (
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
    </div>
  );
}
