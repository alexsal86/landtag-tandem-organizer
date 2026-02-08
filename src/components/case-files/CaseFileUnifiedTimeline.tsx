import { useState, useMemo } from "react";
import {
  CaseFileTimelineEntry,
  CaseFileNote,
  CaseFileDocument,
  CaseFileTask,
  CaseFileAppointment,
  CaseFileLetter,
} from "@/hooks/useCaseFileDetails";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
  Trash2,
} from "lucide-react";
import { format } from "date-fns";
import { de } from "date-fns/locale";
import { cn } from "@/lib/utils";

interface UnifiedTimelineItem {
  id: string;
  category: "timeline" | "note" | "document" | "task" | "appointment" | "letter";
  event_date: string;
  title: string;
  description: string | null;
  source_type?: string | null;
  meta?: Record<string, any>;
}

interface CaseFileUnifiedTimelineProps {
  timeline: CaseFileTimelineEntry[];
  notes: CaseFileNote[];
  documents: CaseFileDocument[];
  tasks: CaseFileTask[];
  appointments: CaseFileAppointment[];
  letters: CaseFileLetter[];
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
};

const FILTER_TABS = [
  { value: "all", label: "Alle" },
  { value: "note", label: "Notizen" },
  { value: "document", label: "Dokumente" },
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
  onAddTimelineEntry,
  onDeleteTimelineEntry,
}: CaseFileUnifiedTimelineProps) {
  const [filter, setFilter] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");

  const unifiedItems = useMemo<UnifiedTimelineItem[]>(() => {
    const items: UnifiedTimelineItem[] = [
      ...timeline.map((t) => ({
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
        title: "Notiz",
        description: n.content,
      })),
      ...documents.map((d) => ({
        id: `document-${d.id}`,
        category: "document" as const,
        event_date: d.created_at,
        title: d.document?.title || "Dokument",
        description: d.document?.file_name || null,
      })),
      ...tasks.map((t) => ({
        id: `task-${t.id}`,
        category: "task" as const,
        event_date: t.created_at,
        title: t.task?.title || "Aufgabe",
        description: t.task ? `Status: ${t.task.status}` : null,
        meta: { status: t.task?.status, priority: t.task?.priority },
      })),
      ...appointments.map((a) => ({
        id: `appointment-${a.id}`,
        category: "appointment" as const,
        event_date: a.appointment?.start_time || a.created_at,
        title: a.appointment?.title || "Termin",
        description: a.appointment?.location || null,
        meta: { status: a.appointment?.status },
      })),
      ...letters.map((l) => ({
        id: `letter-${l.id}`,
        category: "letter" as const,
        event_date: l.created_at,
        title: l.letter?.title || "Brief",
        description: l.letter?.subject || null,
        meta: { status: l.letter?.status },
      })),
    ];

    return items.sort(
      (a, b) => new Date(b.event_date).getTime() - new Date(a.event_date).getTime()
    );
  }, [timeline, notes, documents, tasks, appointments, letters]);

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

        {/* Filter Tabs */}
        <Tabs value={filter} onValueChange={setFilter} className="mt-2">
          <TabsList className="h-8">
            {FILTER_TABS.map((tab) => (
              <TabsTrigger key={tab.value} value={tab.value} className="text-xs px-2.5 h-7">
                {tab.label}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>

        {/* Search */}
        <div className="relative mt-2">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Suchen..."
            className="h-8 text-sm pl-8"
          />
        </div>
      </CardHeader>
      <CardContent className="p-4 pt-2">
        {filteredItems.length === 0 ? (
          <p className="text-muted-foreground text-center py-8 text-sm">
            {searchQuery ? "Keine Treffer" : "Noch keine Einträge"}
          </p>
        ) : (
          <div className="space-y-6">
            {Object.entries(groupedItems).map(([month, items]) => (
              <div key={month}>
                <h3 className="text-xs font-semibold text-muted-foreground mb-3 uppercase tracking-wider">
                  {month}
                </h3>
                <div className="relative border-l-2 border-muted pl-5 space-y-4">
                  {items.map((item) => {
                    const config = CATEGORY_CONFIG[item.category];
                    const Icon = config.icon;
                    const isManualTimeline =
                      item.category === "timeline" && item.source_type === "manual";

                    return (
                      <div key={item.id} className="relative">
                        {/* Timeline dot */}
                        <div
                          className={cn(
                            "absolute -left-[25px] w-3 h-3 rounded-full border-2 border-background",
                            config.color
                          )}
                        />

                        <div className="flex items-start justify-between gap-2">
                          <div className="space-y-0.5 min-w-0 flex-1">
                            <div className="flex items-center gap-2 flex-wrap">
                              <Badge variant="secondary" className="text-[10px] h-5">
                                <Icon className="h-3 w-3 mr-1" />
                                {config.label}
                              </Badge>
                              <span className="text-[10px] text-muted-foreground">
                                {format(new Date(item.event_date), "dd. MMM yyyy, HH:mm", {
                                  locale: de,
                                })}
                              </span>
                            </div>
                            <p className="text-sm font-medium">{item.title}</p>
                            {item.description && (
                              <p className="text-xs text-muted-foreground line-clamp-2">
                                {item.description}
                              </p>
                            )}
                          </div>
                          {isManualTimeline && (
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7 shrink-0 text-destructive hover:text-destructive"
                              onClick={() => onDeleteTimelineEntry(item.meta?.originalId)}
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
        )}
      </CardContent>
    </Card>
  );
}
