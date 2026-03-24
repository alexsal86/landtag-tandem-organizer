import { type ReactNode, useCallback, useEffect, useMemo, useState } from "react";
import { DragDropContext, Draggable, Droppable, type DropResult } from "@hello-pangea/dnd";
import { ArrowLeft, ArrowRight, CalendarDays, CheckSquare, ClipboardList, GripVertical, Kanban, Pencil, Plus, Tag, Trash2, type LucideIcon } from "lucide-react";
import { format } from "date-fns";
import { useSearchParams } from "react-router-dom";
import { de } from "date-fns/locale";
import { Kalenderansicht } from "./Kalenderansicht";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { MultiSelect } from "@/components/ui/multi-select-simple";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { useTenantUsers } from "@/hooks/useTenantUsers";
import { type SocialPlannerItem, PlannerWorkflowStatus, useSocialPlannerItems } from "@/features/redaktion/hooks/useSocialPlannerItems";
import { useTopicBacklog } from "@/features/redaktion/hooks/useTopicBacklog";
import { useToast } from "@/hooks/use-toast";
import type { SpecialDay } from "@/utils/dashboard/specialDays";

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
  draft: "Entwurf",
  pending_approval: "Angefragt",
  approved: "Freigegeben",
  rejected: "Abgelehnt",
};

const CONTENT_GOAL_OPTIONS = [
  "informieren",
  "mobilisieren",
  "Terminankündigung",
  "Rückblick",
  "Statement",
  "Bürgerdialog",
  "Presse-/Linkhinweis",
];

const FORMAT_VARIANT_OPTIONS = ["Story", "Carousel", "Reel", "Feed-Post", "Link-Post"];
const ASSET_OPTIONS = ["Bild nötig", "Video nötig", "Grafik nötig", "Zitatkarte nötig"];

const TEMPLATE_OPTIONS = [
  {
    id: "terminankuendigung",
    label: "Terminankündigung",
    content_goal: "Terminankündigung",
    format: "Feed-Post",
    format_variant: "Feed-Post",
    hook: "Schon vormerken: Wir sind vor Ort und freuen uns auf den Austausch.",
    cta: "Termin sichern und vorbeikommen.",
    asset_requirements: ["Bild nötig", "Grafik nötig"],
  },
  {
    id: "rueckblick",
    label: "Rückblick",
    content_goal: "Rückblick",
    format: "Carousel",
    format_variant: "Carousel",
    hook: "Danke für den starken gemeinsamen Termin – das nehmen wir mit.",
    cta: "Eindrücke teilen oder die wichtigsten Punkte nachlesen.",
    asset_requirements: ["Bild nötig", "Grafik nötig"],
  },
  {
    id: "statement",
    label: "Statement",
    content_goal: "Statement",
    format: "Reel",
    format_variant: "Reel",
    hook: "Meine klare Haltung zum Thema in drei Sätzen.",
    cta: "Position unterstützen oder in die Diskussion einsteigen.",
    asset_requirements: ["Video nötig", "Zitatkarte nötig"],
  },
  {
    id: "buergerdialog",
    label: "Bürgerdialog",
    content_goal: "Bürgerdialog",
    format: "Story",
    format_variant: "Story",
    hook: "Welche Fragen aus dem Wahlkreis sollen wir als Nächstes mitnehmen?",
    cta: "Fragen schicken oder direkt zum Gespräch kommen.",
    asset_requirements: ["Bild nötig", "Grafik nötig"],
  },
  {
    id: "presse-linkhinweis",
    label: "Presse-/Linkhinweis",
    content_goal: "Presse-/Linkhinweis",
    format: "Link-Post",
    format_variant: "Link-Post",
    hook: "Neu erschienen: Die wichtigsten Punkte auf einen Blick.",
    cta: "Artikel öffnen und weiterleiten.",
    asset_requirements: ["Grafik nötig", "Zitatkarte nötig"],
  },
] as const;

type SocialPlannerDraftPayload = {
  topic: string;
  channel_ids: string[];
  format: string | null;
  content_goal: string | null;
  format_variant: string | null;
  asset_requirements: string[];
  approval_required: boolean;
  publish_link: string | null;
  performance_notes: string | null;
  hook: string | null;
  core_message: string | null;
  draft_text: string | null;
  cta: string | null;
  notes: string | null;
  responsible_user_id: string | null;
  scheduled_for: string | null;
  approval_state: string;
  workflow_status: PlannerWorkflowStatus;
};

type SocialPlannerTemplateId = (typeof TEMPLATE_OPTIONS)[number]["id"];

function applyTemplateToState(
  templateId: SocialPlannerTemplateId,
  setters: {
    setFormat: (value: string) => void;
    setContentGoal: (value: string) => void;
    setFormatVariant: (value: string) => void;
    setHook: (value: string) => void;
    setCta: (value: string) => void;
    setAssetRequirements: (value: string[]) => void;
  },
) {
  const template = TEMPLATE_OPTIONS.find((entry) => entry.id === templateId);
  if (!template) return;

  setters.setFormat(template.format);
  setters.setContentGoal(template.content_goal);
  setters.setFormatVariant(template.format_variant);
  setters.setHook(template.hook);
  setters.setCta(template.cta);
  setters.setAssetRequirements([...template.asset_requirements]);
}

function BriefingGroup({
  title,
  description,
  icon: Icon,
  children,
}: {
  title: string;
  description: string;
  icon: LucideIcon;
  children: ReactNode;
}) {
  return (
    <Card className="border-dashed">
      <CardHeader className="pb-3">
        <div className="flex items-start gap-3">
          <div className="rounded-md bg-primary/10 p-2 text-primary">
            <Icon className="h-4 w-4" />
          </div>
          <div>
            <CardTitle className="text-sm">{title}</CardTitle>
            <CardDescription>{description}</CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="grid gap-4 md:grid-cols-2">{children}</CardContent>
    </Card>
  );
}

interface SocialPlannerEditDialogProps {
  item: SocialPlannerItem | null;
  open: boolean;
  users: Array<{ id: string; display_name: string }>;
  channels: Array<{ id: string; name: string }>;
  onOpenChange: (open: boolean) => void;
  onSave: (itemId: string, payload: SocialPlannerDraftPayload) => Promise<void>;
}

function SocialPlannerEditDialog({ item, open, users, channels, onOpenChange, onSave }: SocialPlannerEditDialogProps) {
  const { toast } = useToast();
  const [selectedTemplate, setSelectedTemplate] = useState<string>("none");
  const [topic, setTopic] = useState("");
  const [selectedChannels, setSelectedChannels] = useState<string[]>([]);
  const [formatValue, setFormatValue] = useState("");
  const [contentGoal, setContentGoal] = useState("");
  const [formatVariant, setFormatVariant] = useState("");
  const [assetRequirements, setAssetRequirements] = useState<string[]>([]);
  const [approvalRequired, setApprovalRequired] = useState(true);
  const [publishLink, setPublishLink] = useState("");
  const [performanceNotes, setPerformanceNotes] = useState("");
  const [hookValue, setHookValue] = useState("");
  const [coreMessage, setCoreMessage] = useState("");
  const [draftText, setDraftText] = useState("");
  const [ctaValue, setCtaValue] = useState("");
  const [notesValue, setNotesValue] = useState("");
  const [responsibleUserId, setResponsibleUserId] = useState<string>("none");
  const [scheduledDate, setScheduledDate] = useState("");
  const [approvalState, setApprovalState] = useState("draft");
  const [workflowStatus, setWorkflowStatus] = useState<PlannerWorkflowStatus>("ideas");
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (!item) return;

    setSelectedTemplate("none");
    setTopic(item.topic);
    setSelectedChannels(item.channel_ids);
    setFormatValue(item.format || "");
    setContentGoal(item.content_goal || "");
    setFormatVariant(item.format_variant || item.format || "");
    setAssetRequirements(item.asset_requirements || []);
    setApprovalRequired(item.approval_required ?? true);
    setPublishLink(item.publish_link || "");
    setPerformanceNotes(item.performance_notes || "");
    setHookValue(item.hook || "");
    setCoreMessage(item.core_message || "");
    setDraftText(item.draft_text || "");
    setCtaValue(item.cta || "");
    setNotesValue(item.notes || "");
    setResponsibleUserId(item.responsible_user_id || "none");
    setScheduledDate(item.scheduled_for ? item.scheduled_for.slice(0, 16) : "");
    setApprovalState(item.approval_state || "draft");
    setWorkflowStatus(item.workflow_status);
  }, [item]);

  const channelOptions = useMemo(
    () => channels.map((channel) => ({ value: channel.id, label: channel.name })),
    [channels],
  );

  const handleTemplateChange = (value: string) => {
    setSelectedTemplate(value);
    if (value === "none") return;

    applyTemplateToState(value as SocialPlannerTemplateId, {
      setFormat: setFormatValue,
      setContentGoal,
      setFormatVariant,
      setHook: setHookValue,
      setCta: setCtaValue,
      setAssetRequirements,
    });
  };

  const handleSave = async () => {
    if (!item) return;

    if (!topic.trim()) {
      toast({ title: "Thema fehlt", description: "Bitte ein Thema eintragen.", variant: "destructive" });
      return;
    }

    try {
      setIsSaving(true);
      await onSave(item.id, {
        topic: topic.trim(),
        channel_ids: selectedChannels,
        format: formatValue.trim() || null,
        content_goal: contentGoal.trim() || null,
        format_variant: formatVariant.trim() || null,
        asset_requirements: assetRequirements,
        approval_required: approvalRequired,
        publish_link: publishLink.trim() || null,
        performance_notes: performanceNotes.trim() || null,
        hook: hookValue.trim() || null,
        core_message: coreMessage.trim() || null,
        draft_text: draftText.trim() || null,
        cta: ctaValue.trim() || null,
        notes: notesValue.trim() || null,
        responsible_user_id: responsibleUserId === "none" ? null : responsibleUserId,
        scheduled_for: scheduledDate ? new Date(scheduledDate).toISOString() : null,
        approval_state: approvalState,
        workflow_status: workflowStatus,
      });
      onOpenChange(false);
    } catch {
      toast({ title: "Änderungen konnten nicht gespeichert werden", variant: "destructive" });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Beitrag bearbeiten</DialogTitle>
          <DialogDescription>
            Pflege Inhalte, Kanäle, Briefing und Veröffentlichungsstatus direkt im Social Planner.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="edit-topic">Thema</Label>
              <Input id="edit-topic" value={topic} onChange={(event) => setTopic(event.target.value)} placeholder="Thema des Beitrags" />
            </div>

            <div className="space-y-2 md:col-span-2">
              <Label>Vorlage</Label>
              <Select value={selectedTemplate} onValueChange={handleTemplateChange}>
                <SelectTrigger><SelectValue placeholder="Vorlage anwenden" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Keine Vorlage</SelectItem>
                  {TEMPLATE_OPTIONS.map((template) => (
                    <SelectItem key={template.id} value={template.id}>{template.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2 md:col-span-2">
              <Label>Kanäle</Label>
              <MultiSelect
                options={channelOptions}
                selected={selectedChannels}
                onChange={setSelectedChannels}
                placeholder="Kanäle auswählen"
              />
            </div>
          </div>

          <BriefingGroup title="Wofür ist der Beitrag?" description="Lege Nutzen, Aufhänger und Ziel des Beitrags fest." icon={ClipboardList}>
            <div className="space-y-2">
              <Label>Beitragsziel</Label>
              <Select value={contentGoal || "none"} onValueChange={(value) => setContentGoal(value === "none" ? "" : value)}>
                <SelectTrigger><SelectValue placeholder="Ziel wählen" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Nicht festgelegt</SelectItem>
                  {CONTENT_GOAL_OPTIONS.map((option) => <SelectItem key={option} value={option}>{option}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="edit-hook">Hook</Label>
              <Input id="edit-hook" value={hookValue} onChange={(event) => setHookValue(event.target.value)} placeholder="Einstieg oder Aufhänger" />
            </div>

            <div className="space-y-2">
              <Label htmlFor="edit-core-message">Kernaussage</Label>
              <Input id="edit-core-message" value={coreMessage} onChange={(event) => setCoreMessage(event.target.value)} placeholder="Was soll hängen bleiben?" />
            </div>

            <div className="space-y-2">
              <Label htmlFor="edit-cta">CTA</Label>
              <Input id="edit-cta" value={ctaValue} onChange={(event) => setCtaValue(event.target.value)} placeholder="z. B. Jetzt kommentieren oder teilen" />
            </div>
          </BriefingGroup>

          <BriefingGroup title="Welches Format ist geplant?" description="Definiere Kanal-Logik und Ausgabeformat für Redaktion und Produktion." icon={Pencil}>
            <div className="space-y-2">
              <Label htmlFor="edit-format">Format</Label>
              <Input id="edit-format" value={formatValue} onChange={(event) => setFormatValue(event.target.value)} placeholder="z. B. Reel, Carousel" />
            </div>

            <div className="space-y-2">
              <Label>Formatvariante</Label>
              <Select value={formatVariant || "none"} onValueChange={(value) => setFormatVariant(value === "none" ? "" : value)}>
                <SelectTrigger><SelectValue placeholder="Formatvariante wählen" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Nicht festgelegt</SelectItem>
                  {FORMAT_VARIANT_OPTIONS.map((option) => <SelectItem key={option} value={option}>{option}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="edit-draft-text">Entwurfstext</Label>
              <Textarea id="edit-draft-text" rows={6} value={draftText} onChange={(event) => setDraftText(event.target.value)} placeholder="Textentwurf für den Beitrag" />
            </div>
          </BriefingGroup>

          <BriefingGroup title="Welche Assets werden gebraucht?" description="Halte Materialbedarf für Grafik, Foto, Video und Posting sauber fest." icon={CheckSquare}>
            <div className="space-y-3 md:col-span-2">
              <Label>Asset-Checkliste</Label>
              <div className="grid gap-3 md:grid-cols-2">
                {ASSET_OPTIONS.map((asset) => {
                  const checked = assetRequirements.includes(asset);
                  return (
                    <label key={asset} className="flex items-center gap-3 rounded-md border p-3 text-sm">
                      <Checkbox
                        checked={checked}
                        onCheckedChange={(nextChecked) => {
                          setAssetRequirements((current) => nextChecked ? [...current, asset] : current.filter((entry) => entry !== asset));
                        }}
                      />
                      <span>{asset}</span>
                    </label>
                  );
                })}
              </div>
            </div>

            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="edit-notes">Interne Notizen</Label>
              <Textarea id="edit-notes" rows={4} value={notesValue} onChange={(event) => setNotesValue(event.target.value)} placeholder="Interne Hinweise, Freigabekommentare oder To-dos" />
            </div>
          </BriefingGroup>

          <BriefingGroup title="Was fehlt noch bis zur Veröffentlichung?" description="Behalte Freigabe, Termin, Link und spätere Learnings gemeinsam im Blick." icon={CalendarDays}>
            <div className="flex items-center justify-between gap-4 rounded-md border p-3 md:col-span-2">
              <div>
                <Label htmlFor="edit-approval-required">Freigabe erforderlich</Label>
                <p className="text-xs text-muted-foreground">Aktiviere dies, wenn der Beitrag vor Veröffentlichung redaktionell freigegeben werden muss.</p>
              </div>
              <Switch id="edit-approval-required" checked={approvalRequired} onCheckedChange={setApprovalRequired} />
            </div>

            <div className="space-y-2">
              <Label>Freigabestatus</Label>
              <Select value={approvalState} onValueChange={setApprovalState}>
                <SelectTrigger><SelectValue placeholder="Freigabestatus wählen" /></SelectTrigger>
                <SelectContent>
                  {Object.entries(APPROVAL_LABELS).map(([value, label]) => (
                    <SelectItem key={value} value={value}>{label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Status im Board</Label>
              <Select value={workflowStatus} onValueChange={(value) => setWorkflowStatus(value as PlannerWorkflowStatus)}>
                <SelectTrigger><SelectValue placeholder="Status wählen" /></SelectTrigger>
                <SelectContent>
                  {STATUS_COLUMNS.map((status) => (
                    <SelectItem key={status.id} value={status.id}>{status.title}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Verantwortliche Person</Label>
              <Select value={responsibleUserId} onValueChange={setResponsibleUserId}>
                <SelectTrigger><SelectValue placeholder="Person auswählen" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Nicht zugewiesen</SelectItem>
                  {users.map((user) => (
                    <SelectItem key={user.id} value={user.id}>{user.display_name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="edit-scheduled-for">Veröffentlichungsdatum</Label>
              <Input id="edit-scheduled-for" type="datetime-local" value={scheduledDate} onChange={(event) => setScheduledDate(event.target.value)} />
            </div>

            <div className="space-y-2">
              <Label htmlFor="edit-publish-link">Publish-Link</Label>
              <Input id="edit-publish-link" value={publishLink} onChange={(event) => setPublishLink(event.target.value)} placeholder="https://…" />
            </div>

            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="edit-performance-notes">Performance-Notizen</Label>
              <Textarea id="edit-performance-notes" rows={3} value={performanceNotes} onChange={(event) => setPerformanceNotes(event.target.value)} placeholder="z. B. starke Reichweite bei Carousel, CTA im ersten Slide gut funktioniert" />
            </div>
          </BriefingGroup>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isSaving}>Abbrechen</Button>
          <Button onClick={() => void handleSave()} disabled={isSaving}>Speichern</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

interface PlannerBoardProps {
  specialDays?: SpecialDay[];
}

export function PlannerBoard({ specialDays = [] }: PlannerBoardProps) {
  const { toast } = useToast();
  const [searchParams] = useSearchParams();
  const { users } = useTenantUsers();
  const { topics, createTopic } = useTopicBacklog();
  const { items, channels, loading, updateItem, createItem, deleteItem } = useSocialPlannerItems();

  const [viewMode, setViewMode] = useState<"calendar" | "kanban">("calendar");
  const [channelFilter, setChannelFilter] = useState<string>("all");
  const [ownerFilter, setOwnerFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [tagSearch, setTagSearch] = useState("");
  const [sortBy, setSortBy] = useState<(typeof SORT_OPTIONS)[number]["value"]>("scheduled");
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [editingItemId, setEditingItemId] = useState<string | null>(null);
  const [deleteItemId, setDeleteItemId] = useState<string | null>(null);
  const [createTemplate, setCreateTemplate] = useState<string>("none");
  const [createTopicId, setCreateTopicId] = useState<string>("none");
  const [createTopicTitle, setCreateTopicTitle] = useState("");
  const [createChannelIds, setCreateChannelIds] = useState<string[]>([]);
  const [createFormat, setCreateFormat] = useState("");
  const [createContentGoal, setCreateContentGoal] = useState("");
  const [createFormatVariant, setCreateFormatVariant] = useState("");
  const [createAssetRequirements, setCreateAssetRequirements] = useState<string[]>([]);
  const [createApprovalRequired, setCreateApprovalRequired] = useState(true);
  const [createPublishLink, setCreatePublishLink] = useState("");
  const [createPerformanceNotes, setCreatePerformanceNotes] = useState("");
  const [createHook, setCreateHook] = useState("");
  const [createCoreMessage, setCreateCoreMessage] = useState("");
  const [createDraftText, setCreateDraftText] = useState("");
  const [createCta, setCreateCta] = useState("");
  const [createNotes, setCreateNotes] = useState("");
  const [createResponsibleUserId, setCreateResponsibleUserId] = useState<string>("none");
  const [createApprovalState, setCreateApprovalState] = useState("draft");
  const [createWorkflowStatus, setCreateWorkflowStatus] = useState<PlannerWorkflowStatus>("ideas");
  const [createScheduledDate, setCreateScheduledDate] = useState("");
  const [isCreatingDraft, setIsCreatingDraft] = useState(false);

  const editingItem = useMemo(
    () => items.find((item) => item.id === editingItemId) || null,
    [editingItemId, items],
  );
  const deleteCandidate = useMemo(
    () => items.find((item) => item.id === deleteItemId) || null,
    [deleteItemId, items],
  );

  const channelOptions = useMemo(
    () => channels.map((channel) => ({ value: channel.id, label: channel.name })),
    [channels],
  );

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
          item.tags.some((tag) => tag.toLowerCase().includes(search)) ||
          item.content_goal?.toLowerCase().includes(search) ||
          item.format_variant?.toLowerCase().includes(search)
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

  const handleSaveItem = useCallback(async (itemId: string, payload: SocialPlannerDraftPayload) => {
    await updateItem(itemId, payload);
    toast({ title: "Beitrag aktualisiert", description: "Änderungen sind im Board und Kalender sichtbar." });
  }, [toast, updateItem]);

  const onDragEnd = async (result: DropResult) => {
    if (!result.destination) return;
    const nextStatus = result.destination.droppableId as PlannerWorkflowStatus;
    if (nextStatus === result.source.droppableId) return;
    await handleMove(result.draggableId, nextStatus);
  };

  const resetCreateDialog = () => {
    setCreateTemplate("none");
    setCreateTopicId("none");
    setCreateTopicTitle("");
    setCreateChannelIds([]);
    setCreateFormat("");
    setCreateContentGoal("");
    setCreateFormatVariant("");
    setCreateAssetRequirements([]);
    setCreateApprovalRequired(true);
    setCreatePublishLink("");
    setCreatePerformanceNotes("");
    setCreateHook("");
    setCreateCoreMessage("");
    setCreateDraftText("");
    setCreateCta("");
    setCreateNotes("");
    setCreateResponsibleUserId("none");
    setCreateApprovalState("draft");
    setCreateWorkflowStatus("ideas");
    setCreateScheduledDate("");
  };

  const handleCreateTemplateChange = (value: string) => {
    setCreateTemplate(value);
    if (value === "none") return;

    applyTemplateToState(value as SocialPlannerTemplateId, {
      setFormat: setCreateFormat,
      setContentGoal: setCreateContentGoal,
      setFormatVariant: setCreateFormatVariant,
      setHook: setCreateHook,
      setCta: setCreateCta,
      setAssetRequirements: setCreateAssetRequirements,
    });
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
        workflow_status: createWorkflowStatus,
        approval_state: createApprovalState,
        format: createFormat.trim() || null,
        content_goal: createContentGoal.trim() || null,
        format_variant: createFormatVariant.trim() || null,
        asset_requirements: createAssetRequirements,
        approval_required: createApprovalRequired,
        publish_link: createPublishLink.trim() || null,
        performance_notes: createPerformanceNotes.trim() || null,
        hook: createHook.trim() || null,
        core_message: createCoreMessage.trim() || null,
        draft_text: createDraftText.trim() || null,
        cta: createCta.trim() || null,
        notes: createNotes.trim() || null,
        responsible_user_id: createResponsibleUserId === "none" ? null : createResponsibleUserId,
        scheduled_for: createScheduledDate ? new Date(`${createScheduledDate}T09:00:00`).toISOString() : null,
        channel_ids: createChannelIds,
      });

      toast({ title: "Entwurf erstellt", description: "Der Beitrag wurde mit Briefing-Feldern im Social Planner angelegt." });
      setIsCreateDialogOpen(false);
      resetCreateDialog();
    } catch {
      toast({ title: "Entwurf konnte nicht erstellt werden", variant: "destructive" });
    } finally {
      setIsCreatingDraft(false);
    }
  };


  const handleDeleteItem = useCallback(async () => {
    if (!deleteItemId) return;

    try {
      await deleteItem(deleteItemId);
      if (editingItemId === deleteItemId) setEditingItemId(null);
      setDeleteItemId(null);
      toast({ title: "Beitrag gelöscht", description: "Der Social-Media-Entwurf wurde aus dem Planner entfernt." });
    } catch {
      toast({ title: "Beitrag konnte nicht gelöscht werden", variant: "destructive" });
    }
  }, [deleteItem, deleteItemId, editingItemId, toast]);

  const clearFilters = () => {
    setChannelFilter("all");
    setOwnerFilter("all");
    setStatusFilter("all");
    setTagSearch("");
    setSortBy("scheduled");
  };

  const handleCalendarScheduleUpdate = useCallback(async (itemId: string, isoDate: string) => {
    try {
      await updateItem(itemId, { scheduled_for: isoDate } as Parameters<typeof updateItem>[1]);
    } catch {
      toast({ title: "Zeitpunkt konnte nicht geändert werden", variant: "destructive" });
    }
  }, [updateItem, toast]);

  const hasActiveFilters = channelFilter !== "all" || ownerFilter !== "all" || statusFilter !== "all" || tagSearch.trim().length > 0 || sortBy !== "scheduled";

  useEffect(() => {
    const highlightId = searchParams.get("highlight");
    if (!highlightId || items.length === 0) return;

    const targetItem = items.find((item) => item.id === highlightId);
    if (!targetItem) return;

    setViewMode("kanban");
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

  return (
    <Card>
      <CardHeader className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <CardTitle className="text-base">Social Planner</CardTitle>
            <p className="text-xs text-muted-foreground">Redaktionsplanung – von Idee bis Veröffentlichung.</p>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex rounded-md border overflow-hidden">
              <Button
                size="sm"
                variant={viewMode === "calendar" ? "default" : "ghost"}
                className="rounded-none h-8"
                onClick={() => setViewMode("calendar")}
              >
                <CalendarDays className="mr-1 h-3.5 w-3.5" />
                Kalender
              </Button>
              <Button
                size="sm"
                variant={viewMode === "kanban" ? "default" : "ghost"}
                className="rounded-none h-8"
                onClick={() => setViewMode("kanban")}
              >
                <Kanban className="mr-1 h-3.5 w-3.5" />
                Kanban
              </Button>
            </div>
            <Button size="sm" variant="outline" onClick={() => setIsCreateDialogOpen(true)}>
              <Plus className="mr-1 h-4 w-4" />
              Neuen Inhalt entwerfen
            </Button>
            {hasActiveFilters && (
              <Button variant="ghost" size="sm" onClick={clearFilters}>
                Filter zurücksetzen
              </Button>
            )}
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
        {viewMode === "calendar" ? (
          <Kalenderansicht
            items={filteredItems}
            onUpdateSchedule={handleCalendarScheduleUpdate}
            onEditItem={setEditingItemId}
            onCreateAtSlot={(date) => {
              resetCreateDialog();
              setCreateScheduledDate(format(date, "yyyy-MM-dd"));
              setIsCreateDialogOpen(true);
            }}
            specialDays={specialDays}
          />
        ) : (
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
                                  data-social-planner-item-id={item.id}
                                >
                                  <div className="mb-2 flex items-start gap-2">
                                    <div {...dragProvided.dragHandleProps} className="mt-0.5 text-muted-foreground">
                                      <GripVertical className="h-3.5 w-3.5" />
                                    </div>
                                    <button
                                      type="button"
                                      className="min-w-0 flex-1 text-left"
                                      onClick={() => setEditingItemId(item.id)}
                                    >
                                      <p className="font-medium text-sm leading-tight">{item.topic}</p>
                                      <p className="text-muted-foreground">Kanal: {item.channel_names.join(", ") || "-"}</p>
                                      <p className="text-muted-foreground">Ziel: {item.content_goal || "-"}</p>
                                      <p className="text-muted-foreground">Format: {item.format_variant || item.format || "-"}</p>
                                      <p className="text-muted-foreground">Verantwortlich: {ownerName}</p>
                                      <p className="text-muted-foreground">
                                        Veröffentlichungsfenster: {item.scheduled_for ? format(new Date(item.scheduled_for), "dd.MM.yyyy HH:mm", { locale: de }) : "offen"}
                                      </p>
                                      <p className="text-muted-foreground">
                                        Freigabestatus: {item.approval_required ? (APPROVAL_LABELS[item.approval_state] || item.approval_state) : "Keine Freigabe nötig"}
                                      </p>
                                    </button>
                                  </div>

                                  {item.asset_requirements.length > 0 && (
                                    <div className="mb-2 flex flex-wrap gap-1">
                                      {item.asset_requirements.slice(0, 3).map((asset) => (
                                        <Badge variant="secondary" key={`${item.id}-${asset}`} className="text-[10px]">{asset}</Badge>
                                      ))}
                                    </div>
                                  )}

                                  {item.tags.length > 0 && (
                                    <div className="mb-2 flex flex-wrap gap-1">
                                      {item.tags.slice(0, 3).map((tag) => (
                                        <Badge variant="outline" key={`${item.id}-${tag}`} className="text-[10px]">
                                          <Tag className="mr-1 h-2.5 w-2.5" />{tag}
                                        </Badge>
                                      ))}
                                    </div>
                                  )}

                                  <div className="flex justify-between gap-2">
                                    <div className="flex gap-2">
                                      <Button variant="outline" size="sm" className="h-7" onClick={() => setEditingItemId(item.id)}>
                                        <Pencil className="mr-1 h-3 w-3" />
                                        Bearbeiten
                                      </Button>
                                      <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive" onClick={() => setDeleteItemId(item.id)}>
                                        <Trash2 className="h-3.5 w-3.5" />
                                      </Button>
                                    </div>
                                    <div className="flex gap-1 flex-wrap">
                                      {(() => {
                                        const idx = STATUS_COLUMNS.findIndex((s) => s.id === item.workflow_status);
                                        const prev = STATUS_COLUMNS[idx - 1];
                                        const next = STATUS_COLUMNS[idx + 1];
                                        return (
                                          <>
                                            {prev && (
                                              <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => void handleMove(item.id, prev.id)}>
                                                <ArrowLeft className="h-3 w-3" />
                                              </Button>
                                            )}
                                            {next && (
                                              <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => void handleMove(item.id, next.id)}>
                                                <ArrowRight className="h-3 w-3" />
                                              </Button>
                                            )}
                                          </>
                                        );
                                      })()}
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
        )}

        {loading && <p className="mt-3 text-xs text-muted-foreground">Lade Social-Planer…</p>}
      </CardContent>

      <SocialPlannerEditDialog
        item={editingItem}
        open={editingItem !== null}
        users={users}
        channels={channels}
        onOpenChange={(open) => {
          if (!open) setEditingItemId(null);
        }}
        onSave={handleSaveItem}
      />

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
        setIsCreateDialogOpen(open);
        if (!open) resetCreateDialog();
      }}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Neuen Social-Media-Inhalt entwerfen</DialogTitle>
            <DialogDescription>
              Lege direkt aus dem Planner einen neuen Entwurf an – inklusive redaktionellem Briefing und Vorlagen.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2 md:col-span-2">
                <Label>Vorlage</Label>
                <Select value={createTemplate} onValueChange={handleCreateTemplateChange}>
                  <SelectTrigger><SelectValue placeholder="Vorlage auswählen" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Keine Vorlage</SelectItem>
                    {TEMPLATE_OPTIONS.map((template) => (
                      <SelectItem key={template.id} value={template.id}>{template.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
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

              <div className="space-y-2">
                <Label htmlFor="create-topic-title">Oder neues Thema</Label>
                <Input
                  id="create-topic-title"
                  value={createTopicTitle}
                  onChange={(event) => setCreateTopicTitle(event.target.value)}
                  placeholder="z. B. Verkehrssicherheit in Karlsruhe"
                />
              </div>

              <div className="space-y-2 md:col-span-2">
                <Label>Kanäle</Label>
                <MultiSelect options={channelOptions} selected={createChannelIds} onChange={setCreateChannelIds} placeholder="Kanäle auswählen" />
              </div>
            </div>

            <BriefingGroup title="Wofür ist der Beitrag?" description="Vorlagen füllen Hook/CTA an, du kannst sie hier weiter schärfen." icon={ClipboardList}>
              <div className="space-y-2">
                <Label>Beitragsziel</Label>
                <Select value={createContentGoal || "none"} onValueChange={(value) => setCreateContentGoal(value === "none" ? "" : value)}>
                  <SelectTrigger><SelectValue placeholder="Ziel wählen" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Nicht festgelegt</SelectItem>
                    {CONTENT_GOAL_OPTIONS.map((option) => <SelectItem key={option} value={option}>{option}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="create-hook">Hook</Label>
                <Input id="create-hook" value={createHook} onChange={(event) => setCreateHook(event.target.value)} placeholder="Aufhänger für den Post" />
              </div>

              <div className="space-y-2">
                <Label htmlFor="create-core-message">Kernaussage</Label>
                <Input id="create-core-message" value={createCoreMessage} onChange={(event) => setCreateCoreMessage(event.target.value)} placeholder="Was soll hängen bleiben?" />
              </div>

              <div className="space-y-2">
                <Label htmlFor="create-cta">CTA</Label>
                <Input id="create-cta" value={createCta} onChange={(event) => setCreateCta(event.target.value)} placeholder="Handlungsaufforderung" />
              </div>
            </BriefingGroup>

            <BriefingGroup title="Welches Format ist geplant?" description="Plane direkt mit Format- und Kanalentscheidungen für den Entwurf." icon={Pencil}>
              <div className="space-y-2">
                <Label htmlFor="create-format">Format</Label>
                <Input id="create-format" value={createFormat} onChange={(event) => setCreateFormat(event.target.value)} placeholder="z. B. Carousel" />
              </div>

              <div className="space-y-2">
                <Label>Formatvariante</Label>
                <Select value={createFormatVariant || "none"} onValueChange={(value) => setCreateFormatVariant(value === "none" ? "" : value)}>
                  <SelectTrigger><SelectValue placeholder="Formatvariante wählen" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Nicht festgelegt</SelectItem>
                    {FORMAT_VARIANT_OPTIONS.map((option) => <SelectItem key={option} value={option}>{option}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="create-draft-text">Entwurfstext</Label>
                <Textarea id="create-draft-text" value={createDraftText} onChange={(event) => setCreateDraftText(event.target.value)} placeholder="Textentwurf..." rows={4} />
              </div>
            </BriefingGroup>

            <BriefingGroup title="Welche Assets werden gebraucht?" description="Die Vorlagen setzen passende Checklisten für politische Standardfälle." icon={CheckSquare}>
              <div className="space-y-3 md:col-span-2">
                <Label>Asset-Checkliste</Label>
                <div className="grid gap-3 md:grid-cols-2">
                  {ASSET_OPTIONS.map((asset) => {
                    const checked = createAssetRequirements.includes(asset);
                    return (
                      <label key={asset} className="flex items-center gap-3 rounded-md border p-3 text-sm">
                        <Checkbox
                          checked={checked}
                          onCheckedChange={(nextChecked) => {
                            setCreateAssetRequirements((current) => nextChecked ? [...current, asset] : current.filter((entry) => entry !== asset));
                          }}
                        />
                        <span>{asset}</span>
                      </label>
                    );
                  })}
                </div>
              </div>

              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="create-notes">Interne Notizen</Label>
                <Textarea id="create-notes" value={createNotes} onChange={(event) => setCreateNotes(event.target.value)} placeholder="Offene Punkte, Asset-Briefing, Abstimmungshinweise" rows={3} />
              </div>
            </BriefingGroup>

            <BriefingGroup title="Was fehlt noch bis zur Veröffentlichung?" description="Organisiere Freigabe, Veröffentlichung und spätere Learnings direkt beim Anlegen." icon={CalendarDays}>
              <div className="flex items-center justify-between gap-4 rounded-md border p-3 md:col-span-2">
                <div>
                  <Label htmlFor="create-approval-required">Freigabe erforderlich</Label>
                  <p className="text-xs text-muted-foreground">Vor Aktivierung von „geplant“ oder „veröffentlicht“ kann hier eine interne Freigabe eingefordert werden.</p>
                </div>
                <Switch id="create-approval-required" checked={createApprovalRequired} onCheckedChange={setCreateApprovalRequired} />
              </div>

              <div className="space-y-2">
                <Label>Freigabestatus</Label>
                <Select value={createApprovalState} onValueChange={setCreateApprovalState}>
                  <SelectTrigger><SelectValue placeholder="Freigabestatus wählen" /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(APPROVAL_LABELS).map(([value, label]) => (
                      <SelectItem key={value} value={value}>{label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Status im Board</Label>
                <Select value={createWorkflowStatus} onValueChange={(value) => setCreateWorkflowStatus(value as PlannerWorkflowStatus)}>
                  <SelectTrigger><SelectValue placeholder="Status wählen" /></SelectTrigger>
                  <SelectContent>
                    {STATUS_COLUMNS.map((status) => (
                      <SelectItem key={status.id} value={status.id}>{status.title}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Verantwortliche Person</Label>
                <Select value={createResponsibleUserId} onValueChange={setCreateResponsibleUserId}>
                  <SelectTrigger><SelectValue placeholder="Person auswählen" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Nicht zugewiesen</SelectItem>
                    {users.map((user) => (
                      <SelectItem key={user.id} value={user.id}>{user.display_name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="create-scheduled-date">Veröffentlichungsdatum</Label>
                <Input id="create-scheduled-date" type="date" value={createScheduledDate} onChange={(event) => setCreateScheduledDate(event.target.value)} />
              </div>

              <div className="space-y-2">
                <Label htmlFor="create-publish-link">Publish-Link</Label>
                <Input id="create-publish-link" value={createPublishLink} onChange={(event) => setCreatePublishLink(event.target.value)} placeholder="https://…" />
              </div>

              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="create-performance-notes">Performance-Notizen</Label>
                <Textarea id="create-performance-notes" value={createPerformanceNotes} onChange={(event) => setCreatePerformanceNotes(event.target.value)} placeholder="Learnings, Benchmarks oder Erwartungen festhalten" rows={3} />
              </div>
            </BriefingGroup>
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
