import { useCallback, useMemo, useState } from "react";
import { CalendarDays, AlertTriangle, icons, Clock3, Sparkles, ChevronLeft, ChevronRight, Tag } from "lucide-react";
import { Calendar, dateFnsLocalizer, Views, type View } from "react-big-calendar";
import withDragAndDrop from "react-big-calendar/lib/addons/dragAndDrop";
import { addMonths, addWeeks, endOfMonth, endOfWeek, format, parse, startOfDay, startOfMonth, startOfWeek, getDay, getISOWeek, isSameDay, isWithinInterval } from "date-fns";
import { de } from "date-fns/locale";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { SocialPlannerItem, PlannerWorkflowStatus } from "@/features/redaktion/hooks/useSocialPlannerItems";
import { type SpecialDay } from "@/utils/dashboard/specialDays";
import "react-big-calendar/lib/css/react-big-calendar.css";
import "react-big-calendar/lib/addons/dragAndDrop/styles.css";

const locales = { de };
const DragAndDropCalendar = withDragAndDrop<CalendarEvent>(Calendar);
const OVERLOAD_THRESHOLD_PER_DAY = 4;

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
  sameChannelCount: number;
  kind: "planner";
}

interface SpecialDayCalendarEvent {
  id: string;
  title: string;
  start: Date;
  end: Date;
  specialDay: SpecialDay;
  kind: "special-day";
}

type CalendarEvent = PlannerCalendarEvent | SpecialDayCalendarEvent;

interface Props {
  items: SocialPlannerItem[];
  onUpdateSchedule: (id: string, date: string) => Promise<void> | void;
  onEditItem: (id: string) => void;
  onCreateAtSlot?: (date: Date) => void;
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

function inferFormatType(item: SocialPlannerItem): "story" | "feed" | "other" {
  const normalized = [item.format, item.topic, item.draft_text].filter(Boolean).join(" ").toLowerCase();
  if (normalized.includes("story") || normalized.includes("stories")) return "story";
  if (normalized.includes("feed") || normalized.includes("post") || normalized.includes("carousel") || normalized.includes("reel")) return "feed";
  return "other";
}

function CalendarEventCard({ event }: { event: CalendarEvent }) {
  if (event.kind === "special-day") {
    const HintIcon = event.specialDay.icon ? icons[event.specialDay.icon as keyof typeof icons] : Sparkles;

    return (
      <div className="flex h-full flex-col gap-1 overflow-hidden">
        <div className="flex items-center gap-1">
          <HintIcon className="h-3 w-3 shrink-0" />
          <span className="truncate font-medium">{event.title}</span>
        </div>
        <span className="line-clamp-2 text-[10px] leading-snug text-amber-950/90">{event.specialDay.hint}</span>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col gap-1 overflow-hidden">
      <span className="truncate font-medium">{event.title}</span>
    </div>
  );
}

export function Kalenderansicht({ items, onUpdateSchedule, onEditItem, onCreateAtSlot, specialDays }: Props) {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [view, setView] = useState<View>(Views.WEEK);
  const [formatFilter, setFormatFilter] = useState<"all" | "story" | "feed">("all");
  const [slotSelection, setSlotSelection] = useState<Date | null>(null);
  const [slotSelectedItemId, setSlotSelectedItemId] = useState<string>("none");
  const [inlineScheduleDates, setInlineScheduleDates] = useState<Record<string, string>>({});
  const [isScheduling, setIsScheduling] = useState(false);

  const filteredItems = useMemo(() => {
    return items.filter((item) => {
      const formatType = inferFormatType(item);
      if (formatFilter !== "all" && formatType !== formatFilter) return false;
      return true;
    });
  }, [formatFilter, items]);

  const calendarRange = useMemo(() => {
    if (view === Views.MONTH) {
      return {
        start: startOfWeek(startOfMonth(currentDate), { locale: de }),
        end: endOfWeek(endOfMonth(currentDate), { locale: de }),
      };
    }

    const start = startOfWeek(currentDate, { locale: de });
    return {
      start,
      end: endOfWeek(currentDate, { locale: de }),
    };
  }, [currentDate, view]);

  const { events, unscheduled, countsByDay } = useMemo(() => {
    const scheduled: PlannerCalendarEvent[] = [];
    const unscheduledItems: SocialPlannerItem[] = [];
    const dayCountMap = new Map<string, number>();
    const conflictMap = new Map<string, number>();

    const scheduledItems = filteredItems.filter((item) => item.scheduled_for);
    for (const item of scheduledItems) {
      const dayKey = format(new Date(item.scheduled_for as string), "yyyy-MM-dd");
      dayCountMap.set(dayKey, (dayCountMap.get(dayKey) || 0) + 1);

      for (const channelId of item.channel_ids) {
        const conflictKey = `${dayKey}::${channelId}`;
        conflictMap.set(conflictKey, (conflictMap.get(conflictKey) || 0) + 1);
      }
    }

    for (const item of filteredItems) {
      if (item.scheduled_for) {
        const start = new Date(item.scheduled_for);
        const end = new Date(start.getTime() + 60 * 60 * 1000);
        const dayKey = format(start, "yyyy-MM-dd");
        const sameChannelCount = item.channel_ids.reduce((maxCount, channelId) => {
          const count = conflictMap.get(`${dayKey}::${channelId}`) || 0;
          return Math.max(maxCount, count);
        }, 1);

        scheduled.push({ id: item.id, title: item.topic, start, end, item, sameChannelCount, kind: "planner" });
      } else {
        unscheduledItems.push(item);
      }
    }

    const specialDayEvents: SpecialDayCalendarEvent[] = specialDays
      .flatMap((specialDay) => {
        const candidateYears = [calendarRange.start.getFullYear(), calendarRange.end.getFullYear()];
        return candidateYears
          .map((year) => {
            const start = new Date(year, specialDay.month - 1, specialDay.day, 9, 0, 0, 0);
            const end = new Date(year, specialDay.month - 1, specialDay.day, 10, 0, 0, 0);
            return {
              id: `special-day-${year}-${specialDay.month}-${specialDay.day}`,
              title: `Hinweis: ${specialDay.name}`,
              start,
              end,
              specialDay,
              kind: "special-day" as const,
            };
          })
          .filter((event, index, all) => all.findIndex((candidate) => candidate.id === event.id) === index)
          .filter((event) => isWithinInterval(event.start, { start: calendarRange.start, end: calendarRange.end }));
      });

    return { events: [...scheduled, ...specialDayEvents], unscheduled: unscheduledItems, countsByDay: dayCountMap };
  }, [calendarRange.end, calendarRange.start, filteredItems, specialDays]);

  const overloadedDays = useMemo(
    () => Array.from(countsByDay.entries()).filter(([, count]) => count >= OVERLOAD_THRESHOLD_PER_DAY),
    [countsByDay],
  );

  const eventStyleGetter = useCallback((event: CalendarEvent) => {
    if (event.kind === "special-day") {
      return {
        style: {
          backgroundColor: "rgba(251, 191, 36, 0.22)",
          borderRadius: "6px",
          border: "1px solid rgba(245, 158, 11, 0.75)",
          color: "rgb(120, 53, 15)",
          fontSize: "11px",
          padding: "2px 4px",
          boxShadow: "inset 0 0 0 1px rgba(255,255,255,0.35)",
        },
      };
    }

    return {
      style: {
        backgroundColor: STATUS_COLORS[event.item.workflow_status] || "hsl(var(--primary))",
        borderRadius: "6px",
        border: event.sameChannelCount > 1 ? "2px solid rgba(251,191,36,0.95)" : "none",
        color: "white",
        fontSize: "11px",
        padding: "2px 4px",
        boxShadow: event.sameChannelCount > 1 ? "0 0 0 1px rgba(120,53,15,0.25)" : "none",
      },
    };
  }, []);

  const persistSchedule = useCallback(async (itemId: string, date: Date) => {
    const normalizedDate = new Date(date);
    if (Number.isNaN(normalizedDate.getTime())) return;
    setIsScheduling(true);
    try {
      await onUpdateSchedule(itemId, normalizedDate.toISOString());
    } finally {
      setIsScheduling(false);
    }
  }, [onUpdateSchedule]);

  const handleEventMove = useCallback(async ({ event, start }: { event: CalendarEvent; start: any }) => {
    await persistSchedule(event.id, start);
  }, [persistSchedule]);

  const handleSelectSlot = useCallback(({ start }: { start: Date }) => {
    if (onCreateAtSlot) {
      onCreateAtSlot(start);
    }
  }, [onCreateAtSlot]);

  const handleDayPropGetter = useCallback((date: Date) => {
    const key = format(date, "yyyy-MM-dd");
    const count = countsByDay.get(key) || 0;
    if (count >= OVERLOAD_THRESHOLD_PER_DAY) {
      return {
        className: "bg-amber-50/70 dark:bg-amber-950/10",
        style: { boxShadow: "inset 0 0 0 1px rgba(245,158,11,0.35)" },
      };
    }
    return {};
  }, [countsByDay]);

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

  const rangeLabel = useMemo(() => {
    if (view === Views.MONTH) {
      return format(currentDate, "MMMM yyyy", { locale: de });
    }

    const weekStart = startOfWeek(currentDate, { locale: de });
    const weekEnd = endOfWeek(currentDate, { locale: de });
    return `${format(weekStart, "d. MMM", { locale: de })} – ${format(weekEnd, "d. MMM yyyy", { locale: de })}`;
  }, [currentDate, view]);

  const navigateCalendar = useCallback((direction: "prev" | "next" | "today") => {
    if (direction === "today") {
      setCurrentDate(new Date());
      return;
    }

    setCurrentDate((prev) => (view === Views.MONTH
      ? addMonths(prev, direction === "next" ? 1 : -1)
      : addWeeks(prev, direction === "next" ? 1 : -1)));
  }, [view]);

  const visibleOverloadedDays = useMemo(() => overloadedDays.filter(([day]) => {
    const date = new Date(`${day}T12:00:00`);
    if (view === Views.WEEK) {
      const weekStart = startOfWeek(currentDate, { locale: de });
      const weekEnd = new Date(weekStart);
      weekEnd.setDate(weekEnd.getDate() + 6);
      return isWithinInterval(date, { start: startOfDay(weekStart), end: new Date(weekEnd.setHours(23, 59, 59, 999)) });
    }
    return currentDate.getMonth() === date.getMonth() && currentDate.getFullYear() === date.getFullYear();
  }), [currentDate, overloadedDays, view]);

  return (
    <div className="space-y-3">
      <div className="flex flex-col gap-3 rounded-lg border bg-card p-4 xl:flex-row xl:items-center xl:justify-between">
        <div className="flex flex-wrap items-center gap-3">
          <Button type="button" variant="outline" size="sm" className="h-9 px-4 text-sm font-medium" onClick={() => navigateCalendar("today")}>Heute</Button>
          <div className="flex items-center gap-0.5">
            <Button type="button" variant="ghost" size="icon" className="h-9 w-9" onClick={() => navigateCalendar("prev")}>
              <ChevronLeft className="h-5 w-5" />
              <span className="sr-only">Vorherigen Zeitraum anzeigen</span>
            </Button>
            <Button type="button" variant="ghost" size="icon" className="h-9 w-9" onClick={() => navigateCalendar("next")}>
              <ChevronRight className="h-5 w-5" />
              <span className="sr-only">Nächsten Zeitraum anzeigen</span>
            </Button>
          </div>
          <div>
            <h4 className="text-lg font-semibold capitalize text-foreground">{rangeLabel}</h4>
            <p className="text-xs text-muted-foreground">Planungskalender</p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center rounded-md border overflow-hidden">
            <Button type="button" size="sm" variant={view === Views.WEEK ? "default" : "ghost"} className="rounded-none h-8 px-3" onClick={() => setView(Views.WEEK)}>Woche</Button>
            <Button type="button" size="sm" variant={view === Views.MONTH ? "default" : "ghost"} className="rounded-none h-8 px-3" onClick={() => setView(Views.MONTH)}>Monat</Button>
          </div>
          <Select value={formatFilter} onValueChange={(value) => setFormatFilter(value as typeof formatFilter)}>
            <SelectTrigger className="h-8 w-[150px]"><SelectValue placeholder="Format" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Alle Formate</SelectItem>
              <SelectItem value="story">Nur Stories</SelectItem>
              <SelectItem value="feed">Nur Feed</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {view === Views.WEEK && visibleOverloadedDays.length > 0 && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-950 dark:border-amber-900/70 dark:bg-amber-950/30 dark:text-amber-100">
          <div className="flex items-start gap-2">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            <div>
              <p className="font-medium">Überlastungswarnung in dieser Woche</p>
              <p className="text-xs">
                {visibleOverloadedDays.map(([day, count]) => `${format(new Date(`${day}T12:00:00`), "EEE, dd.MM.", { locale: de })}: ${count} Beiträge`).join(" · ")}
              </p>
            </div>
          </div>
        </div>
      )}

      <div className="min-h-[500px]">
        <div className="mb-2 rounded-md border border-muted-foreground/20 bg-muted/20 px-3 py-2 text-xs text-muted-foreground">
          Beiträge können direkt im Kalender per Drag-and-Drop neu terminiert werden. Klick auf einen freien Slot erstellt einen neuen Beitrag.
        </div>
        <DragAndDropCalendar
          localizer={localizer}
          events={events}
          startAccessor="start"
          endAccessor="end"
          date={currentDate}
          onNavigate={setCurrentDate}
          view={view}
          onView={setView}
          views={[Views.WEEK, Views.MONTH]}
          eventPropGetter={eventStyleGetter}
          dayPropGetter={handleDayPropGetter}
          messages={messages}
          culture="de"
          step={60}
          timeslots={1}
          min={new Date(2020, 0, 1, 0, 0)}
          max={new Date(2020, 0, 1, 23, 59, 59, 999)}
          formats={{
            dayHeaderFormat: (date: Date) => format(date, "EEEE, dd. MMMM", { locale: de }),
            dayRangeHeaderFormat: ({ start, end }: { start: Date; end: Date }) => `${format(start, "dd. MMM", { locale: de })} – ${format(end, "dd. MMM yyyy", { locale: de })}`,
            timeGutterFormat: (date: Date) => format(date, "HH:mm"),
          }}
          components={{
            event: CalendarEventCard,
            month: { dateHeader: MonthDateHeader },
          }}
          popup
          selectable
          resizable={false}
          draggableAccessor={(event) => event.kind === "planner"}
          onEventDrop={handleEventMove}
          onSelectSlot={handleSelectSlot}
          onSelectEvent={(event) => {
            if (event.kind === "planner") onEditItem(event.id);
          }}
          className="social-planner-calendar"
        />
      </div>

      <div>
        <aside className="space-y-2 rounded-lg border bg-muted/30 p-3">
          <h4 className="text-xs font-semibold text-foreground flex items-center gap-1.5">
            <CalendarDays className="h-3.5 w-3.5" />
            Ungeplant ({unscheduled.length}) · Gesamttermine {events.length}
          </h4>
          {unscheduled.length === 0 ? (
            <p className="text-xs text-muted-foreground">Keine ungeplanten Beiträge im aktuellen Filter.</p>
          ) : (
            <div className="grid gap-2">
              {unscheduled.map((item) => (
                <div key={item.id} className="rounded-md border bg-card p-2 text-xs space-y-2">
                  <div className="space-y-1">
                    <p className="font-medium leading-tight">{item.topic}</p>
                    <div className="flex items-center gap-1">
                      <Badge variant="secondary" className="text-[10px]" style={{ backgroundColor: STATUS_COLORS[item.workflow_status], color: "white" }}>
                        {STATUS_LABELS[item.workflow_status]}
                      </Badge>
                      <Badge variant="outline" className="text-[10px]">{inferFormatType(item) === "story" ? "Story" : inferFormatType(item) === "feed" ? "Feed" : "Format offen"}</Badge>
                    </div>
                    {item.tags.length > 0 && (
                      <div className="flex flex-wrap gap-0.5">
                        {item.tags.slice(0, 2).map((tag) => (
                          <Badge variant="outline" key={tag} className="text-[9px]"><Tag className="mr-0.5 h-2 w-2" />{tag}</Badge>
                        ))}
                      </div>
                    )}
                    <p className="text-muted-foreground">{item.channel_names.join(", ") || "Kein Kanal"}</p>
                  </div>
                  <div className="grid gap-2 sm:grid-cols-[1fr_auto_auto]">
                    <div className="space-y-1">
                      <Label htmlFor={`schedule-${item.id}`} className="text-[10px]">Einplanen am</Label>
                      <Input
                        id={`schedule-${item.id}`}
                        type="datetime-local"
                        value={inlineScheduleDates[item.id] || ""}
                        onChange={(event) => setInlineScheduleDates((current) => ({ ...current, [item.id]: event.target.value }))}
                        className="h-8 text-[11px]"
                      />
                    </div>
                    <Button type="button" variant="outline" size="sm" className="self-end" onClick={() => onEditItem(item.id)}>Bearbeiten</Button>
                    <Button
                      type="button"
                      size="sm"
                      className="self-end"
                      disabled={!inlineScheduleDates[item.id] || isScheduling}
                      onClick={() => void persistSchedule(item.id, new Date(inlineScheduleDates[item.id]))}
                    >
                      <Clock3 className="mr-1 h-3 w-3" />Einplanen
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </aside>
      </div>

    </div>
  );
}
