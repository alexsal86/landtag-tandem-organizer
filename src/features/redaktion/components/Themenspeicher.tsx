import { useEffect, useMemo, useRef, useState } from "react";
import { format } from "date-fns";
import { ChevronLeft, ChevronRight, Filter, GripVertical, Lightbulb, MoreHorizontal, Pencil, Star, PlusCircle, Settings2, TriangleAlert } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useTenant } from "@/hooks/useTenant";
import { useCurrentProfileId } from "@/hooks/useCurrentProfileId";
import { getErrorMessage } from "@/utils/errorHandler";
import { TopicBacklogEntry, useTopicBacklog } from "@/features/redaktion/hooks/useTopicBacklog";
import { Checkbox } from "@/components/ui/checkbox";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useSocialCampaigns } from "@/features/redaktion/hooks/useSocialCampaigns";
import { notify } from "@/lib/notify";

import { PLANNER_TOPIC_MIME } from "@/features/redaktion/utils/plannerRules";

interface TemplateDefinition {
  key: string;
  label: string;
  format: string;
  formatVariant: string;
  cta: string;
  draftIntro: string;
}

const TEMPLATES: TemplateDefinition[] = [
  { key: "simple_post", label: "Einfacher Social-Post", format: "Social Post", formatVariant: "single_post", cta: "Jetzt Position teilen", draftIntro: "Kernaussage in 2-3 Sätzen verdichten." },
  { key: "story_series", label: "Story-Serie", format: "Story-Serie", formatVariant: "story_series", cta: "Storys nacheinander erzählen", draftIntro: "Story-Frames mit rotem Faden und Interaktionen skizzieren." },
  { key: "event_post", label: "Termin-Post", format: "Termin-Post", formatVariant: "event_post", cta: "Termin vormerken", draftIntro: "Was, wann, wo und warum kurz und klar nennen." },
  { key: "recap_post", label: "Rückblick-Post", format: "Rückblick-Post", formatVariant: "recap_post", cta: "Feedback in die Kommentare", draftIntro: "Ergebnis, Wirkung und Learnings zusammenfassen." },
];

interface Props {
  compact?: boolean;
  onContentCreated?: () => void;
}

export function Themenspeicher({ onContentCreated, compact = false }: Props) {
  const { user } = useAuth();
  const { currentTenant } = useTenant();
  const profileId = useCurrentProfileId();
  const { createTopic: createBacklogTopic, topics, loading, channels, loadTopics, updateTopic, deleteTopic } = useTopicBacklog();
  const { campaigns } = useSocialCampaigns();

  const [showSettings, setShowSettings] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(5);
  const [pageCapacity, setPageCapacity] = useState(10);
  const listRef = useRef<HTMLDivElement>(null);
  const [dropTime, setDropTime] = useState("10:00");
  const [selectedTopic, setSelectedTopic] = useState<TopicBacklogEntry | null>(null);
  const [isCreateTopicDialogOpen, setIsCreateTopicDialogOpen] = useState(false);
  const [editingTopic, setEditingTopic] = useState<TopicBacklogEntry | null>(null);
  const [deleteTopicCandidate, setDeleteTopicCandidate] = useState<TopicBacklogEntry | null>(null);
  const [newTopicTitle, setNewTopicTitle] = useState("");
  const [newTopicDescription, setNewTopicDescription] = useState("");
  const [newTopicTags, setNewTopicTags] = useState("");
  const [newTopicImportant, setNewTopicImportant] = useState(false);
  const [campaignFilter, setCampaignFilter] = useState<string>("all");
  const [pillarFilter, setPillarFilter] = useState<string>("all");
  const [sortBy, setSortBy] = useState<"priority" | "campaign_phase">("priority");
  const [selectedChannelId, setSelectedChannelId] = useState<string>("none");
  const [selectedTemplateKey, setSelectedTemplateKey] = useState<string>(TEMPLATES[0].key);
  const [scheduledDate, setScheduledDate] = useState<string>(format(new Date(), "yyyy-MM-dd"));
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [duplicateWarning, setDuplicateWarning] = useState<string | null>(null);
  const [overrideDuplicate, setOverrideDuplicate] = useState(false);


  useEffect(() => {
    if (!editingTopic) return;

    setNewTopicTitle(editingTopic.topic);
    setNewTopicDescription(editingTopic.short_description || "");
    setNewTopicTags((editingTopic.tags || []).join(", "));
    setNewTopicImportant(editingTopic.priority > 1);
    setIsCreateTopicDialogOpen(true);
  }, [editingTopic]);

  const selectedTemplate = useMemo(
    () => TEMPLATES.find((template) => template.key === selectedTemplateKey) ?? TEMPLATES[0],
    [selectedTemplateKey],
  );

  const resetDialogState = () => {
    setSelectedChannelId("none");
    setSelectedTemplateKey(TEMPLATES[0].key);
    setScheduledDate(format(new Date(), "yyyy-MM-dd"));
    setDuplicateWarning(null);
    setOverrideDuplicate(false);
  };

  const createFromTopic = async () => {
    if (!user?.id || !currentTenant?.id || !selectedTopic || !profileId) return;

    setIsSubmitting(true);
    setDuplicateWarning(null);

    const scheduledFor = scheduledDate ? new Date(`${scheduledDate}T09:00:00`).toISOString() : null;
    const rangeStart = scheduledDate ? new Date(`${scheduledDate}T00:00:00`) : new Date();
    const rangeEnd = new Date(rangeStart);
    rangeEnd.setDate(rangeEnd.getDate() + 7);

    if (selectedChannelId !== "none" && !overrideDuplicate) {
      const { data: duplicateRows } = await supabase
        .from("social_content_item_channels")
        .select("content_item_id, social_content_items!inner(topic_backlog_id, scheduled_for)")
        .eq("channel_id", selectedChannelId)
        .eq("tenant_id", currentTenant.id)
        .eq("social_content_items.topic_backlog_id", selectedTopic.id)
        .gte("social_content_items.scheduled_for", rangeStart.toISOString())
        .lte("social_content_items.scheduled_for", rangeEnd.toISOString())
        .limit(1);

      if ((duplicateRows ?? []).length > 0) {
        setDuplicateWarning("Für dieses Thema gibt es bereits einen Beitrag im gewählten Kanal innerhalb von 7 Tagen.");
        setIsSubmitting(false);
        return;
      }
    }

    const prefilledHook = selectedTopic.short_description || selectedTopic.topic;
    const prefilledCoreMessage = selectedTopic.topic;
    const openProductionNeeds = Array.isArray(selectedTopic.open_production_needs) ? selectedTopic.open_production_needs : [];
    const openNeedsHint = openProductionNeeds.length
      ? `Offener Produktionsbedarf: ${openProductionNeeds.join(", ")}`
      : "Produktionsbedarf bei Bedarf ergänzen.";
    const prefilledDraft = `${selectedTemplate.draftIntro}\n\nTags: ${(selectedTopic.tags ?? []).join(", ")}\n${openNeedsHint}`;

    const newItemId = crypto.randomUUID();
    const { error: itemError } = await supabase
      .from("social_content_items")
      .insert({
        id: newItemId,
        tenant_id: currentTenant.id,
        created_by: profileId,
        topic_backlog_id: selectedTopic.id,
        hook: prefilledHook,
        core_message: prefilledCoreMessage,
        format: selectedTemplate.format,
        format_variant: selectedTemplate.formatVariant,
        cta: selectedTemplate.cta,
        draft_text: prefilledDraft,
        notes: `Aus Themenspeicher übernommen (${selectedTopic.topic})`,
        campaign_id: selectedTopic.campaign_id,
        content_pillar: selectedTopic.content_pillar,
        scheduled_for: scheduledFor,
        workflow_status: "idea",
        approval_state: "draft",
        responsible_user_id: selectedTopic.owner_id,
        asset_requirements: openProductionNeeds,
      } as never);

    if (itemError) {
      console.error("createFromTopic insert failed:", itemError);
      const msg = getErrorMessage(itemError);
      notify.error("Fehler", { description: `Beitrag konnte nicht erstellt werden: ${msg}`
});
      setIsSubmitting(false);
      return;
    }

    if (selectedChannelId !== "none") {
      const { error: channelError } = await supabase.from("social_content_item_channels").insert({
        tenant_id: currentTenant.id,
        created_by: profileId,
        content_item_id: newItemId,
        channel_id: selectedChannelId,
        is_primary: true,
      } as never);

      if (channelError) {
        notify.error("Hinweis", { description: "Beitrag erstellt, aber Kanal-Verknüpfung fehlgeschlagen."
});
      }
    }

    notify.success("Übernommen", { description: `Thema wurde als ${selectedTemplate.label.toLowerCase()} in die Redaktionsplanung übernommen.` 
});
    setSelectedTopic(null);
    resetDialogState();
    setIsSubmitting(false);
    onContentCreated?.();
    void loadTopics();
  };

  const resetTopicForm = () => {
    setNewTopicTitle("");
    setNewTopicDescription("");
    setNewTopicTags("");
    setNewTopicImportant(false);
    setEditingTopic(null);
  };

  const saveTopic = async () => {
    if (!newTopicTitle.trim()) return;

    setIsSubmitting(true);
    const parsedTags = newTopicTags
      .split(",")
      .map((entry) => entry.trim())
      .filter(Boolean);

    try {
      if (editingTopic) {
        await updateTopic(editingTopic.id, {
          topic: newTopicTitle.trim(),
          tags: parsedTags,
          priority: newTopicImportant === (editingTopic.priority > 1)
            ? editingTopic.priority
            : newTopicImportant ? 2 : 1,
          short_description: newTopicDescription.trim() || null,
        });

        notify.success("Aktualisiert", { description: "Thema wurde im Themenspeicher aktualisiert." 
});
      } else {
        await createBacklogTopic({
          topic: newTopicTitle.trim(),
          tags: parsedTags,
          status: "idea",
          priority: newTopicImportant ? 2 : 1,
          short_description: newTopicDescription.trim() || null,
        });

        notify.success("Erstellt", { description: "Neues Thema wurde im Themenspeicher angelegt." 
});
      }

      resetTopicForm();
      setIsCreateTopicDialogOpen(false);
      void loadTopics();
      onContentCreated?.();
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : String(error);
      const isRls = msg.includes("row-level security") || msg.includes("42501");
      notify.error("Fehler", { description: isRls ? "Keine Berechtigung – bitte Rolle prüfen." : msg
});
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteTopic = async () => {
    if (!deleteTopicCandidate) return;

    setIsSubmitting(true);
    try {
      await deleteTopic(deleteTopicCandidate.id);
      notify.success("Gelöscht", { description: "Thema wurde aus dem Themenspeicher entfernt." 
});
      if (selectedTopic?.id === deleteTopicCandidate.id) {
        setSelectedTopic(null);
        resetDialogState();
      }
      setDeleteTopicCandidate(null);
      if (editingTopic?.id === deleteTopicCandidate.id) {
        setIsCreateTopicDialogOpen(false);
        resetTopicForm();
      }
      onContentCreated?.();
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : String(error);
      notify.error("Fehler", { description: msg
});
    } finally {
      setIsSubmitting(false);
    }
  };

  const filteredTopics = useMemo(() => topics
            .filter((topic) => campaignFilter === "all" || topic.campaign_id === campaignFilter)
            .filter((topic) => pillarFilter === "all" || topic.content_pillar === pillarFilter)
            .sort((a, b) => {
              if (sortBy === "priority") return b.priority - a.priority;
              const campaignById = new Map(campaigns.map((campaign) => [campaign.id, campaign]));
              const today = new Date();
              const phaseRank = (campaignId: string | null): number => {
                const campaign = campaignId ? campaignById.get(campaignId) : null;
                if (!campaign?.start_date || !campaign?.end_date) return 3;
                const start = new Date(campaign.start_date);
                const end = new Date(campaign.end_date);
                if (today < start) return 0;
                if (today > end) return 2;
                return 1;
              };
              return phaseRank(a.campaign_id) - phaseRank(b.campaign_id);
            }), [topics, campaignFilter, pillarFilter, sortBy, campaigns]);
  const effectivePageSize = compact ? Math.min(pageSize, pageCapacity) : pageSize;
  const totalPages = Math.max(1, Math.ceil(filteredTopics.length / effectivePageSize));
  const currentPage = Math.min(page, totalPages);
  const visibleTopics = filteredTopics.slice((currentPage - 1) * effectivePageSize, currentPage * effectivePageSize);

  useEffect(() => { setPage(1); }, [campaignFilter, pillarFilter, sortBy, pageSize, effectivePageSize]);
  useEffect(() => { setPage((current) => Math.min(current, totalPages)); }, [totalPages]);
  useEffect(() => {
    if (!compact || !listRef.current) return;
    const observer = new ResizeObserver(([entry]) => {
      // Compact cards are 96px tall with an 8px gap. Fit full cards, never add an inner scrollbar.
      const constrained = listRef.current && getComputedStyle(listRef.current).getPropertyValue("--topic-height-constrained").trim() === "1";
      setPageCapacity(constrained ? Math.max(1, Math.min(10, Math.floor((entry.contentRect.height + 8) / 104))) : 10);
    });
    observer.observe(listRef.current);
    return () => observer.disconnect();
  }, [compact]);

  return (
    <section className={cn("bg-card p-3", compact ? "flex h-full min-h-0 flex-col gap-3 rounded-lg" : "space-y-3 rounded-lg border")}>
      <div className="flex shrink-0 items-center gap-2">
        <Lightbulb className="h-4 w-4 shrink-0 text-muted-foreground" />
        <h3 className="text-sm font-semibold text-foreground">Themenspeicher</h3>
        <div className="ml-auto flex items-center gap-0.5">
          <Button type="button" size="icon" variant="ghost" className="h-7 w-7" aria-label="Themenspeicher-Einstellungen" aria-expanded={showSettings} aria-controls="topic-settings" onClick={() => { setShowSettings((show) => !show); setShowFilters(false); }}><Settings2 className="h-4 w-4" /></Button>
          <Button type="button" size="icon" variant="ghost" className={cn("h-7 w-7", (showFilters || campaignFilter !== "all" || pillarFilter !== "all") && "text-primary bg-primary/10")} aria-label="Themenfilter" aria-expanded={showFilters} aria-controls="topic-filters" onClick={() => { setShowFilters((show) => !show); setShowSettings(false); }}><Filter className="h-4 w-4" /></Button>
          <Button type="button" size="icon" variant="ghost" className="h-7 w-7" aria-label="Neues Thema" onClick={() => { resetTopicForm(); setIsCreateTopicDialogOpen(true); }}><PlusCircle className="h-4 w-4" /></Button>
        </div>
      </div>
      {showSettings && (
      <div id="topic-settings" className="shrink-0 rounded-lg border bg-muted/20 p-3 space-y-2">
        <p className="text-xs text-muted-foreground">Ziehe eine Themenkarte auf den gewünschten Kalendertag. Die Idee bleibt erhalten und wird mit dem Entwurf verknüpft.</p>
        <div className="flex items-center gap-2">
          <Label htmlFor="topic-drop-time" className="text-xs">Einplanen um</Label>
          <Input id="topic-drop-time" type="time" value={dropTime} onChange={(event) => setDropTime(event.target.value)} className="h-8 w-28" required />
        </div>
        <div className="flex items-center gap-2">
          <Label htmlFor="topic-page-size" className="text-xs">Max. Ideen pro Seite</Label>
          <select id="topic-page-size" className="ml-auto rounded-md border bg-background px-2 py-1 text-sm" value={pageSize} onChange={(event) => setPageSize(Number(event.target.value))}>
            <option value={5}>5</option><option value={10}>10</option>
          </select>
        </div>
      </div>
      )}
      {showFilters && <div id="topic-filters" className={cn("grid shrink-0 gap-2", !compact && "sm:grid-cols-3")}>
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
            <SelectItem value="informieren">Informieren</SelectItem>
            <SelectItem value="mobilisieren">Mobilisieren</SelectItem>
            <SelectItem value="service">Service</SelectItem>
          </SelectContent>
        </Select>
        <Select value={sortBy} onValueChange={(value) => setSortBy(value as "priority" | "campaign_phase")}>
          <SelectTrigger><SelectValue placeholder="Sortierung" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="priority">Priorität</SelectItem>
            <SelectItem value="campaign_phase">Kampagnenphase</SelectItem>
          </SelectContent>
        </Select>
      </div>}

      <div ref={listRef} className={compact ? "min-h-0 flex-1 overflow-hidden" : ""}>
      {loading ? (
        <div className="text-sm text-muted-foreground">Lade Themen…</div>
      ) : filteredTopics.length === 0 ? (
        <p className="text-sm text-muted-foreground">{topics.length ? "Keine Ideen für diese Filter." : "Noch keine Themen vorhanden."}</p>
      ) : (
        <div className="space-y-2">
          {visibleTopics.map((topic) => {
            return (
              <div
                key={topic.id}
                draggable={/^([01]\d|2[0-3]):[0-5]\d$/.test(dropTime)}
                onDragStart={(event) => {
                  if ((event.target as HTMLElement).closest("button")) { event.preventDefault(); return; }
                  event.dataTransfer.setData(PLANNER_TOPIC_MIME, JSON.stringify({ topicId: topic.id, time: dropTime }));
                  event.dataTransfer.effectAllowed = "copy";
                }}
                className={cn("group cursor-grab active:cursor-grabbing rounded-md border relative hover:border-primary/50", compact ? "h-24 overflow-hidden p-2 pr-12" : "p-3 pr-14 space-y-3")}
                title={`Auf einen Kalendertag ziehen, um ${dropTime} einzuplanen`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="space-y-1 min-w-0">
                    <div className={cn(compact ? "flex flex-wrap gap-1 max-h-12 overflow-hidden" : "flex flex-wrap items-center gap-2")}>
                      <p className={cn("flex items-center gap-1 text-sm font-medium", compact && "w-full min-w-0")}><GripVertical className="h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-hidden="true" /><span className={compact ? "truncate" : ""}>{topic.topic}</span>{topic.priority > 1 && <Star className="h-3.5 w-3.5 shrink-0 text-primary" aria-label="Wichtig" />}</p>
                    </div>
                    {topic.short_description && <p className={cn("text-xs text-muted-foreground", compact && "line-clamp-1")}>{topic.short_description}</p>}
                  </div>
                </div>
                <div className={cn(
                  "absolute right-2 top-1/2 -translate-y-1/2 flex flex-col items-center gap-1 transition-opacity duration-150",
                  compact ? "opacity-100" : "opacity-0 pointer-events-none group-hover:opacity-100 group-focus-within:opacity-100 group-hover:pointer-events-auto group-focus-within:pointer-events-auto",
                )}>
                  <div className="relative group/icon">
                    <Button size="icon" variant="ghost" className={compact ? "h-7 w-7" : "h-8 w-8"} onClick={() => { setEditingTopic(topic); }}>
                      <Pencil className="h-4 w-4" />
                      <span className="sr-only">Bearbeiten</span>
                    </Button>
                    <span className="pointer-events-none absolute right-full top-1/2 mr-2 -translate-y-1/2 whitespace-nowrap rounded bg-popover px-2 py-1 text-[11px] text-popover-foreground shadow opacity-0 transition-opacity group-hover/icon:opacity-100">
                      Bearbeiten
                    </span>
                  </div>
                  <div className="relative group/icon">
                    <Button size="icon" variant="ghost" className={compact ? "h-7 w-7" : "h-8 w-8"} onClick={() => setSelectedTopic(topic)}>
                      <PlusCircle className="h-4 w-4" />
                      <span className="sr-only">In Planner</span>
                    </Button>
                    <span className="pointer-events-none absolute right-full top-1/2 mr-2 -translate-y-1/2 whitespace-nowrap rounded bg-popover px-2 py-1 text-[11px] text-popover-foreground shadow opacity-0 transition-opacity group-hover/icon:opacity-100">
                      In Planner
                    </span>
                  </div>

                </div>
              </div>
            );
          })}
        </div>
      )}

      </div>
      <nav aria-label="Themenspeicher-Seiten" className="flex shrink-0 items-center justify-between gap-2 border-t pt-2">
        <Button type="button" size="icon" variant="ghost" className="h-8 w-8" aria-label="Vorherige Themenseite" disabled={currentPage === 1 || loading} onClick={() => setPage(currentPage - 1)}><ChevronLeft className="h-4 w-4" /></Button>
        <span className="text-xs text-muted-foreground" aria-live="polite">{currentPage} / {totalPages} · {filteredTopics.length} Ideen</span>
        <Button type="button" size="icon" variant="ghost" className="h-8 w-8" aria-label="Nächste Themenseite" disabled={currentPage === totalPages || loading} onClick={() => setPage(currentPage + 1)}><ChevronRight className="h-4 w-4" /></Button>
      </nav>

      <Dialog open={!!selectedTopic} onOpenChange={(open) => { if (!open) { setSelectedTopic(null); resetDialogState(); } }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Thema in Redaktionsplanung übernehmen</DialogTitle>
            <DialogDescription>
              Wähle das Format für die Übernahme und nutze vorhandene Metadaten aus dem Themen-Backlog.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3">
            <div>
              <Label>Thema</Label>
              <Input value={selectedTopic?.topic ?? ""} readOnly />
            </div>

            <div>
              <Label>Format der Übernahme</Label>
              <Select value={selectedTemplateKey} onValueChange={setSelectedTemplateKey}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TEMPLATES.map((template) => (
                    <SelectItem key={template.key} value={template.key}>{template.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>Kanal</Label>
              <Select value={selectedChannelId} onValueChange={setSelectedChannelId}>
                <SelectTrigger>
                  <SelectValue placeholder="Kanal wählen (optional)" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Kein Kanal</SelectItem>
                  {channels.map((channel) => (
                    <SelectItem key={channel.id} value={channel.id}>{channel.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="scheduled-date">Zeitraum-Start</Label>
              <Input id="scheduled-date" type="date" value={scheduledDate} onChange={(event) => setScheduledDate(event.target.value)} />
            </div>

            {duplicateWarning && (
              <div className="rounded-md border border-palette-amber/40 bg-palette-amber/10 p-2 text-xs text-palette-amber flex items-start gap-2">
                <TriangleAlert className="h-4 w-4 mt-0.5" />
                <div>
                  <p>{duplicateWarning}</p>
                  <button
                    type="button"
                    className="underline"
                    onClick={() => setOverrideDuplicate(true)}
                  >
                    Trotzdem erstellen
                  </button>
                </div>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setSelectedTopic(null)}>Abbrechen</Button>
            <Button onClick={() => void createFromTopic()} disabled={isSubmitting || (!!duplicateWarning && !overrideDuplicate)}>
              Übernehmen
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isCreateTopicDialogOpen} onOpenChange={(open) => { setIsCreateTopicDialogOpen(open); if (!open) resetTopicForm(); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingTopic ? "Thema bearbeiten" : "Neues Thema im Themenspeicher"}</DialogTitle>
            <DialogDescription>
              {editingTopic ? "Pflege Titel, Beschreibung und markiere das Thema bei Bedarf als wichtig." : "Erstelle ein neues Thema, das anschließend in der Redaktionsplanung genutzt werden kann."}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3">
            <div>
              <Label htmlFor="new-topic-title">Titel</Label>
              <Input
                id="new-topic-title"
                value={newTopicTitle}
                onChange={(event) => setNewTopicTitle(event.target.value)}
                placeholder="z. B. Kita-Ausbau im Wahlkreis"
              />
            </div>

            <div>
              <Label htmlFor="new-topic-description">Kurzbeschreibung (optional)</Label>
              <Input
                id="new-topic-description"
                value={newTopicDescription}
                onChange={(event) => setNewTopicDescription(event.target.value)}
                placeholder="Worum geht es in 1-2 Sätzen?"
              />
            </div>

            <div>
              <Label htmlFor="new-topic-tags">Tags (optional, comma-separiert)</Label>
              <Input
                id="new-topic-tags"
                value={newTopicTags}
                onChange={(event) => setNewTopicTags(event.target.value)}
                placeholder="bildung, kommune, jugend"
              />
            </div>

            <div className="flex items-center gap-3 rounded-md border p-3">
              <Checkbox id="new-topic-important" checked={newTopicImportant} onCheckedChange={(checked) => setNewTopicImportant(checked === true)} />
              <Label htmlFor="new-topic-important" className="flex cursor-pointer items-center gap-2"><Star className="h-4 w-4" />Wichtig</Label>
            </div>
          </div>

          <DialogFooter>
            {editingTopic && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild><Button type="button" variant="ghost" size="icon" className="mr-auto text-muted-foreground" aria-label="Weitere Themenaktionen"><MoreHorizontal className="h-4 w-4" /></Button></DropdownMenuTrigger>
                <DropdownMenuContent align="start">
                  <DropdownMenuItem onSelect={() => setDeleteTopicCandidate(editingTopic)}>Thema löschen…</DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            )}
            <Button variant="outline" onClick={() => setIsCreateTopicDialogOpen(false)}>Abbrechen</Button>
            <Button onClick={() => void saveTopic()} disabled={isSubmitting || !newTopicTitle.trim()}>
              {editingTopic ? "Änderungen speichern" : "Thema erstellen"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteTopicCandidate} onOpenChange={(open) => { if (!open) setDeleteTopicCandidate(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Thema löschen?</AlertDialogTitle>
            <AlertDialogDescription>
              &quot;{deleteTopicCandidate?.topic}&quot; wird aus dem Themenspeicher entfernt. Bereits verknüpfte Beiträge können danach ihr Bezugsthema verlieren.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Abbrechen</AlertDialogCancel>
            <AlertDialogAction onClick={() => void handleDeleteTopic()} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Löschen
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </section>
  );
}
