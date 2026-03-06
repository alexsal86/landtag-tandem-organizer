import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { format } from "date-fns";
import { de } from "date-fns/locale";
import { AlertCircle, ArrowDown, ArrowUp, Briefcase, CheckCircle2, Circle, Clock, ExternalLink, FileText, FolderOpen, Gavel, GripVertical, Link2, Loader2, Mail, MessageSquare, Phone, Plus, Search, Trash2, UserRound, Users, Vote } from "lucide-react";
import { DragDropContext, Droppable, Draggable, type DropResult } from "@hello-pangea/dnd";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ContextMenu, ContextMenuContent, ContextMenuItem, ContextMenuSeparator, ContextMenuSub, ContextMenuSubContent, ContextMenuSubTrigger, ContextMenuTrigger } from "@/components/ui/context-menu";
import { DropdownMenu, DropdownMenuCheckboxItem, DropdownMenuContent, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import SimpleRichTextEditor from "@/components/ui/SimpleRichTextEditor";
import { CaseFileDetail, CaseFileCreateDialog } from "@/features/cases/files/components";
import { CaseItemCreateDialog } from "@/components/my-work/CaseItemCreateDialog";
import { StandaloneDecisionCreator } from "@/components/task-decisions/StandaloneDecisionCreator";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { useCaseItems } from "@/features/cases/items/hooks";
import { useAuth } from "@/hooks/useAuth";
import { useTenant } from "@/hooks/useTenant";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

type CaseItem = {
  id: string;
  subject: string | null;
  resolution_summary: string | null;
  summary: string | null;
  source_channel: string | null;
  source_received_at: string | null;
  status: string | null;
  completion_note: string | null;
  completed_at: string | null;
  priority: string | null;
  due_at: string | null;
  case_file_id: string | null;
  user_id: string | null;
  owner_user_id: string | null;
  intake_payload: Record<string, unknown> | null;
  updated_at: string | null;
};

type CaseFile = {
  id: string;
  title: string;
  status: string;
  reference_number: string | null;
  current_status_note: string | null;
  case_type: string | null;
};

type TeamUser = {
  id: string;
  name: string;
  avatarUrl: string | null;
};

type EditableCaseItem = {
  subject: string;
  summary: string;
  status: string;
  completionNote: string;
  completedAt: string;
  sourceReceivedAt: string;
  dueAt: string;
  category: string;
  priority: string;
  assigneeIds: string[];
  timelineEvents: TimelineEvent[];
  interactionType: TimelineInteractionType;
  interactionTitle: string;
  interactionNote: string;
};

type TimelineInteractionType = "anruf" | "mail" | "treffen" | "gespraech" | "notiz";

type TimelineEvent = {
  id: string;
  type: "status" | "interaktion" | "entscheidung";
  title: string;
  note?: string;
  timestamp: string;
  statusValue?: string;
  interactionType?: TimelineInteractionType;
};

type CaseItemSortKey = "channel" | "subject" | "description" | "status" | "received" | "due" | "category" | "priority" | "assignee";
type SortDirection = "asc" | "desc";

const categoryOptions = ["Allgemein", "Bürgeranliegen", "Anfrage", "Beschwerde", "Termin", "Sonstiges"] as const;

const sourceChannelMeta: Record<string, { icon: typeof Phone; label: string }> = {
  phone: { icon: Phone, label: "Telefon" },
  email: { icon: Mail, label: "E-Mail" },
  social: { icon: MessageSquare, label: "Social" },
  in_person: { icon: UserRound, label: "Vor Ort" },
  other: { icon: Briefcase, label: "Sonstiges" },
};

const statusOptions = [
  { value: "neu", label: "Neu", dotColor: "bg-sky-500", badgeClass: "border-sky-500/40 text-sky-700 bg-sky-500/10" },
  { value: "in_klaerung", label: "In Klärung", dotColor: "bg-amber-500", badgeClass: "border-amber-500/40 text-amber-700 bg-amber-500/10" },
  { value: "antwort_ausstehend", label: "Antwort ausstehend", dotColor: "bg-violet-500", badgeClass: "border-violet-500/40 text-violet-700 bg-violet-500/10" },
  { value: "entscheidung_abwartend", label: "Entscheidung abwartend", dotColor: "bg-fuchsia-600", badgeClass: "border-fuchsia-500/40 text-fuchsia-700 bg-fuchsia-500/10" },
  { value: "erledigt", label: "Erledigt", dotColor: "bg-emerald-600", badgeClass: "border-emerald-500/40 text-emerald-700 bg-emerald-500/10" },
] as const;

const interactionTypeOptions: Array<{ value: TimelineInteractionType; label: string }> = [
  { value: "anruf", label: "Anruf" },
  { value: "mail", label: "Mail" },
  { value: "treffen", label: "Treffen" },
  { value: "gespraech", label: "Gespräch" },
  { value: "notiz", label: "Notiz" },
];

const toEditorHtml = (value: string | null | undefined) => {
  if (!value) return "";
  if (/<[^>]+>/.test(value)) return value;
  return `<p>${value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")}</p>`;
};

const normalizeRichTextValue = (value: string): string | null => {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const withoutTags = trimmed
    .replace(/<p><br><\/p>/gi, "")
    .replace(/<br\s*\/?/gi, "")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/gi, "")
    .trim();
  return withoutTags ? trimmed : null;
};

const parseTimelineEvents = (payload: Record<string, unknown> | null): TimelineEvent[] => {
  const raw = payload?.timeline_events;
  if (!Array.isArray(raw)) return [];
  const results: TimelineEvent[] = [];
  for (const event of raw) {
    if (!event || typeof event !== "object") continue;
    const item = event as Record<string, unknown>;
    if (typeof item.id !== "string" || typeof item.type !== "string" || typeof item.title !== "string" || typeof item.timestamp !== "string") continue;
    const type = item.type as string;
    if (type !== "status" && type !== "interaktion" && type !== "entscheidung") continue;
    results.push({
      id: item.id,
      type: type as TimelineEvent["type"],
      title: item.title,
      note: typeof item.note === "string" ? item.note : undefined,
      timestamp: item.timestamp,
      statusValue: typeof item.statusValue === "string" ? item.statusValue : undefined,
      interactionType: typeof item.interactionType === "string" ? item.interactionType as TimelineInteractionType : undefined,
    });
  }
  return results.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
};

const priorityOptions = [
  { value: "low", label: "Niedrig", color: "text-emerald-500" },
  { value: "medium", label: "Mittel", color: "text-amber-500" },
  { value: "high", label: "Hoch", color: "text-red-500" },
  { value: "urgent", label: "Dringend", color: "text-red-600" },
];

const caseFileStatusBadge = (status: string) => {
  switch (status) {
    case "open":
      return <Badge variant="outline" className="border-emerald-500/40 text-emerald-600 text-[10px] px-1.5 py-0">Offen</Badge>;
    case "in_progress":
      return <Badge variant="outline" className="border-blue-500/40 text-blue-600 text-[10px] px-1.5 py-0">In Bearbeitung</Badge>;
    case "closed":
      return <Badge variant="outline" className="border-muted-foreground/40 text-muted-foreground text-[10px] px-1.5 py-0">Geschlossen</Badge>;
    default:
      return <Badge variant="outline" className="text-[10px] px-1.5 py-0">{status}</Badge>;
  }
};

export function MyWorkCasesWorkspace() {
  const { user } = useAuth();
  const { currentTenant } = useTenant();
  const tenantId = currentTenant?.id;
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { createCaseItem } = useCaseItems();

  const [caseItems, setCaseItems] = useState<CaseItem[]>([]);
  const [allCaseFiles, setAllCaseFiles] = useState<CaseFile[]>([]);
  const [caseFilesById, setCaseFilesById] = useState<Record<string, CaseFile>>({});
  const [teamUsers, setTeamUsers] = useState<TeamUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [itemFilterQuery, setItemFilterQuery] = useState("");
  const [fileFilterQuery, setFileFilterQuery] = useState("");

  const [isCaseItemDialogOpen, setIsCaseItemDialogOpen] = useState(false);
  const [isCaseFileDialogOpen, setIsCaseFileDialogOpen] = useState(false);
  const [pendingCaseItemLinkId, setPendingCaseItemLinkId] = useState<string | null>(null);

  const [detailItemId, setDetailItemId] = useState<string | null>(null);
  const [detailFileId, setDetailFileId] = useState<string | null>(null);
  const [editableCaseItem, setEditableCaseItem] = useState<EditableCaseItem | null>(null);
  const [itemSort, setItemSort] = useState<{ key: CaseItemSortKey; direction: SortDirection }>({ key: "received", direction: "desc" });

  // Decision integration state
  const [isDecisionCreatorOpen, setIsDecisionCreatorOpen] = useState(false);
  const [decisionCreatorItemId, setDecisionCreatorItemId] = useState<string | null>(null);
  const [linkedDecisions, setLinkedDecisions] = useState<Record<string, Array<{ id: string; title: string; status: string; created_at: string; response_deadline: string | null }>>>({});
  const [loadingDecisions, setLoadingDecisions] = useState(false);

  const getItemSubject = useCallback((item: CaseItem) => item.subject || item.summary || item.resolution_summary || "Ohne Titel", []);
  const getItemDescription = useCallback((item: CaseItem) => item.summary || item.resolution_summary || "", []);

  const clearActionParam = useCallback(() => {
    setSearchParams((prev) => {
      const params = new URLSearchParams(prev);
      params.delete("action");
      return params;
    }, { replace: true });
  }, [setSearchParams]);

  useEffect(() => {
    const action = searchParams.get("action");
    if (action === "create-caseitem") {
      setPendingCaseItemLinkId(null);
      setIsCaseItemDialogOpen(true);
      clearActionParam();
      return;
    }
    if (action === "create-casefile") {
      setPendingCaseItemLinkId(searchParams.get("caseItemId"));
      setIsCaseFileDialogOpen(true);
      clearActionParam();
    }
  }, [clearActionParam, searchParams]);

  const loadWorkspaceData = useCallback(async () => {
    if (!user || !tenantId) {
      setCaseItems([]);
      setAllCaseFiles([]);
      setCaseFilesById({});
      setTeamUsers([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const [itemsRes, filesRes, membersRes] = await Promise.all([
        supabase
          .from("case_items" as any)
          .select("id, subject, summary, resolution_summary, source_channel, source_received_at, status, completion_note, completed_at, priority, due_at, case_file_id, user_id, owner_user_id, intake_payload, updated_at")
          .eq("tenant_id", tenantId)
          .order("updated_at", { ascending: false, nullsFirst: false })
          .limit(200),
        supabase
          .from("case_files")
          .select("id, title, status, reference_number, current_status_note, case_type")
          .eq("tenant_id", tenantId)
          .order("updated_at", { ascending: false })
          .limit(200),
        supabase
          .from("user_tenant_memberships")
          .select("user_id")
          .eq("tenant_id", tenantId)
          .eq("is_active", true),
      ]);

      if (itemsRes.error) throw itemsRes.error;
      if (filesRes.error) throw filesRes.error;
      if (membersRes.error) throw membersRes.error;

      const items = (itemsRes.data || []) as unknown as CaseItem[];
      const files = (filesRes.data || []) as unknown as CaseFile[];

      setCaseItems(items);
      setAllCaseFiles(files);

      const mapped = files.reduce<Record<string, CaseFile>>((acc, row) => {
        acc[row.id] = row;
        return acc;
      }, {});
      setCaseFilesById(mapped);
      const memberIds = ((membersRes.data || []) as Array<{ user_id: string }>).map((row) => row.user_id);
      if (memberIds.length === 0) {
        setTeamUsers([]);
      } else {
        const { data: profileRows, error: profilesError } = await supabase
          .from("profiles")
          .select("user_id, display_name, avatar_url")
          .in("user_id", memberIds);
        if (profilesError) throw profilesError;

        const profileById = new Map((profileRows || []).map((row) => [row.user_id, { name: row.display_name || "Unbekannt", avatarUrl: row.avatar_url || null }]));
        setTeamUsers(memberIds.map((id) => {
          const profile = profileById.get(id);
          return { id, name: profile?.name || "Unbekannt", avatarUrl: profile?.avatarUrl || null };
        }));
      }
    } catch (error) {
      console.error("Error loading cases workspace:", error);
    } finally {
      setLoading(false);
    }
  }, [tenantId, user]);

  useEffect(() => {
    if (!user || !tenantId) {
      setLoading(false);
      return;
    }
    void loadWorkspaceData();
  }, [loadWorkspaceData, tenantId, user]);

  // Load linked decisions for a case item
  const loadLinkedDecisions = useCallback(async (itemId: string) => {
    setLoadingDecisions(true);
    try {
      const { data, error } = await supabase
        .from("task_decisions")
        .select("id, title, status, created_at, response_deadline")
        .eq("case_item_id", itemId)
        .order("created_at", { ascending: false });
      if (!error && data) {
        setLinkedDecisions((prev) => ({ ...prev, [itemId]: data as any }));
      }
    } catch (e) {
      console.error("Error loading linked decisions:", e);
    } finally {
      setLoadingDecisions(false);
    }
  }, []);

  // Load decisions when detail item changes
  useEffect(() => {
    if (detailItemId) {
      void loadLinkedDecisions(detailItemId);
    }
  }, [detailItemId, loadLinkedDecisions]);

  const getAssigneeIds = useCallback((item: CaseItem) => {
    const payloadAssigneeIds = Array.isArray(item.intake_payload?.assignee_ids)
      ? item.intake_payload.assignee_ids.filter((id): id is string => typeof id === "string" && id.length > 0)
      : [];
    const merged = [...payloadAssigneeIds];
    if (item.owner_user_id && !merged.includes(item.owner_user_id)) merged.unshift(item.owner_user_id);
    return Array.from(new Set(merged));
  }, []);

  const getCategory = useCallback((item: CaseItem) => {
    const value = item.intake_payload?.category;
    return typeof value === "string" ? value : "";
  }, []);

  const filteredCaseItems = useMemo(() => {
    const query = itemFilterQuery.trim().toLowerCase();
    if (!query) return caseItems;
    return caseItems.filter((item) => {
      const linkedFile = item.case_file_id ? caseFilesById[item.case_file_id] : null;
      const category = getCategory(item);
      return [item.subject, item.summary, item.resolution_summary, item.source_channel, item.status, item.priority, category]
        .concat(linkedFile ? [linkedFile.title, linkedFile.reference_number] : [])
        .filter(Boolean)
        .some((v) => v!.toLowerCase().includes(query));
    });
  }, [caseFilesById, caseItems, getCategory, itemFilterQuery]);

  const sortedCaseItems = useMemo(() => {
    const priorityRank: Record<string, number> = { low: 1, medium: 2, high: 3, urgent: 4 };
    const directionFactor = itemSort.direction === "asc" ? 1 : -1;

    return [...filteredCaseItems].sort((a, b) => {
      const aAssignee = getAssigneeIds(a).map((id) => teamUsers.find((member) => member.id === id)?.name || "").join(", ");
      const bAssignee = getAssigneeIds(b).map((id) => teamUsers.find((member) => member.id === id)?.name || "").join(", ");

      const aValue: string | number = {
        channel: sourceChannelMeta[a.source_channel || ""]?.label || a.source_channel || "",
        subject: getItemSubject(a),
        description: getItemDescription(a),
        status: statusOptions.find((option) => option.value === a.status)?.label || a.status || "Neu",
        received: a.source_received_at ? new Date(a.source_received_at).getTime() : 0,
        due: a.due_at ? new Date(a.due_at).getTime() : 0,
        category: getCategory(a),
        priority: priorityRank[a.priority || ""] || 0,
        assignee: aAssignee,
      }[itemSort.key];

      const bValue: string | number = {
        channel: sourceChannelMeta[b.source_channel || ""]?.label || b.source_channel || "",
        subject: getItemSubject(b),
        description: getItemDescription(b),
        status: statusOptions.find((option) => option.value === b.status)?.label || b.status || "Neu",
        received: b.source_received_at ? new Date(b.source_received_at).getTime() : 0,
        due: b.due_at ? new Date(b.due_at).getTime() : 0,
        category: getCategory(b),
        priority: priorityRank[b.priority || ""] || 0,
        assignee: bAssignee,
      }[itemSort.key];

      if (typeof aValue === "number" && typeof bValue === "number") {
        return (aValue - bValue) * directionFactor;
      }

      return String(aValue).localeCompare(String(bValue), "de", { sensitivity: "base" }) * directionFactor;
    });
  }, [caseFilesById, filteredCaseItems, getAssigneeIds, getCategory, getItemDescription, getItemSubject, itemSort, teamUsers]);

  const toggleSort = useCallback((key: CaseItemSortKey, direction: SortDirection) => {
    setItemSort((prev) => (prev.key === key && prev.direction === direction ? prev : { key, direction }));
  }, []);

  const isSortActive = useCallback(
    (key: CaseItemSortKey, direction: SortDirection) => itemSort.key === key && itemSort.direction === direction,
    [itemSort.direction, itemSort.key],
  );

  const sortButtonClass = useCallback(
    (key: CaseItemSortKey, direction: SortDirection) => cn(
      "rounded p-0.5 opacity-0 transition-all group-hover:opacity-100 hover:bg-muted",
      isSortActive(key, direction) && "bg-primary/15 text-primary opacity-100",
    ),
    [isSortActive],
  );

  const filteredCaseFiles = useMemo(() => {
    const query = fileFilterQuery.trim().toLowerCase();
    if (!query) return allCaseFiles;
    return allCaseFiles.filter((cf) =>
      [cf.title, cf.reference_number, cf.status, cf.current_status_note, cf.case_type]
        .filter(Boolean)
        .some((v) => v!.toLowerCase().includes(query)),
    );
  }, [allCaseFiles, fileFilterQuery]);

  const linkedItemsCountByFile = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const item of caseItems) {
      if (item.case_file_id) {
        counts[item.case_file_id] = (counts[item.case_file_id] || 0) + 1;
      }
    }
    return counts;
  }, [caseItems]);

  const defaultAssigneeId = user?.id ?? null;

  const getStatusMeta = useCallback((status: string | null) => {
    return statusOptions.find((option) => option.value === status) || {
      value: status || "neu",
      label: status || "Neu",
      dotColor: "bg-muted-foreground",
      badgeClass: "border-muted-foreground/40 text-muted-foreground",
    };
  }, []);

  const persistAssignees = async (item: CaseItem, assigneeIds: string[]) => {
    const payload = {
      ...(item.intake_payload || {}),
      assignee_ids: assigneeIds,
      category: getCategory(item),
    };
    const ownerUserId = assigneeIds[0] || null;

    await supabase
      .from("case_items")
      .update({ owner_user_id: ownerUserId, intake_payload: payload })
      .eq("id", item.id);

    setCaseItems((prev) => prev.map((row) => (row.id === item.id ? { ...row, owner_user_id: ownerUserId, intake_payload: payload } : row)));
  };

  const handleAssigneeToggle = async (item: CaseItem, memberId: string, checked: boolean) => {
    const current = getAssigneeIds(item);
    const next = checked ? Array.from(new Set([...current, memberId])) : current.filter((id) => id !== memberId);
    await persistAssignees(item, next);
  };

  // --- Quick action handlers ---

  const handleQuickStatusChange = async (item: CaseItem, newStatus: string) => {
    const { error } = await supabase.from("case_items").update({ status: newStatus } as any).eq("id", item.id);
    if (error) {
      toast.error("Status konnte nicht geändert werden.");
      return;
    }
    setCaseItems((prev) => prev.map((row) => (row.id === item.id ? { ...row, status: newStatus as CaseItem["status"] } : row)));
    toast.success(`Status auf "${statusOptions.find((s) => s.value === newStatus)?.label || newStatus}" gesetzt.`);
  };

  const handleQuickPriorityChange = async (item: CaseItem, newPriority: string) => {
    const { error } = await supabase.from("case_items").update({ priority: newPriority } as any).eq("id", item.id);
    if (error) {
      toast.error("Priorität konnte nicht geändert werden.");
      return;
    }
    setCaseItems((prev) => prev.map((row) => (row.id === item.id ? { ...row, priority: newPriority as CaseItem["priority"] } : row)));
    toast.success(`Priorität auf "${priorityOptions.find((p) => p.value === newPriority)?.label || newPriority}" gesetzt.`);
  };

  const handleQuickLinkToFile = async (item: CaseItem, caseFileId: string) => {
    const { error } = await supabase.from("case_items").update({ case_file_id: caseFileId } as any).eq("id", item.id);
    if (error) {
      toast.error("Verknüpfung konnte nicht erstellt werden.");
      return;
    }
    setCaseItems((prev) => prev.map((row) => (row.id === item.id ? { ...row, case_file_id: caseFileId } : row)));
    const file = caseFilesById[caseFileId];
    toast.success(`Vorgang mit "${file?.title || "Akte"}" verknüpft.`);
  };

  const handleUnlinkFromFile = async (item: CaseItem) => {
    const { error } = await supabase.from("case_items").update({ case_file_id: null } as any).eq("id", item.id);
    if (error) {
      toast.error("Verknüpfung konnte nicht gelöst werden.");
      return;
    }
    setCaseItems((prev) => prev.map((row) => (row.id === item.id ? { ...row, case_file_id: null } : row)));
    toast.success("Verknüpfung zur Akte gelöst.");
  };

  const handleDragEnd = (result: DropResult) => {
    const { destination, draggableId } = result;
    if (!destination) return;
    const droppableId = destination.droppableId;
    if (!droppableId.startsWith("casefile-")) return;
    const caseFileId = droppableId.replace("casefile-", "");
    const item = caseItems.find((i) => i.id === draggableId);
    if (!item) return;
    if (item.case_file_id === caseFileId) return;
    void handleQuickLinkToFile(item, caseFileId);
  };

  const handleSelectCaseItem = (item: CaseItem) => {
    if (detailItemId === item.id) {
      setDetailItemId(null);
      setEditableCaseItem(null);
      return;
    }

    setDetailItemId(item.id);
    setDetailFileId(null);
    setEditableCaseItem({
      subject: item.subject || "",
      summary: item.summary || item.resolution_summary || "",
      status: item.status || "neu",
      completionNote: item.completion_note || "",
      completedAt: item.completed_at ? format(new Date(item.completed_at), "yyyy-MM-dd") : "",
      sourceReceivedAt: item.source_received_at ? format(new Date(item.source_received_at), "yyyy-MM-dd") : "",
      dueAt: item.due_at ? format(new Date(item.due_at), "yyyy-MM-dd") : "",
      category: getCategory(item),
      priority: item.priority || "medium",
      assigneeIds: getAssigneeIds(item),
      timelineEvents: parseTimelineEvents(item.intake_payload),
      interactionType: "anruf",
      interactionTitle: "",
      interactionNote: "",
    });
  };

  const handleSelectCaseFile = (cf: CaseFile) => {
    setDetailFileId(cf.id);
    setDetailItemId(null);
  };

  const handleCreateCaseItem = () => {
    setPendingCaseItemLinkId(null);
    setIsCaseItemDialogOpen(true);
  };

  const handleCreateCaseFile = (caseItemId?: string) => {
    setPendingCaseItemLinkId(caseItemId ?? null);
    setIsCaseFileDialogOpen(true);
  };

  const handleCaseItemCreated = async (newCaseItemId: string) => {
    await loadWorkspaceData();
    setDetailItemId(newCaseItemId);
  };

  const handleCaseFileCreated = async (newCaseFileId: string) => {
    if (pendingCaseItemLinkId) {
      await supabase
        .from("case_items")
        .update({ case_file_id: newCaseFileId, case_scale: "large" })
        .eq("id", pendingCaseItemLinkId);
    }
    await loadWorkspaceData();
    if (pendingCaseItemLinkId) {
      setDetailItemId(pendingCaseItemLinkId);
    } else {
      setDetailFileId(newCaseFileId);
    }
    setPendingCaseItemLinkId(null);
  };

  const detailItem = useMemo(() => {
    if (!detailItemId) return null;
    return caseItems.find((i) => i.id === detailItemId) || null;
  }, [caseItems, detailItemId]);

  const priorityMeta = useCallback((priority: string | null) => {
    switch (priority) {
      case "low":
        return { color: "text-emerald-500", label: "Niedrig" };
      case "high":
      case "urgent":
        return { color: "text-red-500", label: priority === "urgent" ? "Dringend" : "Hoch" };
      case "medium":
      default:
        return { color: "text-amber-500", label: "Mittel" };
    }
  }, []);

  const getInitials = (name: string) => {
    const parts = name.trim().split(" ").filter(Boolean);
    return parts.slice(0, 2).map((part) => part[0]?.toUpperCase()).join("") || "?";
  };

  const formatTimelineDate = useCallback((timestamp: string) => {
    try {
      return format(new Date(timestamp), "dd.MM.yyyy, HH:mm", { locale: de });
    } catch {
      return timestamp;
    }
  }, []);

  const appendTimelineEvent = useCallback((event: Omit<TimelineEvent, "id" | "timestamp">) => {
    setEditableCaseItem((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        timelineEvents: [...prev.timelineEvents, {
          ...event,
          id: typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`,
          timestamp: new Date().toISOString(),
        }],
      };
    });
  }, []);

  const handleAddInteraction = useCallback(() => {
    if (!editableCaseItem) return;
    const title = editableCaseItem.interactionTitle.trim() || `${interactionTypeOptions.find((opt) => opt.value === editableCaseItem.interactionType)?.label || "Interaktion"}`;
    appendTimelineEvent({
      type: "interaktion",
      title,
      note: editableCaseItem.interactionNote.trim() || undefined,
      interactionType: editableCaseItem.interactionType,
    });
    setEditableCaseItem((prev) => prev ? { ...prev, interactionTitle: "", interactionNote: "" } : prev);
  }, [appendTimelineEvent, editableCaseItem]);

  const handleRequestDecision = useCallback(() => {
    if (!editableCaseItem || !detailItemId) return;
    // Open the decision creator dialog with pre-filled data
    setDecisionCreatorItemId(detailItemId);
    setIsDecisionCreatorOpen(true);
  }, [editableCaseItem, detailItemId]);

  const handleDecisionCreated = useCallback(async (decisionId: string) => {
    if (!detailItemId || !editableCaseItem) return;
    // Set status to "entscheidung_abwartend" and add timeline event
    const previousStatus = editableCaseItem.status;
    setEditableCaseItem((prev) => prev ? {
      ...prev,
      status: "entscheidung_abwartend",
      timelineEvents: [...prev.timelineEvents, {
        id: typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`,
        type: "entscheidung" as const,
        title: "Entscheidung erstellt",
        note: `Vorheriger Status: ${getStatusMeta(previousStatus).label}`,
        timestamp: new Date().toISOString(),
        statusValue: previousStatus,
      }],
    } : prev);
    // Reload decisions for this item
    await loadLinkedDecisions(detailItemId);
  }, [detailItemId, editableCaseItem, getStatusMeta, loadLinkedDecisions]);

  const handleDecisionReceived = useCallback(() => {
    if (!editableCaseItem || editableCaseItem.status !== "entscheidung_abwartend") return;
    const decisionEvent = [...editableCaseItem.timelineEvents].reverse().find((event) => event.type === "entscheidung" && event.statusValue);
    const fallback = "in_klaerung";
    const restoredStatus = decisionEvent?.statusValue || fallback;
    setEditableCaseItem((prev) => prev ? {
      ...prev,
      status: restoredStatus,
      timelineEvents: [...prev.timelineEvents, {
        id: typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`,
        type: "status",
        title: "Entscheidung eingegangen",
        note: `Status zurück auf ${getStatusMeta(restoredStatus).label}`,
        timestamp: new Date().toISOString(),
        statusValue: restoredStatus,
      }],
    } : prev);
  }, [editableCaseItem, getStatusMeta]);

  const handleDeleteTimelineEvent = useCallback((eventId: string) => {
    setEditableCaseItem((prev) => prev ? { ...prev, timelineEvents: prev.timelineEvents.filter((event) => event.id !== eventId) } : prev);
  }, []);

  const handleCaseItemSave = async () => {
    if (!detailItemId || !editableCaseItem) return;
    if (editableCaseItem.status === "erledigt" && (!editableCaseItem.completionNote.trim() || !editableCaseItem.completedAt)) {
      toast.error("Für den Status „Erledigt“ sind Abschlussnotiz und Abgeschlossen am Pflichtfelder.");
      return;
    }
    await supabase
      .from("case_items")
      .update({
        subject: editableCaseItem.subject.trim() || null,
        summary: normalizeRichTextValue(editableCaseItem.summary),
        resolution_summary: normalizeRichTextValue(editableCaseItem.summary),
        status: editableCaseItem.status as any,
        completion_note: editableCaseItem.completionNote.trim() || null,
        completed_at: editableCaseItem.completedAt ? new Date(`${editableCaseItem.completedAt}T12:00:00`).toISOString() : null,
        source_received_at: editableCaseItem.sourceReceivedAt ? new Date(`${editableCaseItem.sourceReceivedAt}T12:00:00`).toISOString() : null,
        due_at: editableCaseItem.dueAt ? new Date(`${editableCaseItem.dueAt}T12:00:00`).toISOString() : null,
        priority: editableCaseItem.priority as any,
        owner_user_id: editableCaseItem.assigneeIds[0] || null,
        intake_payload: {
          ...(detailItem?.intake_payload || {}),
          category: editableCaseItem.category,
          assignee_ids: editableCaseItem.assigneeIds,
          timeline_events: editableCaseItem.timelineEvents,
        },
      })
      .eq("id", detailItemId);
    await loadWorkspaceData();
  };

  // --- Render ---

  if (loading) {
    return <div className="p-4 text-sm text-muted-foreground">Lade Fallbearbeitung…</div>;
  }

  return (
    <>
      {detailFileId ? (
        <Card>
          <CardContent className="pt-6">
            <CaseFileDetail caseFileId={detailFileId} onBack={() => setDetailFileId(null)} />
          </CardContent>
        </Card>
      ) : (
        <>
          <DragDropContext onDragEnd={handleDragEnd}>
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,7fr)_minmax(0,3fr)]">
              {/* LEFT: Vorgänge */}
              <Card>
                <CardHeader className="pb-2">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <CardTitle className="flex items-center gap-2 text-base">
                      <FileText className="h-4 w-4" />
                      Vorgänge
                    </CardTitle>
                    <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:items-center">
                      <Button size="sm" onClick={handleCreateCaseItem}>
                        <Plus className="mr-1 h-4 w-4" />
                        Neu
                      </Button>
                      <div className="relative w-full sm:w-64">
                        <Search className="pointer-events-none absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                        <Input
                          value={itemFilterQuery}
                          onChange={(e) => setItemFilterQuery(e.target.value)}
                          placeholder="Vorgänge filtern…"
                          className="h-9 pl-8"
                        />
                      </div>
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">Vorgänge per Drag & Drop auf eine FallAkte ziehen zum Verknüpfen</p>
                </CardHeader>
                <CardContent className="space-y-3 pt-5">
                  <Droppable droppableId="case-items-list" isDropDisabled>
                    {(provided) => (
                      <div className="space-y-1.5 pr-2">
                        <div ref={provided.innerRef} {...provided.droppableProps} className="space-y-1.5">
                          {sortedCaseItems.length === 0 ? (
                            <div className="rounded-md border border-dashed p-4 text-sm text-muted-foreground space-y-3">
                              <p>Keine Vorgänge gefunden.</p>
                              <Button size="sm" onClick={handleCreateCaseItem}>Vorgang erstellen</Button>
                            </div>
                          ) : (
                            <div className="space-y-1.5">
                              <div className="hidden grid-cols-[28px_40px_minmax(160px,1.1fr)_minmax(260px,2.4fr)_minmax(120px,0.8fr)_88px_88px_minmax(110px,0.8fr)_52px_112px] gap-2 border-b px-2 pb-1 text-[11px] font-medium uppercase tracking-wide text-muted-foreground lg:grid">
                                <span />
                                <span className="group inline-flex items-center justify-center gap-0.5">
                                  <button type="button" className={sortButtonClass("channel", "asc")} onClick={() => toggleSort("channel", "asc")} aria-label="Kanal aufsteigend sortieren"><ArrowUp className="h-3 w-3" /></button>
                                  <button type="button" className={sortButtonClass("channel", "desc")} onClick={() => toggleSort("channel", "desc")} aria-label="Kanal absteigend sortieren"><ArrowDown className="h-3 w-3" /></button>
                                </span>
                                <span className="group inline-flex items-center gap-0.5">Betreff<button type="button" className={sortButtonClass("subject", "asc")} onClick={() => toggleSort("subject", "asc")} aria-label="Betreff aufsteigend sortieren"><ArrowUp className="h-3 w-3" /></button><button type="button" className={sortButtonClass("subject", "desc")} onClick={() => toggleSort("subject", "desc")} aria-label="Betreff absteigend sortieren"><ArrowDown className="h-3 w-3" /></button></span>
                                <span className="group inline-flex items-center gap-0.5">Beschreibung<button type="button" className={sortButtonClass("description", "asc")} onClick={() => toggleSort("description", "asc")} aria-label="Beschreibung aufsteigend sortieren"><ArrowUp className="h-3 w-3" /></button><button type="button" className={sortButtonClass("description", "desc")} onClick={() => toggleSort("description", "desc")} aria-label="Beschreibung absteigend sortieren"><ArrowDown className="h-3 w-3" /></button></span>
                                <span className="group inline-flex items-center gap-0.5">Status<button type="button" className={sortButtonClass("status", "asc")} onClick={() => toggleSort("status", "asc")} aria-label="Status aufsteigend sortieren"><ArrowUp className="h-3 w-3" /></button><button type="button" className={sortButtonClass("status", "desc")} onClick={() => toggleSort("status", "desc")} aria-label="Status absteigend sortieren"><ArrowDown className="h-3 w-3" /></button></span>
                                <span className="group inline-flex items-center gap-0.5">Eingang<button type="button" className={sortButtonClass("received", "asc")} onClick={() => toggleSort("received", "asc")} aria-label="Eingang aufsteigend sortieren"><ArrowUp className="h-3 w-3" /></button><button type="button" className={sortButtonClass("received", "desc")} onClick={() => toggleSort("received", "desc")} aria-label="Eingang absteigend sortieren"><ArrowDown className="h-3 w-3" /></button></span>
                                <span className="group inline-flex items-center gap-0.5">Fällig<button type="button" className={sortButtonClass("due", "asc")} onClick={() => toggleSort("due", "asc")} aria-label="Fällig aufsteigend sortieren"><ArrowUp className="h-3 w-3" /></button><button type="button" className={sortButtonClass("due", "desc")} onClick={() => toggleSort("due", "desc")} aria-label="Fällig absteigend sortieren"><ArrowDown className="h-3 w-3" /></button></span>
                                <span className="group inline-flex items-center gap-0.5">Kategorie<button type="button" className={sortButtonClass("category", "asc")} onClick={() => toggleSort("category", "asc")} aria-label="Kategorie aufsteigend sortieren"><ArrowUp className="h-3 w-3" /></button><button type="button" className={sortButtonClass("category", "desc")} onClick={() => toggleSort("category", "desc")} aria-label="Kategorie absteigend sortieren"><ArrowDown className="h-3 w-3" /></button></span>
                                <span className="group inline-flex items-center justify-center gap-0.5"><button type="button" className={sortButtonClass("priority", "asc")} onClick={() => toggleSort("priority", "asc")} aria-label="Priorität aufsteigend sortieren"><ArrowUp className="h-3 w-3" /></button><button type="button" className={sortButtonClass("priority", "desc")} onClick={() => toggleSort("priority", "desc")} aria-label="Priorität absteigend sortieren"><ArrowDown className="h-3 w-3" /></button></span>
                                <span className="group inline-flex items-center gap-0.5">Bearbeiter<button type="button" className={sortButtonClass("assignee", "asc")} onClick={() => toggleSort("assignee", "asc")} aria-label="Bearbeiter aufsteigend sortieren"><ArrowUp className="h-3 w-3" /></button><button type="button" className={sortButtonClass("assignee", "desc")} onClick={() => toggleSort("assignee", "desc")} aria-label="Bearbeiter absteigend sortieren"><ArrowDown className="h-3 w-3" /></button></span>
                              </div>
                              {sortedCaseItems.map((item, index) => {
                                const linkedFile = item.case_file_id ? caseFilesById[item.case_file_id] : null;
                                const isActive = detailItemId === item.id;
                                const channel = item.source_channel ? sourceChannelMeta[item.source_channel] : null;
                                const ChannelIcon = channel?.icon ?? Briefcase;
                                const assigneeIds = getAssigneeIds(item);
                                const assignees = assigneeIds.map((id) => teamUsers.find((member) => member.id === id)).filter(Boolean) as TeamUser[];
                                const category = getCategory(item);
                                const hasInlineDetail = isActive && editableCaseItem;
                                return (
                                  <Draggable key={item.id} draggableId={item.id} index={index}>
                                    {(dragProvided, dragSnapshot) => (
                                      <div
                                        ref={dragProvided.innerRef}
                                        {...dragProvided.draggableProps}
                                        className={cn("border-b", dragSnapshot.isDragging && "opacity-80 shadow-lg rounded-md bg-background")}
                                      >
                                        <ContextMenu>
                                          <ContextMenuTrigger asChild>
                                            <button
                                              type="button"
                                              className={cn(
                                                "w-full px-2 py-2 text-left transition-colors hover:bg-muted/40",
                                                isActive && "bg-primary/5",
                                              )}
                                              onClick={() => handleSelectCaseItem(item)}
                                            >
                                              <div className="hidden h-12 grid-cols-[28px_40px_minmax(160px,1.1fr)_minmax(260px,2.4fr)_minmax(120px,0.8fr)_88px_88px_minmax(110px,0.8fr)_52px_112px] items-center gap-2 text-xs text-muted-foreground lg:grid">
                                                {/* Drag handle */}
                                                <span
                                                  {...dragProvided.dragHandleProps}
                                                  className="inline-flex items-center justify-center cursor-grab text-muted-foreground/50 hover:text-muted-foreground"
                                                  onClick={(e) => e.stopPropagation()}
                                                >
                                                  <GripVertical className="h-4 w-4" />
                                                </span>
                                                <span className="inline-flex" title={channel?.label || "Kanal unbekannt"}>
                                                  <span className="rounded-sm bg-muted p-1 text-muted-foreground">
                                                    <ChannelIcon className="h-3 w-3" />
                                                  </span>
                                                </span>
                                                <span className="truncate text-sm font-medium text-foreground inline-flex items-center gap-1">
                                                  {getItemSubject(item)}
                                                  {/* 3c: Link indicator */}
                                                  {linkedFile && (
                                                    <TooltipProvider delayDuration={200}>
                                                      <Tooltip>
                                                        <TooltipTrigger asChild>
                                                          <Link2 className="h-3.5 w-3.5 text-blue-500 shrink-0" />
                                                        </TooltipTrigger>
                                                        <TooltipContent side="top" className="text-xs">
                                                          <p className="font-medium">Ist Bestandteil der Akte „{linkedFile.title}“</p>
                                                          {linkedFile.reference_number && <p className="text-muted-foreground">{linkedFile.reference_number}</p>}
                                                        </TooltipContent>
                                                      </Tooltip>
                                                    </TooltipProvider>
                                                  )}
                                                </span>
                                                <span className="truncate text-sm font-medium text-foreground" title={getItemDescription(item) || "–"}>{getItemDescription(item) || "–"}</span>
                                                <span>
                                                  <Badge variant="outline" className={cn("text-[11px]", getStatusMeta(item.status).badgeClass)}>
                                                    {getStatusMeta(item.status).label}
                                                  </Badge>
                                                </span>
                                                <span>{item.source_received_at ? format(new Date(item.source_received_at), "dd.MM.yy", { locale: de }) : "–"}</span>
                                                <span>{item.due_at ? format(new Date(item.due_at), "dd.MM.yy", { locale: de }) : "–"}</span>
                                                <span className={cn("truncate", !category && "text-amber-600")}>{category || "Pflichtfeld"}</span>
                                                <span className="inline-flex items-center justify-center" title={priorityMeta(item.priority).label}>
                                                  <Circle className={cn("h-3.5 w-3.5 fill-current", priorityMeta(item.priority).color)} />
                                                </span>
                                                <div className="flex min-w-0 items-center gap-2" onClick={(event) => event.stopPropagation()}>
                                                  <div className="flex items-center -space-x-2">
                                                    {assignees.slice(0, 3).map((member) => (
                                                      <Avatar key={member.id} className="h-6 w-6 border bg-background">
                                                        <AvatarImage src={member.avatarUrl || undefined} />
                                                        <AvatarFallback className="text-[10px]">{getInitials(member.name)}</AvatarFallback>
                                                      </Avatar>
                                                    ))}
                                                  </div>
                                                  <DropdownMenu>
                                                    <DropdownMenuTrigger asChild>
                                                      <Button type="button" size="icon" variant="outline" className="h-7 w-7">
                                                        <Plus className="h-3.5 w-3.5" />
                                                      </Button>
                                                    </DropdownMenuTrigger>
                                                    <DropdownMenuContent align="end" className="w-56">
                                                      {teamUsers.map((member) => (
                                                        <DropdownMenuCheckboxItem
                                                          key={member.id}
                                                          checked={assigneeIds.includes(member.id)}
                                                          onCheckedChange={(checked) => { void handleAssigneeToggle(item, member.id, checked === true); }}
                                                        >
                                                          {member.name}
                                                        </DropdownMenuCheckboxItem>
                                                      ))}
                                                    </DropdownMenuContent>
                                                  </DropdownMenu>
                                                </div>
                                              </div>
                                              <div className="space-y-1 lg:hidden">
                                                <p className="truncate text-sm font-medium">{getItemSubject(item)}</p>
                                                <p className="text-xs text-muted-foreground">{category || "Kategorie fehlt"}</p>
                                              </div>
                                            </button>
                                          </ContextMenuTrigger>
                                          <ContextMenuContent className="w-56">
                                            {/* Status submenu */}
                                            <ContextMenuSub>
                                              <ContextMenuSubTrigger>Status ändern</ContextMenuSubTrigger>
                                              <ContextMenuSubContent className="w-48">
                                                {statusOptions.map((opt) => (
                                                  <ContextMenuItem
                                                    key={opt.value}
                                                    className={cn(item.status === opt.value && "bg-accent")}
                                                    onClick={() => void handleQuickStatusChange(item, opt.value)}
                                                  >
                                                    <span className={cn("mr-2 h-2 w-2 rounded-full inline-block", opt.dotColor)} />
                                                    {opt.label}
                                                    {item.status === opt.value && <span className="ml-auto text-xs text-muted-foreground">✓</span>}
                                                  </ContextMenuItem>
                                                ))}
                                              </ContextMenuSubContent>
                                            </ContextMenuSub>
                                            {/* Priority submenu */}
                                            <ContextMenuSub>
                                              <ContextMenuSubTrigger>Priorität ändern</ContextMenuSubTrigger>
                                              <ContextMenuSubContent className="w-48">
                                                {priorityOptions.map((opt) => (
                                                  <ContextMenuItem
                                                    key={opt.value}
                                                    className={cn(item.priority === opt.value && "bg-accent")}
                                                    onClick={() => void handleQuickPriorityChange(item, opt.value)}
                                                  >
                                                    <Circle className={cn("mr-2 h-3 w-3 fill-current", opt.color)} />
                                                    {opt.label}
                                                    {item.priority === opt.value && <span className="ml-auto text-xs text-muted-foreground">✓</span>}
                                                  </ContextMenuItem>
                                                ))}
                                              </ContextMenuSubContent>
                                            </ContextMenuSub>
                                            <ContextMenuSeparator />
                                            {/* Link to file submenu */}
                                            <ContextMenuSub>
                                              <ContextMenuSubTrigger>Akte zuordnen</ContextMenuSubTrigger>
                                              <ContextMenuSubContent className="w-56 max-h-64 overflow-y-auto">
                                                {item.case_file_id && (
                                                  <>
                                                    <ContextMenuItem onClick={() => void handleUnlinkFromFile(item)} className="text-destructive">
                                                      Verknüpfung lösen
                                                    </ContextMenuItem>
                                                    <ContextMenuSeparator />
                                                  </>
                                                )}
                                                {allCaseFiles.slice(0, 20).map((cf) => (
                                                  <ContextMenuItem
                                                    key={cf.id}
                                                    className={cn(item.case_file_id === cf.id && "bg-accent")}
                                                    onClick={() => void handleQuickLinkToFile(item, cf.id)}
                                                  >
                                                    <FolderOpen className="mr-2 h-3 w-3 shrink-0" />
                                                    <span className="truncate">{cf.title}</span>
                                                    {cf.reference_number && <span className="ml-auto text-xs text-muted-foreground pl-2">{cf.reference_number}</span>}
                                                  </ContextMenuItem>
                                                ))}
                                              </ContextMenuSubContent>
                                            </ContextMenuSub>
                                            <ContextMenuSeparator />
                                            <ContextMenuItem onClick={() => {
                                              setDecisionCreatorItemId(item.id);
                                              setIsDecisionCreatorOpen(true);
                                            }}>
                                              <Vote className="mr-2 h-3 w-3" />
                                              Entscheidung stellen
                                            </ContextMenuItem>
                                          </ContextMenuContent>
                                        </ContextMenu>

                                        {/* Inline detail expansion */}
                                        <div
                                          className={cn(
                                            "grid transition-all duration-300 ease-in-out",
                                            hasInlineDetail ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0",
                                          )}
                                        >
                                          <div className="overflow-hidden">
                                            {hasInlineDetail && (
                                              <div className="mx-2 mb-3 rounded-md border bg-muted/20 p-3 space-y-4">
                                                <div className="grid gap-4 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
                                                  <div className="space-y-3">
                                                    <div className="space-y-1.5">
                                                      <Label className="font-bold" htmlFor="detail-subject">Betreff</Label>
                                                      <Input id="detail-subject" value={editableCaseItem.subject} onChange={(event) => setEditableCaseItem((prev) => prev ? { ...prev, subject: event.target.value } : prev)} />
                                                    </div>
                                                    <div className="space-y-1.5">
                                                      <Label className="font-bold" htmlFor="detail-summary">Beschreibung</Label>
                                                      <SimpleRichTextEditor
                                                        key={`detail-summary-${item.id}`}
                                                        initialContent={toEditorHtml(editableCaseItem.summary)}
                                                        onChange={(html) => setEditableCaseItem((prev) => prev ? { ...prev, summary: html } : prev)}
                                                        placeholder="Beschreibung hinzufügen"
                                                        minHeight="140px"
                                                      />
                                                    </div>
                                                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                                                      <div className="space-y-1.5">
                                                        <Label className="font-bold" htmlFor="detail-received">Eingangsdatum</Label>
                                                        <Input id="detail-received" type="date" value={editableCaseItem.sourceReceivedAt} onChange={(event) => setEditableCaseItem((prev) => prev ? { ...prev, sourceReceivedAt: event.target.value } : prev)} />
                                                      </div>
                                                      <div className="space-y-1.5">
                                                        <Label className="font-bold" htmlFor="detail-due">Fällig am</Label>
                                                        <Input id="detail-due" type="date" value={editableCaseItem.dueAt} onChange={(event) => setEditableCaseItem((prev) => prev ? { ...prev, dueAt: event.target.value } : prev)} />
                                                      </div>
                                                    </div>
                                                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                                                      <div className="space-y-1.5">
                                                        <Label className="font-bold">Status</Label>
                                                        <Select value={editableCaseItem.status} onValueChange={(value) => setEditableCaseItem((prev) => prev ? { ...prev, status: value } : prev)}>
                                                          <SelectTrigger><SelectValue /></SelectTrigger>
                                                          <SelectContent>
                                                            {statusOptions.map((statusOption) => (
                                                              <SelectItem key={statusOption.value} value={statusOption.value}>{statusOption.label}</SelectItem>
                                                            ))}
                                                          </SelectContent>
                                                        </Select>
                                                      </div>
                                                      <div className="space-y-1.5">
                                                        <Label className="font-bold">Kategorie *</Label>
                                                        <Select value={editableCaseItem.category} onValueChange={(value) => setEditableCaseItem((prev) => prev ? { ...prev, category: value } : prev)}>
                                                          <SelectTrigger><SelectValue placeholder="Kategorie wählen" /></SelectTrigger>
                                                          <SelectContent>
                                                            {categoryOptions.map((categoryOption) => (
                                                              <SelectItem key={categoryOption} value={categoryOption}>{categoryOption}</SelectItem>
                                                            ))}
                                                          </SelectContent>
                                                        </Select>
                                                      </div>
                                                    </div>
                                                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                                                      <div className="space-y-1.5">
                                                        <Label className="font-bold">Priorität</Label>
                                                        <Select value={editableCaseItem.priority} onValueChange={(value) => setEditableCaseItem((prev) => prev ? { ...prev, priority: value } : prev)}>
                                                          <SelectTrigger><SelectValue /></SelectTrigger>
                                                          <SelectContent>
                                                            {priorityOptions.map((priorityOption) => (
                                                              <SelectItem key={priorityOption.value} value={priorityOption.value}>{priorityOption.label}</SelectItem>
                                                            ))}
                                                          </SelectContent>
                                                        </Select>
                                                      </div>
                                                      <div className="space-y-1.5">
                                                        <Label className="font-bold">Entscheidung</Label>
                                                        <div className="flex gap-2">
                                                          <Button type="button" variant="outline" size="sm" onClick={handleRequestDecision}><Vote className="mr-1 h-3.5 w-3.5" />Entscheidung stellen</Button>
                                                          <Button type="button" variant="outline" size="sm" onClick={handleDecisionReceived} disabled={editableCaseItem.status !== "entscheidung_abwartend"}>Eingegangen</Button>
                                                        </div>
                                                      </div>
                                                    </div>
                                                    <div className="space-y-1.5">
                                                      <Label className="font-bold">Bearbeiter</Label>
                                                      <div className="flex flex-wrap gap-2">
                                                        {teamUsers.map((member) => {
                                                          const selected = editableCaseItem.assigneeIds.includes(member.id);
                                                          return (
                                                            <Button key={member.id} type="button" size="sm" variant={selected ? "default" : "outline"} onClick={() => {
                                                              setEditableCaseItem((prev) => {
                                                                if (!prev) return prev;
                                                                const next = selected ? prev.assigneeIds.filter((id) => id !== member.id) : [...prev.assigneeIds, member.id];
                                                                return { ...prev, assigneeIds: Array.from(new Set(next)) };
                                                              });
                                                            }}>{member.name}</Button>
                                                          );
                                                        })}
                                                      </div>
                                                    </div>
                                                    {/* Linked Decisions Section */}
                                                    {detailItemId && (
                                                      <div className="space-y-2">
                                                        <Label className="font-bold flex items-center gap-1.5"><Vote className="h-4 w-4" />Verknüpfte Entscheidungen</Label>
                                                        {loadingDecisions ? (
                                                          <div className="flex items-center gap-2 text-xs text-muted-foreground"><Loader2 className="h-3 w-3 animate-spin" />Lade…</div>
                                                        ) : (linkedDecisions[detailItemId] || []).length === 0 ? (
                                                          <p className="text-xs text-muted-foreground">Keine Entscheidungen verknüpft.</p>
                                                        ) : (
                                                          <div className="space-y-1.5">
                                                            {(linkedDecisions[detailItemId] || []).map((dec) => (
                                                              <div key={dec.id} className="flex items-center justify-between rounded-md border bg-background p-2 text-xs">
                                                                <div className="flex items-center gap-2 min-w-0">
                                                                  {dec.status === "completed" ? (
                                                                    <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500 shrink-0" />
                                                                  ) : (
                                                                    <Clock className="h-3.5 w-3.5 text-amber-500 shrink-0" />
                                                                  )}
                                                                  <span className="truncate font-medium">{dec.title}</span>
                                                                </div>
                                                                <Badge variant="outline" className={cn("text-[10px] shrink-0 ml-2", dec.status === "completed" ? "border-emerald-500/40 text-emerald-600" : "border-amber-500/40 text-amber-600")}>
                                                                  {dec.status === "completed" ? "Abgeschlossen" : dec.status === "archived" ? "Archiviert" : "Offen"}
                                                                </Badge>
                                                              </div>
                                                            ))}
                                                          </div>
                                                        )}
                                                        <Button type="button" variant="outline" size="sm" className="w-full" onClick={handleRequestDecision}>
                                                          <Plus className="mr-1 h-3.5 w-3.5" />Weitere Entscheidung stellen
                                                        </Button>
                                                      </div>
                                                    )
                                                    {editableCaseItem.status === "erledigt" && (
                                                      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                                                        <div className="space-y-1.5 sm:col-span-2">
                                                          <Label className="font-bold" htmlFor="detail-completion-note">Abschlussnotiz *</Label>
                                                          <Input id="detail-completion-note" value={editableCaseItem.completionNote} onChange={(event) => setEditableCaseItem((prev) => prev ? { ...prev, completionNote: event.target.value } : prev)} />
                                                        </div>
                                                        <div className="space-y-1.5">
                                                          <Label className="font-bold" htmlFor="detail-completed-at">Abgeschlossen am *</Label>
                                                          <Input id="detail-completed-at" type="date" value={editableCaseItem.completedAt} onChange={(event) => setEditableCaseItem((prev) => prev ? { ...prev, completedAt: event.target.value } : prev)} />
                                                        </div>
                                                      </div>
                                                    )}
                                                    <Button disabled={!editableCaseItem.category} onClick={() => { void handleCaseItemSave(); }}>Speichern</Button>
                                                  </div>

                                                  <div className="space-y-4">
                                                    <div className="rounded-md border bg-background p-3 space-y-3">
                                                      <div className="flex items-center gap-2 text-sm font-semibold"><Users className="h-4 w-4" />Inter-/Aktionen</div>
                                                      <div className="space-y-2">
                                                        <Select value={editableCaseItem.interactionType} onValueChange={(value: TimelineInteractionType) => setEditableCaseItem((prev) => prev ? { ...prev, interactionType: value } : prev)}>
                                                          <SelectTrigger><SelectValue /></SelectTrigger>
                                                          <SelectContent>
                                                            {interactionTypeOptions.map((option) => <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>)}
                                                          </SelectContent>
                                                        </Select>
                                                        <Input placeholder="Titel der Interaktion" value={editableCaseItem.interactionTitle} onChange={(event) => setEditableCaseItem((prev) => prev ? { ...prev, interactionTitle: event.target.value } : prev)} />
                                                        <Input placeholder="Notiz (optional)" value={editableCaseItem.interactionNote} onChange={(event) => setEditableCaseItem((prev) => prev ? { ...prev, interactionNote: event.target.value } : prev)} />
                                                        <Button type="button" size="sm" onClick={handleAddInteraction}>Interaktion hinzufügen</Button>
                                                      </div>
                                                    </div>
                                                    <div className="rounded-md border bg-background p-3">
                                                      <p className="font-bold mb-3">Zeitstrahl</p>
                                                      <div className="relative space-y-4 pl-6">
                                                        <span className="absolute left-2 top-1 bottom-1 w-px bg-border" />
                                                        {editableCaseItem.timelineEvents.length === 0 ? (
                                                          <p className="text-xs text-muted-foreground">Noch keine Einträge im Zeitstrahl.</p>
                                                        ) : (
                                                          editableCaseItem.timelineEvents.map((event) => (
                                                            <div key={event.id} className="relative">
                                                              <span className="absolute -left-[18px] top-1.5 h-2.5 w-2.5 rounded-full bg-primary" />
                                                              <div className="rounded border p-2 text-xs">
                                                                <div className="flex items-start justify-between gap-2">
                                                                  <div>
                                                                    <p className="font-semibold">{event.title}</p>
                                                                    <p className="text-muted-foreground">{formatTimelineDate(event.timestamp)}</p>
                                                                  </div>
                                                                  <Button type="button" variant="ghost" size="icon" className="h-6 w-6" onClick={() => handleDeleteTimelineEvent(event.id)}>
                                                                    <Trash2 className="h-3.5 w-3.5" />
                                                                  </Button>
                                                                </div>
                                                                {event.note && <p className="mt-1 text-muted-foreground">{event.note}</p>}
                                                              </div>
                                                            </div>
                                                          ))
                                                        )}
                                                      </div>
                                                    </div>
                                                  </div>
                                                </div>

                                                {item.case_file_id && caseFilesById[item.case_file_id] ? (
                                                  <div className="mt-1 space-y-2">
                                                    <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Verknüpfte FallAkte</p>
                                                    <div className="rounded-md border bg-background p-3 text-sm">
                                                      <p className="font-semibold">{caseFilesById[item.case_file_id].title}</p>
                                                      <ul className="mt-2 space-y-1 text-xs text-muted-foreground">
                                                        <li>• Status: {caseFilesById[item.case_file_id].status || "offen"}</li>
                                                        {caseFilesById[item.case_file_id].reference_number && <li>• Aktenzeichen: {caseFilesById[item.case_file_id].reference_number}</li>}
                                                        {caseFilesById[item.case_file_id].case_type && <li>• Typ: {caseFilesById[item.case_file_id].case_type}</li>}
                                                        {caseFilesById[item.case_file_id].current_status_note && <li>• Hinweis: {caseFilesById[item.case_file_id].current_status_note}</li>}
                                                      </ul>
                                                    </div>
                                                    <Button size="sm" variant="outline" onClick={() => navigate(`/casefiles?caseFileId=${item.case_file_id}`)}>
                                                      <ExternalLink className="mr-1 h-3.5 w-3.5" />
                                                      Vollansicht
                                                    </Button>
                                                  </div>
                                                ) : (
                                                  <div className="mt-1 space-y-3 rounded-md border border-dashed bg-background p-4 text-sm text-muted-foreground">
                                                    <AlertCircle className="h-4 w-4" />
                                                    <p>Keine Akte verknüpft.</p>
                                                    <div className="flex flex-wrap gap-2">
                                                      <Button size="sm" onClick={() => handleCreateCaseFile(item.id)}>Neue Akte anlegen</Button>
                                                    </div>
                                                  </div>
                                                )}
                                              </div>
                                            )}
                                          </div>
                                        </div>
                                      </div>
                                    )}
                                  </Draggable>
                                );
                              })}
                            </div>
                          )}
                          {provided.placeholder}
                        </div>
                      </div>
                    )}
                  </Droppable>
                </CardContent>
              </Card>

              {/* RIGHT: FallAkten */}
              <Card>
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <CardTitle className="flex items-center gap-2 text-base">
                      <FolderOpen className="h-4 w-4" />
                      FallAkten
                    </CardTitle>
                    <Button size="sm" onClick={() => handleCreateCaseFile()}>
                      <Plus className="mr-1 h-4 w-4" />
                      Neu
                    </Button>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="relative">
                    <Search className="pointer-events-none absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input
                      value={fileFilterQuery}
                      onChange={(e) => setFileFilterQuery(e.target.value)}
                      placeholder="FallAkten filtern…"
                      className="pl-8"
                    />
                  </div>
                  <div className="space-y-1.5 pr-2">
                    <div className="space-y-1.5">
                      {filteredCaseFiles.length === 0 ? (
                        <div className="rounded-md border border-dashed p-4 text-sm text-muted-foreground space-y-3">
                          <p>Keine FallAkten gefunden.</p>
                          <Button size="sm" onClick={() => handleCreateCaseFile()}>FallAkte erstellen</Button>
                        </div>
                      ) : (
                        filteredCaseFiles.map((cf) => {
                          const linkedCount = linkedItemsCountByFile[cf.id] || 0;
                          return (
                            <Droppable key={cf.id} droppableId={`casefile-${cf.id}`}>
                              {(dropProvided, dropSnapshot) => (
                                <div
                                  ref={dropProvided.innerRef}
                                  {...dropProvided.droppableProps}
                                >
                                  <button
                                    type="button"
                                    className={cn(
                                      "w-full border-b px-2 py-2 text-left transition-colors hover:bg-muted/40 rounded-md",
                                      dropSnapshot.isDraggingOver && "ring-2 ring-blue-500 bg-blue-50 dark:bg-blue-950/20",
                                    )}
                                    onClick={() => handleSelectCaseFile(cf)}
                                  >
                                    <div className="flex items-center gap-2">
                                      <p className="text-sm font-medium line-clamp-1 flex-1">{cf.title}</p>
                                      {caseFileStatusBadge(cf.status)}
                                    </div>
                                    <div className="mt-1.5 flex items-center justify-between text-xs text-muted-foreground">
                                      {cf.reference_number && <span>{cf.reference_number}</span>}
                                      {linkedCount > 0 && (
                                        <span>
                                          <FileText className="inline h-3 w-3 mr-0.5" />
                                          {linkedCount} {linkedCount === 1 ? "Vorgang" : "Vorgänge"}
                                        </span>
                                      )}
                                    </div>
                                    {dropSnapshot.isDraggingOver && (
                                      <p className="mt-1 text-xs text-blue-600 font-medium">Vorgang hier ablegen zum Verknüpfen</p>
                                    )}
                                    {cf.current_status_note && !dropSnapshot.isDraggingOver && (
                                      <p className="mt-1 text-xs text-muted-foreground truncate">{cf.current_status_note}</p>
                                    )}
                                  </button>
                                  {dropProvided.placeholder}
                                </div>
                              )}
                            </Droppable>
                          );
                        })
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </DragDropContext>

          <CaseItemCreateDialog
            open={isCaseItemDialogOpen}
            onOpenChange={setIsCaseItemDialogOpen}
            onCreated={(id) => { void handleCaseItemCreated(id); }}
            createCaseItem={createCaseItem}
            assignees={teamUsers}
            defaultAssigneeId={defaultAssigneeId}
          />

          <CaseFileCreateDialog
            open={isCaseFileDialogOpen}
            onOpenChange={(open) => {
              setIsCaseFileDialogOpen(open);
              if (!open) setPendingCaseItemLinkId(null);
            }}
            onSuccess={(caseFile) => {
              void handleCaseFileCreated(caseFile.id);
              setIsCaseFileDialogOpen(false);
            }}
          />
        </>
      )}
    </>
  );
}
