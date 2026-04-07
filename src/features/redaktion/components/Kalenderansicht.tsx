import { useCallback, useMemo, useState } from "react";
import { CalendarDays, AlertTriangle, Clock3, ChevronLeft, ChevronRight, Tag } from "lucide-react";
import { addMonths, addWeeks, endOfWeek, format, startOfWeek } from "date-fns";
import { de } from "date-fns/locale";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { SocialPlannerItem, PlannerWorkflowStatus } from "@/features/redaktion/hooks/useSocialPlannerItems";
import type { PlannerNote } from "@/features/redaktion/hooks/usePlannerNotes";
import { type SpecialDay } from "@/utils/dashboard/specialDays";
import { PlannerCalendarGrid } from "./PlannerCalendarGrid";

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

function inferFormatType(item: SocialPlannerItem): "story" | "feed" | "other" {
  const normalized = [item.format, item.topic, item.draft_text].filter(Boolean).join(" ").toLowerCase();
  if (normalized.includes("story") || normalized.includes("stories")) return "story";
  if (normalized.includes("feed") || normalized.includes("post") || normalized.includes("carousel") || normalized.includes("reel")) return "feed";
  return "other";
}

interface Props {
  items: SocialPlannerItem[];
  onUpdateSchedule: (id: string, date: string) => Promise<void> | void;
  onEditItem: (id: string) => void;
  onCreateAtSlot?: (date: Date) => void;
  specialDays: SpecialDay[];
  notes: PlannerNote[];
  onCreateNote: (noteDate: string, content: string, color?: string) => Promise<void>;
  onUpdateNote: (id: string, patch: Partial<Pick<PlannerNote, "content" | "color">>) => Promise<void>;
  onDeleteNote: (id: string) => Promise<void>;
}

export function Kalenderansicht({ items, onUpdateSchedule, onEditItem, onCreateAtSlot, specialDays, notes, onCreateNote, onUpdateNote, onDeleteNote }: Props) {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [view, setView] = useState<"week" | "month">("week");
  const [inlineScheduleDates, setInlineScheduleDates] = useState<Record<string, string>>({});
  const [isScheduling, setIsScheduling] = useState(false);
  const unscheduled = useMemo(() => items.filter((i) => !i.scheduled_for), [items]);

  const rangeLabel = useMemo(() => {
    if (view === "month") {
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
    setCurrentDate((prev) => (view === "month"
      ? addMonths(prev, direction === "next" ? 1 : -1)
      : addWeeks(prev, direction === "next" ? 1 : -1)));
  }, [view]);

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

  return (
    <div className="space-y-3">
      {/* Toolbar */}
      <div className="flex flex-col gap-3 rounded-lg border bg-card p-4 xl:flex-row xl:items-center xl:justify-between">
        <div className="flex flex-wrap items-center gap-3 xl:flex-1">
          <div className="flex items-center gap-1">
            <Button type="button" size="sm" variant={view === "week" ? "default" : "ghost"} className="h-8 px-3" onClick={() => setView("week")}>Woche</Button>
            <Button type="button" size="sm" variant={view === "month" ? "default" : "ghost"} className="h-8 px-3" onClick={() => setView("month")}>Monat</Button>
          </div>
          <Button type="button" variant="outline" size="sm" className="h-9 px-4 text-sm font-medium" onClick={() => navigateCalendar("today")}>Heute</Button>
          <div className="flex items-center gap-0.5">
            <Button type="button" variant="ghost" size="icon" className="h-9 w-9" onClick={() => navigateCalendar("prev")}>
              <ChevronLeft className="h-5 w-5" />
            </Button>
            <Button type="button" variant="ghost" size="icon" className="h-9 w-9" onClick={() => navigateCalendar("next")}>
              <ChevronRight className="h-5 w-5" />
            </Button>
          </div>
        </div>
        <div className="xl:ml-auto xl:text-right">
          <h4 className="text-lg font-semibold capitalize text-foreground">{rangeLabel}</h4>
          <p className="text-xs text-muted-foreground">Planungskalender</p>
        </div>
      </div>

      {/* Calendar Grid */}
      <PlannerCalendarGrid
        view={view}
        currentDate={currentDate}
        items={items}
        specialDays={specialDays}
        notes={notes}
        onEditItem={onEditItem}
        onCreateAtSlot={onCreateAtSlot}
        onCreateNote={onCreateNote}
        onUpdateNote={onUpdateNote}
        onDeleteNote={onDeleteNote}
      />

      {/* Unscheduled items */}
      <aside className="space-y-2 rounded-lg border bg-muted/30 p-3">
        <h4 className="text-xs font-semibold text-foreground flex items-center gap-1.5">
          <CalendarDays className="h-3.5 w-3.5" />
          Ungeplant ({unscheduled.length})
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
                    {item.content_pillar && <Badge variant="secondary" className="text-[10px]">{item.content_pillar}</Badge>}
                  </div>
                  {item.campaign_name && <Badge variant="outline" className="text-[10px]">{item.campaign_name}</Badge>}
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
  );
}
