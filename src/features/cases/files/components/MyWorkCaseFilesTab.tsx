import { useState, useEffect } from "react";
import { debugConsole } from '@/utils/debugConsole';
import { useSearchParams, useNavigate } from "react-router-dom";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Briefcase, ExternalLink, Calendar } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useTenant } from "@/hooks/useTenant";
import { format } from "date-fns";
import { de } from "date-fns/locale";

interface CaseFile {
  id: string;
  title: string;
  description: string | null;
  current_status_note: string | null;
  status: string;
  case_type: string;
  case_scale: "small" | "large" | null;
  priority: string | null;
  target_date: string | null;
  reference_number: string | null;
  created_at: string;
  user_id: string;
  assigned_to: string | null;
}


export function MyWorkCaseFilesTab() {
  const { user } = useAuth();
  const { currentTenant } = useTenant();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  const [caseFiles, setCaseFiles] = useState<CaseFile[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const action = searchParams.get("action");
    if (action === "create-casefile") {
      searchParams.delete("action");
      setSearchParams(searchParams, { replace: true });
      navigate("/casefiles?action=create");
    }
  }, [searchParams, setSearchParams, navigate]);

  useEffect(() => {
    if (user && currentTenant?.id) {
      loadCaseFiles();
    }
  }, [user, currentTenant?.id]);

  // Realtime subscription
  useEffect(() => {
    if (!user?.id || !currentTenant?.id) return;
    let timeout: ReturnType<typeof setTimeout> | null = null;
    const scheduleRefresh = () => {
      if (timeout) clearTimeout(timeout);
      timeout = setTimeout(() => { timeout = null; void loadCaseFiles(); }, 250);
    };
    const channelName = `my-work-casefiles-${currentTenant.id}-${user.id}-${crypto.randomUUID()}`;
    const channel = supabase
      .channel(channelName)
      .on("postgres_changes", { event: "*", schema: "public", table: "case_files", filter: `tenant_id=eq.${currentTenant.id}` }, scheduleRefresh)
      .subscribe();
    return () => {
      if (timeout) clearTimeout(timeout);
      supabase.removeChannel(channel);
    };
  }, [user?.id, currentTenant?.id]);

  const loadCaseFiles = async () => {
    if (!user || !currentTenant?.id) return;

    try {
      const { data, error } = await supabase
        .from("case_files")
        .select("id, title, description, current_status_note, status, case_type, case_scale, priority, target_date, reference_number, created_at, user_id, assigned_to")
        .eq("tenant_id", currentTenant.id)
        .or(`user_id.eq.${user.id},assigned_to.eq.${user.id}`)
        .in("status", ["active", "pending"])
        .order("updated_at", { ascending: false })
        .limit(20);

      if (error) throw error;
      setCaseFiles((data || []) as unknown as CaseFile[]);
    } catch (error) {
      debugConsole.error("Error loading case files:", error);
    } finally {
      setLoading(false);
    }
  };

  const getPriorityBadge = (priority: string | null) => {
    switch (priority) {
      case "high":
        return <Badge variant="destructive" className="text-xs">Hoch</Badge>;
      case "medium":
        return <Badge variant="secondary" className="text-xs">Mittel</Badge>;
      case "low":
        return <Badge variant="outline" className="text-xs">Niedrig</Badge>;
      default:
        return null;
    }
  };


  if (loading) {
    return (
      <div className="space-y-2 p-4">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-16 bg-muted animate-pulse rounded-md" />
        ))}
      </div>
    );
  }

  return (
    <ScrollArea className="h-[500px]">
      <div className="space-y-2 p-4">
        {caseFiles.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <Briefcase className="h-10 w-10 mx-auto mb-2 opacity-50" />
            <p>Keine aktiven Fallakten</p>
          </div>
        ) : (
          caseFiles.map((caseFile) => (
            <div
              key={caseFile.id}
              className="flex items-start gap-3 p-3 rounded-lg border bg-card hover:bg-muted/50 transition-colors"
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-medium text-sm">{caseFile.title}</span>
                  {getPriorityBadge(caseFile.priority)}
                </div>
                {caseFile.reference_number && (
                  <p className="text-xs text-muted-foreground mt-0.5">Az: {caseFile.reference_number}</p>
                )}
                {caseFile.description && (
                  <p className="text-xs text-muted-foreground line-clamp-1 mt-0.5">{caseFile.description}</p>
                )}
                {caseFile.current_status_note && (
                  <p className="text-xs text-muted-foreground line-clamp-1 mt-0.5">
                    <span className="font-medium">Aktueller Stand:</span>{" "}
                    {caseFile.current_status_note.replace(/<[^>]*>/g, "").trim()}
                  </p>
                )}
                <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                  {caseFile.target_date && (
                    <span className="flex items-center gap-1">
                      <Calendar className="h-3 w-3" />
                      Ziel: {format(new Date(caseFile.target_date), "dd.MM.yyyy", { locale: de })}
                    </span>
                  )}
                </div>
              </div>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 flex-shrink-0"
                onClick={() => navigate(`/casefiles?caseFileId=${caseFile.id}`)}
              >
                <ExternalLink className="h-3 w-3" />
              </Button>
            </div>
          ))
        )}
      </div>
    </ScrollArea>
  );
}
