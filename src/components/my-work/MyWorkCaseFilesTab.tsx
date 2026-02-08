import { useState, useEffect } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Briefcase, ExternalLink, Calendar } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { de } from "date-fns/locale";

interface CaseFile {
  id: string;
  title: string;
  description: string | null;
  status: string;
  case_type: string;
  priority: string | null;
  target_date: string | null;
  reference_number: string | null;
  created_at: string;
  user_id: string;
}

const STATUS_COLORS: Record<string, string> = {
  active: "bg-green-500",
  pending: "bg-yellow-500",
  closed: "bg-blue-500",
  archived: "bg-gray-500",
};

export function MyWorkCaseFilesTab() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  
  const [caseFiles, setCaseFiles] = useState<CaseFile[]>([]);
  const [loading, setLoading] = useState(true);

  // Handle action parameter from URL
  useEffect(() => {
    const action = searchParams.get('action');
    if (action === 'create-casefile') {
      searchParams.delete('action');
      setSearchParams(searchParams, { replace: true });
      navigate('/casefiles?action=create');
    }
  }, [searchParams, setSearchParams, navigate]);

  useEffect(() => {
    if (user) {
      loadCaseFiles();
    }
  }, [user]);

  const loadCaseFiles = async () => {
    if (!user) return;
    
    try {
      // Load case files visible to user (RLS handles visibility filtering)
      const { data, error } = await supabase
        .from("case_files")
        .select("*")
        .in("status", ["active", "pending"])
        .order("updated_at", { ascending: false })
        .limit(20);

      if (error) throw error;
      setCaseFiles(data || []);
    } catch (error) {
      console.error("Error loading case files:", error);
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

  const getStatusLabel = (status: string) => {
    switch (status) {
      case "active": return "Aktiv";
      case "pending": return "Wartend";
      case "closed": return "Abgeschlossen";
      case "archived": return "Archiviert";
      default: return status;
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
            <p>Keine aktiven FallAkten</p>
          </div>
        ) : (
          caseFiles.map((caseFile) => (
            <div
              key={caseFile.id}
              className="flex items-start gap-3 p-3 rounded-lg border bg-card hover:bg-muted/50 transition-colors"
            >
              <div className="mt-0.5">
                <div
                  className={cn(
                    "w-2 h-2 rounded-full",
                    STATUS_COLORS[caseFile.status] || "bg-gray-500"
                  )}
                />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-medium text-sm">{caseFile.title}</span>
                  {getPriorityBadge(caseFile.priority)}
                  <Badge variant="outline" className="text-xs">
                    {getStatusLabel(caseFile.status)}
                  </Badge>
                </div>
                {caseFile.reference_number && (
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Az: {caseFile.reference_number}
                  </p>
                )}
                {caseFile.description && (
                  <p className="text-xs text-muted-foreground line-clamp-1 mt-0.5">
                    {caseFile.description}
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
                onClick={() => navigate("/casefiles")}
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
