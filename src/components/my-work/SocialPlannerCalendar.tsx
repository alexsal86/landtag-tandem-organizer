import { useCallback, useMemo, useState } from "react";
import { Calendar, dateFnsLocalizer, Views, type View } from "react-big-calendar";
import { format, parse, startOfWeek, getDay, getISOWeek, isSameDay } from "date-fns";
import { de } from "date-fns/locale";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, ArrowRight, CalendarDays, Tag } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { SocialPlannerItem, PlannerWorkflowStatus } from "@/hooks/useSocialPlannerItems";
import { type SpecialDay } from "@/utils/dashboard/specialDays";
import "react-big-calendar/lib/css/react-big-calendar.css";

const locales = { de };

const localizer = dateFnsLocalizer({
  format: (date: Date, formatStr: string, options?: Record<string, unknown>) =>
    format(date, formatStr, { ...options, locale: de }),
  parse: (value: string, formatStr: string) =>
    parse(value, formatStr, new Date(), { locale: de }),
  startOfWeek: () => startOfWeek(new Date(), { locale: de }),
  getDay,
  locales,
});

const STATUS_COLORS: Record<PlannerWorkflowStatus, string> = {
  ideas: "hsl(var(--muted-foreground))",
  in_progress: "hsl(var(--primary))",
  in_review: "hsl(35 90% 50%)",
  approved: "hsl(142 70% 45%)",
  scheduled: "hsl(262 80% 55%)",
  published: "hsl(142 70% 35%)",
};

const STATUS_LABELS: Record<PlannerWorkflowStatus, string> = {
  ideas: "Idee",
  in_progress: "In Arbeit",
  in_review: "In Freigabe",
  approved: "Freigegeben",
  scheduled: "Geplant",
  published: "Veröffentlicht",
};

interface PlannerCalendarEvent {
  id: string;
  title: string;
  start: Date;
  end: Date;
  item: SocialPlannerItem;
  eventType: "planner";
}

interface HintCalendarEvent {
  id: string;
  title: string;
  start: Date;
  end: Date;
  eventType: "hint";
  hint: string;
  allDay: true;
}

type CalendarEvent = PlannerCalendarEvent | HintCalendarEvent;

interface Props {
  items: SocialPlannerItem[];
  onUpdateSchedule: (id: string, date: string) => void;
  specialDays: SpecialDay[];
}

interface DateHeaderProps {
  date: Date;
  label: string;
}

function MonthDateHeader({ date, label }: DateHeaderProps) {
  const weekStart = startOfWeek(date, { locale: de });
  const showWeekNumber = isSameDay(date, weekStart);

  const isoWeek = getISOWeek(date);

  return (
    <div className="social-planner-month-date-header">
      {showWeekNumber && (
        <span className="social-planner-week-gutter" aria-label={`Kalenderwoche ${isoWeek}`}>
          {isoWeek}
        </span>
      )}
      <span className="social-planner-day-label">{label}</span>
    </div>
  );
}

export function SocialPlannerCalendar({ items, onUpdateSchedule, specialDays }: Props) {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [view, setView] = useState<View>(Views.MONTH);

  const { events, unscheduled } = useMemo(() => {
    const scheduled: PlannerCalendarEvent[] = [];
    const unscheduledItems: SocialPlannerItem[] = [];

    for (const item of items) {
      if (item.scheduled_for) {
        const start = new Date(item.scheduled_for);
        const end = new Date(start.getTime() + 60 * 60 * 1000);
        scheduled.push({ id: item.id, title: item.topic, start, end, item, eventType: "planner" });
      } else {
        unscheduledItems.push(item);
      }
    }

    const visibleYear = currentDate.getFullYear();
    const hintEvents: HintCalendarEvent[] = specialDays.map((specialDay) => {
      const start = new Date(visibleYear, specialDay.month - 1, specialDay.day);
      const end = new Date(visibleYear, specialDay.month - 1, specialDay.day + 1);

      return {
        id: `special-day-${visibleYear}-${specialDay.month}-${specialDay.day}-${specialDay.name}`,
        title: `Hinweis: ${specialDay.name}`,
        start,
        end,
        eventType: "hint",
        hint: specialDay.hint,
        allDay: true,
      };
    });

    return { events: [...scheduled, ...hintEvents], unscheduled: unscheduledItems };
  }, [items, currentDate, specialDays]);

  const eventStyleGetter = useCallback((event: CalendarEvent) => {
    if (event.eventType === "hint") {
      return {
        style: {
          backgroundColor: "hsl(42 96% 56%)",
          borderRadius: "4px",
          border: "1px solid hsl(35 92% 32% / 0.35)",
          color: "hsl(20 14% 12%)",
          fontSize: "11px",
          fontWeight: 600,
          padding: "2px 4px",
        },
      };
    }

    return {
      style: {
        backgroundColor: STATUS_COLORS[event.item.workflow_status] || "hsl(var(--primary))",
        borderRadius: "4px",
        border: "none",
        color: "white",
        fontSize: "11px",
        padding: "2px 4px",
      },
    };
  }, []);

  const handleEventDrop = useCallback(
    ({ event, start }: { event: CalendarEvent; start: string | Date }) => {
      const date = start instanceof Date ? start : new Date(start);
      onUpdateSchedule(event.id, date.toISOString());
    },
    [onUpdateSchedule],
  );


  const messages = useMemo(() => ({
    today: "Heute",
    previous: "Zurück",
    next: "Weiter",
    month: "Monat",
    week: "Woche",
    day: "Tag",
    agenda: "Agenda",
    noEventsInRange: "Keine Beiträge in diesem Zeitraum.",
  }), []);

  const tooltipAccessor = useCallback((event: CalendarEvent) => event.eventType === "hint" ? event.hint : event.title, []);

  return (
    <div className="space-y-3">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h4 className="text-sm font-semibold text-foreground">Planungskalender</h4>
          <p className="text-xs text-muted-foreground">
            {format(currentDate, view === Views.MONTH ? "MMMM yyyy" : "'Woche vom' dd. MMMM yyyy", { locale: de })}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center rounded-md border overflow-hidden">
            <Button type="button" size="sm" variant="ghost" className="rounded-none h-8 px-2" onClick={() => setCurrentDate(new Date())}>
              Heute
            </Button>
            <Button type="button" size="icon" variant="ghost" className="rounded-none h-8 w-8" onClick={() => setCurrentDate((current) => new Date(current.getFullYear(), current.getMonth() - 1, 1))}>
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <Button type="button" size="icon" variant="ghost" className="rounded-none h-8 w-8" onClick={() => setCurrentDate((current) => new Date(current.getFullYear(), current.getMonth() + 1, 1))}>
              <ArrowRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>

      <div className="min-h-[500px]">
        <Calendar
          localizer={localizer}
          events={events}
          startAccessor="start"
          endAccessor="end"
          allDayAccessor={(event: CalendarEvent) => event.eventType === "hint"}
          tooltipAccessor={tooltipAccessor}
          date={currentDate}
          onNavigate={setCurrentDate}
          view={view}
          onView={setView}
          views={[Views.WEEK, Views.MONTH]}
          eventPropGetter={eventStyleGetter}
          messages={messages}
          culture="de"
          step={60}
          timeslots={1}
          min={new Date(2020, 0, 1, 7, 0)}
          max={new Date(2020, 0, 1, 20, 0)}
          formats={{
            dayHeaderFormat: (date: Date) => format(date, "EEEE, dd. MMMM", { locale: de }),
            dayRangeHeaderFormat: ({ start, end }: { start: Date; end: Date }) =>
              `${format(start, "dd. MMM", { locale: de })} – ${format(end, "dd. MMM yyyy", { locale: de })}`,
            timeGutterFormat: (date: Date) => format(date, "HH:mm"),
          }}
          components={{
            month: {
              dateHeader: MonthDateHeader,
            },
          }}
          popup
          selectable={false}
          className="social-planner-calendar"
        />
      </div>

      {unscheduled.length > 0 && (
        <aside className="space-y-2 rounded-lg border bg-muted/30 p-3">
          <h4 className="text-xs font-semibold text-foreground flex items-center gap-1.5">
            <CalendarDays className="h-3.5 w-3.5" />
            Ungeplant ({unscheduled.length})
          </h4>
          <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">
            {unscheduled.map((item) => (
              <div key={item.id} className="rounded-md border bg-card p-2 text-xs space-y-1">
                <p className="font-medium leading-tight">{item.topic}</p>
                <div className="flex items-center gap-1">
                  <Badge
                    variant="secondary"
                    className="text-[10px]"
                    style={{ backgroundColor: STATUS_COLORS[item.workflow_status], color: "white" }}
                  >
                    {STATUS_LABELS[item.workflow_status]}
                  </Badge>
                </div>
                {item.tags.length > 0 && (
                  <div className="flex flex-wrap gap-0.5">
                    {item.tags.slice(0, 2).map((tag) => (
                      <Badge variant="outline" key={tag} className="text-[9px]">
                        <Tag className="mr-0.5 h-2 w-2" />{tag}
                      </Badge>
                    ))}
                  </div>
                )}
                <p className="text-muted-foreground">
                  {item.channel_names.join(", ") || "Kein Kanal"}
                </p>
              </div>
            ))}
          </div>
        </aside>
      )}
    </div>
  );
}
