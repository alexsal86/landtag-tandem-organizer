import { useState } from 'react';
import { addDays, startOfDay } from 'date-fns';
import { AlarmClockPlus, ChevronDown } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { cn } from '@/lib/utils';
import { useSnoozeDeadline } from '@/hooks/useSnoozeDeadline';
import type { DeadlineItem } from '@/types/dashboardDeadlines';

interface DeadlineSnoozeButtonProps {
  item: DeadlineItem;
}

const PRESETS: Array<{ label: string; days: number }> = [
  { label: 'Morgen', days: 1 },
  { label: 'In 3 Tagen', days: 3 },
  { label: 'In 7 Tagen', days: 7 },
  { label: 'In 14 Tagen', days: 14 },
  { label: 'In 30 Tagen', days: 30 },
];

export const DeadlineSnoozeButton = ({ item }: DeadlineSnoozeButtonProps) => {
  const { mutate, isPending } = useSnoozeDeadline();
  const [popoverOpen, setPopoverOpen] = useState(false);
  const [showCalendar, setShowCalendar] = useState(false);

  const snoozeBy = (days: number) => {
    const newDate = addDays(startOfDay(new Date()), days);
    mutate({ item, newDate });
  };

  const handleQuickClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    snoozeBy(7);
  };

  const handlePresetClick = (e: React.MouseEvent, days: number) => {
    e.stopPropagation();
    snoozeBy(days);
    setPopoverOpen(false);
    setShowCalendar(false);
  };

  const handleCustomDate = (date: Date | undefined) => {
    if (!date) return;
    mutate({ item, newDate: startOfDay(date) });
    setPopoverOpen(false);
    setShowCalendar(false);
  };

  return (
    <span
      className={cn(
        'inline-flex items-center overflow-hidden shrink-0 transition-all duration-200 ease-out',
        // Hover-driven slide-in (always visible while popover open)
        popoverOpen
          ? 'max-w-12 opacity-100 ml-1'
          : 'max-w-0 opacity-0 ml-0 group-hover:max-w-12 group-hover:opacity-100 group-hover:ml-1',
      )}
      onClick={(e) => e.stopPropagation()}
    >
      <button
        type="button"
        onClick={handleQuickClick}
        disabled={isPending}
        title="Wiedervorlage in 7 Tagen"
        aria-label="Wiedervorlage in 7 Tagen"
        className="rounded p-0.5 text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors disabled:opacity-50"
      >
        <AlarmClockPlus className="h-3.5 w-3.5" />
      </button>
      <Popover
        open={popoverOpen}
        onOpenChange={(open) => {
          setPopoverOpen(open);
          if (!open) setShowCalendar(false);
        }}
      >
        <PopoverTrigger asChild>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              e.preventDefault();
              setPopoverOpen((v) => !v);
            }}
            disabled={isPending}
            title="Anderes Intervall"
            aria-label="Anderes Intervall wählen"
            className="rounded p-0.5 text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors disabled:opacity-50"
          >
            <ChevronDown className="h-3 w-3" />
          </button>
        </PopoverTrigger>
        <PopoverContent
          align="end"
          className="w-auto p-2"
          onClick={(e) => e.stopPropagation()}
        >
          {showCalendar ? (
            <Calendar
              mode="single"
              selected={undefined}
              onSelect={handleCustomDate}
              disabled={(date) => date < startOfDay(new Date())}
              initialFocus
              className={cn('p-3 pointer-events-auto')}
            />
          ) : (
            <div className="flex flex-col min-w-[180px]">
              <div className="px-2 py-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Wiedervorlage in
              </div>
              {PRESETS.map((preset) => (
                <button
                  key={preset.days}
                  type="button"
                  onClick={(e) => handlePresetClick(e, preset.days)}
                  className="text-left text-sm px-2 py-1.5 rounded hover:bg-muted transition-colors"
                >
                  {preset.label}
                </button>
              ))}
              <div className="my-1 border-t" />
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setShowCalendar(true);
                }}
                className="text-left text-sm px-2 py-1.5 rounded hover:bg-muted transition-colors"
              >
                Eigenes Datum…
              </button>
            </div>
          )}
        </PopoverContent>
      </Popover>
    </span>
  );
};
