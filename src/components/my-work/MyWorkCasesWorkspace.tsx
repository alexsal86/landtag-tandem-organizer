import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { format } from "date-fns";
import { de } from "date-fns/locale";
import { AlertCircle, ArrowDown, ArrowUp, Briefcase, Circle, ExternalLink, FileText, FolderOpen, Mail, MessageSquare, Phone, Plus, Search, UserRound } from "lucide-react";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DropdownMenu, DropdownMenuCheckboxItem, DropdownMenuContent, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CaseFileDetail, CaseFileCreateDialog } from "@/features/cases/files/components";
import { CaseItemCreateDialog } from "@/components/my-work/CaseItemCreateDialog";
import { useCaseItems } from "@/features/cases/items/hooks";
import { useAuth } from "@/hooks/useAuth";
import { useTenant } from "@/hooks/useTenant";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

type CaseItem = {
  id: string;
  subject: string | null;
  resolution_summary: string | null;
  summary: string | null;
  source_channel: string | null;
  source_received_at: string | null;
  status: string | null;
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
  sourceReceivedAt: string;
  dueAt: string;
  category: string;
  priority: string;
  assigneeIds: string[];
};

type CaseItemSortKey = "channel" | "subject" | "description" | "received" | "due" | "type" | "category" | "priority" | "assignee";
type SortDirection = "asc" | "desc";

const categoryOptions = ["Allgemein", "Bürgeranliegen", "Anfrage", "Beschwerde", "Termin", "Sonstiges"] as const;

const sourceChannelMeta: Record<string, { icon: typeof Phone; label: string }> = {
  phone: { icon: Phone, label: "Telefon" },
  email: { icon: Mail, label: "E-Mail" },
  social: { icon: MessageSquare, label: "Social" },
  in_person: { icon: UserRound, label: "Vor Ort" },
  other: { icon: Briefcase, label: "Sonstiges" },
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

  // Sheet states for detail views
  const [detailItemId, setDetailItemId] = useState<string | null>(null);
  const [detailFileId, setDetailFileId] = useState<string | null>(null);
  const [editableCaseItem, setEditableCaseItem] = useState<EditableCaseItem | null>(null);
  const [itemSort, setItemSort] = useState<{ key: CaseItemSortKey; direction: SortDirection }>({ key: "received", direction: "desc" });

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
      // Load case items and ALL case files in parallel
      const [itemsRes, filesRes, membersRes] = await Promise.all([
        supabase
          .from("case_items" as any)
          .select("id, subject, summary, resolution_summary, source_channel, source_received_at, status, priority, due_at, case_file_id, user_id, owner_user_id, intake_payload, updated_at")
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

  // --- Filtered lists ---

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
      const aLinkedFile = a.case_file_id ? caseFilesById[a.case_file_id] : null;
      const bLinkedFile = b.case_file_id ? caseFilesById[b.case_file_id] : null;
      const aAssignee = getAssigneeIds(a).map((id) => teamUsers.find((member) => member.id === id)?.name || "").join(", ");
      const bAssignee = getAssigneeIds(b).map((id) => teamUsers.find((member) => member.id === id)?.name || "").join(", ");

      const aValue: string | number = {
        channel: sourceChannelMeta[a.source_channel || ""]?.label || a.source_channel || "",
        subject: getItemSubject(a),
        description: getItemDescription(a),
        received: a.source_received_at ? new Date(a.source_received_at).getTime() : 0,
        due: a.due_at ? new Date(a.due_at).getTime() : 0,
        type: aLinkedFile ? `Akte: ${aLinkedFile.title}` : "Einzelvorgang",
        category: getCategory(a),
        priority: priorityRank[a.priority || ""] || 0,
        assignee: aAssignee,
      }[itemSort.key];

      const bValue: string | number = {
        channel: sourceChannelMeta[b.source_channel || ""]?.label || b.source_channel || "",
        subject: getItemSubject(b),
        description: getItemDescription(b),
        received: b.source_received_at ? new Date(b.source_received_at).getTime() : 0,
        due: b.due_at ? new Date(b.due_at).getTime() : 0,
        type: bLinkedFile ? `Akte: ${bLinkedFile.title}` : "Einzelvorgang",
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

  const filteredCaseFiles = useMemo(() => {
    const query = fileFilterQuery.trim().toLowerCase();
    if (!query) return allCaseFiles;
    return allCaseFiles.filter((cf) =>
      [cf.title, cf.reference_number, cf.status, cf.current_status_note, cf.case_type]
        .filter(Boolean)
        .some((v) => v!.toLowerCase().includes(query)),
    );
  }, [allCaseFiles, fileFilterQuery]);

  // Count linked items per case file
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

  // --- Handlers ---

  const handleSelectCaseItem = (item: CaseItem) => {
    setDetailItemId(item.id);
    setDetailFileId(null);
    setEditableCaseItem({
      subject: item.subject || "",
      summary: item.summary || item.resolution_summary || "",
      sourceReceivedAt: item.source_received_at ? format(new Date(item.source_received_at), "yyyy-MM-dd") : "",
      dueAt: item.due_at ? format(new Date(item.due_at), "yyyy-MM-dd") : "",
      category: getCategory(item),
      priority: item.priority || "medium",
      assigneeIds: getAssigneeIds(item),
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

  // --- Detail item for Sheet ---
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

  const handleCaseItemSave = async () => {
    if (!detailItemId || !editableCaseItem) return;
    await supabase
      .from("case_items")
      .update({
        subject: editableCaseItem.subject.trim() || null,
        summary: editableCaseItem.summary.trim() || null,
        resolution_summary: editableCaseItem.summary.trim() || null,
        source_received_at: editableCaseItem.sourceReceivedAt ? new Date(`${editableCaseItem.sourceReceivedAt}T12:00:00`).toISOString() : null,
        due_at: editableCaseItem.dueAt ? new Date(`${editableCaseItem.dueAt}T12:00:00`).toISOString() : null,
        priority: editableCaseItem.priority,
        owner_user_id: editableCaseItem.assigneeIds[0] || null,
        intake_payload: {
          ...(detailItem?.intake_payload || {}),
          category: editableCaseItem.category,
          assignee_ids: editableCaseItem.assigneeIds,
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
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,7fr)_minmax(0,3fr)]">
        {/* LEFT: Vorgänge */}
        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2 text-base">
                <FileText className="h-4 w-4" />
                Vorgänge
              </CardTitle>
              <Button size="sm" onClick={handleCreateCaseItem}>
                <Plus className="mr-1 h-4 w-4" />
                Neu
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="relative">
              <Search className="pointer-events-none absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                value={itemFilterQuery}
                onChange={(e) => setItemFilterQuery(e.target.value)}
                placeholder="Vorgänge filtern…"
                className="pl-8"
              />
            </div>
            <ScrollArea className="h-[520px] pr-2">
              <div className="space-y-1.5">
                {sortedCaseItems.length === 0 ? (
                  <div className="rounded-md border border-dashed p-4 text-sm text-muted-foreground space-y-3">
                    <p>Keine Vorgänge gefunden.</p>
                    <Button size="sm" onClick={handleCreateCaseItem}>Vorgang erstellen</Button>
                  </div>
                ) : (
                  <div className="space-y-1.5">
                    <div className="hidden grid-cols-[40px_minmax(180px,1.4fr)_minmax(140px,1.2fr)_1fr_1fr_1.4fr_1fr_52px_2fr] gap-2 border-b px-2 pb-1 text-[11px] font-medium uppercase tracking-wide text-muted-foreground lg:grid">
                      <span className="inline-flex items-center justify-center gap-1">
                        <button type="button" className="rounded p-0.5 hover:bg-muted" onClick={() => toggleSort("channel", "asc")} aria-label="Kanal aufsteigend sortieren"><ArrowUp className="h-3 w-3" /></button>
                        <button type="button" className="rounded p-0.5 hover:bg-muted" onClick={() => toggleSort("channel", "desc")} aria-label="Kanal absteigend sortieren"><ArrowDown className="h-3 w-3" /></button>
                      </span>
                      <span className="inline-flex items-center gap-1">Betreff<button type="button" className="rounded p-0.5 hover:bg-muted" onClick={() => toggleSort("subject", "asc")} aria-label="Betreff aufsteigend sortieren"><ArrowUp className="h-3 w-3" /></button><button type="button" className="rounded p-0.5 hover:bg-muted" onClick={() => toggleSort("subject", "desc")} aria-label="Betreff absteigend sortieren"><ArrowDown className="h-3 w-3" /></button></span>
                      <span className="inline-flex items-center gap-1">Beschreibung<button type="button" className="rounded p-0.5 hover:bg-muted" onClick={() => toggleSort("description", "asc")} aria-label="Beschreibung aufsteigend sortieren"><ArrowUp className="h-3 w-3" /></button><button type="button" className="rounded p-0.5 hover:bg-muted" onClick={() => toggleSort("description", "desc")} aria-label="Beschreibung absteigend sortieren"><ArrowDown className="h-3 w-3" /></button></span>
                      <span className="inline-flex items-center gap-1">Eingang<button type="button" className="rounded p-0.5 hover:bg-muted" onClick={() => toggleSort("received", "asc")} aria-label="Eingang aufsteigend sortieren"><ArrowUp className="h-3 w-3" /></button><button type="button" className="rounded p-0.5 hover:bg-muted" onClick={() => toggleSort("received", "desc")} aria-label="Eingang absteigend sortieren"><ArrowDown className="h-3 w-3" /></button></span>
                      <span className="inline-flex items-center gap-1">Fällig<button type="button" className="rounded p-0.5 hover:bg-muted" onClick={() => toggleSort("due", "asc")} aria-label="Fällig aufsteigend sortieren"><ArrowUp className="h-3 w-3" /></button><button type="button" className="rounded p-0.5 hover:bg-muted" onClick={() => toggleSort("due", "desc")} aria-label="Fällig absteigend sortieren"><ArrowDown className="h-3 w-3" /></button></span>
                      <span className="inline-flex items-center gap-1">Art<button type="button" className="rounded p-0.5 hover:bg-muted" onClick={() => toggleSort("type", "asc")} aria-label="Art aufsteigend sortieren"><ArrowUp className="h-3 w-3" /></button><button type="button" className="rounded p-0.5 hover:bg-muted" onClick={() => toggleSort("type", "desc")} aria-label="Art absteigend sortieren"><ArrowDown className="h-3 w-3" /></button></span>
                      <span className="inline-flex items-center gap-1">Kategorie<button type="button" className="rounded p-0.5 hover:bg-muted" onClick={() => toggleSort("category", "asc")} aria-label="Kategorie aufsteigend sortieren"><ArrowUp className="h-3 w-3" /></button><button type="button" className="rounded p-0.5 hover:bg-muted" onClick={() => toggleSort("category", "desc")} aria-label="Kategorie absteigend sortieren"><ArrowDown className="h-3 w-3" /></button></span>
                      <span className="inline-flex items-center justify-center gap-1"><button type="button" className="rounded p-0.5 hover:bg-muted" onClick={() => toggleSort("priority", "asc")} aria-label="Priorität aufsteigend sortieren"><ArrowUp className="h-3 w-3" /></button><button type="button" className="rounded p-0.5 hover:bg-muted" onClick={() => toggleSort("priority", "desc")} aria-label="Priorität absteigend sortieren"><ArrowDown className="h-3 w-3" /></button></span>
                      <span className="inline-flex items-center gap-1">Bearbeiter<button type="button" className="rounded p-0.5 hover:bg-muted" onClick={() => toggleSort("assignee", "asc")} aria-label="Bearbeiter aufsteigend sortieren"><ArrowUp className="h-3 w-3" /></button><button type="button" className="rounded p-0.5 hover:bg-muted" onClick={() => toggleSort("assignee", "desc")} aria-label="Bearbeiter absteigend sortieren"><ArrowDown className="h-3 w-3" /></button></span>
                    </div>
                    {sortedCaseItems.map((item) => {
                      const linkedFile = item.case_file_id ? caseFilesById[item.case_file_id] : null;
                      const isActive = detailItemId === item.id;
                      const channel = item.source_channel ? sourceChannelMeta[item.source_channel] : null;
                      const ChannelIcon = channel?.icon ?? Briefcase;
                      const assigneeIds = getAssigneeIds(item);
                      const assignees = assigneeIds.map((id) => teamUsers.find((member) => member.id === id)).filter(Boolean) as TeamUser[];
                      const category = getCategory(item);
                      return (
                      <button
                        key={item.id}
                        type="button"
                        className={cn(
                          "w-full border-b px-2 py-2 text-left transition-colors hover:bg-muted/40",
                          isActive && "bg-primary/5",
                        )}
                        onClick={() => handleSelectCaseItem(item)}
                      >
                        <div className="hidden h-12 grid-cols-[40px_minmax(180px,1.4fr)_minmax(140px,1.2fr)_1fr_1fr_1.4fr_1fr_52px_2fr] items-center gap-2 text-xs text-muted-foreground lg:grid">
                          <span className="inline-flex" title={channel?.label || "Kanal unbekannt"}>
                            <span className="rounded-sm bg-muted p-1 text-muted-foreground">
                              <ChannelIcon className="h-3 w-3" />
                            </span>
                          </span>
                          <span className="text-sm font-medium text-foreground truncate">{getItemSubject(item)}</span>
                          <span className="text-sm font-medium text-foreground truncate" title={getItemDescription(item) || "–"}>{getItemDescription(item) || "–"}</span>
                          <span>{item.source_received_at ? format(new Date(item.source_received_at), "dd.MM.yy", { locale: de }) : "–"}</span>
                          <span>{item.due_at ? format(new Date(item.due_at), "dd.MM.yy", { locale: de }) : "–"}</span>
                          <span className="truncate" title={linkedFile ? linkedFile.title : "Einzelvorgang"}>
                            {linkedFile ? `Akte: ${linkedFile.title}` : "Einzelvorgang"}
                          </span>
                          <span className={cn("truncate", !category && "text-amber-600")}>{category || "Pflichtfeld"}</span>
                          <span className="inline-flex items-center justify-center" title={priorityMeta(item.priority).label}>
                            <Circle className={cn("h-3.5 w-3.5 fill-current", priorityMeta(item.priority).color)} />
                          </span>
                          <div className="flex items-center gap-2 min-w-0" onClick={(event) => event.stopPropagation()}>
                            <div className="flex items-center -space-x-2">
                              {assignees.slice(0, 3).map((member) => (
                                <Avatar key={member.id} className="h-6 w-6 border bg-background">
                                  <AvatarImage src={member.avatarUrl || undefined} />
                                  <AvatarFallback className="text-[10px]">{getInitials(member.name)}</AvatarFallback>
                                </Avatar>
                              ))}
                            </div>
                            <span className="truncate">{assignees.length > 0 ? assignees.map((m) => m.name).join(", ") : "Nicht zugewiesen"}</span>
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
                          <p className="text-sm font-medium truncate">{item.subject || item.summary || item.resolution_summary || "Ohne Titel"}</p>
                          <p className="text-xs text-muted-foreground">{category || "Kategorie fehlt"}</p>
                        </div>
                      </button>
                    );
                    })}
                  </div>
                )}
              </div>
            </ScrollArea>
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
            <ScrollArea className="h-[520px] pr-2">
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
                      <button
                        key={cf.id}
                        type="button"
                        className="w-full border-b px-2 py-2 text-left transition-colors hover:bg-muted/40"
                        onClick={() => handleSelectCaseFile(cf)}
                      >
                        <p className="text-sm font-medium line-clamp-1">{cf.title}</p>
                        <div className="mt-1.5 flex items-center justify-between text-xs text-muted-foreground">
                          {cf.reference_number && <span>{cf.reference_number}</span>}
                          {linkedCount > 0 && (
                            <span>
                              <FileText className="inline h-3 w-3 mr-0.5" />
                              {linkedCount} {linkedCount === 1 ? "Vorgang" : "Vorgänge"}
                            </span>
                          )}
                        </div>
                        {cf.current_status_note && (
                          <p className="mt-1 text-xs text-muted-foreground truncate">{cf.current_status_note}</p>
                        )}
                      </button>
                    );
                  })
                )}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>
      </div>
      )}

      {/* Sheet: Vorgang Detail (from left) */}
      <Sheet open={!!detailItemId} onOpenChange={(open) => { if (!open) { setDetailItemId(null); setEditableCaseItem(null); } }}>
        <SheetContent side="left" className="w-full overflow-y-auto sm:max-w-lg">
          <SheetHeader>
            <SheetTitle className="flex items-center gap-2">
              <FileText className="h-4 w-4" />
              Vorgang
            </SheetTitle>
          </SheetHeader>
          {detailItem && editableCaseItem && (
            <div className="mt-4 space-y-4">
              <div className="space-y-2">
                <h3 className="font-semibold">Vorgang bearbeiten</h3>
                <div className="flex flex-wrap gap-2 text-xs">
                  {detailItem.status && <Badge variant="outline">{detailItem.status}</Badge>}
                  <Badge variant="secondary" className="inline-flex items-center gap-1"><Circle className={cn("h-3 w-3 fill-current", priorityMeta(editableCaseItem.priority).color)} /> {priorityMeta(editableCaseItem.priority).label}</Badge>
                  {detailItem.source_channel && <Badge variant="secondary">Kanal: {detailItem.source_channel}</Badge>}
                </div>
              </div>

              <div className="space-y-3 rounded-md border p-3">
                <div className="space-y-1.5">
                  <Label htmlFor="detail-subject">Betreff</Label>
                  <Input id="detail-subject" value={editableCaseItem.subject} onChange={(event) => setEditableCaseItem((prev) => prev ? { ...prev, subject: event.target.value } : prev)} />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="detail-summary">Beschreibung</Label>
                  <Input id="detail-summary" value={editableCaseItem.summary} onChange={(event) => setEditableCaseItem((prev) => prev ? { ...prev, summary: event.target.value } : prev)} />
                </div>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <Label htmlFor="detail-received">Eingangsdatum</Label>
                    <Input id="detail-received" type="date" value={editableCaseItem.sourceReceivedAt} onChange={(event) => setEditableCaseItem((prev) => prev ? { ...prev, sourceReceivedAt: event.target.value } : prev)} />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="detail-due">Fällig am</Label>
                    <Input id="detail-due" type="date" value={editableCaseItem.dueAt} onChange={(event) => setEditableCaseItem((prev) => prev ? { ...prev, dueAt: event.target.value } : prev)} />
                  </div>
                </div>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <Label>Kategorie *</Label>
                    <Select value={editableCaseItem.category} onValueChange={(value) => setEditableCaseItem((prev) => prev ? { ...prev, category: value } : prev)}>
                      <SelectTrigger><SelectValue placeholder="Kategorie auswählen" /></SelectTrigger>
                      <SelectContent>
                        {categoryOptions.map((category) => <SelectItem key={category} value={category}>{category}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label>Priorität</Label>
                    <Select value={editableCaseItem.priority} onValueChange={(value) => setEditableCaseItem((prev) => prev ? { ...prev, priority: value } : prev)}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="low">Niedrig</SelectItem>
                        <SelectItem value="medium">Mittel</SelectItem>
                        <SelectItem value="high">Hoch</SelectItem>
                        <SelectItem value="urgent">Dringend</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label>Bearbeiter (mehrfach)</Label>
                    <div className="rounded-md border px-3 py-2 text-sm">
                      {editableCaseItem.assigneeIds.length > 0
                        ? editableCaseItem.assigneeIds.map((id) => teamUsers.find((member) => member.id === id)?.name || id).join(", ")
                        : "Nicht zugewiesen"}
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {teamUsers.map((member) => {
                        const selected = editableCaseItem.assigneeIds.includes(member.id);
                        return (
                          <Button
                            key={member.id}
                            type="button"
                            size="sm"
                            variant={selected ? "default" : "outline"}
                            onClick={() => {
                              setEditableCaseItem((prev) => {
                                if (!prev) return prev;
                                const next = selected
                                  ? prev.assigneeIds.filter((id) => id !== member.id)
                                  : [...prev.assigneeIds, member.id];
                                return { ...prev, assigneeIds: Array.from(new Set(next)) };
                              });
                            }}
                          >
                            {member.name}
                          </Button>
                        );
                      })}
                    </div>
                  </div>
                </div>
                <Button disabled={!editableCaseItem.category} onClick={() => { void handleCaseItemSave(); }}>
                  Speichern
                </Button>
              </div>

              {detailItem.case_file_id && caseFilesById[detailItem.case_file_id] ? (
                <div className="space-y-2">
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Verknüpfte FallAkte</p>
                  <div className="rounded-md border p-3 text-sm">
                    <p className="font-semibold">{caseFilesById[detailItem.case_file_id].title}</p>
                    <ul className="mt-2 space-y-1 text-xs text-muted-foreground">
                      <li>• Status: {caseFilesById[detailItem.case_file_id].status || "offen"}</li>
                      {caseFilesById[detailItem.case_file_id].reference_number && <li>• Aktenzeichen: {caseFilesById[detailItem.case_file_id].reference_number}</li>}
                      {caseFilesById[detailItem.case_file_id].case_type && <li>• Typ: {caseFilesById[detailItem.case_file_id].case_type}</li>}
                      {caseFilesById[detailItem.case_file_id].current_status_note && <li>• Hinweis: {caseFilesById[detailItem.case_file_id].current_status_note}</li>}
                    </ul>
                  </div>
                  <Button size="sm" variant="outline" onClick={() => navigate(`/casefiles?caseFileId=${detailItem.case_file_id}`)}>
                    <ExternalLink className="mr-1 h-3.5 w-3.5" />
                    Vollansicht
                  </Button>
                </div>
              ) : (
                <div className="rounded-md border border-dashed p-4 text-sm text-muted-foreground space-y-3">
                  <AlertCircle className="h-4 w-4" />
                  <p>Keine Akte verknüpft.</p>
                  <div className="flex flex-wrap gap-2">
                    <Button size="sm" onClick={() => handleCreateCaseFile(detailItem.id)}>
                      Neue Akte anlegen
                    </Button>
                  </div>
                </div>
              )}
            </div>
          )}
        </SheetContent>
      </Sheet>

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
  );
}
