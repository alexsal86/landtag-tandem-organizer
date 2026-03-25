import { type KeyboardEvent, useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useNotificationHighlight } from "@/hooks/useNotificationHighlight";
import { de } from "date-fns/locale";
import { Briefcase, CheckCircle2, Clock, FileText, FolderOpen, Gavel, Inbox, Mail, MessageSquare, Phone, Timer, UserRound, Users } from "lucide-react";
import type { DropResult } from "@hello-pangea/dnd";
import { CaseFileDetail } from "@/features/cases/files/components";
import { useCaseFileTypes } from "@/features/cases/files/hooks/useCaseFileTypes";
import type { CaseItemIntakePayload } from "@/features/cases/items/types";
import { useCaseItems } from "@/features/cases/items/hooks";
import { useAuth } from "@/hooks/useAuth";
import { useTenant } from "@/hooks/useTenant";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { debugConsole } from "@/utils/debugConsole";
import { useCaseWorkspaceData, type CaseFile, type CaseItem } from "@/components/my-work/hooks/useCaseWorkspaceData";
import { useCaseItemEdit, type CaseItemInteractionDocument, type TimelineEvent, type TimelineInteractionType, type TimelineDocumentAttachment } from "@/components/my-work/hooks/useCaseItemEdit";
import { DEFAULT_CASE_ITEM_CATEGORIES, useCaseItemCategories } from "@/hooks/useCaseItemCategories";
import { toEditorHtml } from "@/components/my-work/utils/editorContent";
import { CaseItemList, type CaseItemSortKey, type SortDirection } from "@/components/my-work/cases/workspace/CaseItemList";
import { CaseFileList } from "@/components/my-work/cases/workspace/CaseFileList";
import { CasesWorkspaceShell } from "@/components/my-work/cases/workspace/CasesWorkspaceShell";
import { CaseWorkspaceDialogs } from "@/components/my-work/cases/workspace/CaseWorkspaceDialogs";
import { formatDateSafe } from "@/components/my-work/cases/workspace/utils/dateFormatting";
import { getContactDetail, getContactName, parseContactPerson, parseInteractionDocuments } from "@/components/my-work/cases/workspace/utils/parsers";
import { normalizeRichTextValue, richTextToPlain } from "@/components/my-work/cases/workspace/utils/richText";
import { parseTimelineEvents, sanitizeTimelineNote, toTimeSafe } from "@/components/my-work/cases/workspace/utils/timeline";
import { CaseItemDetailPanel } from "@/components/my-work/CaseItemDetailPanel";
import type { TablesUpdate } from "@/integrations/supabase/types";
import type { CaseWorkspaceFilters, CaseWorkspaceSort } from "@/components/my-work/types";
type TimelineEntry = {
  id: string;
  timestamp: string;
  title: string;
  note?: string;
  safeNoteHtml?: string;
  documents?: TimelineDocumentAttachment[];
  accentClass: string;
  icon?: typeof Phone;
  canDelete?: boolean;
  onDelete?: () => void;
};


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

const interactionTypeOptions: Array<{ value: TimelineInteractionType; label: string; icon: typeof Phone }> = [
  { value: "anruf", label: "Anruf", icon: Phone },
  { value: "mail", label: "Mail", icon: Mail },
  { value: "treffen", label: "Treffen", icon: Users },
  { value: "dokument", label: "Dokument", icon: FileText },
  { value: "notiz", label: "Notiz", icon: MessageSquare },
];


const priorityOptions = [
  { value: "low", label: "Niedrig", color: "text-emerald-500" },
  { value: "medium", label: "Mittel", color: "text-amber-500" },
  { value: "high", label: "Hoch", color: "text-red-500" },
  { value: "urgent", label: "Dringend", color: "text-red-600" },
];

export function MyWorkCasesWorkspace() {
  const { user } = useAuth();
  const { currentTenant } = useTenant();
  const { data: configuredCaseItemCategories } = useCaseItemCategories();
  const tenantId = currentTenant?.id;
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { createCaseItem, deleteCaseItem } = useCaseItems();
  const { caseFileTypes } = useCaseFileTypes();
  const { isHighlighted, highlightRef } = useNotificationHighlight();

  const {
    caseItems,
    setCaseItems,
    caseFiles: allCaseFiles,
    caseFilesById,
    teamUsers,
    loading,
    refreshAll,
    hasMoreItems,
    hasMoreFiles,
    loadMoreItems,
    loadMoreFiles,
    loadingMoreItems,
    loadingMoreFiles,
  } = useCaseWorkspaceData({ tenantId, userId: user?.id });
  const [filters, setFilters] = useState<CaseWorkspaceFilters>({ itemQuery: "", fileQuery: "" });

  const categoryOptions = useMemo(() => {
    const configured = (configuredCaseItemCategories ?? [])
      .map((category) => category.label?.trim() || category.name?.trim())
      .filter((label): label is string => Boolean(label));

    return configured.length > 0 ? configured : [...DEFAULT_CASE_ITEM_CATEGORIES];
  }, [configuredCaseItemCategories]);

  const [isCaseItemDialogOpen, setIsCaseItemDialogOpen] = useState(false);
  const [isCaseFileDialogOpen, setIsCaseFileDialogOpen] = useState(false);
  const [pendingCaseItemLinkId, setPendingCaseItemLinkId] = useState<string | null>(null);

  const [detailItemId, setDetailItemId] = useState<string | null>(null);
  const [detailFileId, setDetailFileId] = useState<string | null>(null);
  const { editableCaseItem, setEditableCaseItem, updateEdit, appendTimelineEvent, deleteTimelineEvent } = useCaseItemEdit();
  const [itemSort, setItemSort] = useState<CaseWorkspaceSort>({
    primary: { key: "received", direction: "desc" },
    secondary: { enabled: false, direction: "asc" },
  });

  // Keyboard focus index for arrow/enter navigation (kept "inactive" until the user interacts)
  const [focusedItemIndex, setFocusedItemIndex] = useState<number>(-1);

  const runAsync = useCallback((action: () => Promise<unknown>) => {
    action().catch((error) => {
      debugConsole.error("Unerwarteter Fehler:", error);
      toast.error("Aktion konnte nicht ausgeführt werden.");
    });
  }, []);

  const applyItemOptimisticUpdate = useCallback(async (itemId: string, updater: (item: CaseItem) => CaseItem, persist: () => PromiseLike<{ error?: unknown } | null>, rollbackMessage: string) => {
    let snapshot: CaseItem[] = [];
    setCaseItems((current) => {
      snapshot = current;
      return current.map((row) => (row.id === itemId ? updater(row) : row));
    });

    const result = await persist();
    if (result?.error) {
      setCaseItems(snapshot);
      toast.error(rollbackMessage);
      return false;
    }
    return true;
  }, [setCaseItems]);

  // Decision integration types
  type LinkedDecision = {
    id: string;
    title: string;
    description: string | null;
    status: string;
    created_at: string;
    response_deadline: string | null;
    created_by: string | null;
    task_decision_participants: Array<{
      id: string;
      user_id: string;
      task_decision_responses: Array<{ id: string; response_type: string }>;
    }>;
  };

  // Decision integration state
  const [isDecisionCreatorOpen, setIsDecisionCreatorOpen] = useState(false);
  const [decisionCreatorItemId, setDecisionCreatorItemId] = useState<string | null>(null);
  const [linkedDecisions, setLinkedDecisions] = useState<Record<string, LinkedDecision[]>>({});
  const [loadingDecisions, setLoadingDecisions] = useState(false);

  // Jour Fixe meeting selector state
  const [isMeetingSelectorOpen, setIsMeetingSelectorOpen] = useState(false);
  const [meetingSelectorItemId, setMeetingSelectorItemId] = useState<string | null>(null);

  // Delete confirmation state
  const [deleteConfirmItemId, setDeleteConfirmItemId] = useState<string | null>(null);
  const [isItemArchiveOpen, setIsItemArchiveOpen] = useState(false);
  const [isFileArchiveOpen, setIsFileArchiveOpen] = useState(false);
  const [deleteConfirmCaseFileId, setDeleteConfirmCaseFileId] = useState<string | null>(null);

  const handleDeleteCaseItem = useCallback(async () => {
    if (!deleteConfirmItemId) return;
    const id = deleteConfirmItemId;
    setDeleteConfirmItemId(null);
    // If this item is open in detail, close it
    if (detailItemId === id) {
      setDetailItemId(null);
      setEditableCaseItem(null);
    }
    setCaseItems((current) => current.filter((row) => row.id !== id));
    await deleteCaseItem(id);
    toast.success("Vorgang gelöscht");
  }, [deleteConfirmItemId, detailItemId, setEditableCaseItem, setCaseItems, deleteCaseItem]);


  const handleArchiveCaseItem = useCallback(async (item: CaseItem) => {
    const nextStatus = item.status === "archiviert" ? "neu" : "archiviert";
    const ok = await applyItemOptimisticUpdate(
      item.id,
      (row) => ({ ...row, status: nextStatus }),
      () => supabase.from("case_items").update({ status: nextStatus }).eq("id", item.id),
      "Vorgang konnte nicht archiviert werden.",
    );
    if (!ok) return;
    if (nextStatus === "archiviert" && detailItemId === item.id) {
      setDetailItemId(null);
      setEditableCaseItem(null);
    }
    toast.success(nextStatus === "archiviert" ? "Vorgang archiviert." : "Vorgang wiederhergestellt.");
  }, [applyItemOptimisticUpdate, detailItemId, setEditableCaseItem]);

  const handleArchiveCaseFile = useCallback(async (caseFile: CaseFile) => {
    const nextStatus = caseFile.status === "archived" ? "active" : "archived";
    try {
      const { error } = await supabase.from("case_files").update({ status: nextStatus }).eq("id", caseFile.id);
      if (error) throw error;
      if (nextStatus === "archived") {
        setCaseItems((current) => current.map((item) => item.case_file_id === caseFile.id ? { ...item, case_file_id: null } : item));
        if (detailFileId === caseFile.id) setDetailFileId(null);
      }
      toast.success(nextStatus === "archived" ? "Fallakte archiviert." : "Fallakte wiederhergestellt.");
      await refreshAll();
    } catch (error) {
      debugConsole.error("Fallakte konnte nicht archiviert werden", error);
      toast.error("Fallakte konnte nicht archiviert werden.");
    }
  }, [detailFileId, refreshAll, setCaseItems]);


  const handleDeleteCaseFile = useCallback(async (caseFile: CaseFile) => {
    try {
      const { error } = await supabase.from("case_files").delete().eq("id", caseFile.id);
      if (error) throw error;
      setCaseItems((current) => current.map((item) => item.case_file_id === caseFile.id ? { ...item, case_file_id: null } : item));
      if (detailFileId === caseFile.id) setDetailFileId(null);
      toast.success("Fallakte gelöscht.");
      await refreshAll();
    } catch (error) {
      debugConsole.error("Fallakte konnte nicht gelöscht werden", error);
      toast.error("Fallakte konnte nicht gelöscht werden.");
    }
  }, [detailFileId, refreshAll, setCaseItems]);

  const getItemSubject = useCallback((item: CaseItem) => item.subject || item.summary || item.resolution_summary || "Ohne Titel", []);
  const getItemDescription = useCallback((item: CaseItem) => richTextToPlain(item.summary || item.resolution_summary || ""), []);

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

  // Load linked decisions for a case item
  const loadLinkedDecisions = useCallback(async (itemId: string) => {
    setLoadingDecisions(true);
    try {
      const { data, error } = await supabase
        .from("task_decisions")
        .select(`
          id,
          title,
          description,
          status,
          created_at,
          response_deadline,
          created_by,
          task_decision_participants (
            id,
            user_id,
            task_decision_responses (id, response_type)
          )
        `)
        .eq("case_item_id", itemId)
        .order("created_at", { ascending: false });

      if (!error) {
        setLinkedDecisions((prev) => ({
          ...prev,
          [itemId]: ((data ?? []) as unknown as LinkedDecision[]),
        }));
      }
    } catch (e) {
      debugConsole.error("Error loading linked decisions:", e);
    } finally {
      setLoadingDecisions(false);
    }
  }, []);

  // Load decisions when detail item changes
  useEffect(() => {
    if (detailItemId) {
      runAsync(() => loadLinkedDecisions(detailItemId));
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

  const activeCaseItems = useMemo(() => caseItems.filter((item) => item.status !== "archiviert"), [caseItems]);
  const archivedCaseItems = useMemo(() => caseItems.filter((item) => item.status === "archiviert"), [caseItems]);

  const filteredCaseItems = useMemo(() => {
    const query = filters.itemQuery.trim().toLowerCase();
    if (!query) return activeCaseItems;
    return activeCaseItems.filter((item) => {
      const linkedFile = item.case_file_id ? caseFilesById[item.case_file_id] : null;
      const category = getCategory(item);
      return [item.subject, item.summary, item.resolution_summary, item.source_channel, item.status, item.priority, category]
        .concat(linkedFile ? [linkedFile.title, linkedFile.reference_number] : [])
        .filter(Boolean)
        .some((v) => v!.toLowerCase().includes(query));
    });
  }, [activeCaseItems, caseFilesById, filters.itemQuery, getCategory]);

  const sortedCaseItems = useMemo(() => {
    const priorityRank: Record<string, number> = { low: 1, medium: 2, high: 3, urgent: 4 };
    const primaryDirectionFactor = itemSort.primary.direction === "asc" ? 1 : -1;
    const secondaryDirectionFactor = itemSort.secondary.direction === "asc" ? 1 : -1;

    return [...filteredCaseItems].sort((a, b) => {
      const aAssignee = getAssigneeIds(a).map((id) => teamUsers.find((member) => member.id === id)?.name || "").join(", ");
      const bAssignee = getAssigneeIds(b).map((id) => teamUsers.find((member) => member.id === id)?.name || "").join(", ");

      // Primary sort
      const aValue: string | number = {
        channel: sourceChannelMeta[a.source_channel || ""]?.label || a.source_channel || "",
        subject: getItemSubject(a),
        description: getItemDescription(a),
        status: statusOptions.find((option) => option.value === a.status)?.label || a.status || "Neu",
        received: toTimeSafe(a.source_received_at),
        due: toTimeSafe(a.due_at),
        category: getCategory(a),
        priority: priorityRank[a.priority || ""] || 0,
        assignee: aAssignee,
      }[itemSort.primary.key];

      const bValue: string | number = {
        channel: sourceChannelMeta[b.source_channel || ""]?.label || b.source_channel || "",
        subject: getItemSubject(b),
        description: getItemDescription(b),
        status: statusOptions.find((option) => option.value === b.status)?.label || b.status || "Neu",
        received: toTimeSafe(b.source_received_at),
        due: toTimeSafe(b.due_at),
        category: getCategory(b),
        priority: priorityRank[b.priority || ""] || 0,
        assignee: bAssignee,
      }[itemSort.primary.key];

      let primaryResult = 0;
      if (typeof aValue === "number" && typeof bValue === "number") {
        primaryResult = (aValue - bValue) * primaryDirectionFactor;
      } else {
        primaryResult = String(aValue).localeCompare(String(bValue), "de", { sensitivity: "base" }) * primaryDirectionFactor;
      }

      // If primary values are equal and secondary sort is enabled, sort by assignee
      if (primaryResult === 0 && itemSort.secondary.enabled) {
        return aAssignee.localeCompare(bAssignee, "de", { sensitivity: "base" }) * secondaryDirectionFactor;
      }

      return primaryResult;
    });
  }, [caseFilesById, filteredCaseItems, getAssigneeIds, getCategory, getItemDescription, getItemSubject, itemSort, teamUsers]);

  const toggleSort = useCallback((key: CaseItemSortKey, direction: SortDirection) => {
    setItemSort((prev) => 
      prev.primary.key === key && prev.primary.direction === direction 
        ? prev 
        : { ...prev, primary: { key, direction } }
    );
  }, []);

  const toggleSecondarySort = useCallback(() => {
    setItemSort((prev) => ({
      ...prev,
      secondary: { ...prev.secondary, enabled: !prev.secondary.enabled },
    }));
  }, []);

  const toggleSecondaryDirection = useCallback(() => {
    setItemSort((prev) => ({
      ...prev,
      secondary: {
        ...prev.secondary,
        direction: prev.secondary.direction === "asc" ? "desc" : "asc",
      },
    }));
  }, []);

  const isSortActive = useCallback(
    (key: CaseItemSortKey, direction: SortDirection) => 
      itemSort.primary.key === key && itemSort.primary.direction === direction,
    [itemSort.primary.direction, itemSort.primary.key],
  );

  const sortButtonClass = useCallback(
    (key: CaseItemSortKey, direction: SortDirection) => cn(
      "rounded p-0.5 opacity-0 transition-all group-hover:opacity-100 hover:bg-muted",
      isSortActive(key, direction) && "bg-primary/15 text-primary opacity-100",
    ),
    [isSortActive],
  );

  const activeCaseFiles = useMemo(() => allCaseFiles.filter((cf) => cf.status !== "archived"), [allCaseFiles]);
  const archivedCaseFiles = useMemo(() => allCaseFiles.filter((cf) => cf.status === "archived"), [allCaseFiles]);

  const filteredCaseFiles = useMemo(() => {
    const query = filters.fileQuery.trim().toLowerCase();
    if (!query) return activeCaseFiles;
    return activeCaseFiles.filter((cf) =>
      [cf.title, cf.reference_number, cf.status, cf.current_status_note, cf.case_type]
        .filter(Boolean)
        .some((v) => v!.toLowerCase().includes(query)),
    );
  }, [activeCaseFiles, filters.fileQuery]);

  const { recentCaseFiles, groupedCaseFiles } = useMemo(() => {
    const sorted = [...filteredCaseFiles].sort((a, b) =>
      new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()
    );
    const recent = sorted.slice(0, 5);
    const rest = sorted.slice(5);
    const groups: Record<string, CaseFile[]> = {};
    for (const cf of rest) {
      const key = cf.case_type || "sonstige";
      if (!groups[key]) groups[key] = [];
      groups[key].push(cf);
    }
    return { recentCaseFiles: recent, groupedCaseFiles: groups };
  }, [filteredCaseFiles]);

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

    await applyItemOptimisticUpdate(
      item.id,
      (row) => ({ ...row, owner_user_id: ownerUserId, intake_payload: payload }),
      () => supabase.from("case_items").update({ owner_user_id: ownerUserId, intake_payload: payload }).eq("id", item.id),
      "Zuweisung konnte nicht gespeichert werden.",
    );
  };

  const handleAssigneeToggle = async (item: CaseItem, memberId: string, checked: boolean) => {
    const current = getAssigneeIds(item);
    const next = checked ? Array.from(new Set([...current, memberId])) : current.filter((id) => id !== memberId);
    await persistAssignees(item, next);
  };

  // --- Quick action handlers ---

  const handleQuickStatusChange = async (item: CaseItem, newStatus: string) => {
    const ok = await applyItemOptimisticUpdate(
      item.id,
      (row) => ({ ...row, status: newStatus as CaseItem["status"] }),
      () => supabase.from("case_items").update({ status: newStatus }).eq("id", item.id),
      "Status konnte nicht geändert werden.",
    );
    if (ok) toast.success(`Status auf "${statusOptions.find((s) => s.value === newStatus)?.label || newStatus}" gesetzt.`);
  };

  const handleQuickPriorityChange = async (item: CaseItem, newPriority: string) => {
    const ok = await applyItemOptimisticUpdate(
      item.id,
      (row) => ({ ...row, priority: newPriority as CaseItem["priority"] }),
      () => supabase.from("case_items").update({ priority: newPriority }).eq("id", item.id),
      "Priorität konnte nicht geändert werden.",
    );
    if (ok) toast.success(`Priorität auf "${priorityOptions.find((p) => p.value === newPriority)?.label || newPriority}" gesetzt.`);
  };


  const handleQuickVisibilityChange = async (item: CaseItem, nextPublic: boolean) => {
    const ok = await applyItemOptimisticUpdate(
      item.id,
      (row) => ({ ...row, visible_to_all: nextPublic }),
      () => supabase.from("case_items").update({ visible_to_all: nextPublic }).eq("id", item.id),
      "Sichtbarkeit konnte nicht geändert werden.",
    );
    if (ok) toast.success(nextPublic ? "Vorgang ist jetzt öffentlich." : "Vorgang ist jetzt nicht öffentlich.");
  };

  const handleQuickLinkToFile = async (item: CaseItem, caseFileId: string) => {
    const ok = await applyItemOptimisticUpdate(
      item.id,
      (row) => ({ ...row, case_file_id: caseFileId }),
      () => supabase.from("case_items").update({ case_file_id: caseFileId }).eq("id", item.id),
      "Verknüpfung konnte nicht erstellt werden.",
    );
    if (!ok) return;
    const file = caseFilesById[caseFileId];
    toast.success(`Vorgang mit "${file?.title || "Akte"}" verknüpft.`);
  };

  const handleUnlinkFromFile = async (item: CaseItem) => {
    const ok = await applyItemOptimisticUpdate(
      item.id,
      (row) => ({ ...row, case_file_id: null }),
      () => supabase.from("case_items").update({ case_file_id: null }).eq("id", item.id),
      "Verknüpfung konnte nicht gelöst werden.",
    );
    if (ok) toast.success("Verknüpfung zur Akte gelöst.");
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
    runAsync(() => handleQuickLinkToFile(item, caseFileId));
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
      completedAt: formatDateSafe(item.completed_at, "yyyy-MM-dd", "", { warnKey: `${item.id}:completed_at`, warnItemId: item.id, warnField: "completed_at" }),
      sourceReceivedAt: formatDateSafe(item.source_received_at, "yyyy-MM-dd", "", { warnKey: `${item.id}:source_received_at`, warnItemId: item.id, warnField: "source_received_at" }),
      dueAt: formatDateSafe(item.due_at, "yyyy-MM-dd", "", { warnKey: `${item.id}:due_at`, warnItemId: item.id, warnField: "due_at" }),
      category: getCategory(item),
      priority: item.priority || "medium",
      assigneeIds: getAssigneeIds(item),
      visibleToAll: item.visible_to_all === true,
      timelineEvents: parseTimelineEvents(item.intake_payload),
      interactionDocuments: parseInteractionDocuments(item.intake_payload),
      interactionType: "",
      interactionContact: getContactDetail(item.intake_payload) || getContactName(item.intake_payload),
      interactionDateTime: "",
      interactionNote: "",
      contactPerson: [getContactName(item.intake_payload), getContactDetail(item.intake_payload)].filter(Boolean).join(" · "),
      contactEmail: (item.intake_payload as Record<string, unknown>)?.contact_email as string || "",
      contactPhone: (item.intake_payload as Record<string, unknown>)?.contact_phone as string || "",
      selectedContactId: ((item.intake_payload as Record<string, unknown>)?.matched_contact_id as string) || (item as Record<string, unknown>).contact_id as string || null,
    });
  };

  useEffect(() => {
    setFocusedItemIndex((prev) => {
      if (!sortedCaseItems.length) return -1;
      if (prev < 0) return -1;
      return Math.min(prev, sortedCaseItems.length - 1);
    });
  }, [sortedCaseItems.length]);

  const handleListKeyDown = useCallback((event: KeyboardEvent<HTMLDivElement>) => {
    if (!sortedCaseItems.length) return;

    if (event.key === "ArrowDown") {
      event.preventDefault();
      setFocusedItemIndex((prev) => (prev < 0 ? 0 : Math.min(prev + 1, sortedCaseItems.length - 1)));
      return;
    }

    if (event.key === "ArrowUp") {
      event.preventDefault();
      setFocusedItemIndex((prev) => (prev < 0 ? sortedCaseItems.length - 1 : Math.max(prev - 1, 0)));
      return;
    }

    if (event.key === "Enter") {
      event.preventDefault();
      const index = focusedItemIndex < 0 ? 0 : focusedItemIndex;
      const item = sortedCaseItems[index];
      if (item) handleSelectCaseItem(item);
    }
  }, [focusedItemIndex, sortedCaseItems]);

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
    await refreshAll();
    setDetailItemId(newCaseItemId);
  };

  const handleCaseFileCreated = async (newCaseFileId: string) => {
    if (pendingCaseItemLinkId) {
      await supabase
        .from("case_items")
        .update({ case_file_id: newCaseFileId, case_scale: "large" })
        .eq("id", pendingCaseItemLinkId);
    }
    await refreshAll();
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


  const formatInteractionTimestamp = useCallback((value: string) => {
    if (!value) return new Date().toISOString();
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) return new Date().toISOString();
    return parsed.toISOString();
  }, []);

  const handleAddInteraction = useCallback(async (files: File[] = []) => {
    if (!editableCaseItem) return;
    if (!editableCaseItem.interactionType) {
      toast.error("Bitte zuerst eine Interaktion auswählen.");
      return;
    }
    const typeMeta = interactionTypeOptions.find((opt) => opt.value === editableCaseItem.interactionType);
    const contact = editableCaseItem.interactionContact.trim();
    const fallbackTypeLabel = typeMeta?.label || "Interaktion";

    let title = fallbackTypeLabel;

    if (editableCaseItem.interactionType === "dokument") {
      if (!currentTenant?.id || !user?.id) {
        toast.error("Dokument-Upload ist aktuell nicht verfügbar.");
        return;
      }
      if (files.length === 0) {
        toast.error("Bitte mindestens ein Dokument auswählen.");
        return;
      }

      const uploaded: CaseItemInteractionDocument[] = [];
      for (const file of files) {
        const fileExt = file.name.split(".").pop();
        const storagePath = `${user.id}/${Date.now()}-${Math.random().toString(36).slice(2)}${fileExt ? `.${fileExt}` : ""}`;

        const { error: uploadError } = await supabase.storage.from("documents").upload(storagePath, file);
        if (uploadError) {
          toast.error(`Upload fehlgeschlagen: ${file.name}`);
          return;
        }

        const { data: documentRow, error: insertError } = await supabase
          .from("documents")
          .insert({
            user_id: user.id,
            tenant_id: currentTenant.id,
            title: file.name,
            file_name: file.name,
            file_path: storagePath,
            file_size: file.size,
            file_type: file.type || null,
          })
          .select("id, title, file_name, file_path")
          .single();

        if (insertError || !documentRow) {
          toast.error(`Dokument konnte nicht gespeichert werden: ${file.name}`);
          return;
        }

        uploaded.push({
          id: documentRow.id,
          title: documentRow.title,
          fileName: documentRow.file_name,
          filePath: documentRow.file_path,
          uploadedBy: user.id,
          uploadedByName: teamUsers.find((member) => member.id === user.id)?.name || null,
          uploadedAt: new Date().toISOString(),
          documentDate: editableCaseItem.interactionDateTime ? formatInteractionTimestamp(editableCaseItem.interactionDateTime) : null,
          shortText: normalizeRichTextValue(editableCaseItem.interactionNote),
        });
      }

      updateEdit({
        interactionDocuments: [...editableCaseItem.interactionDocuments, ...uploaded].sort((a, b) => a.title.localeCompare(b.title, "de", { sensitivity: "base" })),
      });
      toast.success(uploaded.length > 1 ? `${uploaded.length} Dokumente hinzugefügt.` : "Dokument hinzugefügt.");
    } else if (editableCaseItem.interactionType === "anruf") {
      title = `Telefonat mit ${contact || "unbekannt"}`;
    } else if (editableCaseItem.interactionType === "mail") {
      title = `E-Mail mit ${contact || "unbekannt"}`;
    } else if (contact) {
      title = `${fallbackTypeLabel} mit ${contact}`;
    }

    if (editableCaseItem.interactionType !== "dokument") {
      appendTimelineEvent({
        type: "interaktion",
        title,
        note: normalizeRichTextValue(editableCaseItem.interactionNote) || undefined,
        interactionType: editableCaseItem.interactionType,
        timestamp: formatInteractionTimestamp(editableCaseItem.interactionDateTime),
      });
    }
    updateEdit({ interactionContact: "", interactionDateTime: "", interactionNote: "" });
  }, [appendTimelineEvent, currentTenant?.id, editableCaseItem, formatInteractionTimestamp, teamUsers, updateEdit, user?.id]);

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
    setCaseItems((prev) => prev.map((row) => row.id === detailItemId ? { ...row, status: "entscheidung_abwartend" as CaseItem['status'] } : row));
    // Reload decisions for this item
    await loadLinkedDecisions(detailItemId);
  }, [detailItemId, editableCaseItem, getStatusMeta, loadLinkedDecisions, setCaseItems]);

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
    if (detailItemId) {
      setCaseItems((prev) => prev.map((row) => row.id === detailItemId ? { ...row, status: restoredStatus as CaseItem['status'] } : row));
    }
  }, [detailItemId, editableCaseItem, getStatusMeta, setCaseItems]);

  const timelineEntries = useMemo<TimelineEntry[]>(() => {
    if (!editableCaseItem) return [];
    const entries: TimelineEntry[] = [];
    if (editableCaseItem.sourceReceivedAt) {
      entries.push({
        id: "source-received",
        timestamp: `${editableCaseItem.sourceReceivedAt}T08:00:00`,
        title: "Eingang",
        accentClass: "bg-sky-500",
        icon: Inbox,
      });
    }
    if (editableCaseItem.dueAt) {
      entries.push({
        id: "due-at",
        timestamp: `${editableCaseItem.dueAt}T18:00:00`,
        title: "Frist",
        accentClass: "bg-amber-500",
        icon: Timer,
      });
    }

    entries.push(...editableCaseItem.timelineEvents.map((event) => ({
      id: event.id,
      timestamp: event.timestamp,
      title: event.title,
      note: event.note,
      safeNoteHtml: sanitizeTimelineNote(event.note),
      documents: event.documents,
      accentClass: "bg-primary",
      icon: event.type === "entscheidung" ? Gavel : interactionTypeOptions.find((option) => option.value === event.interactionType)?.icon,
      canDelete: true,
      onDelete: () => deleteTimelineEvent(event.id),
    })));

    if (detailItemId) {
      const currentUserId = user?.id || null;
      entries.push(
        ...(linkedDecisions[detailItemId] || []).map((decision) => {
          const participants = decision.task_decision_participants || [];
          const userParticipant = currentUserId ? participants.find((p) => p.user_id === currentUserId) ?? null : null;
          const userHasResponded = !currentUserId
            ? true
            : decision.created_by === currentUserId
              ? true
              : !userParticipant
                ? true
                : (userParticipant.task_decision_responses?.length ?? 0) > 0;

          return {
            id: `dec-${decision.id}`,
            timestamp: decision.created_at,
            title: `Entscheidung: ${decision.title}`,
            accentClass: "bg-muted",
            icon: userHasResponded ? CheckCircle2 : Clock,
          };
        }),
      );
    }

    return entries.sort((a, b) => toTimeSafe(a.timestamp) - toTimeSafe(b.timestamp));
  }, [deleteTimelineEvent, detailItemId, editableCaseItem, linkedDecisions, user?.id]);


  const handleDownloadInteractionDocument = useCallback(async (document: CaseItemInteractionDocument) => {
    const { data, error } = await supabase.storage.from("documents").download(document.filePath);
    if (error || !data) {
      toast.error("Dokument konnte nicht heruntergeladen werden.");
      return;
    }

    const url = URL.createObjectURL(data);
    const link = window.document.createElement("a");
    link.href = url;
    link.download = document.fileName || document.title || "dokument";
    window.document.body.appendChild(link);
    link.click();
    window.document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }, []);

  const handleRenameInteractionDocument = useCallback(async (documentId: string, title: string) => {
    if (!title.trim()) {
      toast.error("Bitte einen Dokumentnamen eingeben.");
      return;
    }

    const target = editableCaseItem?.interactionDocuments.find((doc) => doc.id === documentId);
    if (!target) return;

    const { error } = await supabase.from("documents").update({ title: title.trim() }).eq("id", documentId);
    if (error) {
      toast.error("Dokumentname konnte nicht aktualisiert werden.");
      return;
    }

    updateEdit({
      interactionDocuments: editableCaseItem!.interactionDocuments
        .map((doc) => (doc.id === documentId ? { ...doc, title: title.trim() } : doc))
        .sort((a, b) => a.title.localeCompare(b.title, "de", { sensitivity: "base" })),
    });
    toast.success("Dokumentname aktualisiert.");
  }, [editableCaseItem, updateEdit]);

  const handleDeleteInteractionDocument = useCallback(async (documentId: string) => {
    const target = editableCaseItem?.interactionDocuments.find((doc) => doc.id === documentId);
    if (!target) return;

    await supabase.storage.from("documents").remove([target.filePath]);
    const { error } = await supabase.from("documents").delete().eq("id", documentId);
    if (error) {
      toast.error("Dokument konnte nicht gelöscht werden.");
      return;
    }

    updateEdit({ interactionDocuments: editableCaseItem!.interactionDocuments.filter((doc) => doc.id !== documentId) });
    toast.success("Dokument gelöscht.");
  }, [editableCaseItem, updateEdit]);

  const handleUpdateInteractionDocumentMeta = useCallback((documentId: string, patch: { shortText?: string | null; documentDate?: string | null }) => {
    if (!editableCaseItem) return;
    updateEdit({
      interactionDocuments: editableCaseItem.interactionDocuments.map((doc) => (doc.id === documentId ? { ...doc, ...patch } : doc)),
    });
  }, [editableCaseItem, updateEdit]);

  const handleCaseItemSave = async () => {
    if (!detailItemId || !editableCaseItem) return;
    if (editableCaseItem.status === "erledigt" && (!editableCaseItem.completionNote.trim() || !editableCaseItem.completedAt)) {
      toast.error("Für den Status „Erledigt“ sind Abschlussnotiz und Abgeschlossen am Pflichtfelder.");
      return;
    }

    const { contactName: parsedName, contactDetail: parsedDetail } = parseContactPerson(editableCaseItem.contactPerson);

    const intakePayload: CaseItemIntakePayload = {
      ...(detailItem?.intake_payload || {}),
      category: editableCaseItem.category,
      assignee_ids: editableCaseItem.assigneeIds,
      timeline_events: editableCaseItem.timelineEvents,
      interaction_documents: editableCaseItem.interactionDocuments,
      contact_name: parsedName,
      contact_detail: parsedDetail,
      contact_email: editableCaseItem.contactEmail.trim() || null,
      contact_phone: editableCaseItem.contactPhone.trim() || null,
      matched_contact_id: editableCaseItem.selectedContactId,
    };

    const patch: TablesUpdate<"case_items"> = {
      subject: editableCaseItem.subject.trim() || null,
      summary: normalizeRichTextValue(editableCaseItem.summary),
      resolution_summary: normalizeRichTextValue(editableCaseItem.summary),
      status: editableCaseItem.status as TablesUpdate<"case_items">["status"],
      completion_note: editableCaseItem.completionNote.trim() || null,
      completed_at: editableCaseItem.completedAt ? new Date(`${editableCaseItem.completedAt}T12:00:00`).toISOString() : null,
      source_received_at: editableCaseItem.sourceReceivedAt ? new Date(`${editableCaseItem.sourceReceivedAt}T12:00:00`).toISOString() : null,
      due_at: editableCaseItem.dueAt ? new Date(`${editableCaseItem.dueAt}T12:00:00`).toISOString() : null,
      priority: editableCaseItem.priority as TablesUpdate<"case_items">["priority"],
      owner_user_id: editableCaseItem.assigneeIds[0] || null,
      visible_to_all: editableCaseItem.visibleToAll,
      intake_payload: intakePayload as unknown as TablesUpdate<"case_items">["intake_payload"],
      contact_id: editableCaseItem.selectedContactId || null,
      reporter_name: parsedName,
      reporter_contact: editableCaseItem.contactEmail.trim() || editableCaseItem.contactPhone.trim() || parsedDetail,
    };

    const ok = await applyItemOptimisticUpdate(
      detailItemId,
      (row) => ({ ...row, ...patch, intake_payload: intakePayload }),
      () => supabase.from("case_items").update(patch).eq("id", detailItemId),
      "Vorgang konnte nicht gespeichert werden.",
    );
    if (!ok) return;
    toast.success("Vorgang gespeichert.");
  };

  // --- Render ---

  if (loading) {
    return <div className="p-4 text-sm text-muted-foreground">Lade Fallbearbeitung…</div>;
  }

  const detailPanelForItem = (item: CaseItem, contactDisplay: string) => (
    <div className={cn("grid transition-all duration-300 ease-in-out", detailItemId === item.id && editableCaseItem ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0")}><div className="overflow-hidden">{detailItemId === item.id && editableCaseItem ? (
      <CaseItemDetailPanel
        itemId={item.id}
        itemCaseFileId={item.case_file_id}
        editableCaseItem={editableCaseItem}
        statusOptions={statusOptions.map(({ value, label }) => ({ value, label }))}
        categoryOptions={categoryOptions}
        teamUsers={teamUsers}
        currentUserId={user?.id || null}
        linkedDecisions={linkedDecisions[item.id] || []}
        loadingDecisions={loadingDecisions}
        timelineEntries={timelineEntries}
        toEditorHtml={toEditorHtml}
        caseFilesById={caseFilesById}
        onUpdate={updateEdit}
        onSave={() => runAsync(handleCaseItemSave)}
        onDecisionRequest={handleRequestDecision}
        onDecisionReceived={handleDecisionReceived}
        onAddInteraction={handleAddInteraction}
        onDownloadDocument={handleDownloadInteractionDocument}
        onRenameDocument={handleRenameInteractionDocument}
        onDeleteDocument={handleDeleteInteractionDocument}
        onUpdateDocumentMeta={handleUpdateInteractionDocumentMeta}
        onCreateCaseFile={handleCreateCaseFile}
        onNavigateToCaseFile={(caseFileId) => navigate(`/casefiles?caseFileId=${caseFileId}`)}
        contactDisplay={contactDisplay}
        onContactPersonChange={(value) => updateEdit({ contactPerson: value })}
        contactPerson={editableCaseItem.contactPerson}
        contactEmail={editableCaseItem.contactEmail}
        contactPhone={editableCaseItem.contactPhone}
        selectedContactId={editableCaseItem.selectedContactId}
        onContactEmailChange={(value) => updateEdit({ contactEmail: value })}
        onContactPhoneChange={(value) => updateEdit({ contactPhone: value })}
        onContactSelected={(contact) => updateEdit({ selectedContactId: contact?.id || null })}
        onArchive={() => runAsync(() => handleArchiveCaseItem(item))}
        archiveLabel={item.status === "archiviert" ? "Wiederherstellen" : "Archivieren"}
        onDelete={() => setDeleteConfirmItemId(item.id)}
      />
    ) : null}</div></div>
  );

  return (
    <>
      {detailFileId ? (
        <div className="rounded-lg border bg-card text-card-foreground shadow-sm">
          <div className="pt-6 px-6 pb-6">
            <CaseFileDetail caseFileId={detailFileId} onBack={() => setDetailFileId(null)} />
          </div>
        </div>
      ) : (
        <>
          <CasesWorkspaceShell
            onDragEnd={handleDragEnd}
            left={
              <CaseItemList
                itemFilterQuery={filters.itemQuery}
                onItemFilterQueryChange={(itemQuery) => setFilters((prev) => ({ ...prev, itemQuery }))}
                onCreateCaseItem={handleCreateCaseItem}
                onOpenArchive={() => setIsItemArchiveOpen(true)}
                helperText="Vorgänge per Drag & Drop auf eine Fallakte ziehen zum Verknüpfen"
                sortedCaseItems={sortedCaseItems}
                caseFilesById={caseFilesById}
                allCaseFiles={allCaseFiles}
                detailItemId={detailItemId}
                editableCaseItem={editableCaseItem}
                focusedItemIndex={focusedItemIndex}
                onListKeyDown={handleListKeyDown}
                sortButtonClass={sortButtonClass}
                toggleSort={toggleSort}
                itemSort={itemSort}
                toggleSecondarySort={toggleSecondarySort}
                toggleSecondaryDirection={toggleSecondaryDirection}
                getAssigneeIds={getAssigneeIds}
                teamUsers={teamUsers}
                getCategory={getCategory}
                getItemSubject={getItemSubject}
                getItemDescription={getItemDescription}
                getContactName={getContactName}
                getContactDetail={getContactDetail}
                sourceChannelMeta={sourceChannelMeta}
                getStatusMeta={getStatusMeta}
                priorityMeta={priorityMeta}
                getInitials={getInitials}
                isHighlighted={isHighlighted}
                highlightRef={highlightRef}
                handleSelectCaseItem={handleSelectCaseItem}
                runAsync={runAsync}
                handleAssigneeToggle={handleAssigneeToggle}
                statusOptions={[...statusOptions]}
                priorityOptions={priorityOptions}
                handleQuickStatusChange={handleQuickStatusChange}
                handleQuickPriorityChange={handleQuickPriorityChange}
                handleQuickVisibilityChange={handleQuickVisibilityChange}
                handleUnlinkFromFile={handleUnlinkFromFile}
                handleQuickLinkToFile={handleQuickLinkToFile}
                openDecisionCreator={(itemId) => { setDecisionCreatorItemId(itemId); setIsDecisionCreatorOpen(true); }}
                openMeetingSelector={(itemId) => { setMeetingSelectorItemId(itemId); setIsMeetingSelectorOpen(true); }}
                handleArchiveCaseItem={handleArchiveCaseItem}
                onDeleteCaseItem={setDeleteConfirmItemId}
                detailPanelForItem={detailPanelForItem}
                hasMoreItems={hasMoreItems}
                loadingMoreItems={loadingMoreItems}
                loadMoreItems={loadMoreItems}
              />
            }
            right={
              <CaseFileList
                fileFilterQuery={filters.fileQuery}
                onFileFilterQueryChange={(fileQuery) => setFilters((prev) => ({ ...prev, fileQuery }))}
                onCreateCaseFile={() => handleCreateCaseFile()}
                onOpenArchive={() => setIsFileArchiveOpen(true)}
                filteredCaseFiles={filteredCaseFiles}
                recentCaseFiles={recentCaseFiles}
                groupedCaseFiles={groupedCaseFiles}
                linkedItemsCountByFile={linkedItemsCountByFile}
                onSelectCaseFile={handleSelectCaseFile}
                onArchiveCaseFile={(cf) => runAsync(() => handleArchiveCaseFile(cf))}
                onDeleteCaseFile={(cf) => setDeleteConfirmCaseFileId(cf.id)}
                caseFileTypes={caseFileTypes}
                hasMoreFiles={hasMoreFiles}
                loadingMoreFiles={loadingMoreFiles}
                onLoadMoreFiles={() => runAsync(loadMoreFiles)}
              />
            }
          />

          <CaseWorkspaceDialogs
            isCaseItemDialogOpen={isCaseItemDialogOpen}
            setIsCaseItemDialogOpen={setIsCaseItemDialogOpen}
            onCaseItemCreated={(id) => { runAsync(() => handleCaseItemCreated(id)); }}
            createCaseItem={createCaseItem}
            teamUsers={teamUsers}
            defaultAssigneeId={defaultAssigneeId}
            categoryOptions={categoryOptions}
            isCaseFileDialogOpen={isCaseFileDialogOpen}
            onCaseFileDialogOpenChange={(open) => { setIsCaseFileDialogOpen(open); if (!open) setPendingCaseItemLinkId(null); }}
            onCaseFileCreated={(id) => { runAsync(() => handleCaseFileCreated(id)); setIsCaseFileDialogOpen(false); }}
            isDecisionCreatorOpen={isDecisionCreatorOpen}
            setIsDecisionCreatorOpen={(open) => { setIsDecisionCreatorOpen(open); if (!open) setDecisionCreatorItemId(null); }}
            decisionCreatorItemId={decisionCreatorItemId}
            caseItems={caseItems}
            onDecisionCreatorReload={() => { if (decisionCreatorItemId) runAsync(() => loadLinkedDecisions(decisionCreatorItemId)); }}
            onDecisionCreatedWithId={(decisionId) => { runAsync(() => handleDecisionCreated(decisionId)); }}
            isMeetingSelectorOpen={isMeetingSelectorOpen}
            setIsMeetingSelectorOpen={(open) => { setIsMeetingSelectorOpen(open); if (!open) setMeetingSelectorItemId(null); }}
            onMeetingSelected={async (meetingId, meetingTitle) => {
              if (!meetingSelectorItemId) return;
              const { error } = await supabase.from("case_items").update({ meeting_id: meetingId, pending_for_jour_fixe: false }).eq("id", meetingSelectorItemId);
              if (error) { toast.error("Fehler beim Zuordnen."); return; }
              setCaseItems((prev) => prev.map((i) => i.id === meetingSelectorItemId ? { ...i, meeting_id: meetingId, pending_for_jour_fixe: false } as CaseItem : i));
              toast.success(`Vorgang dem Meeting "${meetingTitle}" zugeordnet.`);
            }}
            onMarkForNextJourFixe={async () => {
              if (!meetingSelectorItemId) return;
              const { error } = await supabase.from("case_items").update({ pending_for_jour_fixe: true }).eq("id", meetingSelectorItemId);
              if (error) { toast.error("Fehler beim Vormerken."); return; }
              setCaseItems((prev) => prev.map((i) => i.id === meetingSelectorItemId ? { ...i, pending_for_jour_fixe: true } as CaseItem : i));
              toast.success("Vorgang für Jour Fixe vorgemerkt.");
            }}
            archivedCaseItems={archivedCaseItems.map((item) => ({ id: item.id, title: getItemSubject(item), subtitle: formatDateSafe(item.updated_at, "dd.MM.yyyy HH:mm", "–", { locale: de }), onRestore: () => runAsync(() => handleArchiveCaseItem(item)) }))}
            isItemArchiveOpen={isItemArchiveOpen}
            setIsItemArchiveOpen={setIsItemArchiveOpen}
            archivedCaseFiles={archivedCaseFiles.map((cf) => ({ id: cf.id, title: cf.title, subtitle: cf.reference_number || "Kein Aktenzeichen", onRestore: () => runAsync(() => handleArchiveCaseFile(cf)) }))}
            isFileArchiveOpen={isFileArchiveOpen}
            setIsFileArchiveOpen={setIsFileArchiveOpen}
            deleteCaseFile={{ open: deleteConfirmCaseFileId !== null, onOpenChange: (open) => { if (!open) setDeleteConfirmCaseFileId(null); }, onConfirm: () => { const caseFile = allCaseFiles.find((entry) => entry.id === deleteConfirmCaseFileId); if (caseFile) runAsync(() => handleDeleteCaseFile(caseFile)); setDeleteConfirmCaseFileId(null); } }}
            deleteCaseItem={{ open: !!deleteConfirmItemId, onOpenChange: (open) => { if (!open) setDeleteConfirmItemId(null); }, onConfirm: () => runAsync(handleDeleteCaseItem) }}
          />
        </>
      )}
    </>
  );

}
