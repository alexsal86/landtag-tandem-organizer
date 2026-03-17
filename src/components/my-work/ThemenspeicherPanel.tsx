import { useEffect, useMemo, useState } from "react";
import { format } from "date-fns";
import { de } from "date-fns/locale";
import { Lightbulb, Link2, PlusCircle, TriangleAlert } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useTenant } from "@/hooks/useTenant";
import { useCurrentProfileId } from "@/hooks/useCurrentProfileId";
import { useToast } from "@/hooks/use-toast";
import { getErrorMessage } from "@/utils/errorHandler";
import { useTopicBacklog } from "@/hooks/useTopicBacklog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface TopicBacklogItem {
  id: string;
  topic: string;
  short_description: string | null;
  tags: string[];
  status: string;
}

interface ContentLink {
  id: string;
  hook: string | null;
  workflow_status: string;
  scheduled_for: string | null;
}

interface Channel {
  id: string;
  name: string;
}

interface TemplateDefinition {
  key: string;
  label: string;
  format: string;
  cta: string;
  draftIntro: string;
}

const TEMPLATES: TemplateDefinition[] = [
  { key: "statement", label: "Statement", format: "Text + Visual", cta: "Jetzt Position teilen", draftIntro: "Kernaussage in 2-3 Sätzen." },
  { key: "terminankuendigung", label: "Terminankündigung", format: "Feed + Story", cta: "Termin vormerken", draftIntro: "Was, wann, wo – kurz und klar." },
  { key: "rueckblick", label: "Rückblick", format: "Carousel", cta: "Feedback in die Kommentare", draftIntro: "Ergebnis und Learnings zusammenfassen." },
];

interface Props {
  onContentCreated?: () => void;
}

export function ThemenspeicherPanel({ onContentCreated }: Props) {
  const { user } = useAuth();
  const { currentTenant } = useTenant();
  const { toast } = useToast();
  const profileId = useCurrentProfileId();
  const { createTopic: createBacklogTopic } = useTopicBacklog();

  const [loading, setLoading] = useState(true);
  const [topics, setTopics] = useState<TopicBacklogItem[]>([]);
  const [linksByTopic, setLinksByTopic] = useState<Record<string, ContentLink[]>>({});
  const [channels, setChannels] = useState<Channel[]>([]);

  const [selectedTopic, setSelectedTopic] = useState<TopicBacklogItem | null>(null);
  const [isCreateTopicDialogOpen, setIsCreateTopicDialogOpen] = useState(false);
  const [newTopicTitle, setNewTopicTitle] = useState("");
  const [newTopicDescription, setNewTopicDescription] = useState("");
  const [newTopicTags, setNewTopicTags] = useState("");
  const [selectedChannelId, setSelectedChannelId] = useState<string>("none");
  const [selectedTemplateKey, setSelectedTemplateKey] = useState<string>(TEMPLATES[0].key);
  const [scheduledDate, setScheduledDate] = useState<string>(format(new Date(), "yyyy-MM-dd"));
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [duplicateWarning, setDuplicateWarning] = useState<string | null>(null);
  const [overrideDuplicate, setOverrideDuplicate] = useState(false);

  const selectedTemplate = useMemo(
    () => TEMPLATES.find((template) => template.key === selectedTemplateKey) ?? TEMPLATES[0],
    [selectedTemplateKey]
  );

  const loadData = async () => {
    if (!user?.id || !currentTenant?.id) return;

    setLoading(true);
    const { data: topicRows, error: topicError } = await supabase
      .from("topic_backlog")
      .select("id, topic, short_description, tags, status")
      .eq("tenant_id", currentTenant.id)
      .order("created_at", { ascending: false });

    if (topicError) {
      toast({ title: "Fehler", description: "Themenspeicher konnte nicht geladen werden.", variant: "destructive" });
      setLoading(false);
      return;
    }

    const topicData = (topicRows ?? []) as TopicBacklogItem[];
    setTopics(topicData);

    if (topicData.length > 0) {
      const topicIds = topicData.map((topic) => topic.id);
      const { data: linkedItems } = await supabase
        .from("social_content_items")
        .select("id, hook, workflow_status, scheduled_for, topic_backlog_id")
        .in("topic_backlog_id", topicIds)
        .eq("tenant_id", currentTenant.id)
        .order("created_at", { ascending: false });

      const mapped: Record<string, ContentLink[]> = {};
      for (const row of linkedItems ?? []) {
        const topicId = row.topic_backlog_id;
        if (!mapped[topicId]) mapped[topicId] = [];
        mapped[topicId].push({
          id: row.id,
          hook: row.hook,
          workflow_status: row.workflow_status,
          scheduled_for: row.scheduled_for,
        });
      }
      setLinksByTopic(mapped);
    } else {
      setLinksByTopic({});
    }

    const { data: channelRows } = await supabase
      .from("social_content_channels")
      .select("id, name")
      .eq("tenant_id", currentTenant.id)
      .eq("is_active", true)
      .order("sort_order", { ascending: true });

    setChannels((channelRows ?? []) as Channel[]);
    setLoading(false);
  };

  useEffect(() => {
    void loadData();
  }, [user?.id, currentTenant?.id]);

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
    const prefilledDraft = `${selectedTemplate.draftIntro}\n\nTags: ${(selectedTopic.tags ?? []).join(", ")}`;

    const newItemId = crypto.randomUUID();
    const { error: itemError } = await supabase
      .from("social_content_items")
      .insert({
        id: newItemId,
        tenant_id: currentTenant.id,
        created_by: profileId!,
        topic_backlog_id: selectedTopic.id,
        hook: prefilledHook,
        core_message: prefilledCoreMessage,
        format: selectedTemplate.format,
        cta: selectedTemplate.cta,
        draft_text: prefilledDraft,
        notes: `Aus Themenspeicher übernommen (${selectedTopic.topic})`,
        scheduled_for: scheduledFor,
        workflow_status: "idea",
        approval_state: "draft",
      } as any);

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
        created_by: profileId!,
        content_item_id: newItemId,
        channel_id: selectedChannelId,
        is_primary: true,
      } as any);

      if (channelError) {
        toast({ title: "Hinweis", description: "Beitrag erstellt, aber Kanal-Verknüpfung fehlgeschlagen.", variant: "destructive" });
      }
    }

    toast({ title: "Übernommen", description: "Thema wurde in die Redaktionsplanung übernommen." });
    setSelectedTopic(null);
    resetDialogState();
    setIsSubmitting(false);
    onContentCreated?.();
    void loadData();
  };

  const createTopic = async () => {
    if (!newTopicTitle.trim()) return;

    setIsSubmitting(true);
    const parsedTags = newTopicTags
      .split(",")
      .map((entry) => entry.trim())
      .filter(Boolean);

    try {
      await createBacklogTopic({
        topic: newTopicTitle.trim(),
        tags: parsedTags,
        status: "idea",
        priority: 1,
        short_description: newTopicDescription.trim() || null,
      });

      toast({ title: "Erstellt", description: "Neues Thema wurde im Themenspeicher angelegt." });
      setNewTopicTitle("");
      setNewTopicDescription("");
      setNewTopicTags("");
      setIsCreateTopicDialogOpen(false);
      void loadData();
      onContentCreated?.();
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : String(error);
      const isRls = msg.includes("row-level security") || msg.includes("42501");
      toast({ title: "Fehler", description: isRls ? "Keine Berechtigung – bitte Rolle prüfen." : msg, variant: "destructive" });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <section className="rounded-lg border bg-card p-4 space-y-3">
      <div className="flex items-center gap-2">
        <Lightbulb className="h-4 w-4 text-muted-foreground" />
        <h3 className="text-sm font-semibold text-foreground">Themenspeicher</h3>
        <Button size="sm" variant="outline" className="ml-auto" onClick={() => setIsCreateTopicDialogOpen(true)}>
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
            const linkedItems = linksByTopic[topic.id] ?? [];
            return (
              <div key={topic.id} className="rounded-md border p-3 space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="text-sm font-medium">{topic.topic}</p>
                    {topic.short_description && <p className="text-xs text-muted-foreground">{topic.short_description}</p>}
                  </div>
                  <Button size="sm" variant="outline" onClick={() => setSelectedTopic(topic)}>
                    <PlusCircle className="h-3.5 w-3.5 mr-1" />
                    In Redaktionsplanung übernehmen
                  </Button>
                </div>

                <div className="flex flex-wrap gap-1">
                  {(topic.tags ?? []).map((tag) => (
                    <Badge key={`${topic.id}-${tag}`} variant="secondary" className="text-[10px]">
                      #{tag}
                    </Badge>
                  ))}
                </div>

                <div className="text-xs text-muted-foreground flex flex-wrap items-center gap-1">
                  <Link2 className="h-3 w-3" />
                  {linkedItems.length === 0 ? "Noch keine verknüpften Beiträge" : `${linkedItems.length} verknüpfte Beiträge:`}
                  {linkedItems.slice(0, 2).map((item) => (
                    <Badge key={item.id} variant="outline" className="text-[10px]">
                      {item.hook ?? "Ohne Hook"}
                    </Badge>
                  ))}
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
              Vorausfüllung mit Titel, Hook und Tags aus dem Themenspeicher.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3">
            <div>
              <Label>Thema</Label>
              <Input value={selectedTopic?.topic ?? ""} readOnly />
            </div>

            <div>
              <Label>Vorlage (optional)</Label>
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

      <Dialog open={isCreateTopicDialogOpen} onOpenChange={setIsCreateTopicDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Neues Thema im Themenspeicher</DialogTitle>
            <DialogDescription>
              Erstelle ein neues Thema, das anschließend in der Redaktionsplanung genutzt werden kann.
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
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsCreateTopicDialogOpen(false)}>Abbrechen</Button>
            <Button onClick={() => void createTopic()} disabled={isSubmitting || !newTopicTitle.trim()}>
              Thema erstellen
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  );
}
