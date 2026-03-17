import { useCallback, useMemo, useState } from "react";
import { DragDropContext, Draggable, Droppable, type DropResult } from "@hello-pangea/dnd";
import { ArrowLeft, ArrowRight, Calendar, GripVertical, Kanban, Plus, Tag } from "lucide-react";
import { format } from "date-fns";
import { de } from "date-fns/locale";
import { SocialPlannerCalendar } from "./SocialPlannerCalendar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useTenantUsers } from "@/hooks/useTenantUsers";
import { useTopicBacklog } from "@/hooks/useTopicBacklog";
import { PlannerWorkflowStatus, useSocialPlannerItems } from "@/hooks/useSocialPlannerItems";
import { useToast } from "@/hooks/use-toast";

const STATUS_COLUMNS: Array<{ id: PlannerWorkflowStatus; title: string }> = [
  { id: "ideas", title: "Ideen" },
  { id: "in_progress", title: "In Arbeit" },
  { id: "in_review", title: "In Freigabe" },
  { id: "approved", title: "Freigegeben" },
  { id: "scheduled", title: "Geplant" },
  { id: "published", title: "Veröffentlicht" },
];

const SORT_OPTIONS = [
  { value: "scheduled", label: "Veröffentlichungsfenster" },
  { value: "topic", label: "Thema" },
  { value: "status", label: "Status" },
] as const;

const APPROVAL_LABELS: Record<string, string> = {
  open: "Offen",
  requested: "Angefragt",
  approved: "Freigegeben",
  rejected: "Abgelehnt",
};

export function MyWorkSocialPlannerBoard() {
  const { toast } = useToast();
  const { users } = useTenantUsers();
  const { topics, loading: topicBacklogLoading, createTopic } = useTopicBacklog();
  const { items, channels, loading, updateItem, createItem } = useSocialPlannerItems();

  const [viewMode, setViewMode] = useState<"calendar" | "kanban">("calendar");
  const [channelFilter, setChannelFilter] = useState<string>("all");
  const [ownerFilter, setOwnerFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [tagSearch, setTagSearch] = useState("");
  const [sortBy, setSortBy] = useState<(typeof SORT_OPTIONS)[number]["value"]>("scheduled");
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [createTopicId, setCreateTopicId] = useState<string>("none");
  const [createTopicTitle, setCreateTopicTitle] = useState("");
  const [createChannelId, setCreateChannelId] = useState<string>("none");
  const [createFormat, setCreateFormat] = useState("");
  const [createHook, setCreateHook] = useState("");
  const [createCoreMessage, setCreateCoreMessage] = useState("");
  const [createDraftText, setCreateDraftText] = useState("");
  const [createScheduledDate, setCreateScheduledDate] = useState("");
  const [isCreatingDraft, setIsCreatingDraft] = useState(false);

  const filteredItems = useMemo(() => {
    const search = tagSearch.trim().toLowerCase();

    return items
      .filter((item) => {
        if (channelFilter !== "all" && !item.channel_ids.includes(channelFilter)) return false;
        if (ownerFilter !== "all" && item.responsible_user_id !== ownerFilter) return false;
        if (statusFilter !== "all" && item.workflow_status !== statusFilter) return false;
        if (!search) return true;

        return (
          item.topic.toLowerCase().includes(search) ||
          item.tags.some((tag) => tag.toLowerCase().includes(search))
        );
      })
      .sort((a, b) => {
        if (sortBy === "topic") return a.topic.localeCompare(b.topic);
        if (sortBy === "status") return a.workflow_status.localeCompare(b.workflow_status);

        const aTime = a.scheduled_for ? new Date(a.scheduled_for).getTime() : Number.MAX_SAFE_INTEGER;
        const bTime = b.scheduled_for ? new Date(b.scheduled_for).getTime() : Number.MAX_SAFE_INTEGER;
        return aTime - bTime;
      });
  }, [items, channelFilter, ownerFilter, statusFilter, tagSearch, sortBy]);

  const byStatus = useMemo(
    () =>
      STATUS_COLUMNS.reduce<Record<PlannerWorkflowStatus, typeof filteredItems>>((acc, status) => {
        acc[status.id] = filteredItems.filter((item) => item.workflow_status === status.id);
        return acc;
      }, {
        ideas: [],
        in_progress: [],
        in_review: [],
        approved: [],
        scheduled: [],
        published: [],
      }),
    [filteredItems],
  );

  const handleMove = async (itemId: string, status: PlannerWorkflowStatus) => {
    try {
      await updateItem(itemId, { workflow_status: status });
    } catch {
      toast({ title: "Statuswechsel fehlgeschlagen", variant: "destructive" });
    }
  };

  const onDragEnd = async (result: DropResult) => {
    if (!result.destination) return;
    const nextStatus = result.destination.droppableId as PlannerWorkflowStatus;
    if (nextStatus === result.source.droppableId) return;
    await handleMove(result.draggableId, nextStatus);
  };

  const createFromBacklog = async () => {
    const existingTopicIds = new Set(items.map((entry) => entry.topic_backlog_id));
    const candidate = topics.find((topic) => !existingTopicIds.has(topic.id));

    if (!candidate) {
      toast({ title: "Alle Themen sind bereits im Planer" });
      return;
    }

    try {
      await createItem({ topic_backlog_id: candidate.id, workflow_status: "ideas" });
      toast({ title: `Beitrag für '${candidate.topic}' angelegt` });
    } catch {
      toast({ title: "Beitrag konnte nicht angelegt werden", variant: "destructive" });
    }
  };

  const resetCreateDialog = () => {
    setCreateTopicId("none");
    setCreateChannelId("none");
    setCreateTopicTitle("");
    setCreateFormat("");
    setCreateHook("");
    setCreateCoreMessage("");
    setCreateDraftText("");
    setCreateScheduledDate("");
  };

  const createDraft = async () => {
    const trimmedTopicTitle = createTopicTitle.trim();
    if (createTopicId === "none" && !trimmedTopicTitle) {
      toast({ title: "Bitte Thema auswählen oder neu eingeben", variant: "destructive" });
      return;
    }

    try {
      setIsCreatingDraft(true);

      let topicBacklogId = createTopicId;
      if (topicBacklogId === "none") {
        const createdTopic = await createTopic({
          topic: trimmedTopicTitle,
          status: "idea",
        });

        if (!createdTopic?.id) {
          throw new Error("topic-create-failed");
        }

        topicBacklogId = createdTopic.id;
      }

      await createItem({
        topic_backlog_id: topicBacklogId,
        workflow_status: "ideas",
        format: createFormat.trim() || null,
        hook: createHook.trim() || null,
        core_message: createCoreMessage.trim() || null,
        draft_text: createDraftText.trim() || null,
        scheduled_for: createScheduledDate ? new Date(`${createScheduledDate}T09:00:00`).toISOString() : null,
        channel_ids: createChannelId !== "none" ? [createChannelId] : [],
      });

      toast({ title: "Entwurf erstellt", description: "Der Beitrag wurde als Idee im Social Planner angelegt." });
      setIsCreateDialogOpen(false);
      resetCreateDialog();
    } catch {
      toast({ title: "Entwurf konnte nicht erstellt werden", variant: "destructive" });
    } finally {
      setIsCreatingDraft(false);
    }
  };

  const clearFilters = () => {
    setChannelFilter("all");
    setOwnerFilter("all");
    setStatusFilter("all");
    setTagSearch("");
    setSortBy("scheduled");
  };

  const hasActiveFilters = channelFilter !== "all" || ownerFilter !== "all" || statusFilter !== "all" || tagSearch.trim().length > 0 || sortBy !== "scheduled";

  return (
    <Card>
      <CardHeader className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <CardTitle className="text-base">Social Planner Board</CardTitle>
            <p className="text-xs text-muted-foreground">Workflow ohne Kalenderansicht – von Idee bis Veröffentlichung.</p>
          </div>
          <div className="flex items-center gap-2">
            <Button size="sm" variant="outline" onClick={() => setIsCreateDialogOpen(true)}>
              <Plus className="mr-1 h-4 w-4" />
              Neuen Inhalt entwerfen
            </Button>
            {hasActiveFilters && (
              <Button variant="ghost" size="sm" onClick={clearFilters}>
                Filter zurücksetzen
              </Button>
            )}
            <Button size="sm" onClick={createFromBacklog} disabled={topicBacklogLoading}>
              <Plus className="mr-1 h-4 w-4" />
              Aus Themenspeicher anlegen
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-2 md:grid-cols-2 xl:grid-cols-5">
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

          <Input value={tagSearch} onChange={(event) => setTagSearch(event.target.value)} placeholder="Thema/Tag suchen" />

          <Select value={sortBy} onValueChange={(value) => setSortBy(value as (typeof SORT_OPTIONS)[number]["value"])}>
            <SelectTrigger><SelectValue placeholder="Sortierung" /></SelectTrigger>
            <SelectContent>
              {SORT_OPTIONS.map((option) => <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </CardHeader>

      <CardContent>
        <DragDropContext onDragEnd={onDragEnd}>
          <div className="grid grid-cols-1 gap-3 lg:grid-cols-2 2xl:grid-cols-3">
            {STATUS_COLUMNS.map((column) => (
              <Droppable key={column.id} droppableId={column.id}>
                {(dropProvided) => (
                  <section ref={dropProvided.innerRef} {...dropProvided.droppableProps} className="rounded-lg border bg-muted/30 p-2">
                    <div className="mb-2 flex items-center justify-between">
                      <h4 className="text-sm font-semibold">{column.title}</h4>
                      <Badge variant="secondary">{byStatus[column.id].length}</Badge>
                    </div>

                    <div className="min-h-16 space-y-2">
                      {byStatus[column.id].map((item, index) => {
                        const ownerName = users.find((user) => user.id === item.responsible_user_id)?.display_name || "Nicht zugewiesen";

                        return (
                          <Draggable key={item.id} draggableId={item.id} index={index}>
                            {(dragProvided) => (
                              <article
                                ref={dragProvided.innerRef}
                                {...dragProvided.draggableProps}
                                className="rounded-md border bg-card p-2 text-xs"
                              >
                                <div className="mb-1 flex items-start gap-2">
                                  <div {...dragProvided.dragHandleProps} className="mt-0.5 text-muted-foreground">
                                    <GripVertical className="h-3.5 w-3.5" />
                                  </div>
                                  <div className="min-w-0 flex-1">
                                    <p className="font-medium text-sm leading-tight">{item.topic}</p>
                                    <p className="text-muted-foreground">Kanal: {item.channel_names.join(", ") || "-"}</p>
                                    <p className="text-muted-foreground">Format: {item.format || "-"}</p>
                                    <p className="text-muted-foreground">Verantwortlich: {ownerName}</p>
                                    <p className="text-muted-foreground">
                                      Veröffentlichungsfenster: {item.scheduled_for ? format(new Date(item.scheduled_for), "dd.MM.yyyy HH:mm", { locale: de }) : "offen"}
                                    </p>
                                    <p className="text-muted-foreground">
                                      Freigabestatus: {APPROVAL_LABELS[item.approval_state] || item.approval_state}
                                    </p>
                                  </div>
                                </div>

                                {item.tags.length > 0 && (
                                  <div className="mb-2 flex flex-wrap gap-1">
                                    {item.tags.slice(0, 3).map((tag) => (
                                      <Badge variant="outline" key={`${item.id}-${tag}`} className="text-[10px]">
                                        <Tag className="mr-1 h-2.5 w-2.5" />{tag}
                                      </Badge>
                                    ))}
                                  </div>
                                )}

                                <div className="flex justify-between gap-1">
                                  <div className="flex gap-1">
                                    {STATUS_COLUMNS.filter((status) => status.id !== item.workflow_status).map((status) => (
                                      <Button
                                        key={`${item.id}-${status.id}`}
                                        variant="outline"
                                        size="sm"
                                        className="h-6 px-1.5 text-[10px]"
                                        onClick={() => void handleMove(item.id, status.id)}
                                      >
                                        {status.title}
                                      </Button>
                                    ))}
                                  </div>
                                  <div className="flex gap-1">
                                    <Button variant="ghost" size="icon" className="h-6 w-6" disabled={column.id === "ideas"} onClick={() => {
                                      const currentIndex = STATUS_COLUMNS.findIndex((status) => status.id === item.workflow_status);
                                      const prev = STATUS_COLUMNS[currentIndex - 1];
                                      if (prev) void handleMove(item.id, prev.id);
                                    }}>
                                      <ArrowLeft className="h-3 w-3" />
                                    </Button>
                                    <Button variant="ghost" size="icon" className="h-6 w-6" disabled={column.id === "published"} onClick={() => {
                                      const currentIndex = STATUS_COLUMNS.findIndex((status) => status.id === item.workflow_status);
                                      const next = STATUS_COLUMNS[currentIndex + 1];
                                      if (next) void handleMove(item.id, next.id);
                                    }}>
                                      <ArrowRight className="h-3 w-3" />
                                    </Button>
                                  </div>
                                </div>
                              </article>
                            )}
                          </Draggable>
                        );
                      })}

                      {dropProvided.placeholder}
                      {byStatus[column.id].length === 0 && <p className="py-2 text-center text-xs text-muted-foreground">Keine Beiträge</p>}
                    </div>
                  </section>
                )}
              </Droppable>
            ))}
          </div>
        </DragDropContext>

        {loading && <p className="mt-3 text-xs text-muted-foreground">Lade Social-Planer…</p>}
      </CardContent>

      <Dialog open={isCreateDialogOpen} onOpenChange={(open) => {
        setIsCreateDialogOpen(open);
        if (!open) resetCreateDialog();
      }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Neuen Social-Media-Inhalt entwerfen</DialogTitle>
            <DialogDescription>
              Lege direkt aus dem Planner einen neuen Entwurf an.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3">
            <div>
              <Label>Thema</Label>
              <Select value={createTopicId} onValueChange={setCreateTopicId}>
                <SelectTrigger><SelectValue placeholder="Thema wählen" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Bitte wählen</SelectItem>
                  {topics.map((topic) => (
                    <SelectItem key={topic.id} value={topic.id}>{topic.topic}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="create-topic-title">Oder neues Thema (optional)</Label>
              <Input
                id="create-topic-title"
                value={createTopicTitle}
                onChange={(event) => setCreateTopicTitle(event.target.value)}
                placeholder="z. B. Verkehrssicherheit in Karlsruhe"
              />
            </div>

            <div>
              <Label>Kanal (optional)</Label>
              <Select value={createChannelId} onValueChange={setCreateChannelId}>
                <SelectTrigger><SelectValue placeholder="Kanal wählen" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Kein Kanal</SelectItem>
                  {channels.map((channel) => (
                    <SelectItem key={channel.id} value={channel.id}>{channel.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="create-format">Format (optional)</Label>
              <Input id="create-format" value={createFormat} onChange={(event) => setCreateFormat(event.target.value)} placeholder="z. B. Carousel" />
            </div>

            <div>
              <Label htmlFor="create-hook">Hook (optional)</Label>
              <Input id="create-hook" value={createHook} onChange={(event) => setCreateHook(event.target.value)} placeholder="Aufhänger für den Post" />
            </div>

            <div>
              <Label htmlFor="create-core-message">Kernaussage (optional)</Label>
              <Input id="create-core-message" value={createCoreMessage} onChange={(event) => setCreateCoreMessage(event.target.value)} placeholder="Was soll hängen bleiben?" />
            </div>

            <div>
              <Label htmlFor="create-draft-text">Entwurfstext (optional)</Label>
              <Textarea id="create-draft-text" value={createDraftText} onChange={(event) => setCreateDraftText(event.target.value)} placeholder="Textentwurf..." rows={4} />
            </div>

            <div>
              <Label htmlFor="create-scheduled-date">Veröffentlichungsdatum (optional)</Label>
              <Input id="create-scheduled-date" type="date" value={createScheduledDate} onChange={(event) => setCreateScheduledDate(event.target.value)} />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsCreateDialogOpen(false)}>Abbrechen</Button>
            <Button onClick={() => void createDraft()} disabled={isCreatingDraft || (createTopicId === "none" && createTopicTitle.trim().length === 0)}>Entwurf erstellen</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
