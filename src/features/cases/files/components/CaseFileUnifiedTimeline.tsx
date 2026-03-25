import { useState, useMemo } from "react";
import {
  CaseFileTimelineEntry,
  CaseFileNote,
  CaseFileDocument,
  CaseFileTask,
  CaseFileAppointment,
  CaseFileLetter,
  CaseItemInteraction,
} from "@/features/cases/files/hooks";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Clock,
  Flag,
  FileText,
  Calendar,
  CheckSquare,
  Mail,
  MessageSquare,
  Search,
  Plus,
  Trash2
} from "lucide-react";
import { format } from "date-fns";
import { de } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { getCaseTaskDescription } from "@/features/cases/shared/utils/caseInteropAdapters";

interface UnifiedTimelineItem {
  id: string;
  category: "timeline" | "note" | "document" | "task" | "appointment" | "letter" | "interaction";
  event_date: string;
  title: string;
  description: string | null;
  source_type?: string | null;
  meta?: Record<string, unknown>;
  created_by_name?: string | null;
}

interface CaseFileUnifiedTimelineProps {
  timeline: CaseFileTimelineEntry[];
  notes: CaseFileNote[];
  documents: CaseFileDocument[];
  tasks: CaseFileTask[];
  appointments: CaseFileAppointment[];
  letters: CaseFileLetter[];
  interactions: CaseItemInteraction[];
  onAddTimelineEntry: () => void;
  onDeleteTimelineEntry: (id: string) => Promise<boolean>;
}

const CATEGORY_CONFIG = {
  timeline: { icon: Flag, label: "Ereignis", color: "bg-purple-500" },
  note: { icon: MessageSquare, label: "Notiz", color: "bg-amber-500" },
  document: { icon: FileText, label: "Dokument", color: "bg-orange-500" },
  task: { icon: CheckSquare, label: "Aufgabe", color: "bg-green-500" },
  appointment: { icon: Calendar, label: "Termin", color: "bg-blue-500" },
  letter: { icon: Mail, label: "Brief", color: "bg-cyan-500" },
  interaction: { icon: MessageSquare, label: "Interaktion", color: "bg-indigo-500" },
};

const FILTER_TABS = [
  { value: "all", label: "Alle" },
  { value: "note", label: "Notizen" },
  { value: "appointment", label: "Termine" },
  { value: "task", label: "Aufgaben" },
  { value: "letter", label: "Briefe" },
];

export function CaseFileUnifiedTimeline({
  timeline,
  notes,
  documents,
  tasks,
  appointments,
  letters,
  interactions,
  onAddTimelineEntry,
  onDeleteTimelineEntry,
}: CaseFileUnifiedTimelineProps) {
  const [filter, setFilter] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");

  const unifiedItems = useMemo<UnifiedTimelineItem[]>(() => {
    const items: UnifiedTimelineItem[] = [
      // Only include manual timeline entries (not auto-generated link entries)
      ...timeline
        .filter((t) => t.source_type === "manual" || !t.source_type)
        .map((t) => ({
          id: `timeline-${t.id}`,
          category: "timeline" as const,
          event_date: t.event_date,
          title: t.title,
          description: t.description,
          source_type: t.source_type,
          meta: { originalId: t.id, eventType: t.event_type },
        })),
      ...notes.map((n) => ({
        id: `note-${n.id}`,
        category: "note" as const,
        event_date: n.created_at,
        title: "Notiz hinzugefügt",
        description: n.content,
      })),
      ...tasks.map((t) => ({
        id: `task-${t.id}`,
        category: "task" as const,
        event_date: t.created_at,
        title: `Aufgabe: ${t.task?.title || "Aufgabe"}`,
        description: getCaseTaskDescription(t.task),
        meta: { status: t.task?.status, priority: t.task?.priority },
      })),
      ...appointments.map((a) => ({
        id: `appointment-${a.id}`,
        category: "appointment" as const,
        event_date: a.appointment?.start_time || a.created_at,
        title: `Termin: ${a.appointment?.title || "Termin"}`,
        description: a.appointment?.location || null,
        meta: { status: a.appointment?.status },
      })),
      ...letters.map((l) => ({
        id: `letter-${l.id}`,
        category: "letter" as const,
        event_date: l.created_at,
        title: `Brief: ${l.letter?.title || "Brief"}`,
        description: l.letter?.subject || null,
        meta: { status: l.letter?.status },
      })),
      ...interactions.map((i) => ({
        id: `interaction-${i.id}`,
        category: "interaction" as const,
        event_date: i.created_at,
        title: `${i.interaction_type}: ${i.subject}`,
        description: i.details,
        meta: {
          type: i.interaction_type,
          direction: i.direction,
          isResolution: i.is_resolution,
        },
      })),
    ];

    return items.sort(
      (a, b) => new Date(b.event_date).getTime() - new Date(a.event_date).getTime()
    );
  }, [timeline, notes, documents, tasks, appointments, letters, interactions]);

  const filteredItems = useMemo(() => {
    let items = unifiedItems;
    if (filter !== "all") {
      items = items.filter((item) => item.category === filter);
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      items = items.filter(
        (item) =>
          item.title.toLowerCase().includes(q) ||
          (item.description && item.description.toLowerCase().includes(q))
      );
    }
    return items;
  }, [unifiedItems, filter, searchQuery]);

  // Group by month
  const groupedItems = useMemo(() => {
    const groups: Record<string, UnifiedTimelineItem[]> = {};
    filteredItems.forEach((item) => {
      const month = format(new Date(item.event_date), "MMMM yyyy", { locale: de });
      if (!groups[month]) groups[month] = [];
      groups[month].push(item);
    });
    return groups;
  }, [filteredItems]);

  return (
    <Card className="flex-1">
      <CardHeader className="p-4 pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <Clock className="h-4 w-4" />
            Chronologie
          </CardTitle>
          <Button size="sm" variant="outline" onClick={onAddTimelineEntry}>
            <Plus className="mr-1 h-3.5 w-3.5" />
            Ereignis
          </Button>
        </div>

        {/* Filter Tabs + Search in same row */}
        <div className="flex items-center gap-2 mt-2">
          <Tabs value={filter} onValueChange={setFilter} className="flex-1">
            <TabsList className="h-8">
              {FILTER_TABS.map((tab) => (
                <TabsTrigger key={tab.value} value={tab.value} className="text-xs px-2.5 h-7">
                  {tab.label}
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>
          <div className="relative w-40 shrink-0">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Suchen..."
              className="h-8 text-sm pl-7"
            />
          </div>
        </div>
      </CardHeader>
      <CardContent className="p-4 pt-2">
        {filteredItems.length === 0 ? (
          <p className="text-muted-foreground text-center py-8 text-sm">
            {searchQuery ? "Keine Treffer" : "Noch keine Einträge"}
          </p>
        ) : (
          <TooltipProvider>
            <div className="relative pl-16">
              <div className="absolute left-5 top-6 bottom-6 w-[2px] bg-muted" />
              <div className="space-y-10">
                {Object.entries(groupedItems).map(([month, items]) => (
                  <div key={month}>
                    <h3 className="ml-3 text-sm font-bold text-foreground mb-5 uppercase tracking-wider">
                      {month}
                    </h3>
                    <div className="space-y-6">
                      {items.map((item) => {
                        const config = CATEGORY_CONFIG[item.category];
                        const Icon = config.icon;
                        const isManualTimeline =
                          item.category === "timeline" && item.source_type === "manual";
                        const dateStr = format(new Date(item.event_date), "dd. MMMM yyyy", { locale: de });
                        const timeStr = format(new Date(item.event_date), "HH:mm", { locale: de });

                        return (
                          <div key={item.id} className="relative">
                            {/* Timeline dot with tooltip */}
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <div
                                  className={cn(
                                    "absolute -left-[58px] h-7 w-7 rounded-full border-2 border-background shadow-[0_0_0_3px_hsl(var(--background))] cursor-default flex items-center justify-center text-white",
                                    config.color
                                  )}
                                >
                                  <Icon className="h-3.5 w-3.5" />
                                </div>
                              </TooltipTrigger>
                              <TooltipContent side="left">
                                <p className="text-xs">
                                  {item.created_by_name
                                    ? `Hinzugefügt von ${item.created_by_name}`
                                    : "Hinzugefügt"}{" "}
                                  am {dateStr} um {timeStr}
                                </p>
                              </TooltipContent>
                            </Tooltip>

                            <div className="flex items-start justify-between gap-2">
                              <div className="min-w-0 flex-1">
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <p className="text-[10px] text-muted-foreground cursor-default">{dateStr}</p>
                                  </TooltipTrigger>
                                  <TooltipContent>
                                    <p className="text-xs">{timeStr} Uhr</p>
                                  </TooltipContent>
                                </Tooltip>
                                <p className="text-sm font-medium mt-0.5">{item.title}</p>
                                {item.description && (
                                  <p className="text-xs text-muted-foreground line-clamp-2 mt-1">{item.description}</p>
                                )}
                              </div>
                              {isManualTimeline && (
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-7 w-7 shrink-0 text-destructive hover:text-destructive"
                                  onClick={() => onDeleteTimelineEntry(String(item.meta?.originalId ?? ''))}
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
                                </Button>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </TooltipProvider>
        )}
      </CardContent>
    </Card>
  );
}
