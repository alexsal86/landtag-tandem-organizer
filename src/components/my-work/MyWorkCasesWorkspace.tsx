import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { format } from "date-fns";
import { de } from "date-fns/locale";
import { Briefcase, ExternalLink, FileText, FolderOpen, Mail, MessageSquare, Phone, Plus, Search, UserRound } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
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
};

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
          .select("id, subject, summary, resolution_summary, source_channel, source_received_at, status, priority, due_at, case_file_id, user_id, owner_user_id, updated_at")
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
          .select("user_id, display_name")
          .in("user_id", memberIds);
        if (profilesError) throw profilesError;

        const nameById = new Map((profileRows || []).map((row) => [row.user_id, row.display_name || "Unbekannt"]));
        setTeamUsers(memberIds.map((id) => ({ id, name: nameById.get(id) || "Unbekannt" })));
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

  const filteredCaseItems = useMemo(() => {
    const query = itemFilterQuery.trim().toLowerCase();
    if (!query) return caseItems;
    return caseItems.filter((item) => {
      const linkedFile = item.case_file_id ? caseFilesById[item.case_file_id] : null;
      return [item.subject, item.summary, item.resolution_summary, item.source_channel, item.status, item.priority]
        .concat(linkedFile ? [linkedFile.title, linkedFile.reference_number] : [])
        .filter(Boolean)
        .some((v) => v!.toLowerCase().includes(query));
    });
  }, [caseFilesById, caseItems, itemFilterQuery]);

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

  const handleOwnerChange = async (caseItemId: string, ownerId: string) => {
    const value = ownerId === "unassigned" ? null : ownerId;
    await supabase.from("case_items").update({ owner_user_id: value }).eq("id", caseItemId);
    setCaseItems((prev) => prev.map((item) => (item.id === caseItemId ? { ...item, owner_user_id: value } : item)));
  };

  const fileStats = useMemo(() => {
    const closedStatuses = new Set(["closed", "done", "abgeschlossen", "archived", "archiviert"]);
    const active = filteredCaseFiles.filter((cf) => {
      const s = cf.status?.trim().toLowerCase();
      return !s || !closedStatuses.has(s);
    }).length;
    return { total: filteredCaseFiles.length, active };
  }, [filteredCaseFiles]);

  // --- Handlers ---

  const handleSelectCaseItem = (item: CaseItem) => {
    setDetailItemId(item.id);
    setDetailFileId(null);
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


  // --- Render ---

  if (loading) {
    return <div className="p-4 text-sm text-muted-foreground">Lade Fallbearbeitung…</div>;
  }

  return (
    <>
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
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
                {filteredCaseItems.length === 0 ? (
                  <div className="rounded-md border border-dashed p-4 text-sm text-muted-foreground space-y-3">
                    <p>Keine Vorgänge gefunden.</p>
                    <Button size="sm" onClick={handleCreateCaseItem}>Vorgang erstellen</Button>
                  </div>
                ) : (
                  filteredCaseItems.map((item) => {
                    const linkedFile = item.case_file_id ? caseFilesById[item.case_file_id] : null;
                    const isActive = detailItemId === item.id;
                    const channel = item.source_channel ? sourceChannelMeta[item.source_channel] : null;
                    const ChannelIcon = channel?.icon ?? Briefcase;
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
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex items-start gap-2 min-w-0">
                            <span className="mt-0.5 rounded-sm bg-muted p-1 text-muted-foreground" title={channel?.label || "Kanal unbekannt"}>
                              <ChannelIcon className="h-3 w-3" />
                            </span>
                            <p className="text-sm font-medium line-clamp-1">
                              {item.subject || item.summary || item.resolution_summary || "Ohne Titel"}
                            </p>
                          </div>
                          {item.priority && <Badge variant="outline" className="shrink-0 text-[10px]">{item.priority}</Badge>}
                        </div>
                        <div className="mt-1.5 grid grid-cols-1 gap-2 text-xs text-muted-foreground sm:grid-cols-2 lg:grid-cols-5">
                          <span>Status: {item.status || "offen"}</span>
                          <span>{item.source_received_at ? `Eingang: ${format(new Date(item.source_received_at), "dd.MM.yy", { locale: de })}` : "Eingang: –"}</span>
                          <span>{item.due_at ? `Fällig: ${format(new Date(item.due_at), "dd.MM.yy", { locale: de })}` : "Fällig: –"}</span>
                          <span className="truncate" title={item.summary || item.resolution_summary || ""}>Thema: {item.summary || item.resolution_summary || "–"}</span>
                          <div className="flex items-center gap-2" onClick={(event) => event.stopPropagation()}>
                            <span>Bearbeiter:</span>
                            <Select value={item.owner_user_id || "unassigned"} onValueChange={(value) => { void handleOwnerChange(item.id, value); }}>
                              <SelectTrigger className="h-7 w-[170px] text-xs">
                                <SelectValue placeholder="Bearbeiter" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="unassigned">Nicht zugewiesen</SelectItem>
                                {teamUsers.map((member) => (
                                  <SelectItem key={member.id} value={member.id}>{member.name}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                        </div>
                        {linkedFile ? (
                          <p className="mt-1 text-xs text-muted-foreground truncate">
                            <FolderOpen className="inline h-3 w-3 mr-0.5" />
                            {linkedFile.title}
                            {linkedFile.reference_number && <span className="ml-1 opacity-70">({linkedFile.reference_number})</span>}
                          </p>
                        ) : (
                          <p className="mt-1 text-xs text-amber-700 dark:text-amber-400">Einzelvorgang</p>
                        )}
                      </button>
                    );
                  })
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
            <div className="mt-2 flex gap-3 text-xs">
              <span className="rounded-md border px-2 py-1">
                <span className="text-muted-foreground">Gesamt:</span>{" "}
                <span className="font-semibold">{fileStats.total}</span>
              </span>
              <span className="rounded-md border px-2 py-1">
                <span className="text-muted-foreground">Aktiv:</span>{" "}
                <span className="font-semibold">{fileStats.active}</span>
              </span>
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
                    const isActive = detailFileId === cf.id;
                    const linkedCount = linkedItemsCountByFile[cf.id] || 0;
                    return (
                      <button
                        key={cf.id}
                        type="button"
                        className={cn(
                          "w-full border-b px-2 py-2 text-left transition-colors hover:bg-muted/40",
                          isActive && "bg-primary/5",
                        )}
                        onClick={() => handleSelectCaseFile(cf)}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <p className="text-sm font-medium line-clamp-1">{cf.title}</p>
                          <Badge variant="outline" className="shrink-0 text-[10px]">{cf.status || "offen"}</Badge>
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

      {/* Sheet: Vorgang Detail (from left) */}
      <Sheet open={!!detailItemId} onOpenChange={(open) => { if (!open) setDetailItemId(null); }}>
        <SheetContent side="left" className="w-full overflow-y-auto sm:max-w-lg">
          <SheetHeader>
            <SheetTitle className="flex items-center gap-2">
              <FileText className="h-4 w-4" />
              Vorgang
            </SheetTitle>
          </SheetHeader>
          {detailItem && (
            <div className="mt-4 space-y-4">
              <div className="space-y-2">
                <h3 className="font-semibold">{detailItem.subject || detailItem.summary || detailItem.resolution_summary || "Ohne Titel"}</h3>
                <div className="flex flex-wrap gap-2 text-xs">
                  {detailItem.status && <Badge variant="outline">{detailItem.status}</Badge>}
                  {detailItem.priority && <Badge variant="secondary">{detailItem.priority}</Badge>}
                  {detailItem.source_channel && <Badge variant="secondary">Kanal: {detailItem.source_channel}</Badge>}
                </div>
                {detailItem.due_at && (
                  <p className="text-xs text-muted-foreground">
                    Fällig: {format(new Date(detailItem.due_at), "dd.MM.yyyy", { locale: de })}
                  </p>
                )}
              </div>

              {detailItem.case_file_id && caseFilesById[detailItem.case_file_id] ? (
                <div className="space-y-2">
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Verknüpfte FallAkte</p>
                  <CaseFileDetail caseFileId={detailItem.case_file_id} onBack={() => undefined} />
                  <Button size="sm" variant="outline" onClick={() => navigate(`/casefiles?caseFileId=${detailItem.case_file_id}`)}>
                    <ExternalLink className="mr-1 h-3.5 w-3.5" />
                    Vollansicht
                  </Button>
                </div>
              ) : (
                <div className="rounded-md border border-dashed p-4 text-sm text-muted-foreground space-y-3">
                  <Briefcase className="h-4 w-4" />
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

      {/* Sheet: FallAkte Detail (from right) */}
      <Sheet open={!!detailFileId} onOpenChange={(open) => { if (!open) setDetailFileId(null); }}>
        <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-2xl">
          <SheetHeader>
            <SheetTitle className="flex items-center gap-2">
              <FolderOpen className="h-4 w-4" />
              FallAkte
            </SheetTitle>
          </SheetHeader>
          {detailFileId && (
            <div className="mt-4 space-y-3">
              <CaseFileDetail caseFileId={detailFileId} onBack={() => undefined} />
              <Button size="sm" variant="outline" onClick={() => navigate(`/casefiles?caseFileId=${detailFileId}`)}>
                <ExternalLink className="mr-1 h-3.5 w-3.5" />
                Vollansicht öffnen
              </Button>
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
