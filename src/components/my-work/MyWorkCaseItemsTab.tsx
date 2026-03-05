import { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { format, isPast, isToday } from "date-fns";
import { de } from "date-fns/locale";
import { AlertCircle, ArrowUpDown, Briefcase, CalendarClock, ExternalLink, Plus, Search } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CaseItemCreateDialog } from "@/components/my-work/CaseItemCreateDialog";
import { useAuth } from "@/hooks/useAuth";
import { useCaseItems } from "@/hooks/useCaseItems";
import { cn } from "@/lib/utils";

type SortBy = "updated_desc" | "due_asc" | "priority_desc";

const STATUS_STYLES: Record<string, string> = {
  active: "bg-blue-500 text-white",
  pending: "bg-yellow-500 text-black",
  closed: "bg-green-600 text-white",
  archived: "bg-gray-500 text-white",
};

const PRIORITY_LABELS: Record<string, string> = {
  low: "Niedrig",
  medium: "Mittel",
  high: "Hoch",
  urgent: "Dringend",
};

const STATUS_LABELS: Record<string, string> = {
  active: "Aktiv",
  pending: "In Bearbeitung",
  closed: "Geschlossen",
  archived: "Archiviert",
};

const CHANNEL_LABELS: Record<string, string> = {
  email: "E-Mail",
  phone: "Telefon",
  social: "Social Media",
  in_person: "Persönlich",
  other: "Sonstiges",
};

const normalize = (value: string | null | undefined) => value?.trim().toLowerCase() || "";

export function MyWorkCaseItemsTab() {
  const { user } = useAuth();
  const { caseItems, loading, createCaseItem } = useCaseItems();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  const [searchTerm, setSearchTerm] = useState("");
  const [channelFilter, setChannelFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [priorityFilter, setPriorityFilter] = useState("all");
  const [followUpFilter, setFollowUpFilter] = useState("all");
  const [dueFilter, setDueFilter] = useState("all");
  const [assignedToMeOnly, setAssignedToMeOnly] = useState(false);
  const [sortBy, setSortBy] = useState<SortBy>("updated_desc");
  const [createOpen, setCreateOpen] = useState(false);
  const [highlightedItemId, setHighlightedItemId] = useState<string | null>(null);

  const items = useMemo(() => (
    caseItems
      .filter((row) => row.user_id === user?.id || row.owner_user_id === user?.id)
      .map((row) => ({
        id: row.id,
        title: row.resolution_summary || "Ohne Titel",
        description: null,
        status: row.status || null,
        priority: row.priority || null,
        channel: row.source_channel || null,
        follow_up_at: row.follow_up_at || null,
        due_date: row.due_at || null,
        assigned_to: row.owner_user_id,
        user_id: row.user_id || null,
        case_file_id: row.case_file_id || null,
        created_at: row.created_at,
        updated_at: row.updated_at || null,
      }))
  ), [caseItems, user?.id]);

  useEffect(() => {
    if (!highlightedItemId) return;

    const timer = window.setTimeout(() => {
      setHighlightedItemId(null);
    }, 3000);

    return () => window.clearTimeout(timer);
  }, [highlightedItemId]);

  const channelOptions = useMemo(() => {
    const channels = new Set(items.map((item) => normalize(item.channel)).filter(Boolean));
    return Array.from(channels);
  }, [items]);

  const statusOptions = useMemo(() => {
    const statuses = new Set(items.map((item) => normalize(item.status)).filter(Boolean));
    return Array.from(statuses);
  }, [items]);

  const priorityOptions = useMemo(() => {
    const priorities = new Set(items.map((item) => normalize(item.priority)).filter(Boolean));
    return Array.from(priorities);
  }, [items]);

  const filteredItems = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();

    const base = items.filter((item) => {
      const matchesSearch = !q || [
        item.title,
        item.description || "",
        item.channel || "",
        item.status || "",
        item.priority || "",
      ].join(" ").toLowerCase().includes(q);

      const itemChannel = normalize(item.channel);
      const itemStatus = normalize(item.status);
      const itemPriority = normalize(item.priority);

      const matchesChannel = channelFilter === "all" || itemChannel === channelFilter;
      const matchesStatus = statusFilter === "all" || itemStatus === statusFilter;
      const matchesPriority = priorityFilter === "all" || itemPriority === priorityFilter;

      const followUpDate = item.follow_up_at ? new Date(item.follow_up_at) : null;
      const dueDate = item.due_date ? new Date(item.due_date) : null;

      const matchesFollowUp =
        followUpFilter === "all"
        || (followUpFilter === "none" && !followUpDate)
        || (followUpFilter === "today" && followUpDate && isToday(followUpDate))
        || (followUpFilter === "overdue" && followUpDate && isPast(followUpDate) && !isToday(followUpDate));

      const matchesDue =
        dueFilter === "all"
        || (dueFilter === "none" && !dueDate)
        || (dueFilter === "today" && dueDate && isToday(dueDate))
        || (dueFilter === "overdue" && dueDate && isPast(dueDate) && !isToday(dueDate));

      const matchesAssignee = !assignedToMeOnly || item.assigned_to === user?.id;

      return matchesSearch && matchesChannel && matchesStatus && matchesPriority && matchesFollowUp && matchesDue && matchesAssignee;
    });

    const priorityWeight: Record<string, number> = { urgent: 4, high: 3, medium: 2, low: 1 };

    return [...base].sort((a, b) => {
      if (sortBy === "due_asc") {
        const aDue = a.due_date ? new Date(a.due_date).getTime() : Number.MAX_SAFE_INTEGER;
        const bDue = b.due_date ? new Date(b.due_date).getTime() : Number.MAX_SAFE_INTEGER;
        return aDue - bDue;
      }

      if (sortBy === "priority_desc") {
        return (priorityWeight[normalize(b.priority)] || 0) - (priorityWeight[normalize(a.priority)] || 0);
      }

      const aUpdated = new Date(a.updated_at || a.created_at).getTime();
      const bUpdated = new Date(b.updated_at || b.created_at).getTime();
      return bUpdated - aUpdated;
    });
  }, [items, searchTerm, channelFilter, statusFilter, priorityFilter, followUpFilter, dueFilter, assignedToMeOnly, sortBy, user?.id]);

  if (loading) {
    return (
      <div className="space-y-2 p-4">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="h-24 animate-pulse rounded-md bg-muted" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-4 p-4">
      <CaseItemCreateDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        onCreated={(newItemId) => setHighlightedItemId(newItemId)}
        createCaseItem={createCaseItem}
      />

      <Card>
        <CardContent className="p-4 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="relative w-full max-w-xl">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Suche in Titel, Beschreibung, Kanal, Status…"
                className="pl-9"
              />
            </div>
            <Button onClick={() => setCreateOpen(true)}>
              <Plus className="mr-2 h-4 w-4" />
              Neues Anliegen
            </Button>
          </div>

          <div className="flex flex-wrap gap-2">
            <Select value={channelFilter} onValueChange={setChannelFilter}>
              <SelectTrigger className="w-[180px]"><SelectValue placeholder="Kanal" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Alle Kanäle</SelectItem>
                {channelOptions.map((channel) => (
                  <SelectItem key={channel} value={channel}>{CHANNEL_LABELS[channel] || channel}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[190px]"><SelectValue placeholder="Status" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Alle Status</SelectItem>
                {statusOptions.map((status) => (
                  <SelectItem key={status} value={status}>{STATUS_LABELS[status] || status}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={priorityFilter} onValueChange={setPriorityFilter}>
              <SelectTrigger className="w-[170px]"><SelectValue placeholder="Priorität" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Alle Prioritäten</SelectItem>
                {priorityOptions.map((priority) => (
                  <SelectItem key={priority} value={priority}>{PRIORITY_LABELS[priority] || priority}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={followUpFilter} onValueChange={setFollowUpFilter}>
              <SelectTrigger className="w-[180px]"><SelectValue placeholder="Wiedervorlage" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Alle Wiedervorlagen</SelectItem>
                <SelectItem value="today">Heute</SelectItem>
                <SelectItem value="overdue">Überfällig</SelectItem>
                <SelectItem value="none">Ohne Wiedervorlage</SelectItem>
              </SelectContent>
            </Select>

            <Select value={dueFilter} onValueChange={setDueFilter}>
              <SelectTrigger className="w-[150px]"><SelectValue placeholder="Fälligkeit" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Alle Fristen</SelectItem>
                <SelectItem value="today">Heute</SelectItem>
                <SelectItem value="overdue">Überfällig</SelectItem>
                <SelectItem value="none">Ohne Fälligkeit</SelectItem>
              </SelectContent>
            </Select>

            <Select value={sortBy} onValueChange={(value) => setSortBy(value as SortBy)}>
              <SelectTrigger className="w-[190px]"><SelectValue placeholder="Sortierung" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="updated_desc">Zuletzt geändert</SelectItem>
                <SelectItem value="due_asc">Fälligkeit (früh zuerst)</SelectItem>
                <SelectItem value="priority_desc">Priorität (hoch zuerst)</SelectItem>
              </SelectContent>
            </Select>

            <label className="flex items-center gap-2 px-2 text-sm">
              <Checkbox checked={assignedToMeOnly} onCheckedChange={(checked) => setAssignedToMeOnly(checked === true)} />
              mir zugewiesen
            </label>
          </div>
        </CardContent>
      </Card>

      <ScrollArea className="h-[520px]">
        <div className="space-y-2">
          {filteredItems.length === 0 ? (
            <div className="rounded-md border border-dashed p-8 text-center text-muted-foreground">
              <AlertCircle className="mx-auto mb-2 h-8 w-8 opacity-50" />
              Keine Anliegen für die aktuellen Filter gefunden.
            </div>
          ) : (
            filteredItems.map((item) => {
              const normalizedStatus = normalize(item.status);
              const normalizedPriority = normalize(item.priority);
              const dueDate = item.due_date ? new Date(item.due_date) : null;
              const followUpDate = item.follow_up_at ? new Date(item.follow_up_at) : null;
              const isOverdue = Boolean(dueDate && isPast(dueDate) && !isToday(dueDate));

              return (
                <div
                  key={item.id}
                  className={cn(
                    "rounded-lg border bg-card p-3 transition-colors hover:bg-muted/40",
                    highlightedItemId === item.id && "border-primary bg-primary/10"
                  )}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="truncate text-sm font-semibold">{item.title}</p>
                        {item.status && (
                          <Badge className={cn("text-xs", STATUS_STYLES[normalizedStatus] || "bg-slate-500 text-white")}>
                            {STATUS_LABELS[normalizedStatus] || item.status}
                          </Badge>
                        )}
                        {item.priority && (
                          <Badge variant={normalizedPriority === "high" || normalizedPriority === "urgent" ? "destructive" : "secondary"} className="text-xs">
                            {PRIORITY_LABELS[normalizedPriority] || item.priority}
                          </Badge>
                        )}
                        {item.channel && (
                          <Badge variant="outline" className="text-xs">{CHANNEL_LABELS[normalize(item.channel)] || item.channel}</Badge>
                        )}
                      </div>

                      {item.description && (
                        <p className="line-clamp-2 text-xs text-muted-foreground">{item.description}</p>
                      )}

                      <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                        {dueDate && (
                          <span className={cn("inline-flex items-center gap-1", isOverdue && "text-destructive font-medium")}>
                            <CalendarClock className="h-3 w-3" />
                            Fällig: {format(dueDate, "dd.MM.yyyy", { locale: de })}
                          </span>
                        )}
                        {followUpDate && (
                          <span className="inline-flex items-center gap-1">
                            <ArrowUpDown className="h-3 w-3" />
                            Wiedervorlage: {format(followUpDate, "dd.MM.yyyy", { locale: de })}
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="flex shrink-0 items-center gap-1">
                      <Button size="sm" variant="outline" onClick={() => navigate(`/?section=casefiles&caseItemId=${item.id}`)}>
                        <ExternalLink className="mr-1 h-3.5 w-3.5" />
                        Öffnen
                      </Button>
                      {item.case_file_id && (
                        <Button size="sm" variant="ghost" onClick={() => navigate(`/casefiles?caseFileId=${item.case_file_id}`)}>
                          <Briefcase className="mr-1 h-3.5 w-3.5" />
                          In Akte öffnen
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </ScrollArea>
    </div>
  );
}
