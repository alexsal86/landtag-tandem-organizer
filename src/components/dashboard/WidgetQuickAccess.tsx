import { Phone, Timer, FileText } from "lucide-react";

interface WidgetQuickAccessProps {
  onWidgetSelect: (widget: 'calllog' | 'pomodoro' | 'quicknotes') => void;
}

export function WidgetQuickAccess({ onWidgetSelect }: WidgetQuickAccessProps) {
  const widgets = [
    {
      id: 'calllog' as const,
      name: 'Call Log',
      icon: Phone,
      color: 'bg-blue-500 hover:bg-blue-600',
    },
    {
      id: 'pomodoro' as const,
      name: 'Pomodoro',
      icon: Timer,
      color: 'bg-purple-500 hover:bg-purple-600',
    },
    {
      id: 'quicknotes' as const,
      name: 'Quick Notes',
      icon: FileText,
      color: 'bg-emerald-500 hover:bg-emerald-600',
    },
  ];

  return (
    <div className="flex flex-col gap-2 lg:gap-3">
      {widgets.map((widget) => (
        <button
          key={widget.id}
          onClick={() => onWidgetSelect(widget.id)}
          className={`
            w-[100px] h-[100px]
            rounded-xl
            ${widget.color}
            flex flex-col items-center justify-center gap-2
            shadow-lg hover:shadow-xl
            transition-all duration-200
            hover:scale-105
            text-white font-medium
            group
          `}
          aria-label={`Open ${widget.name}`}
        >
          <widget.icon className="w-8 h-8 transition-transform group-hover:scale-110" />
          <span className="text-xs font-semibold">{widget.name}</span>
        </button>
      ))}
    </div>
  );
}
