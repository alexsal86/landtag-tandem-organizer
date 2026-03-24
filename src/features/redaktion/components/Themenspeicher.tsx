import { useEffect, useMemo, useState } from "react";
import { format } from "date-fns";
import { Lightbulb, Pencil, PlusCircle, Trash2, TriangleAlert } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useTenant } from "@/hooks/useTenant";
import { useCurrentProfileId } from "@/hooks/useCurrentProfileId";
import { useToast } from "@/hooks/use-toast";
import { getErrorMessage } from "@/utils/errorHandler";
import { TopicBacklogEntry, TopicEditorialStatus, useTopicBacklog } from "@/features/redaktion/hooks/useTopicBacklog";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

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

const STATUS_META: Record<TopicEditorialStatus, { label: string; variant: "secondary" | "outline" | "default" }> = {
  idea: { label: "Idee", variant: "secondary" },
  planning: { label: "in Planung", variant: "outline" },
  production: { label: "in Produktion", variant: "default" },
  published: { label: "veröffentlicht", variant: "default" },
  repurpose: { label: "wiederverwenden", variant: "secondary" },
};

interface Props {
  onContentCreated?: () => void;
}

export function Themenspeicher({ onContentCreated }: Props) {
  const { user } = useAuth();
  const { currentTenant } = useTenant();
  const { toast } = useToast();
  const profileId = useCurrentProfileId();
  const { createTopic: createBacklogTopic, topics, loading, channels, loadTopics, updateTopic, deleteTopic } = useTopicBacklog();

  const [selectedTopic, setSelectedTopic] = useState<TopicBacklogEntry | null>(null);
  const [isCreateTopicDialogOpen, setIsCreateTopicDialogOpen] = useState(false);
  const [editingTopic, setEditingTopic] = useState<TopicBacklogEntry | null>(null);
  const [deleteTopicCandidate, setDeleteTopicCandidate] = useState<TopicBacklogEntry | null>(null);
  const [newTopicTitle, setNewTopicTitle] = useState("");
  const [newTopicDescription, setNewTopicDescription] = useState("");
  const [newTopicTags, setNewTopicTags] = useState("");
  const [newTopicStatus, setNewTopicStatus] = useState<TopicEditorialStatus>("idea");
  const [newTopicPriority, setNewTopicPriority] = useState("1");
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
    setNewTopicStatus(editingTopic.status);
    setNewTopicPriority(String(editingTopic.priority || 1));
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
    const openNeedsHint = selectedTopic.open_production_needs.length
      ? `Offener Produktionsbedarf: ${selectedTopic.open_production_needs.join(", ")}`
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
        scheduled_for: scheduledFor,
        workflow_status: "idea",
        approval_state: "draft",
        responsible_user_id: selectedTopic.owner_id,
        asset_requirements: selectedTopic.open_production_needs,
      } as never);

    if (itemError) {
      console.error("createFromTopic insert failed:", itemError);
      const msg = getErrorMessage(itemError);
      toast({ title: "Fehler", description: `Beitrag konnte nicht erstellt werden: ${msg}`, variant: "destructive" });
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
        toast({ title: "Hinweis", description: "Beitrag erstellt, aber Kanal-Verknüpfung fehlgeschlagen.", variant: "destructive" });
      }
    }

    toast({ title: "Übernommen", description: `Thema wurde als ${selectedTemplate.label.toLowerCase()} in die Redaktionsplanung übernommen.` });
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
    setNewTopicStatus("idea");
    setNewTopicPriority("1");
    setEditingTopic(null);
  };

  const saveTopic = async () => {
    if (!newTopicTitle.trim()) return;

    setIsSubmitting(true);
    const parsedTags = newTopicTags
      .split(",")
      .map((entry) => entry.trim())
      .filter(Boolean);
    const parsedPriority = Number.parseInt(newTopicPriority, 10);

    try {
      if (editingTopic) {
        await updateTopic(editingTopic.id, {
          topic: newTopicTitle.trim(),
          tags: parsedTags,
          status: newTopicStatus,
          priority: Number.isNaN(parsedPriority) ? editingTopic.priority : parsedPriority,
          short_description: newTopicDescription.trim() || null,
        });

        toast({ title: "Aktualisiert", description: "Thema wurde im Themenspeicher aktualisiert." });
      } else {
        await createBacklogTopic({
          topic: newTopicTitle.trim(),
          tags: parsedTags,
          status: newTopicStatus,
          priority: Number.isNaN(parsedPriority) ? 1 : parsedPriority,
          short_description: newTopicDescription.trim() || null,
        });

        toast({ title: "Erstellt", description: "Neues Thema wurde im Themenspeicher angelegt." });
      }

      resetTopicForm();
      setIsCreateTopicDialogOpen(false);
      void loadTopics();
      onContentCreated?.();
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : String(error);
      const isRls = msg.includes("row-level security") || msg.includes("42501");
      toast({ title: "Fehler", description: isRls ? "Keine Berechtigung – bitte Rolle prüfen." : msg, variant: "destructive" });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteTopic = async () => {
    if (!deleteTopicCandidate) return;

    setIsSubmitting(true);
    try {
      await deleteTopic(deleteTopicCandidate.id);
      toast({ title: "Gelöscht", description: "Thema wurde aus dem Themenspeicher entfernt." });
      if (selectedTopic?.id === deleteTopicCandidate.id) {
        setSelectedTopic(null);
        resetDialogState();
      }
      setDeleteTopicCandidate(null);
      onContentCreated?.();
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : String(error);
      toast({ title: "Fehler", description: msg, variant: "destructive" });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <section className="rounded-lg border bg-card p-4 space-y-3">
      <div className="flex items-center gap-2">
        <Lightbulb className="h-4 w-4 text-muted-foreground" />
        <h3 className="text-sm font-semibold text-foreground">Themenspeicher</h3>
        <Button size="sm" variant="outline" className="ml-auto" onClick={() => { resetTopicForm(); setIsCreateTopicDialogOpen(true); }}>
          <PlusCircle className="h-3.5 w-3.5 mr-1" />
          Neues Thema
        </Button>
      </div>

      {loading ? (
        <div className="text-sm text-muted-foreground">Lade Themen…</div>
      ) : topics.length === 0 ? (
        <p className="text-sm text-muted-foreground">Noch keine Themen vorhanden.</p>
      ) : (
        <div className="space-y-2">
          {topics.map((topic) => {
            const statusMeta = STATUS_META[topic.status];
            return (
              <div key={topic.id} className="group rounded-md border p-3 pr-14 space-y-3 relative">
                <div className="flex items-start justify-between gap-2">
                  <div className="space-y-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-sm font-medium">{topic.topic}</p>
                      <Badge variant={statusMeta.variant}>{statusMeta.label}</Badge>
                    </div>
                    {topic.short_description && <p className="text-xs text-muted-foreground">{topic.short_description}</p>}
                  </div>
                </div>
                <div className={cn(
                  "absolute right-2 top-1/2 -translate-y-1/2 flex flex-col items-center gap-1 transition-opacity duration-150",
                  "opacity-0 pointer-events-none group-hover:opacity-100 group-focus-within:opacity-100 group-hover:pointer-events-auto group-focus-within:pointer-events-auto",
                )}>
                  <div className="relative group/icon">
                    <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => { setEditingTopic(topic); }}>
                      <Pencil className="h-4 w-4" />
                      <span className="sr-only">Bearbeiten</span>
                    </Button>
                    <span className="pointer-events-none absolute right-full top-1/2 mr-2 -translate-y-1/2 whitespace-nowrap rounded bg-popover px-2 py-1 text-[11px] text-popover-foreground shadow opacity-0 transition-opacity group-hover/icon:opacity-100">
                      Bearbeiten
                    </span>
                  </div>
                  <div className="relative group/icon">
                    <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => setSelectedTopic(topic)}>
                      <PlusCircle className="h-4 w-4" />
                      <span className="sr-only">In Planner</span>
                    </Button>
                    <span className="pointer-events-none absolute right-full top-1/2 mr-2 -translate-y-1/2 whitespace-nowrap rounded bg-popover px-2 py-1 text-[11px] text-popover-foreground shadow opacity-0 transition-opacity group-hover/icon:opacity-100">
                      In Planner
                    </span>
                  </div>
                  <div className="relative group/icon">
                    <Button size="icon" variant="ghost" className="h-8 w-8 text-destructive hover:text-destructive" onClick={() => setDeleteTopicCandidate(topic)}>
                      <Trash2 className="h-4 w-4" />
                      <span className="sr-only">Löschen</span>
                    </Button>
                    <span className="pointer-events-none absolute right-full top-1/2 mr-2 -translate-y-1/2 whitespace-nowrap rounded bg-popover px-2 py-1 text-[11px] text-popover-foreground shadow opacity-0 transition-opacity group-hover/icon:opacity-100">
                      Löschen
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

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
              <div className="rounded-md border border-amber-300 bg-amber-50 p-2 text-xs text-amber-800 flex items-start gap-2">
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
              {editingTopic ? "Pflege Titel, Beschreibung, Priorität und Status direkt im Themenspeicher." : "Erstelle ein neues Thema, das anschließend in der Redaktionsplanung genutzt werden kann."}
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

            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <Label>Status</Label>
                <Select value={newTopicStatus} onValueChange={(value) => setNewTopicStatus(value as TopicEditorialStatus)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(STATUS_META).map(([value, meta]) => (
                      <SelectItem key={value} value={value}>{meta.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor="new-topic-priority">Priorität</Label>
                <Input
                  id="new-topic-priority"
                  type="number"
                  min="0"
                  value={newTopicPriority}
                  onChange={(event) => setNewTopicPriority(event.target.value)}
                  placeholder="1"
                />
              </div>
            </div>
          </div>

          <DialogFooter>
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
