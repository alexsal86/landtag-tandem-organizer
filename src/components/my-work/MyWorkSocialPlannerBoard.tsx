import { useMemo, useState } from "react";
import { DragDropContext, Draggable, Droppable, type DropResult } from "@hello-pangea/dnd";
import { ArrowLeft, ArrowRight, GripVertical, Plus, Tag } from "lucide-react";
import { format } from "date-fns";
import { de } from "date-fns/locale";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
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

export function MyWorkSocialPlannerBoard() {
  const { toast } = useToast();
  const { users } = useTenantUsers();
  const { topics } = useTopicBacklog();
  const { items, channels, loading, updateItem, createItem } = useSocialPlannerItems();

  const [channelFilter, setChannelFilter] = useState<string>("all");
  const [ownerFilter, setOwnerFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [tagSearch, setTagSearch] = useState("");
  const [sortBy, setSortBy] = useState<(typeof SORT_OPTIONS)[number]["value"]>("scheduled");

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

  return (
    <Card>
      <CardHeader className="space-y-3">
        <div className="flex items-center justify-between gap-2">
          <CardTitle className="text-base">Social Planner Board</CardTitle>
          <Button size="sm" onClick={createFromBacklog}>
            <Plus className="mr-1 h-4 w-4" />
            Aus Themenspeicher anlegen
          </Button>
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

                    <div className="space-y-2 min-h-16">
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
                                    <p className="text-muted-foreground">Freigabestatus: {item.approval_state}</p>
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

                                <div className="flex justify-end gap-1">
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
    </Card>
  );
}
