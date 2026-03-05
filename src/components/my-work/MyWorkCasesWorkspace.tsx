import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { format } from "date-fns";
import { de } from "date-fns/locale";
import { Briefcase, ExternalLink, FileText, FolderOpen } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useAuth } from "@/hooks/useAuth";
import { useTenant } from "@/hooks/useTenant";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

type CaseItem = {
  id: string;
  title: string | null;
  description: string | null;
  status: string | null;
  priority: string | null;
  due_date: string | null;
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
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  const [caseItems, setCaseItems] = useState<CaseItem[]>([]);
  const [caseFilesById, setCaseFilesById] = useState<Record<string, CaseFile>>({});
  const [loading, setLoading] = useState(true);

  const selectedCaseItemId = searchParams.get("caseItemId");
  const selectedCaseFileId = searchParams.get("caseFileId");

  useEffect(() => {
    const action = searchParams.get("action");
    if (action === "create-caseitem") {
      navigate("/caseitems?action=create");
      return;
    }
    if (action === "create-casefile") {
      navigate("/casefiles?action=create");
    }
  }, [navigate, searchParams]);

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
    if (!user || !currentTenant?.id) return;

    setLoading(true);
    try {
      const { data: caseItemsData, error: caseItemsError } = await supabase
        .from("case_items" as any)
        .select("id, title, description, status, priority, due_date, case_file_id, user_id, owner_user_id, updated_at")
        .eq("tenant_id", currentTenant.id)
        .or(`user_id.eq.${user.id},owner_user_id.eq.${user.id}`)
        .order("updated_at", { ascending: false, nullsFirst: false })
        .limit(120);

      if (caseItemsError) throw caseItemsError;

      const items = (caseItemsData || []) as CaseItem[];
      setCaseItems(items);

      const linkedCaseFileIds = Array.from(new Set(items.map((item) => item.case_file_id).filter(Boolean) as string[]));

      if (linkedCaseFileIds.length === 0) {
        setCaseFilesById({});
        return;
      }

      const { data: caseFilesData, error: caseFilesError } = await supabase
        .from("case_files")
        .select("id, title, status, reference_number, current_status_note")
        .eq("tenant_id", currentTenant.id)
        .in("id", linkedCaseFileIds);

      if (caseFilesError) throw caseFilesError;

      const mapped = ((caseFilesData || []) as CaseFile[]).reduce<Record<string, CaseFile>>((acc, row) => {
        acc[row.id] = row;
        return acc;
      }, {});

      setCaseFilesById(mapped);
    } catch (error) {
      console.error("Error loading cases workspace:", error);
    } finally {
      setLoading(false);
    }
  }, [currentTenant?.id, user]);

  useEffect(() => {
    void loadWorkspaceData();
  }, [loadWorkspaceData]);

  const selectedCaseItem = useMemo(() => {
    if (selectedCaseItemId) {
      return caseItems.find((item) => item.id === selectedCaseItemId) || null;
    }
    return caseItems[0] || null;
  }, [caseItems, selectedCaseItemId]);

  const contextualCaseFile = useMemo(() => {
    if (selectedCaseFileId && caseFilesById[selectedCaseFileId]) {
      return caseFilesById[selectedCaseFileId];
    }

    if (selectedCaseItem?.case_file_id) {
      return caseFilesById[selectedCaseItem.case_file_id] || null;
    }

    return null;
  }, [caseFilesById, selectedCaseFileId, selectedCaseItem?.case_file_id]);

  if (loading) {
    return <div className="p-4 text-sm text-muted-foreground">Lade Fallbearbeitung…</div>;
  }

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <FileText className="h-4 w-4" />
            Anliegen
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ScrollArea className="h-[520px] pr-3">
            <div className="space-y-2">
              {caseItems.length === 0 ? (
                <div className="rounded-md border border-dashed p-4 text-sm text-muted-foreground">
                  Keine zugeordneten Anliegen gefunden.
                </div>
              ) : (
                caseItems.map((item) => {
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
                      onClick={() => updateWorkspaceParams({ caseItemId: item.id, caseFileId: item.case_file_id })}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <p className="text-sm font-medium">{item.title || "Ohne Titel"}</p>
                          {item.description && (
                            <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{item.description}</p>
                          )}
                        </div>
                        {item.priority && <Badge variant="outline">{item.priority}</Badge>}
                      </div>
                      <div className="mt-2 flex items-center justify-between text-xs text-muted-foreground">
                        <span>{item.status || "offen"}</span>
                        {item.due_date ? <span>Fällig: {format(new Date(item.due_date), "dd.MM.yyyy", { locale: de })}</span> : null}
                      </div>
                      {linkedFile ? (
                        <p className="mt-2 text-xs text-muted-foreground">
                          Akte: <span className="font-medium text-foreground">{linkedFile.title}</span>
                        </p>
                      ) : null}
                    </button>
                  );
                })
              )}
            </div>
          </ScrollArea>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <FolderOpen className="h-4 w-4" />
            Zugeordnete Akte
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {contextualCaseFile ? (
            <>
              <div className="rounded-md border p-3">
                <p className="font-medium">{contextualCaseFile.title}</p>
                {contextualCaseFile.reference_number ? (
                  <p className="text-xs text-muted-foreground">Az: {contextualCaseFile.reference_number}</p>
                ) : null}
                <div className="mt-2 flex items-center gap-2">
                  <Badge variant="secondary">{contextualCaseFile.status}</Badge>
                </div>
                {contextualCaseFile.current_status_note ? (
                  <p className="mt-2 text-xs text-muted-foreground line-clamp-3">
                    {contextualCaseFile.current_status_note.replace(/<[^>]*>/g, "").trim()}
                  </p>
                ) : null}
              </div>

              <div className="flex flex-wrap gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => updateWorkspaceParams({ caseItemId: selectedCaseItem?.id || null, caseFileId: contextualCaseFile.id })}
                >
                  Als Kontext setzen
                </Button>
                <Button size="sm" onClick={() => navigate(`/casefiles?caseFileId=${contextualCaseFile.id}`)}>
                  <ExternalLink className="mr-1 h-3.5 w-3.5" />
                  Akte öffnen
                </Button>
              </div>
            </>
          ) : (
            <div className="rounded-md border border-dashed p-4 text-sm text-muted-foreground">
              <Briefcase className="mb-2 h-4 w-4" />
              Wähle ein Anliegen mit verknüpfter Akte oder öffne eine Akte per Deep-Link mit
              <code className="mx-1 rounded bg-muted px-1 py-0.5">caseFileId</code>.
            </div>
          )}

          {selectedCaseItem ? (
            <Button size="sm" variant="ghost" onClick={() => navigate(`/?section=casefiles&caseItemId=${selectedCaseItem.id}`)}>
              <ExternalLink className="mr-1 h-3.5 w-3.5" />
              Vollansicht zum Anliegen
            </Button>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}
