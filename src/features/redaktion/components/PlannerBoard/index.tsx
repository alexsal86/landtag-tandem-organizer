import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Check, Filter, Plus } from "lucide-react";
import { format } from "date-fns";
import { useSearchParams } from "react-router-dom";
import { Kalenderansicht } from "../Kalenderansicht";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useTenantUsers } from "@/hooks/useTenantUsers";
import { toast } from "@/hooks/use-toast";
import {
  type SocialPlannerItem,
  useSocialPlannerItems,
} from "@/features/redaktion/hooks/useSocialPlannerItems";
import { useTopicBacklog } from "@/features/redaktion/hooks/useTopicBacklog";
import { usePlannerNotes } from "@/features/redaktion/hooks/usePlannerNotes";
import { useSocialCampaigns } from "@/features/redaktion/hooks/useSocialCampaigns";
import type { SpecialDay } from "@/utils/dashboard/specialDays";
import { lazyWithRetry } from "@/lib/lazyWithRetry";
import { debugConsole } from "@/utils/debugConsole";
import {
  CONTENT_PILLAR_OPTIONS,
  SORT_OPTIONS,
  STATUS_COLUMNS,
  TEMPLATE_OPTIONS,
} from "./constants";
import type { PlannerFormatFilter, SocialPlannerDraftPayload } from "./types";
import { inferFormatType } from "./utils";
import { getErrorMessage } from "@/utils/errorHandler";
import { notify } from "@/lib/notify";

const SocialPlannerEditPanel = lazyWithRetry(
  () => import("./SocialPlannerEditPanel"),
);

interface PlannerBoardProps {
  specialDays?: SpecialDay[];
}

export function PlannerBoard({ specialDays = [] }: PlannerBoardProps) {
  const [searchParams] = useSearchParams();
  const { users } = useTenantUsers();
  const { topics, createTopic } = useTopicBacklog();
  const { campaigns } = useSocialCampaigns();
  const { items, channels, loading, updateItem, createItem, deleteItem } = useSocialPlannerItems();
  const { notes, createNote, updateNote, deleteNote } = usePlannerNotes();
  debugConsole.log("[PlannerBoard] render", { hasUsers: !!users, topicsCount: topics?.length, itemsCount: items?.length, channelsCount: channels?.length, loading });

  const [channelFilter, setChannelFilter] = useState<string>("all");
  const [ownerFilter, setOwnerFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [formatFilter, setFormatFilter] = useState<PlannerFormatFilter>("all");
  const [campaignFilter, setCampaignFilter] = useState<string>("all");
  const [pillarFilter, setPillarFilter] = useState<string>("all");
  const [tagSearch, setTagSearch] = useState("");
  const [sortBy, setSortBy] = useState<(typeof SORT_OPTIONS)[number]["value"]>("scheduled");
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [editingItemId, setEditingItemId] = useState<string | null>(null);
  const [editScrollRequest, setEditScrollRequest] = useState(0);
  const [deleteItemId, setDeleteItemId] = useState<string | null>(null);
  const [createTemplate, setCreateTemplate] = useState("none");
  const [createTopicId, setCreateTopicId] = useState<string | null>(null);
  const [createTopicTitle, setCreateTopicTitle] = useState("");
  const [createChannelIds, setCreateChannelIds] = useState<string[]>([]);
  const [createResponsibleUserId, setCreateResponsibleUserId] = useState("none");
  const [createScheduledDate, setCreateScheduledDate] = useState("");
  const [createAppointmentId, setCreateAppointmentId] = useState<string | null>(null);
  const [isCreatingDraft, setIsCreatingDraft] = useState(false);
  const skipCreateFocusRestore = useRef(false);
  const pendingTopicDrops = useRef(new Set<string>());

  const editingItem = useMemo(
    () => items.find((item) => item.id === editingItemId) || null,
    [editingItemId, items],
  );
  const deleteCandidate = useMemo(
    () => items.find((item) => item.id === deleteItemId) || null,
    [deleteItemId, items],
  );

  const allTagSuggestions = useMemo(
    () => [...new Set(items.flatMap((item) => item.tags))].sort(),
    [items],
  );

  const filteredItems = useMemo(() => {
    const search = tagSearch.trim().toLowerCase();

    return items
      .filter((item) => {
        if (channelFilter !== "all" && !item.channel_ids.includes(channelFilter)) return false;
        if (ownerFilter !== "all" && item.responsible_user_id !== ownerFilter) return false;
        if (statusFilter !== "all" && item.workflow_status !== statusFilter) return false;
        if (formatFilter !== "all" && inferFormatType(item) !== formatFilter) return false;
        if (campaignFilter !== "all" && item.campaign_id !== campaignFilter) return false;
        if (pillarFilter !== "all" && item.content_pillar !== pillarFilter) return false;
        if (!search) return true;

        return (
          item.topic.toLowerCase().includes(search) ||
          item.tags.some((tag) => tag.toLowerCase().includes(search)) ||
          item.content_goal?.toLowerCase().includes(search) ||
          item.format_variant?.toLowerCase().includes(search)
        );
      })
      .sort((a, b) => {
        if (sortBy === "topic") return a.topic.localeCompare(b.topic);
        if (sortBy === "status") return a.workflow_status.localeCompare(b.workflow_status);
        if (sortBy === "campaign_phase") {
          const getPhaseRank = (item: SocialPlannerItem) => {
            if (!item.campaign_start_date || !item.campaign_end_date) return 3;
            const now = new Date();
            const start = new Date(item.campaign_start_date);
            const end = new Date(item.campaign_end_date);
            if (now < start) return 0;
            if (now > end) return 2;
            return 1;
          };
          return getPhaseRank(a) - getPhaseRank(b);
        }

        const aTime = a.scheduled_for ? new Date(a.scheduled_for).getTime() : Number.MAX_SAFE_INTEGER;
        const bTime = b.scheduled_for ? new Date(b.scheduled_for).getTime() : Number.MAX_SAFE_INTEGER;
        return aTime - bTime;
      });
  }, [items, channelFilter, ownerFilter, statusFilter, formatFilter, campaignFilter, pillarFilter, tagSearch, sortBy]);

  const handleSaveItem = useCallback(async (itemId: string, payload: SocialPlannerDraftPayload) => {
    await updateItem(itemId, payload);
    notify.success("Beitrag aktualisiert", { description: "Änderungen sind im Board und Kalender sichtbar." 
});
  }, [toast, updateItem]);

  const resetCreateDialog = () => {
    setCreateTemplate("none");
    setCreateTopicId(null);
    setCreateTopicTitle("");
    setCreateChannelIds([]);
    setCreateResponsibleUserId("none");
    setCreateScheduledDate("");
    setCreateAppointmentId(null);
  };

  const createDraft = async () => {
    if (isCreatingDraft) return;
    const topicTitle = createTopicTitle.trim();
    if (!topicTitle) {
      notify.error("Bitte ein Thema eingeben");
      return;
    }

    try {
      setIsCreatingDraft(true);
      let topicBacklogId = createTopicId
        || topics.find((topic) => topic.topic.trim().toLowerCase() === topicTitle.toLowerCase())?.id;
      if (!topicBacklogId) {
        const createdTopic = await createTopic({ topic: topicTitle, status: "idea" });
        if (!createdTopic?.id) throw new Error("topic-create-failed");
        topicBacklogId = createdTopic.id;
        setCreateTopicId(topicBacklogId);
      }

      // Keep all template defaults, even though the quick form only shows basic fields.
      const template = TEMPLATE_OPTIONS.find((entry) => entry.id === createTemplate);
      const createdItem = await createItem({
        topic_backlog_id: topicBacklogId,
        workflow_status: "ideas",
        approval_state: "draft",
        format: template?.format || null,
        content_goal: template?.content_goal || null,
        format_variant: template?.format_variant || null,
        asset_requirements: template ? [...template.asset_requirements] : [],
        hook: template?.hook || null,
        cta: template?.cta || null,
        approval_required: true,
        responsible_user_id: createResponsibleUserId === "none" ? null : createResponsibleUserId,
        scheduled_for: createScheduledDate ? new Date(`${createScheduledDate}T09:00:00`).toISOString() : null,
        channel_ids: createChannelIds,
        variants: createChannelIds.map((channelId) => ({
          channel_id: channelId,
          caption: "",
          first_comment: "",
          media_type: "" as const,
          asset_ids: [],
          platform_metadata: {},
          platform_status: "draft" as const,
        })),
        appointment_id: createAppointmentId,
      });
      if (!createdItem?.id) throw new Error("item-create-failed");

      skipCreateFocusRestore.current = true;
      setEditingItemId(createdItem.id);
      setEditScrollRequest((request) => request + 1);
      setIsCreateDialogOpen(false);
      resetCreateDialog();
      notify.success("Inhalt angelegt");
    } catch (error) {
      notify.error("Inhalt konnte nicht angelegt werden", { description: getErrorMessage(error) });
    } finally {
      setIsCreatingDraft(false);
    }
  };

  const handleTopicDrop = async (topicId: string, scheduledFor: Date) => {
    // Resolve metadata from this tenant's loaded topics, never from the drag payload.
    const topic = topics.find((entry) => entry.id === topicId);
    if (!topic) { notify.error("Thema nicht verfügbar. Bitte den Themenspeicher neu öffnen."); return; }
    const scheduledIso = scheduledFor.toISOString();
    const dropKey = `${topicId}:${scheduledIso}`;
    if (pendingTopicDrops.current.has(dropKey)) return;
    if (items.some((item) => item.topic_backlog_id === topicId && item.scheduled_for && new Date(item.scheduled_for).getTime() === scheduledFor.getTime())) {
      notify.error("Dieses Thema ist zu diesem Zeitpunkt bereits eingeplant.");
      return;
    }
    pendingTopicDrops.current.add(dropKey);
    try {
      const created = await createItem({
        topic_backlog_id: topic.id,
        scheduled_for: scheduledIso,
        workflow_status: "ideas",
        approval_state: "draft",
        approval_required: true,
        hook: topic.short_description || topic.topic,
        core_message: topic.topic,
        notes: `Aus Themenspeicher übernommen (${topic.topic})`,
        responsible_user_id: topic.owner_id,
        campaign_id: topic.campaign_id,
        content_pillar: topic.content_pillar,
        asset_requirements: topic.open_production_needs || [],
      });
      if (!created?.id) throw new Error("topic-drop-create-failed");
      notify.success(`Eingeplant am ${format(scheduledFor, "dd.MM.yyyy 'um' HH:mm")}`);
    } catch (error) {
      notify.error("Thema konnte nicht eingeplant werden. Bitte erneut versuchen.", { description: getErrorMessage(error) });
    } finally {
      pendingTopicDrops.current.delete(dropKey);
    }
  };

  const handleDeleteItem = useCallback(async () => {
    if (!deleteItemId) return;

    try {
      await deleteItem(deleteItemId);
      if (editingItemId === deleteItemId) setEditingItemId(null);
      setDeleteItemId(null);
      notify.success("Beitrag gelöscht", { description: "Der Social-Media-Entwurf wurde aus dem Planner entfernt." 
});
    } catch (error) {
      notify.error("Beitrag konnte nicht gelöscht werden", { description: getErrorMessage(error) });
    }
  }, [deleteItem, deleteItemId, editingItemId, toast]);

  const clearFilters = () => {
    setChannelFilter("all");
    setOwnerFilter("all");
    setStatusFilter("all");
    setFormatFilter("all");
    setCampaignFilter("all");
    setPillarFilter("all");
    setTagSearch("");
    setSortBy("scheduled");
  };

  const handleCalendarScheduleUpdate = useCallback(async (itemId: string, isoDate: string) => {
    try {
      await updateItem(itemId, { scheduled_for: isoDate } as Parameters<typeof updateItem>[1]);
    } catch (error) {
      notify.error("Zeitpunkt konnte nicht geändert werden", { description: getErrorMessage(error) });
    }
  }, [updateItem, toast]);

  const hasActiveFilters = channelFilter !== "all" || ownerFilter !== "all" || statusFilter !== "all" || formatFilter !== "all" || campaignFilter !== "all" || pillarFilter !== "all" || tagSearch.trim().length > 0 || sortBy !== "scheduled";

  useEffect(() => {
    const highlightId = searchParams.get("highlight");
    if (!highlightId || items.length === 0) return;

    const targetItem = items.find((item) => item.id === highlightId);
    if (!targetItem) return;

    const timeout = window.setTimeout(() => {
      const element = document.querySelector(`[data-social-planner-item-id="${highlightId}"]`);
      if (element instanceof HTMLElement) {
        element.scrollIntoView({ behavior: "smooth", block: "center" });
        element.classList.add("notification-highlight");
        window.setTimeout(() => element.classList.remove("notification-highlight"), 2200);
      }
    }, 150);

    return () => window.clearTimeout(timeout);
  }, [items, searchParams]);

  // Prefill Create-Dialog when navigated from an Appointment ("Ankündigung" / "Rückblick")
  useEffect(() => {
    const apptId = searchParams.get("socialAppointmentId");
    if (!apptId) return;
    const topicTitle = searchParams.get("socialTopic") || "";
    const scheduledDate = searchParams.get("socialScheduledDate") || "";

    resetCreateDialog();
    setCreateAppointmentId(apptId);
    if (topicTitle) setCreateTopicTitle(topicTitle);
    if (scheduledDate) setCreateScheduledDate(scheduledDate);
    setIsCreateDialogOpen(true);
    // We intentionally only react to changes of the appointment id
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams.get("socialAppointmentId")]);

  return (
    <div className="flex min-w-0 flex-col items-start gap-4">
      <Card className="min-w-0 w-full flex-1">
      <CardContent className="pt-6">
        <Kalenderansicht
          onDropTopic={(topicId, date) => { void handleTopicDrop(topicId, date); }}
          items={filteredItems}
          onUpdateSchedule={handleCalendarScheduleUpdate}
          onEditItem={(itemId) => {
            setEditingItemId(itemId);
            setEditScrollRequest((request) => request + 1);
          }}
          onCreateAtSlot={(date) => {
            resetCreateDialog();
            setCreateScheduledDate(format(date, "yyyy-MM-dd"));
            setIsCreateDialogOpen(true);
          }}
          specialDays={specialDays}
          notes={notes}
          onCreateNote={createNote}
          onUpdateNote={updateNote}
          onDeleteNote={deleteNote}
          headerActions={(
            <div className="flex flex-wrap items-center gap-2">
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className="relative h-9 rounded-lg px-3 text-sm">
                    <Filter className="mr-1 h-4 w-4" />
                    Filter
                    {hasActiveFilters && (
                      <span className="absolute -right-1 -top-1 h-2.5 w-2.5 rounded-full bg-primary" />
                    )}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-80 space-y-3" align="end">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">Filter & Sortierung</span>
                    {hasActiveFilters && (
                      <Button variant="ghost" size="sm" className="h-auto px-2 py-1 text-xs" onClick={clearFilters}>
                        Zurücksetzen
                      </Button>
                    )}
                  </div>
                  <Select value={channelFilter} onValueChange={setChannelFilter}>
                    <SelectTrigger><SelectValue placeholder="Kanal" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Alle Kanäle</SelectItem>
                      {channels.map((channel) => <SelectItem key={channel.id} value={channel.id}>{channel.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  <Select value={ownerFilter} onValueChange={setOwnerFilter}>
                    <SelectTrigger><SelectValue placeholder="Verantwortlich" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Alle Verantwortlichen</SelectItem>
                      {users.map((user) => <SelectItem key={user.id} value={user.id}>{user.display_name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  <Select value={statusFilter} onValueChange={setStatusFilter}>
                    <SelectTrigger><SelectValue placeholder="Status" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Alle Status</SelectItem>
                      {STATUS_COLUMNS.map((status) => <SelectItem key={status.id} value={status.id}>{status.title}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  <Select value={formatFilter} onValueChange={(value) => setFormatFilter(value as PlannerFormatFilter)}>
                    <SelectTrigger><SelectValue placeholder="Format" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Alle Formate</SelectItem>
                      <SelectItem value="story">Nur Stories</SelectItem>
                      <SelectItem value="feed">Nur Feed</SelectItem>
                    </SelectContent>
                  </Select>
                  <Select value={campaignFilter} onValueChange={setCampaignFilter}>
                    <SelectTrigger><SelectValue placeholder="Kampagne" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Alle Kampagnen</SelectItem>
                      {campaigns.map((campaign) => <SelectItem key={campaign.id} value={campaign.id}>{campaign.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  <Select value={pillarFilter} onValueChange={setPillarFilter}>
                    <SelectTrigger><SelectValue placeholder="Content-Pillar" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Alle Pillars</SelectItem>
                      {CONTENT_PILLAR_OPTIONS.map((option) => <SelectItem key={option} value={option}>{option}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  <Input value={tagSearch} onChange={(event) => setTagSearch(event.target.value)} placeholder="Thema/Tag suchen" />
                  <Select value={sortBy} onValueChange={(value) => setSortBy(value as (typeof SORT_OPTIONS)[number]["value"])}>
                    <SelectTrigger><SelectValue placeholder="Sortierung" /></SelectTrigger>
                    <SelectContent>
                      {SORT_OPTIONS.map((option) => <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </PopoverContent>
              </Popover>
              <Button className="h-9 rounded-lg px-3 text-sm font-medium" onClick={() => setIsCreateDialogOpen(true)}>
                <Plus className="mr-1 h-4 w-4" />
                Neuer Inhalt
              </Button>
            </div>
          )}
        />

        {loading && <p className="mt-3 text-xs text-muted-foreground">Lade Social-Planer…</p>}
      </CardContent>
      </Card>

      {editingItem && (
        <aside aria-label="Beitrag bearbeiten" className="w-full min-w-0">
        <Suspense fallback={<div className="rounded-lg border bg-card p-6" role="status">Lade Beitragsbearbeitung…</div>}>
          <SocialPlannerEditPanel
            key={editingItem.id}
            item={editingItem}
            scrollRequest={editScrollRequest}
            open={editingItem !== null}
            users={users}
            channels={channels}
            campaigns={campaigns}
            tagSuggestions={allTagSuggestions}
            onOpenChange={(open) => {
              if (!open) setEditingItemId(null);
            }}
            onSave={handleSaveItem}
          />
        </Suspense>
        </aside>
      )}

      <AlertDialog open={!!deleteCandidate} onOpenChange={(open) => { if (!open) setDeleteItemId(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Beitrag löschen?</AlertDialogTitle>
            <AlertDialogDescription>
              "{deleteCandidate?.topic}" wird aus dem Social Planner entfernt. Diese Aktion kann nicht rückgängig gemacht werden.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Abbrechen</AlertDialogCancel>
            <AlertDialogAction onClick={() => void handleDeleteItem()} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Löschen
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog open={isCreateDialogOpen} onOpenChange={(open) => {
        if (isCreatingDraft) return;
        setIsCreateDialogOpen(open);
        if (!open) resetCreateDialog();
      }}>
        <DialogContent
          className="max-w-2xl max-h-[90vh] overflow-y-auto"
          onCloseAutoFocus={(event) => {
            if (skipCreateFocusRestore.current) {
              event.preventDefault();
              skipCreateFocusRestore.current = false;
            }
          }}
        >
          <DialogHeader>
            <DialogTitle>Neuen Inhalt anlegen</DialogTitle>
            <DialogDescription>Starte mit den wichtigsten Angaben. Danach öffnet sich die Bearbeitung.</DialogDescription>
          </DialogHeader>
          <form onSubmit={(event) => { event.preventDefault(); void createDraft(); }} className="space-y-5">
            <fieldset disabled={isCreatingDraft} className="space-y-5 disabled:opacity-60">
              <fieldset className="space-y-2">
                <legend className="mb-2 text-sm font-semibold">Vorlage <span className="font-normal text-muted-foreground">(optional)</span></legend>
                <div className="flex flex-wrap gap-2">
                  {TEMPLATE_OPTIONS.map((template) => (
                    <button
                      key={template.id}
                      type="button"
                      aria-pressed={createTemplate === template.id}
                      onClick={() => setCreateTemplate((current) => current === template.id ? "none" : template.id)}
                      className={`flex items-center gap-2 rounded-xl border px-3 py-3 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${createTemplate === template.id ? "border-primary bg-primary/10 text-primary" : "bg-background hover:border-primary/50 hover:bg-muted/30"}`}
                    >
                      {createTemplate === template.id && <Check className="h-4 w-4" aria-hidden="true" />}
                      {template.label}
                    </button>
                  ))}
                </div>
              </fieldset>

              <div className="space-y-2">
                <Label htmlFor="create-topic-title" className="font-semibold">Thema</Label>
                <Input
                  id="create-topic-title"
                  list="create-topic-suggestions"
                  value={createTopicTitle}
                  onChange={(event) => { setCreateTopicTitle(event.target.value); setCreateTopicId(null); }}
                  placeholder="Worum geht es?"
                  required
                />
                <datalist id="create-topic-suggestions">
                  {topics.map((topic) => <option key={topic.id} value={topic.topic} />)}
                </datalist>
              </div>

              <fieldset className="space-y-2">
                <legend className="mb-2 text-sm font-semibold">Kanäle</legend>
                <div className="flex flex-wrap gap-2">
                  {channels.map((channel) => (
                    <button
                      key={channel.id}
                      type="button"
                      aria-pressed={createChannelIds.includes(channel.id)}
                      onClick={() => setCreateChannelIds((current) => current.includes(channel.id) ? current.filter((id) => id !== channel.id) : [...current, channel.id])}
                      className={`flex items-center gap-2 rounded-xl border px-3 py-3 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${createChannelIds.includes(channel.id) ? "border-primary bg-primary/10 text-primary" : "bg-background hover:border-primary/50 hover:bg-muted/30"}`}
                    >
                      {createChannelIds.includes(channel.id) && <Check className="h-4 w-4" aria-hidden="true" />}
                      {channel.name}
                    </button>
                  ))}
                  {channels.length === 0 && <p className="text-sm text-muted-foreground">Noch keine Kanäle eingerichtet.</p>}
                </div>
              </fieldset>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="create-scheduled-date" className="font-semibold">Datum</Label>
                  <div className="flex flex-wrap items-center gap-2">
                    <Button type="button" variant={createScheduledDate ? "outline" : "secondary"} aria-pressed={!createScheduledDate} onClick={() => setCreateScheduledDate("")}>Noch offen</Button>
                    <Input id="create-scheduled-date" type="date" className="min-w-0 flex-1" value={createScheduledDate} onChange={(event) => setCreateScheduledDate(event.target.value)} />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="create-responsible" className="font-semibold">Verantwortliche Person</Label>
                  <Select value={createResponsibleUserId} onValueChange={setCreateResponsibleUserId} disabled={isCreatingDraft}>
                    <SelectTrigger id="create-responsible"><SelectValue placeholder="Person auswählen" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Nicht zugewiesen</SelectItem>
                      {users.map((user) => <SelectItem key={user.id} value={user.id}>{user.display_name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </fieldset>
            <DialogFooter>
              <Button type="button" variant="outline" disabled={isCreatingDraft} onClick={() => { setIsCreateDialogOpen(false); resetCreateDialog(); }}>Abbrechen</Button>
              <Button type="submit" disabled={isCreatingDraft || !createTopicTitle.trim()}>{isCreatingDraft ? "Wird angelegt…" : "Inhalt anlegen"}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
