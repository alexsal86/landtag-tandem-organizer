import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { format } from "date-fns";
import { de } from "date-fns/locale";
import { Briefcase, ExternalLink, FileText, FolderOpen, Plus, Search } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
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
  source_channel: string | null;
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
};

export function MyWorkCasesWorkspace() {
  const { user } = useAuth();
  const { currentTenant } = useTenant();
  const tenantId = currentTenant?.id;
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { createCaseItem } = useCaseItems();

  const [caseItems, setCaseItems] = useState<CaseItem[]>([]);
  const [isCaseItemDialogOpen, setIsCaseItemDialogOpen] = useState(false);
  const [isCaseFileDialogOpen, setIsCaseFileDialogOpen] = useState(false);
  const [pendingCaseItemLinkId, setPendingCaseItemLinkId] = useState<string | null>(null);
  const [caseFiles, setCaseFiles] = useState<CaseFile[]>([]);
  const [caseFilesById, setCaseFilesById] = useState<Record<string, CaseFile>>({});
  const [loading, setLoading] = useState(true);
  const [filterQuery, setFilterQuery] = useState("");
  const [mobileDetailOpen, setMobileDetailOpen] = useState(false);
  const [isMobileViewport, setIsMobileViewport] = useState(false);

  const selectedCaseItemId = searchParams.get("caseItemId");
  const selectedCaseFileId = searchParams.get("caseFileId");

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

  const updateWorkspaceParams = useCallback((next: { caseItemId?: string | null; caseFileId?: string | null }) => {
    setSearchParams((prev) => {
      const params = new URLSearchParams(prev);
      params.set("tab", "cases");

      if (next.caseItemId) params.set("caseItemId", next.caseItemId);
      else params.delete("caseItemId");

      if (next.caseFileId) params.set("caseFileId", next.caseFileId);
      else params.delete("caseFileId");

      params.delete("action");
      return params;
    });
  }, [setSearchParams]);

  const loadWorkspaceData = useCallback(async () => {
    if (!user || !tenantId) {
      setCaseItems([]);
      setCaseFilesById({});
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const { data: caseItemsData, error: caseItemsError } = await supabase
        .from("case_items" as any)
        .select("id, subject, resolution_summary, source_channel, status, priority, due_at, case_file_id, user_id, owner_user_id, updated_at")
        .eq("tenant_id", tenantId)
        .order("updated_at", { ascending: false, nullsFirst: false })
        .limit(120);

      if (caseItemsError) throw caseItemsError;

      const items = (caseItemsData || []) as unknown as CaseItem[];
      setCaseItems(items);

      const caseFileIds = [...new Set(items.map(i => i.case_file_id).filter((id): id is string => Boolean(id)))];

      const { data: caseFilesData, error: caseFilesError } = caseFileIds.length > 0
        ? await supabase
            .from("case_files")
            .select("id, title, status, reference_number, current_status_note")
            .eq("tenant_id", tenantId)
            .in("id", caseFileIds)
        : { data: [] as CaseFile[], error: null };

      if (caseFilesError) throw caseFilesError;

      const caseFilesList = (caseFilesData || []) as CaseFile[];
      setCaseFiles(caseFilesList);

      const mapped = caseFilesList.reduce<Record<string, CaseFile>>((acc, row) => {
        acc[row.id] = row;
        return acc;
      }, {});

      setCaseFilesById(mapped);
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

  const selectedCaseItem = useMemo(() => {
    if (selectedCaseItemId) {
      return caseItems.find((item) => item.id === selectedCaseItemId) || null;
    }
    return null;
  }, [caseItems, selectedCaseItemId]);

  const selectedCaseFile = useMemo(() => {
    if (!selectedCaseFileId) return null;
    return caseFilesById[selectedCaseFileId] || null;
  }, [caseFilesById, selectedCaseFileId]);



  useEffect(() => {
    if (typeof window === "undefined") return;

    const mediaQuery = window.matchMedia("(max-width: 1023px)");
    const updateViewport = () => {
      setIsMobileViewport(mediaQuery.matches);
      if (!mediaQuery.matches) {
        setMobileDetailOpen(false);
      }
    };

    updateViewport();
    mediaQuery.addEventListener("change", updateViewport);
    return () => mediaQuery.removeEventListener("change", updateViewport);
  }, []);


  const filteredCaseItems = useMemo(() => {
    const query = filterQuery.trim().toLowerCase();
    if (!query) return caseItems;

    return caseItems.filter((item) => {
      const linkedFile = item.case_file_id ? caseFilesById[item.case_file_id] : null;
      return [item.subject, item.resolution_summary, item.source_channel, item.status, item.priority]
        .concat(linkedFile ? [linkedFile.title, linkedFile.reference_number] : [])
        .filter(Boolean)
        .some((value) => value!.toLowerCase().includes(query));
    });
  }, [caseFilesById, caseItems, filterQuery]);


  const unlinkedCaseItems = useMemo(
    () => filteredCaseItems.filter((item) => !item.case_file_id),
    [filteredCaseItems],
  );

  const linkedCaseItems = useMemo(
    () => filteredCaseItems.filter((item) => Boolean(item.case_file_id)),
    [filteredCaseItems],
  );

  const filteredStandaloneCaseFiles = useMemo(() => {
    const linkedCaseFileIds = new Set(
      caseItems
        .map((item) => item.case_file_id)
        .filter((caseFileId): caseFileId is string => Boolean(caseFileId)),
    );

    const standalone = caseFiles.filter((caseFile) => !linkedCaseFileIds.has(caseFile.id));
    const query = filterQuery.trim().toLowerCase();
    if (!query) return standalone;

    return standalone.filter((caseFile) =>
      [caseFile.title, caseFile.reference_number, caseFile.status, caseFile.current_status_note]
        .filter(Boolean)
        .some((value) => value!.toLowerCase().includes(query)),
    );
  }, [caseFiles, caseItems, filterQuery]);

  const stats = useMemo(() => {
    const closedStatuses = new Set(["closed", "done", "abgeschlossen"]);

    const openItems = filteredCaseItems.filter((item) => {
      const normalizedStatus = item.status?.trim().toLowerCase();
      return !normalizedStatus || !closedStatuses.has(normalizedStatus);
    }).length;

    const linkedCaseFileCount = new Set(
      linkedCaseItems
        .map((item) => item.case_file_id)
        .filter((caseFileId): caseFileId is string => Boolean(caseFileId)),
    ).size;

    return {
      totalItems: filteredCaseItems.length,
      openItems,
      singleItemsCount: unlinkedCaseItems.length,
      uniqueCaseFiles: linkedCaseFileCount + filteredStandaloneCaseFiles.length,
    };
  }, [filteredCaseItems, filteredStandaloneCaseFiles.length, linkedCaseItems, unlinkedCaseItems]);

  const renderCaseItemEntry = (item: CaseItem) => {
    const linkedFile = item.case_file_id ? caseFilesById[item.case_file_id] : null;
    const isActive = selectedCaseItem?.id === item.id;

    return (
      <button
        key={item.id}
        type="button"
        className={cn(
          "w-full rounded-md border p-3 text-left transition-colors hover:bg-muted/50",
          isActive && "border-primary bg-primary/5",
        )}
        onClick={() => handleSelectCaseItem(item)}
      >
        <div className="flex items-start justify-between gap-2">
          <div>
            <p className="text-sm font-medium">{item.subject || item.resolution_summary || "Ohne Titel"}</p>
            {item.source_channel ? <p className="mt-1 text-xs text-muted-foreground">Kanal: {item.source_channel}</p> : null}
          </div>
          {item.priority && <Badge variant="outline">{item.priority}</Badge>}
        </div>
        <div className="mt-2 flex items-center justify-between text-xs text-muted-foreground">
          <span>{item.status || "offen"}</span>
          {item.due_at ? <span>Fällig: {format(new Date(item.due_at), "dd.MM.yyyy", { locale: de })}</span> : null}
        </div>
        {linkedFile ? (
          <p className="mt-2 text-xs text-muted-foreground">
            Akte: <span className="font-medium text-foreground">{linkedFile.title}</span>
            {linkedFile.reference_number ? <span className="ml-1">({linkedFile.reference_number})</span> : null}
          </p>
        ) : (
          <p className="mt-2 text-xs text-amber-700 dark:text-amber-400">Einzelvorgang ohne Akte</p>
        )}
      </button>
    );
  };

  const handleSelectCaseItem = (item: CaseItem) => {
    updateWorkspaceParams({ caseItemId: item.id, caseFileId: item.case_file_id });
    if (isMobileViewport) {
      setMobileDetailOpen(true);
    }
  };

  const handleSelectCaseFile = (caseFile: CaseFile) => {
    updateWorkspaceParams({ caseItemId: null, caseFileId: caseFile.id });
    if (isMobileViewport) {
      setMobileDetailOpen(true);
    }
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
    updateWorkspaceParams({ caseItemId: newCaseItemId, caseFileId: null });
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
      updateWorkspaceParams({ caseItemId: pendingCaseItemLinkId, caseFileId: newCaseFileId });
    } else {
      navigate(`/casefiles?caseFileId=${newCaseFileId}`);
    }

    setPendingCaseItemLinkId(null);
  };

  const renderDetailPanel = () => {
    if (selectedCaseItem?.case_file_id) {
      return (
        <div className="space-y-3">
          <div className="rounded-md border bg-muted/30 p-3 text-sm">
            <p className="font-medium">Vorgang</p>
            <p>{selectedCaseItem.subject || selectedCaseItem.resolution_summary || "Ohne Titel"}</p>
            {selectedCaseItem.source_channel ? <p className="mt-1 text-xs text-muted-foreground">Kanal: {selectedCaseItem.source_channel}</p> : null}
          </div>
          <CaseFileDetail caseFileId={selectedCaseItem.case_file_id} onBack={() => undefined} />
          <Button size="sm" variant="outline" onClick={() => navigate(`/casefiles?caseFileId=${selectedCaseItem.case_file_id}`)}>
            <ExternalLink className="mr-1 h-3.5 w-3.5" />
            Vollansicht öffnen
          </Button>
        </div>
      );
    }

    if (selectedCaseItem && !selectedCaseItem.case_file_id) {
      return (
        <div className="space-y-3 rounded-md border border-dashed p-4 text-sm text-muted-foreground">
          <Briefcase className="h-4 w-4" />
          <p>Für dieses Anliegen ist noch keine Akte verknüpft.</p>
          <div className="flex flex-wrap gap-2">
            <Button size="sm" onClick={() => handleCreateCaseFile(selectedCaseItem.id)}>
              Neue Akte anlegen
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => navigate(`/?tab=cases&caseItemId=${selectedCaseItem.id}&focus=caseitem-linking`)}
            >
              Bestehender Akte zuordnen
            </Button>
          </div>
        </div>
      );
    }

    if (selectedCaseFile) {
      return (
        <div className="space-y-3">
          <CaseFileDetail caseFileId={selectedCaseFile.id} onBack={() => undefined} />
          <Button size="sm" variant="outline" onClick={() => navigate(`/casefiles?caseFileId=${selectedCaseFile.id}`)}>
            <ExternalLink className="mr-1 h-3.5 w-3.5" />
            Vollansicht öffnen
          </Button>
        </div>
      );
    }

    return (
      <div className="rounded-md border border-dashed p-4 text-sm text-muted-foreground">
        <Briefcase className="mb-2 h-4 w-4" />
        Wähle links einen Vorgang oder eine FallAkte aus, um Details anzuzeigen.
      </div>
    );
  };

  if (loading) {
    return <div className="p-4 text-sm text-muted-foreground">Lade Fallbearbeitung…</div>;
  }

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1.9fr)]">
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <FileText className="h-4 w-4" />
            Vorgänge in Meine Arbeit
          </CardTitle>
          <p className="text-xs text-muted-foreground">
            Alle Bürgeranfragen, Petitionen und ähnliche Sachverhalte als Vorgangs-Items – mit optionaler Zuordnung zu einer FallAkte.
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <Button size="sm" onClick={handleCreateCaseItem}>
              <Plus className="mr-1 h-4 w-4" />
              Vorgang erstellen
            </Button>
            <Button size="sm" variant="outline" onClick={() => handleCreateCaseFile()}>
              <Plus className="mr-1 h-4 w-4" />
              FallAkte erstellen
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-2 gap-2 text-xs lg:grid-cols-4">
            <div className="rounded-md border p-2">
              <p className="text-muted-foreground">Alle Vorgänge</p>
              <p className="text-sm font-semibold">{stats.totalItems}</p>
            </div>
            <div className="rounded-md border p-2">
              <p className="text-muted-foreground">Offen</p>
              <p className="text-sm font-semibold">{stats.openItems}</p>
            </div>
            <div className="rounded-md border p-2">
              <p className="text-muted-foreground">Einzelvorgänge</p>
              <p className="text-sm font-semibold">{stats.singleItemsCount}</p>
            </div>
            <div className="rounded-md border p-2">
              <p className="text-muted-foreground">FallAkten</p>
              <p className="text-sm font-semibold">{stats.uniqueCaseFiles}</p>
            </div>
          </div>
          <div className="relative">
            <Search className="pointer-events-none absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              value={filterQuery}
              onChange={(event) => setFilterQuery(event.target.value)}
              placeholder="Anliegen filtern…"
              className="pl-8"
            />
          </div>
          <ScrollArea className="h-[520px] pr-3">
            <div className="space-y-4">
              {filteredCaseItems.length === 0 ? (
                <div className="rounded-md border border-dashed p-4 text-sm text-muted-foreground space-y-3">
                  <p>Keine Anliegen passend zum Filter gefunden.</p>
                  <div className="flex flex-wrap gap-2">
                    <Button size="sm" onClick={handleCreateCaseItem}>Vorgang erstellen</Button>
                    <Button size="sm" variant="outline" onClick={() => handleCreateCaseFile()}>FallAkte erstellen</Button>
                  </div>
                </div>
              ) : (
                <>
                  <div className="space-y-2">
                    <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      Einzelvorgänge (ohne FallAkte)
                    </p>
                    {unlinkedCaseItems.length > 0 ? (
                      unlinkedCaseItems.map(renderCaseItemEntry)
                    ) : (
                      <div className="rounded-md border border-dashed p-3 text-xs text-muted-foreground">
                        Keine Einzelvorgänge im aktuellen Filter.
                      </div>
                    )}
                  </div>

                  <div className="space-y-2">
                    <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      Vorgänge in FallAkten
                    </p>
                    {linkedCaseItems.length > 0 ? (
                      linkedCaseItems.map(renderCaseItemEntry)
                    ) : (
                      <div className="rounded-md border border-dashed p-3 text-xs text-muted-foreground">
                        Keine zugeordneten Vorgänge im aktuellen Filter.
                      </div>
                    )}
                  </div>

                  <div className="space-y-2">
                    <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      FallAkten ohne verknüpfte Vorgänge
                    </p>
                    {filteredStandaloneCaseFiles.length > 0 ? (
                      filteredStandaloneCaseFiles.map((caseFile) => (
                        <button
                          key={caseFile.id}
                          type="button"
                          className={cn(
                            "w-full rounded-md border p-3 text-left transition-colors hover:bg-muted/50",
                            selectedCaseFile?.id === caseFile.id && "border-primary bg-primary/5",
                          )}
                          onClick={() => handleSelectCaseFile(caseFile)}
                        >
                          <p className="text-sm font-medium">{caseFile.title}</p>
                          <div className="mt-2 flex items-center justify-between text-xs text-muted-foreground">
                            <span>{caseFile.status || "offen"}</span>
                            {caseFile.reference_number ? <span>{caseFile.reference_number}</span> : null}
                          </div>
                        </button>
                      ))
                    ) : (
                      <div className="rounded-md border border-dashed p-3 text-xs text-muted-foreground">
                        Keine zusätzlichen FallAkten im aktuellen Filter.
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>
          </ScrollArea>
        </CardContent>
      </Card>

      <Card className="hidden lg:block">
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <FolderOpen className="h-4 w-4" />
            Detailpanel
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">{renderDetailPanel()}</CardContent>
      </Card>

      <Sheet open={mobileDetailOpen} onOpenChange={setMobileDetailOpen}>
        <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-2xl">
          <SheetHeader>
            <SheetTitle className="flex items-center gap-2">
              <FolderOpen className="h-4 w-4" />
              Detailpanel
            </SheetTitle>
          </SheetHeader>
          <div className="mt-4">{renderDetailPanel()}</div>
        </SheetContent>
      </Sheet>

      <CaseItemCreateDialog
        open={isCaseItemDialogOpen}
        onOpenChange={setIsCaseItemDialogOpen}
        onCreated={(id) => {
          void handleCaseItemCreated(id);
        }}
        createCaseItem={createCaseItem}
      />

      <CaseFileCreateDialog
        open={isCaseFileDialogOpen}
        onOpenChange={(open) => {
          setIsCaseFileDialogOpen(open);
          if (!open) {
            setPendingCaseItemLinkId(null);
          }
        }}
        onSuccess={(caseFile) => {
          void handleCaseFileCreated(caseFile.id);
          setIsCaseFileDialogOpen(false);
        }}
      />
    </div>
  );
}
