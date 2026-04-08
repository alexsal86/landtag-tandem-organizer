import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { format, isPast, isToday } from "date-fns";
import { de } from "date-fns/locale";
import { AlertCircle, Archive, ArrowUpDown, Briefcase, CalendarClock, CalendarDays, ExternalLink, Plus, Search } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CaseItemsArchiveSheet } from "@/features/cases/items/components/CaseItemsArchiveSheet";
import { CaseItemCreateDialog } from "@/components/my-work/CaseItemCreateDialog";
import { CaseItemMeetingSelector } from "@/components/my-work/CaseItemMeetingSelector";
import { useAuth } from "@/hooks/useAuth";
import { useTenant } from "@/hooks/useTenant";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import { useCaseItems } from "@/features/cases/items/hooks";
import type { CaseItemListEntry, EscalationSuggestion } from "@/features/cases/items/types";
import { debugConsole } from "@/utils/debugConsole";
import { useCaseFileTypes } from "@/features/cases/files/hooks/useCaseFileTypes";

type SortBy = "updated_desc" | "due_asc" | "priority_desc";

type CaseFileOption = {
  id: string;
  title: string;
};

const STATUS_STYLES: Record<string, string> = {
  neu: "bg-sky-500 text-white",
  in_klaerung: "bg-amber-500 text-black",
  antwort_ausstehend: "bg-violet-500 text-white",
  erledigt: "bg-emerald-600 text-white",
  archiviert: "bg-slate-400 text-white",
};

const PRIORITY_LABELS: Record<string, string> = {
  low: "Niedrig",
  medium: "Mittel",
  high: "Hoch",
  urgent: "Dringend",
};

const STATUS_LABELS: Record<string, string> = {
  neu: "Neu",
  in_klaerung: "In Klärung",
  antwort_ausstehend: "Antwort ausstehend",
  erledigt: "Erledigt",
  archiviert: "Archiviert",
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
  const { currentTenant } = useTenant();
  const { data: configuredCaseItemCategories } = useCaseItemCategories();
  const { toast } = useToast();
  const navigate = useNavigate();

  const [items, setItems] = useState<CaseItemListEntry[]>([]);
  const [caseFiles, setCaseFiles] = useState<CaseFileOption[]>([]);
  const [escalationSuggestionByItemId, setEscalationSuggestionByItemId] = useState<Record<string, EscalationSuggestion>>({});
  const [selectedCaseFileByItemId, setSelectedCaseFileByItemId] = useState<Record<string, string>>({});
  const [processingItemId, setProcessingItemId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const [searchTerm, setSearchTerm] = useState("");
  const [channelFilter, setChannelFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [priorityFilter, setPriorityFilter] = useState("all");
  const [followUpFilter, setFollowUpFilter] = useState("all");
  const [dueFilter, setDueFilter] = useState("all");
  const [assignedToMeOnly, setAssignedToMeOnly] = useState(false);
  const [sortBy, setSortBy] = useState<SortBy>("updated_desc");
  const [createOpen, setCreateOpen] = useState(false);
  const [archiveOpen, setArchiveOpen] = useState(false);
  const [highlightedItemId, setHighlightedItemId] = useState<string | null>(null);

  // Jour Fixe meeting selector state (ContextMenu)
  const [meetingSelectorOpen, setMeetingSelectorOpen] = useState(false);
  const [meetingSelectorItemId, setMeetingSelectorItemId] = useState<string | null>(null);

  const { createCaseItem } = useCaseItems();

  const categoryOptions = useMemo(() => {
    const configured = (configuredCaseItemCategories ?? [])
      .map((category) => category.label?.trim() || category.name?.trim())
      .filter((label): label is string => Boolean(label));

    return configured.length > 0 ? configured : [...DEFAULT_CASE_ITEM_CATEGORIES];
  }, [configuredCaseItemCategories]);

  const loadCaseItems = useCallback(async () => {
    if (!user || !currentTenant?.id) return;

    try {
      setLoading(true);

      const userFilter = `user_id.eq.${user.id},owner_user_id.eq.${user.id}`;
      const [{ data, error }, { data: caseFileData, error: caseFilesError }] = await Promise.all([
        supabase
          .from("case_items")
          .select("id, user_id, owner_user_id, subject, summary, resolution_summary, status, priority, source_channel, follow_up_at, due_at, case_file_id, created_at, updated_at, meeting_id, pending_for_jour_fixe")
          .eq("tenant_id", currentTenant.id)
          .or(userFilter)
          .neq("status", "archiviert")
          .order("updated_at", { ascending: false, nullsFirst: false })
          .limit(100),
        supabase
          .from("case_files")
          .select("id, title")
          .eq("tenant_id", currentTenant.id)
          .in("status", ["active", "pending"])
          .order("updated_at", { ascending: false })
          .limit(50),
      ]);

      if (error) throw error;
      if (caseFilesError) throw caseFilesError;

      // Escalation suggestions loaded separately (best-effort)
      let escalationData: { suggestions?: EscalationSuggestion[] } | null = null;
      try {
        const { data: escData, error: escError } = await supabase.functions.invoke("suggest-case-escalations", {
          body: { action: "list" },
        });
        if (!escError) escalationData = escData;
      } catch (e) {
        debugConsole.warn("Eskalationsvorschläge konnten nicht geladen werden:", e);
      }

      const visibleItems = (data ?? []).map((row): CaseItemListEntry => ({
          id: row.id,
          title: row.subject || row.resolution_summary || "Ohne Titel",
          description: row.summary || null,
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
          meeting_id: row.meeting_id || null,
          pending_for_jour_fixe: row.pending_for_jour_fixe ?? false,
        }));

      setItems(visibleItems);
      setCaseFiles((caseFileData || []) as CaseFileOption[]);

      const incomingSuggestions = escalationData?.suggestions ?? [];
      const byItemId = incomingSuggestions.reduce<Record<string, EscalationSuggestion>>((acc, suggestion) => {
        acc[suggestion.case_items.id] = suggestion;
        return acc;
      }, {});
      setEscalationSuggestionByItemId(byItemId);

      const initialSelection = incomingSuggestions.reduce<Record<string, string>>((acc, suggestion) => {
        if (suggestion.suggested_case_file_id) {
          acc[suggestion.case_items.id] = suggestion.suggested_case_file_id;
        }
        return acc;
      }, {});
      setSelectedCaseFileByItemId(initialSelection);
    } catch (error) {
      debugConsole.error("Error loading case items:", error);
    } finally {
      setLoading(false);
    }
  }, [user, currentTenant?.id]);

  useEffect(() => {
    void loadCaseItems();
  }, [loadCaseItems]);

  const handleEscalation = async (itemId: string, mode: "create" | "assign") => {
    const suggestion = escalationSuggestionByItemId[itemId];
    if (!suggestion) {
      toast({
        title: "Kein Eskalationsvorschlag",
        description: "Für dieses Anliegen liegt aktuell kein Eskalationsvorschlag vor.",
        variant: "destructive",
      });
      return;
    }

    const selectedCaseFileId = selectedCaseFileByItemId[itemId] ?? "";
    if (mode === "assign" && !selectedCaseFileId) {
      toast({
        title: "Akte wählen",
        description: "Bitte zuerst eine bestehende Akte auswählen.",
        variant: "destructive",
      });
      return;
    }

    try {
      setProcessingItemId(itemId);
      const { error } = await supabase.functions.invoke("suggest-case-escalations", {
        body: {
          action: "review",
          suggestionId: suggestion.id,
          decision: "accepted",
          ...(mode === "create" ? { createCaseFile: true } : { targetCaseFileId: selectedCaseFileId }),
        },
      });
      if (error) throw error;

      toast({
        title: "Eskalation bestätigt",
        description: mode === "create" ? "Anliegen wurde in eine neue Akte überführt." : "Anliegen wurde einer bestehenden Akte zugeordnet.",
      });

      await loadCaseItems();
    } catch (error) {
      debugConsole.error("Error escalating case item:", error);
      toast({
        title: "Fehler",
        description: "Eskalation konnte nicht verarbeitet werden.",
        variant: "destructive",
      });
    } finally {
      setProcessingItemId(null);
    }
  };

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

  const handleArchive = async (itemId: string) => {
    try {
      const { error } = await supabase
        .from("case_items")
        .update({ status: "archiviert" })
        .eq("id", itemId);
      if (error) throw error;
      toast({ title: "Archiviert", description: "Vorgang wurde archiviert." });
      await loadCaseItems();
    } catch (e) {
      debugConsole.error("Error archiving case item:", e);
      toast({ title: "Fehler", description: "Vorgang konnte nicht archiviert werden.", variant: "destructive" });
    }
  };

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
        assignees={[]}
        defaultAssigneeId={null}
        categoryOptions={categoryOptions}
      />
      <CaseItemsArchiveSheet
        open={archiveOpen}
        onOpenChange={setArchiveOpen}
        onRestore={() => loadCaseItems()}
      />
      <CaseItemMeetingSelector
        open={meetingSelectorOpen}
        onOpenChange={(open) => {
          setMeetingSelectorOpen(open);
          if (!open) setMeetingSelectorItemId(null);
        }}
        onSelect={async (meetingId, meetingTitle) => {
          if (!meetingSelectorItemId) return;

          const { error } = await supabase
            .from("case_items")
            .update({ meeting_id: meetingId, pending_for_jour_fixe: false })
            .eq("id", meetingSelectorItemId);

          if (error) {
            debugConsole.error("Error linking case item to meeting:", error);
            toast({ title: "Fehler", description: "Zuordnung zum Jour Fixe fehlgeschlagen.", variant: "destructive" });
            return;
          }

          setItems((prev) =>
            prev.map((row) =>
              row.id === meetingSelectorItemId ? { ...row, meeting_id: meetingId, pending_for_jour_fixe: false } : row
            )
          );
          toast({ title: "Zugeordnet", description: `Vorgang dem Meeting „${meetingTitle}“ zugeordnet.` });
        }}
        onMarkForNextJourFixe={async () => {
          if (!meetingSelectorItemId) return;

          const { error } = await supabase
            .from("case_items")
            .update({ pending_for_jour_fixe: true })
            .eq("id", meetingSelectorItemId);

          if (error) {
            debugConsole.error("Error marking case item for next Jour Fixe:", error);
            toast({ title: "Fehler", description: "Vormerken für Jour Fixe fehlgeschlagen.", variant: "destructive" });
            return;
          }

          setItems((prev) => prev.map((row) => (row.id === meetingSelectorItemId ? { ...row, pending_for_jour_fixe: true } : row)));
          toast({ title: "Vorgemerkt", description: "Vorgang für den nächsten Jour Fixe vorgemerkt." });
        }}
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
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={() => setArchiveOpen(true)}>
                <Archive className="mr-2 h-4 w-4" />
                Archiv
              </Button>
              <Button onClick={() => setCreateOpen(true)}>
                <Plus className="mr-2 h-4 w-4" />
                Neues Anliegen
              </Button>
            </div>
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
                <ContextMenu key={item.id}>
                  <ContextMenuTrigger asChild>
                    <div
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
                          {/* Desktop: Full buttons */}
                          <div className="hidden lg:flex items-center gap-1">
                            {!item.case_file_id && (
                              <>
                                <Button
                                  size="sm"
                                  disabled={processingItemId === item.id}
                                  onClick={() => handleEscalation(item.id, "create")}
                                >
                                  In Akte überführen
                                </Button>
                                <select
                                  className="h-9 rounded-md border bg-background px-2 text-sm"
                                  value={selectedCaseFileByItemId[item.id] ?? ""}
                                  onChange={(event) =>
                                    setSelectedCaseFileByItemId((prev) => ({ ...prev, [item.id]: event.target.value }))
                                  }
                                  disabled={processingItemId === item.id}
                                >
                                  <option value="">Bestehende Akte wählen</option>
                                  {caseFiles.map((caseFile) => (
                                    <option key={caseFile.id} value={caseFile.id}>{caseFile.title}</option>
                                  ))}
                                </select>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  disabled={processingItemId === item.id || !selectedCaseFileByItemId[item.id]}
                                  onClick={() => handleEscalation(item.id, "assign")}
                                >
                                  Bestehender Akte zuordnen
                                </Button>
                              </>
                            )}
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
                          
                          {/* Mobile: Only open button */}
                          <Button 
                            size="sm" 
                            variant="outline" 
                            onClick={() => navigate(`/?section=casefiles&caseItemId=${item.id}`)}
                            className="lg:hidden"
                          >
                            <ExternalLink className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  </ContextMenuTrigger>
                  <ContextMenuContent>
                    <ContextMenuItem onClick={() => navigate(`/?section=casefiles&caseItemId=${item.id}`)}>
                      <ExternalLink className="mr-2 h-4 w-4" />
                      Öffnen
                    </ContextMenuItem>
                    {item.case_file_id && (
                      <ContextMenuItem onClick={() => navigate(`/casefiles?caseFileId=${item.case_file_id}`)}>
                        <Briefcase className="mr-2 h-4 w-4" />
                        In Akte öffnen
                      </ContextMenuItem>
                    )}
                    {!item.case_file_id && (
                      <ContextMenuItem onClick={() => handleEscalation(item.id, "create")} disabled={processingItemId === item.id}>
                        <Briefcase className="mr-2 h-4 w-4" />
                        In Akte überführen
                      </ContextMenuItem>
                    )}
                    <ContextMenuItem onClick={() => {
                      setMeetingSelectorItemId(item.id);
                      setMeetingSelectorOpen(true);
                    }}>
                      <CalendarDays className="mr-2 h-4 w-4" />
                      Zum Jour Fixe hinzufügen
                    </ContextMenuItem>
                    <ContextMenuItem onClick={() => handleArchive(item.id)}>
                      <Archive className="mr-2 h-4 w-4" />
                      Archivieren
                    </ContextMenuItem>
                  </ContextMenuContent>
                </ContextMenu>
              );
            })
          )}
        </div>
      </ScrollArea>
    </div>
  );
}
