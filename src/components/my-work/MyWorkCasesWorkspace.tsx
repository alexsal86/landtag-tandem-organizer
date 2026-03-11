import { type KeyboardEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useNotificationHighlight } from "@/hooks/useNotificationHighlight";
import { format, type Locale } from "date-fns";
import { de } from "date-fns/locale";
import { ArrowDown, ArrowUp, Briefcase, CalendarDays, CheckCircle2, ChevronRight, Circle, Clock, FileText, FolderOpen, Gavel, Globe, GripVertical, Inbox, Link2, Mail, MessageSquare, Phone, Plus, Search, Timer, Trash2, UserRound, Users, Vote } from "lucide-react";
import { DragDropContext, Droppable, Draggable, type DropResult } from "@hello-pangea/dnd";
import { sanitizeRichHtml } from "@/utils/htmlSanitizer";
import { RichTextDisplay } from "@/components/ui/RichTextDisplay";
import { debugConsole } from '@/utils/debugConsole';

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ContextMenu, ContextMenuContent, ContextMenuItem, ContextMenuSeparator, ContextMenuSub, ContextMenuSubContent, ContextMenuSubTrigger, ContextMenuTrigger } from "@/components/ui/context-menu";
import { DropdownMenu, DropdownMenuCheckboxItem, DropdownMenuContent, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { CaseFileDetail, CaseFileCreateDialog } from "@/features/cases/files/components";
import { useCaseFileTypes } from "@/features/cases/files/hooks/useCaseFileTypes";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { CaseItemCreateDialog } from "@/components/my-work/CaseItemCreateDialog";
import { CaseItemMeetingSelector } from "@/components/my-work/CaseItemMeetingSelector";
import { StandaloneDecisionCreator } from "@/components/task-decisions/StandaloneDecisionCreator";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { CaseItemDetailPanel } from "@/components/my-work/CaseItemDetailPanel";
import { useCaseItems } from "@/features/cases/items/hooks";
import type { CaseItemIntakePayload } from "@/features/cases/items/types";
import { useAuth } from "@/hooks/useAuth";
import { useTenant } from "@/hooks/useTenant";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { useCaseWorkspaceData, type CaseFile, type CaseItem, type TeamUser } from "@/components/my-work/hooks/useCaseWorkspaceData";
import { useCaseItemEdit, type EditableCaseItem, type TimelineEvent, type TimelineInteractionType } from "@/components/my-work/hooks/useCaseItemEdit";






type TimelineEntry = {
  id: string;
  timestamp: string;
  title: string;
  note?: string;
  safeNoteHtml?: string;
  accentClass: string;
  icon?: typeof Phone;
  canDelete?: boolean;
  onDelete?: () => void;
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

const interactionTypeOptions: Array<{ value: TimelineInteractionType; label: string; icon: typeof Phone }> = [
  { value: "anruf", label: "Anruf", icon: Phone },
  { value: "mail", label: "Mail", icon: Mail },
  { value: "treffen", label: "Treffen", icon: Users },
  { value: "gespraech", label: "Gespräch", icon: MessageSquare },
  { value: "notiz", label: "Notiz", icon: FileText },
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

const richTextToPlain = (value: string | null | undefined): string => {
  if (!value) return "";
  return value
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/\s+/g, " ")
    .trim();
};

const sanitizeTimelineNote = (note: string | undefined) => {
  if (!note) return undefined;
  return sanitizeRichHtml(note);
};

const parseTimelineEvents = (payload: CaseItemIntakePayload | null): TimelineEvent[] => {
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
  return results.sort((a, b) => toTimeSafe(a.timestamp) - toTimeSafe(b.timestamp));
};



const getContactName = (payload: CaseItemIntakePayload | null): string => {
  const value = payload?.contact_name;
  return typeof value === "string" ? value : "";
};

const getContactDetail = (payload: CaseItemIntakePayload | null): string => {
  const value = payload?.contact_detail;
  return typeof value === "string" ? value : "";
};

const parseContactPerson = (value: string): { contactName: string | null; contactDetail: string | null } => {
  const trimmed = value.trim();
  if (!trimmed) return { contactName: null, contactDetail: null };

  const separators = [" · ", "|", ","];
  for (const separator of separators) {
    if (!trimmed.includes(separator)) continue;
    const parts = trimmed
      .split(separator)
      .map((part) => part.trim())
      .filter(Boolean);
    if (parts.length >= 2) {
      return {
        contactName: parts[0] || null,
        contactDetail: parts.slice(1).join(" ").trim() || null,
      };
    }
  }

  return { contactName: trimmed, contactDetail: null };
};

const loggedInvalidDateWarnings = new Set<string>();

const formatDateSafe = (
  value: string | number | Date | null | undefined,
  pattern: string,
  fallback = "–",
  options?: { locale?: Locale; warnKey?: string; warnItemId?: string; warnField?: string },
) => {
  if (!value) return fallback;
  const parsedDate = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(parsedDate.getTime())) {
    if (options?.warnKey && !loggedInvalidDateWarnings.has(options.warnKey)) {
      loggedInvalidDateWarnings.add(options.warnKey);
      debugConsole.warn("Invalid date in case workspace item", {
        itemId: options.warnItemId,
        field: options.warnField,
        value,
      });
    }
    return fallback;
  }
  return format(parsedDate, pattern, options?.locale ? { locale: options.locale } : undefined);
};

function toTimeSafe(value: string | null | undefined) {
  if (!value) return 0;
  const parsedDate = new Date(value);
  return Number.isNaN(parsedDate.getTime()) ? 0 : parsedDate.getTime();
}

const priorityOptions = [
  { value: "low", label: "Niedrig", color: "text-emerald-500" },
  { value: "medium", label: "Mittel", color: "text-amber-500" },
  { value: "high", label: "Hoch", color: "text-red-500" },
  { value: "urgent", label: "Dringend", color: "text-red-600" },
];

export function MyWorkCasesWorkspace() {
  const { user } = useAuth();
  const { currentTenant } = useTenant();
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
  const [itemFilterQuery, setItemFilterQuery] = useState("");
  const [fileFilterQuery, setFileFilterQuery] = useState("");

  const [isCaseItemDialogOpen, setIsCaseItemDialogOpen] = useState(false);
  const [isCaseFileDialogOpen, setIsCaseFileDialogOpen] = useState(false);
  const [pendingCaseItemLinkId, setPendingCaseItemLinkId] = useState<string | null>(null);

  const [detailItemId, setDetailItemId] = useState<string | null>(null);
  const [detailFileId, setDetailFileId] = useState<string | null>(null);
  const { editableCaseItem, setEditableCaseItem, updateEdit, appendTimelineEvent, deleteTimelineEvent } = useCaseItemEdit();
  const [itemSort, setItemSort] = useState<{
    primary: { key: CaseItemSortKey; direction: SortDirection };
    secondary: { enabled: boolean; direction: SortDirection };
  }>({
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

  const filteredCaseFiles = useMemo(() => {
    const query = fileFilterQuery.trim().toLowerCase();
    if (!query) return allCaseFiles;
    return allCaseFiles.filter((cf) =>
      [cf.title, cf.reference_number, cf.status, cf.current_status_note, cf.case_type]
        .filter(Boolean)
        .some((v) => v!.toLowerCase().includes(query)),
    );
  }, [allCaseFiles, fileFilterQuery]);

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
      () => supabase.from("case_items").update({ owner_user_id: ownerUserId, intake_payload: payload as any }).eq("id", item.id),
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
      () => supabase.from("case_items").update({ status: newStatus } as any).eq("id", item.id),
      "Status konnte nicht geändert werden.",
    );
    if (ok) toast.success(`Status auf "${statusOptions.find((s) => s.value === newStatus)?.label || newStatus}" gesetzt.`);
  };

  const handleQuickPriorityChange = async (item: CaseItem, newPriority: string) => {
    const ok = await applyItemOptimisticUpdate(
      item.id,
      (row) => ({ ...row, priority: newPriority as CaseItem["priority"] }),
      () => supabase.from("case_items").update({ priority: newPriority } as any).eq("id", item.id),
      "Priorität konnte nicht geändert werden.",
    );
    if (ok) toast.success(`Priorität auf "${priorityOptions.find((p) => p.value === newPriority)?.label || newPriority}" gesetzt.`);
  };


  const handleQuickVisibilityChange = async (item: CaseItem, nextPublic: boolean) => {
    const ok = await applyItemOptimisticUpdate(
      item.id,
      (row) => ({ ...row, visible_to_all: nextPublic }),
      () => supabase.from("case_items").update({ visible_to_all: nextPublic } as any).eq("id", item.id),
      "Sichtbarkeit konnte nicht geändert werden.",
    );
    if (ok) toast.success(nextPublic ? "Vorgang ist jetzt öffentlich." : "Vorgang ist jetzt nicht öffentlich.");
  };

  const handleQuickLinkToFile = async (item: CaseItem, caseFileId: string) => {
    const ok = await applyItemOptimisticUpdate(
      item.id,
      (row) => ({ ...row, case_file_id: caseFileId }),
      () => supabase.from("case_items").update({ case_file_id: caseFileId } as any).eq("id", item.id),
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
      () => supabase.from("case_items").update({ case_file_id: null } as any).eq("id", item.id),
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

  const handleAddInteraction = useCallback(() => {
    if (!editableCaseItem) return;
    if (!editableCaseItem.interactionType) {
      toast.error("Bitte zuerst eine Interaktion auswählen.");
      return;
    }
    const typeMeta = interactionTypeOptions.find((opt) => opt.value === editableCaseItem.interactionType);
    const contact = editableCaseItem.interactionContact.trim();
    const fallbackTypeLabel = typeMeta?.label || "Interaktion";

    let title = fallbackTypeLabel;
    if (editableCaseItem.interactionType === "anruf") {
      title = `Telefonat mit ${contact || "unbekannt"}`;
    } else if (editableCaseItem.interactionType === "mail") {
      title = `E-Mail mit ${contact || "unbekannt"}`;
    } else if (contact) {
      title = `${fallbackTypeLabel} mit ${contact}`;
    }

    appendTimelineEvent({
      type: "interaktion",
      title,
      note: normalizeRichTextValue(editableCaseItem.interactionNote) || undefined,
      interactionType: editableCaseItem.interactionType,
      timestamp: formatInteractionTimestamp(editableCaseItem.interactionDateTime),
    });
    updateEdit({ interactionContact: "", interactionDateTime: "", interactionNote: "" });
  }, [appendTimelineEvent, editableCaseItem, formatInteractionTimestamp, updateEdit]);

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
    setCaseItems((prev) => prev.map((row) => row.id === detailItemId ? { ...row, status: "entscheidung_abwartend" } : row));
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
      setCaseItems((prev) => prev.map((row) => row.id === detailItemId ? { ...row, status: restoredStatus } : row));
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
      contact_name: parsedName,
      contact_detail: parsedDetail,
      contact_email: editableCaseItem.contactEmail.trim() || null,
      contact_phone: editableCaseItem.contactPhone.trim() || null,
      matched_contact_id: editableCaseItem.selectedContactId,
    };

    const patch = {
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
      visible_to_all: editableCaseItem.visibleToAll,
      intake_payload: intakePayload as any,
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
                  <p className="text-xs text-muted-foreground mt-1">Vorgänge per Drag & Drop auf eine Fallakte ziehen zum Verknüpfen</p>
                </CardHeader>
                <CardContent className="space-y-3 pt-5 overflow-hidden">
                  <Droppable droppableId="case-items-list" isDropDisabled>
                    {(provided) => (
                      <div className="space-y-1.5 pr-2">
                        <div ref={provided.innerRef} {...provided.droppableProps} className="space-y-1.5" tabIndex={0} onKeyDown={handleListKeyDown}>
                          {sortedCaseItems.length === 0 ? (
                            <div className="rounded-md border border-dashed p-4 text-sm text-muted-foreground space-y-3">
                              <p>Keine Vorgänge gefunden.</p>
                              <Button size="sm" onClick={handleCreateCaseItem}>Vorgang erstellen</Button>
                            </div>
                          ) : (
                            <div className="space-y-1.5">
                              <div className="hidden xl:grid grid-cols-[28px_34px_minmax(220px,1.8fr)_minmax(380px,3.6fr)_72px_minmax(80px,0.7fr)_minmax(90px,0.7fr)_36px_44px_92px] gap-2 border-b px-2 pb-1 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                                <span />
                                <span className="group inline-flex items-center justify-center gap-0.5">
                                  <button type="button" className={sortButtonClass("channel", "asc")} onClick={() => toggleSort("channel", "asc")} aria-label="Kanal aufsteigend sortieren"><ArrowUp className="h-3 w-3" /></button>
                                  <button type="button" className={sortButtonClass("channel", "desc")} onClick={() => toggleSort("channel", "desc")} aria-label="Kanal absteigend sortieren"><ArrowDown className="h-3 w-3" /></button>
                                </span>
                                <span className="group inline-flex items-center gap-0.5">Betreff<button type="button" className={sortButtonClass("subject", "asc")} onClick={() => toggleSort("subject", "asc")} aria-label="Betreff aufsteigend sortieren"><ArrowUp className="h-3 w-3" /></button><button type="button" className={sortButtonClass("subject", "desc")} onClick={() => toggleSort("subject", "desc")} aria-label="Betreff absteigend sortieren"><ArrowDown className="h-3 w-3" /></button></span>
                                <span className="group inline-flex items-center gap-0.5">Beschreibung<button type="button" className={sortButtonClass("description", "asc")} onClick={() => toggleSort("description", "asc")} aria-label="Beschreibung aufsteigend sortieren"><ArrowUp className="h-3 w-3" /></button><button type="button" className={sortButtonClass("description", "desc")} onClick={() => toggleSort("description", "desc")} aria-label="Beschreibung absteigend sortieren"><ArrowDown className="h-3 w-3" /></button></span>
                                <span className="group inline-flex items-center gap-0.5">Fällig<button type="button" className={sortButtonClass("due", "asc")} onClick={() => toggleSort("due", "asc")} aria-label="Fällig aufsteigend sortieren"><ArrowUp className="h-3 w-3" /></button><button type="button" className={sortButtonClass("due", "desc")} onClick={() => toggleSort("due", "desc")} aria-label="Fällig absteigend sortieren"><ArrowDown className="h-3 w-3" /></button></span>
                                <span className="group inline-flex items-center gap-0.5">Kategorie<button type="button" className={sortButtonClass("category", "asc")} onClick={() => toggleSort("category", "asc")} aria-label="Kategorie aufsteigend sortieren"><ArrowUp className="h-3 w-3" /></button><button type="button" className={sortButtonClass("category", "desc")} onClick={() => toggleSort("category", "desc")} aria-label="Kategorie absteigend sortieren"><ArrowDown className="h-3 w-3" /></button></span>
                                <span className="group inline-flex items-center gap-0.5">Status<button type="button" className={sortButtonClass("status", "asc")} onClick={() => toggleSort("status", "asc")} aria-label="Status aufsteigend sortieren"><ArrowUp className="h-3 w-3" /></button><button type="button" className={sortButtonClass("status", "desc")} onClick={() => toggleSort("status", "desc")} aria-label="Status absteigend sortieren"><ArrowDown className="h-3 w-3" /></button></span>
                                <span className="group inline-flex items-center justify-center gap-0.5"><button type="button" className={sortButtonClass("priority", "asc")} onClick={() => toggleSort("priority", "asc")} aria-label="Priorität aufsteigend sortieren"><ArrowUp className="h-3 w-3" /></button><button type="button" className={sortButtonClass("priority", "desc")} onClick={() => toggleSort("priority", "desc")} aria-label="Priorität absteigend sortieren"><ArrowDown className="h-3 w-3" /></button></span>
                                <span className="inline-flex items-center justify-center">Öff./Akte</span>
                                <span className="group inline-flex items-center gap-0.5">
                                  Bearbeiter
                                  <button type="button" className={sortButtonClass("assignee", "asc")} onClick={() => toggleSort("assignee", "asc")} aria-label="Bearbeiter aufsteigend sortieren"><ArrowUp className="h-3 w-3" /></button>
                                  <button type="button" className={sortButtonClass("assignee", "desc")} onClick={() => toggleSort("assignee", "desc")} aria-label="Bearbeiter absteigend sortieren"><ArrowDown className="h-3 w-3" /></button>
                                  <TooltipProvider>
                                    <Tooltip>
                                      <TooltipTrigger asChild>
                                        <button
                                          type="button"
                                          className={cn(
                                            "rounded p-0.5 ml-1 transition-all hover:bg-muted",
                                            itemSort.secondary.enabled && "bg-primary/15 text-primary"
                                          )}
                                          onClick={toggleSecondarySort}
                                          aria-label="Als zweite Sortierung verwenden"
                                        >
                                          <Link2 className="h-3 w-3" />
                                        </button>
                                      </TooltipTrigger>
                                      <TooltipContent>
                                        <div className="text-xs">
                                          {itemSort.secondary.enabled ? (
                                            <>2. Sortierung nach Bearbeiter aktiv (deaktivieren)</>
                                          ) : (
                                            <>Als 2. Sortierung aktivieren</>
                                          )}
                                        </div>
                                      </TooltipContent>
                                    </Tooltip>
                                  </TooltipProvider>
                                  {itemSort.secondary.enabled && (
                                    <TooltipProvider>
                                      <Tooltip>
                                        <TooltipTrigger asChild>
                                          <button
                                            type="button"
                                            className={cn(
                                              "rounded p-0.5 transition-all hover:bg-muted",
                                              itemSort.secondary.direction === "asc" ? "bg-primary/15 text-primary" : "opacity-60"
                                            )}
                                            onClick={toggleSecondaryDirection}
                                            aria-label="Richtung der zweiten Sortierung wechseln"
                                          >
                                            {itemSort.secondary.direction === "asc" ? (
                                              <ArrowUp className="h-3 w-3" />
                                            ) : (
                                              <ArrowDown className="h-3 w-3" />
                                            )}
                                          </button>
                                        </TooltipTrigger>
                                        <TooltipContent>
                                          <div className="text-xs">
                                            2. Sortierung: {itemSort.secondary.direction === "asc" ? "A-Z" : "Z-A"}
                                          </div>
                                        </TooltipContent>
                                      </Tooltip>
                                    </TooltipProvider>
                                  )}
                                </span>
                              </div>
                              {sortedCaseItems.map((item, index) => {
                                const linkedFile = item.case_file_id ? caseFilesById[item.case_file_id] : null;
                                const isActive = detailItemId === item.id;
                                const channel = item.source_channel ? sourceChannelMeta[item.source_channel] : null;
                                const ChannelIcon = channel?.icon ?? Briefcase;
                                const assigneeIds = getAssigneeIds(item);
                                const assignees = assigneeIds.map((id) => teamUsers.find((member) => member.id === id)).filter(Boolean) as TeamUser[];
                                const category = getCategory(item);
                                const contactName = getContactName(item.intake_payload);
                                const contactDetail = getContactDetail(item.intake_payload);
                                const contactDisplay = [contactName, contactDetail].filter(Boolean).join(" · ");
                                const hasInlineDetail = isActive && editableCaseItem;
                                return (
                                  <Draggable key={item.id} draggableId={item.id} index={index}>
                                    {(dragProvided, dragSnapshot) => (
                                      <div
                                        ref={(el) => { dragProvided.innerRef(el); if (isHighlighted(item.id) && el) highlightRef(item.id)(el); }}
                                        {...dragProvided.draggableProps}
                                        className={cn("border-b outline-none focus:outline-none focus-visible:ring-0", dragSnapshot.isDragging && "opacity-80 shadow-lg rounded-md bg-background", isHighlighted(item.id) && "notification-highlight")}
                                      >
                                        <ContextMenu>
                                          <ContextMenuTrigger asChild>
                                            <button
                                              type="button"
                                              className={cn(
                                                "w-full px-2 py-2 text-left transition-colors hover:bg-muted/40",
                                                isActive && "bg-primary/5",
                                                focusedItemIndex >= 0 && focusedItemIndex === index && "ring-1 ring-primary/40",
                                              )}
                                              onClick={() => handleSelectCaseItem(item)}
                                            >
                                              <div className="hidden xl:grid h-12 grid-cols-[28px_34px_minmax(220px,1.8fr)_minmax(380px,3.6fr)_72px_minmax(80px,0.7fr)_minmax(90px,0.7fr)_36px_44px_92px] items-center gap-2 text-xs text-muted-foreground">
                                                {/* Drag handle */}
                                                <span
                                                  {...dragProvided.dragHandleProps}
                                                  className="inline-flex items-center justify-center cursor-grab text-muted-foreground/50 hover:text-muted-foreground"
                                                  onClick={(e) => e.stopPropagation()}
                                                >
                                                  <GripVertical className="h-4 w-4" />
                                                </span>
                                                <span className="inline-flex" title={channel?.label || "Kanal unbekannt"}>
                                                  <span className="flex h-7 w-7 items-center justify-center rounded-md bg-muted text-muted-foreground">
                                                    <ChannelIcon className="h-4 w-4" />
                                                  </span>
                                                </span>
                                                <span className="truncate text-sm font-medium text-foreground inline-flex items-center gap-1">
                                                  {getItemSubject(item)}
                                                </span>
                                                <span className="truncate text-sm font-medium text-foreground" title={getItemDescription(item) || "–"}>{getItemDescription(item) || "–"}</span>
                                                <span>{formatDateSafe(item.due_at, "dd.MM.yy", "–", { locale: de, warnKey: `${item.id}:due_at:list`, warnItemId: item.id, warnField: "due_at" })}</span>
                                                <span className={cn("truncate", !category && "text-amber-600")}>{category || "Pflichtfeld"}</span>
                                                <span>
                                                  <Badge variant="outline" className={cn("text-[11px]", getStatusMeta(item.status).badgeClass)}>
                                                    {getStatusMeta(item.status).label}
                                                  </Badge>
                                                </span>
                                                <span className="inline-flex items-center justify-center" title={priorityMeta(item.priority).label}>
                                                  <Circle className={cn("h-3.5 w-3.5 fill-current", priorityMeta(item.priority).color)} />
                                                </span>
                                                <span className="inline-flex items-center justify-center gap-0.5">
                                                  <span className="inline-flex h-4 w-4 items-center justify-center">
                                                    {item.visible_to_all && <Globe className="h-3.5 w-3.5 text-blue-500" />}
                                                  </span>
                                                  <span className="inline-flex h-4 w-4 items-center justify-center">
                                                    {linkedFile && (
                                                      <TooltipProvider delayDuration={200}>
                                                        <Tooltip>
                                                          <TooltipTrigger asChild>
                                                            <Link2 className="h-3.5 w-3.5 text-blue-500" />
                                                          </TooltipTrigger>
                                                          <TooltipContent side="top" className="text-xs">
                                                            <p className="font-medium">Ist Bestandteil der Akte „{linkedFile.title}“</p>
                                                            {linkedFile.reference_number && <p className="text-muted-foreground">{linkedFile.reference_number}</p>}
                                                          </TooltipContent>
                                                        </Tooltip>
                                                      </TooltipProvider>
                                                    )}
                                                  </span>
                                                </span>
                                                <div className="flex min-w-0 items-center" onClick={(event) => event.stopPropagation()}>
                                                    <div className="inline-flex items-end gap-1">
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
                                                          <Button type="button" size="icon" variant="outline" className="mt-1 h-6 w-6 rounded-full border bg-background p-0 shadow-sm">
                                                            <Plus className="h-3 w-3" />
                                                          </Button>
                                                        </DropdownMenuTrigger>
                                                      <DropdownMenuContent align="end" className="w-56">
                                                      {teamUsers.map((member) => (
                                                        <DropdownMenuCheckboxItem
                                                          key={member.id}
                                                          checked={assigneeIds.includes(member.id)}
                                                          onCheckedChange={(checked) => { runAsync(() => handleAssigneeToggle(item, member.id, checked === true)); }}
                                                        >
                                                          {member.name}
                                                        </DropdownMenuCheckboxItem>
                                                      ))}
                                                      </DropdownMenuContent>
                                                    </DropdownMenu>
                                                  </div>
                                                </div>
                                              </div>
                                              {/* Mobile/Tablet Card View */}
                                              <div className="space-y-3 xl:hidden">
                                                <div className="flex items-start justify-between gap-3">
                                                  <div className="flex-1 min-w-0">
                                                    <div className="flex items-center gap-2 mb-1">
                                                      <span className="flex h-7 w-7 items-center justify-center rounded-md bg-muted text-muted-foreground">
                                                        <ChannelIcon className="h-3 w-3" />
                                                      </span>
                                                      <p className="truncate text-sm font-medium flex-1">{getItemSubject(item)}</p>
                                                      {item.visible_to_all && <Globe className="h-3.5 w-3.5 text-blue-500 shrink-0" />}
                                                      {linkedFile && (
                                                        <TooltipProvider delayDuration={200}>
                                                          <Tooltip>
                                                            <TooltipTrigger asChild>
                                                              <Link2 className="h-3.5 w-3.5 text-blue-500 shrink-0" />
                                                            </TooltipTrigger>
                                                            <TooltipContent side="top" className="text-xs">
                                                              <p className="font-medium">„{linkedFile.title}"</p>
                                                              {linkedFile.reference_number && <p className="text-muted-foreground">{linkedFile.reference_number}</p>}
                                                            </TooltipContent>
                                                          </Tooltip>
                                                        </TooltipProvider>
                                                      )}
                                                    </div>
                                                    {getItemDescription(item) && (
                                                      <p className="text-xs text-muted-foreground line-clamp-2 mb-2">{getItemDescription(item)}</p>
                                                    )}
                                                    <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                                                      {category ? (
                                                        <Badge variant="outline" className="text-[10px] px-1.5 py-0">{category}</Badge>
                                                      ) : (
                                                        <Badge variant="outline" className="text-[10px] px-1.5 py-0 border-amber-500/40 text-amber-600">Kategorie fehlt</Badge>
                                                      )}
                                                      <Badge variant="outline" className={cn("text-[10px] px-1.5 py-0", getStatusMeta(item.status).badgeClass)}>
                                                        {getStatusMeta(item.status).label}
                                                      </Badge>
                                                      <span className="inline-flex items-center gap-1" title={priorityMeta(item.priority).label}>
                                                        <Circle className={cn("h-2.5 w-2.5 fill-current", priorityMeta(item.priority).color)} />
                                                      </span>
                                                      {contactDisplay && (
                                                        <span className="text-[10px]">👤 {contactDisplay}</span>
                                                      )}
                                                    </div>
                                                  </div>
                                                  <span
                                                    {...dragProvided.dragHandleProps}
                                                    className="inline-flex items-center justify-center cursor-grab text-muted-foreground/50 hover:text-muted-foreground pt-1"
                                                    onClick={(e) => e.stopPropagation()}
                                                  >
                                                    <GripVertical className="h-4 w-4" />
                                                  </span>
                                                </div>
                                                <div className="flex items-center justify-between gap-3 pt-2 border-t">
                                                  <div className="flex items-center gap-3 text-[11px] text-muted-foreground">
                                                    <span className="inline-flex items-center gap-1">
                                                      <Inbox className="h-3 w-3" />
                                                      {formatDateSafe(item.source_received_at, "dd.MM.yy", "–", { locale: de })}
                                                    </span>
                                                    {item.due_at && (
                                                      <span className="inline-flex items-center gap-1">
                                                        <Clock className="h-3 w-3" />
                                                        {formatDateSafe(item.due_at, "dd.MM.yy", "–", { locale: de })}
                                                      </span>
                                                    )}
                                                  </div>
                                                  <div className="flex items-center" onClick={(event) => event.stopPropagation()}>
                                                    <div className="inline-flex items-end gap-1">
                                                      <div className="flex items-center -space-x-2">
                                                        {assignees.slice(0, 2).map((member) => (
                                                          <Avatar key={member.id} className="h-6 w-6 border bg-background">
                                                            <AvatarImage src={member.avatarUrl || undefined} />
                                                            <AvatarFallback className="text-[10px]">{getInitials(member.name)}</AvatarFallback>
                                                          </Avatar>
                                                        ))}
                                                      </div>
                                                      <DropdownMenu>
                                                        <DropdownMenuTrigger asChild>
                                                          <Button type="button" size="icon" variant="outline" className="mt-1 h-6 w-6 rounded-full border bg-background p-0 shadow-sm">
                                                            <Plus className="h-3 w-3" />
                                                          </Button>
                                                        </DropdownMenuTrigger>
                                                      <DropdownMenuContent align="end" className="w-56">
                                                        {teamUsers.map((member) => (
                                                          <DropdownMenuCheckboxItem
                                                            key={member.id}
                                                            checked={assigneeIds.includes(member.id)}
                                                            onCheckedChange={(checked) => { runAsync(() => handleAssigneeToggle(item, member.id, checked === true)); }}
                                                          >
                                                            {member.name}
                                                          </DropdownMenuCheckboxItem>
                                                        ))}
                                                        </DropdownMenuContent>
                                                      </DropdownMenu>
                                                    </div>
                                                  </div>
                                                </div>
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
                                                    onClick={() => runAsync(() => handleQuickStatusChange(item, opt.value))}
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
                                                    onClick={() => runAsync(() => handleQuickPriorityChange(item, opt.value))}
                                                  >
                                                    <Circle className={cn("mr-2 h-3 w-3 fill-current", opt.color)} />
                                                    {opt.label}
                                                    {item.priority === opt.value && <span className="ml-auto text-xs text-muted-foreground">✓</span>}
                                                  </ContextMenuItem>
                                                ))}
                                              </ContextMenuSubContent>
                                            </ContextMenuSub>
                                            <ContextMenuItem onClick={() => runAsync(() => handleQuickVisibilityChange(item, !item.visible_to_all))}>
                                              <Globe className="mr-2 h-3 w-3" />
                                              {item.visible_to_all ? "Nicht öffentlich machen" : "Öffentlich machen"}
                                            </ContextMenuItem>
                                            <ContextMenuSeparator />
                                            {/* Link to file submenu */}
                                            <ContextMenuSub>
                                              <ContextMenuSubTrigger>Akte zuordnen</ContextMenuSubTrigger>
                                              <ContextMenuSubContent className="w-56 max-h-64 overflow-y-auto">
                                                {item.case_file_id && (
                                                  <>
                                                    <ContextMenuItem onClick={() => runAsync(() => handleUnlinkFromFile(item))} className="text-destructive">
                                                      Verknüpfung lösen
                                                    </ContextMenuItem>
                                                    <ContextMenuSeparator />
                                                  </>
                                                )}
                                                {allCaseFiles.slice(0, 20).map((cf) => (
                                                  <ContextMenuItem
                                                    key={cf.id}
                                                    className={cn(item.case_file_id === cf.id && "bg-accent")}
                                                    onClick={() => runAsync(() => handleQuickLinkToFile(item, cf.id))}
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
                                            <ContextMenuSeparator />
                                            <ContextMenuItem onClick={() => {
                                              setMeetingSelectorItemId(item.id);
                                              setIsMeetingSelectorOpen(true);
                                            }}>
                                              <CalendarDays className="mr-2 h-3 w-3" />
                                              Zum Jour Fixe hinzufügen
                                            </ContextMenuItem>
                                            <ContextMenuSeparator />
                                            <ContextMenuItem
                                              className="text-destructive focus:text-destructive"
                                              onClick={() => setDeleteConfirmItemId(item.id)}
                                            >
                                              <Trash2 className="mr-2 h-3 w-3" />
                                              Vorgang löschen
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
                                                onContactSelected={(contact) => updateEdit({
                                                  selectedContactId: contact?.id || null,
                                                })}
                                                onDelete={() => setDeleteConfirmItemId(item.id)}
                                              />
                                            )}
                                          </div>
                                       </div>
                                      </div>
                                    )}
                                  </Draggable>
                                );
                              })}
                              {hasMoreItems && (
                                <div className="pt-2">
                                  <Button type="button" variant="outline" size="sm" disabled={loadingMoreItems} onClick={() => runAsync(loadMoreItems)}>
                                    {loadingMoreItems ? "Lade weitere Vorgänge…" : "Weitere Vorgänge laden"}
                                  </Button>
                                </div>
                              )}
                            </div>
                          )}
                          {provided.placeholder}
                        </div>
                      </div>
                    )}
                  </Droppable>
                </CardContent>
              </Card>

              {/* RIGHT: Fallakten */}
              <Card>
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <CardTitle className="flex items-center gap-2 text-base">
                      <FolderOpen className="h-4 w-4" />
                      Fallakten
                    </CardTitle>
                    <div className="flex items-center gap-2">
                      <Button size="sm" onClick={() => handleCreateCaseFile()}>
                        <Plus className="mr-1 h-4 w-4" />
                        Neu
                      </Button>
                      <div className="relative">
                        <Search className="pointer-events-none absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                        <Input
                          value={fileFilterQuery}
                          onChange={(e) => setFileFilterQuery(e.target.value)}
                          placeholder="Filtern…"
                          className="pl-8 h-8 w-36"
                        />
                      </div>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="space-y-1.5 pr-2">
                    {filteredCaseFiles.length === 0 ? (
                      <div className="rounded-md border border-dashed p-4 text-sm text-muted-foreground space-y-3">
                        <p>Keine Fallakten gefunden.</p>
                        <Button size="sm" onClick={() => handleCreateCaseFile()}>Fallakte erstellen</Button>
                      </div>
                    ) : (
                      <>
                        {/* Zuletzt bearbeitet */}
                        {recentCaseFiles.length > 0 && (
                          <div className="space-y-1.5">
                            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide px-1">Zuletzt bearbeitet</p>
                            {recentCaseFiles.map((cf) => {
                              const linkedCount = linkedItemsCountByFile[cf.id] || 0;
                              return (
                                <Droppable key={cf.id} droppableId={`casefile-${cf.id}`}>
                                  {(dropProvided, dropSnapshot) => (
                                    <div ref={dropProvided.innerRef} {...dropProvided.droppableProps}>
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
                                        </div>
                                        <div className="mt-1.5 flex items-center justify-between text-xs text-muted-foreground">
                                          <div className="flex items-center gap-2">
                                            {cf.reference_number && <span>{cf.reference_number}</span>}
                                          </div>
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
                                          <div className="mt-1 [&_p]:line-clamp-1">
                                            <RichTextDisplay content={cf.current_status_note} className="text-xs" />
                                          </div>
                                        )}
                                      </button>
                                      {dropProvided.placeholder}
                                    </div>
                                  )}
                                </Droppable>
                              );
                            })}
                          </div>
                        )}

                        {/* Gruppiert nach Typ */}
                        {Object.entries(groupedCaseFiles).map(([typeKey, files]) => {
                          const typeConfig = caseFileTypes.find(t => t.name === typeKey);
                          const label = typeConfig?.label || typeKey;
                          return (
                            <Collapsible key={typeKey}>
                              <CollapsibleTrigger className="flex items-center gap-1.5 w-full px-1 py-1.5 text-xs font-semibold text-muted-foreground uppercase tracking-wide hover:text-foreground transition-colors group">
                                <ChevronRight className="h-3.5 w-3.5 transition-transform group-data-[state=open]:rotate-90" />
                                {typeConfig?.color && (
                                  <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: typeConfig.color }} />
                                )}
                                {label} ({files.length})
                              </CollapsibleTrigger>
                              <CollapsibleContent className="space-y-1.5 mt-1">
                                {files.map((cf) => {
                                  const linkedCount = linkedItemsCountByFile[cf.id] || 0;
                                  return (
                                    <Droppable key={cf.id} droppableId={`casefile-${cf.id}`}>
                                      {(dropProvided, dropSnapshot) => (
                                        <div ref={dropProvided.innerRef} {...dropProvided.droppableProps}>
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
                                            </div>
                                            <div className="mt-1.5 flex items-center justify-between text-xs text-muted-foreground">
                                              <div className="flex items-center gap-2">
                                                {cf.reference_number && <span>{cf.reference_number}</span>}
                                              </div>
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
                                              <div className="mt-1 [&_p]:line-clamp-1">
                                                <RichTextDisplay content={cf.current_status_note} className="text-xs" />
                                              </div>
                                            )}
                                          </button>
                                          {dropProvided.placeholder}
                                        </div>
                                      )}
                                    </Droppable>
                                  );
                                })}
                              </CollapsibleContent>
                            </Collapsible>
                          );
                        })}
                      </>
                    )}
                    {hasMoreFiles && (
                      <Button type="button" variant="outline" size="sm" disabled={loadingMoreFiles} onClick={() => runAsync(loadMoreFiles)}>
                        {loadingMoreFiles ? "Lade weitere Fallakten…" : "Weitere Fallakten laden"}
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            </div>
          </DragDropContext>

          <CaseItemCreateDialog
            open={isCaseItemDialogOpen}
            onOpenChange={setIsCaseItemDialogOpen}
            onCreated={(id) => { runAsync(() => handleCaseItemCreated(id)); }}
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
              runAsync(() => handleCaseFileCreated(caseFile.id));
              setIsCaseFileDialogOpen(false);
            }}
          />

          {isDecisionCreatorOpen && (
            <StandaloneDecisionCreator
              isOpen={isDecisionCreatorOpen}
              onOpenChange={(open) => {
                setIsDecisionCreatorOpen(open);
                if (!open) setDecisionCreatorItemId(null);
              }}
              onDecisionCreated={() => {
                if (decisionCreatorItemId) runAsync(() => loadLinkedDecisions(decisionCreatorItemId));
              }}
              caseItemId={decisionCreatorItemId || undefined}
              defaultTitle={decisionCreatorItemId ? (caseItems.find(i => i.id === decisionCreatorItemId)?.subject || "") : ""}
              defaultDescription={decisionCreatorItemId ? (caseItems.find(i => i.id === decisionCreatorItemId)?.summary || "") : ""}
              onCreatedWithId={(decisionId) => {
                runAsync(() => handleDecisionCreated(decisionId));
              }}
            />
          )}

          <CaseItemMeetingSelector
            open={isMeetingSelectorOpen}
            onOpenChange={(open) => {
              setIsMeetingSelectorOpen(open);
              if (!open) setMeetingSelectorItemId(null);
            }}
            onSelect={async (meetingId, meetingTitle) => {
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
          />
        </>
      )}

      <AlertDialog open={!!deleteConfirmItemId} onOpenChange={(open) => { if (!open) setDeleteConfirmItemId(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Vorgang endgültig löschen?</AlertDialogTitle>
            <AlertDialogDescription>
              Dieser Vorgang wird unwiderruflich gelöscht. Verknüpfte Zeitstrahlereignisse und Interaktionen gehen ebenfalls verloren.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Abbrechen</AlertDialogCancel>
            <AlertDialogAction onClick={() => runAsync(handleDeleteCaseItem)} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Löschen
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
