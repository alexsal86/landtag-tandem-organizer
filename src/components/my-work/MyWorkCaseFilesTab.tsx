import { useState, useEffect } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Input } from "@/components/ui/input";
import { Briefcase, ExternalLink, Calendar } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useTenant } from "@/hooks/useTenant";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { classifyCaseScale, type CaseScale } from "@/lib/caseFileSizing";
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

interface EscalationSuggestion {
  id: string;
  reason_codes: string[];
  suggestion_payload?: {
    reasonLabels?: string[];
    daysOld?: number;
  };
  suggested_case_file_id: string | null;
  case_items: {
    id: string;
    source_channel: string;
    priority: string;
    created_at: string;
  };
}

const STATUS_COLORS: Record<string, string> = {
  active: "bg-green-500",
  pending: "bg-yellow-500",
  closed: "bg-blue-500",
  archived: "bg-gray-500",
};

export function MyWorkCaseFilesTab() {
  const { user } = useAuth();
  const { currentTenant } = useTenant();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [searchParams, setSearchParams] = useSearchParams();

  const [caseFiles, setCaseFiles] = useState<CaseFile[]>([]);
  const [suggestions, setSuggestions] = useState<EscalationSuggestion[]>([]);
  const [selectedCaseFileBySuggestion, setSelectedCaseFileBySuggestion] = useState<Record<string, string>>({});
  const [rejectionReasonBySuggestion, setRejectionReasonBySuggestion] = useState<Record<string, string>>({});
  const [processingSuggestionId, setProcessingSuggestionId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [scaleFilter, setScaleFilter] = useState<"all" | CaseScale>("all");

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
      loadEscalationSuggestions();
    }
  }, [user, currentTenant?.id]);

  const loadEscalationSuggestions = async () => {
    try {
      const { data, error } = await supabase.functions.invoke("suggest-case-escalations", {
        body: { action: "list" },
      });

      if (error) throw error;
      const incomingSuggestions = (data?.suggestions ?? []) as EscalationSuggestion[];
      setSuggestions(incomingSuggestions);
      const initialSelection = incomingSuggestions.reduce<Record<string, string>>((acc, suggestion) => {
        if (suggestion.suggested_case_file_id) {
          acc[suggestion.id] = suggestion.suggested_case_file_id;
        }
        return acc;
      }, {});
      setSelectedCaseFileBySuggestion(initialSelection);
    } catch (error) {
      console.error("Error loading escalation suggestions:", error);
    }
  };

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

  const filteredCaseFiles = caseFiles.filter((caseFile) => {
    if (scaleFilter === "all") return true;

    return classifyCaseScale({ explicitScale: caseFile.case_scale, caseType: caseFile.case_type }) === scaleFilter;
  });

  const scaleCounts = {
    all: caseFiles.length,
    small: caseFiles.filter((caseFile) => classifyCaseScale({ explicitScale: caseFile.case_scale, caseType: caseFile.case_type }) === "small").length,
    large: caseFiles.filter((caseFile) => classifyCaseScale({ explicitScale: caseFile.case_scale, caseType: caseFile.case_type }) === "large").length,
  };

  const reviewSuggestion = async (
    suggestionId: string,
    decision: "accepted" | "rejected",
    options?: { createCaseFile?: boolean; targetCaseFileId?: string; rejectionReason?: string }
  ) => {
    try {
      setProcessingSuggestionId(suggestionId);
      const { error } = await supabase.functions.invoke("suggest-case-escalations", {
        body: {
          action: "review",
          suggestionId,
          decision,
          ...options,
        },
      });
      if (error) throw error;

      toast({
        title: decision === "accepted" ? "Eskalation bestätigt" : "Eskalation abgelehnt",
        description: decision === "accepted" ? "Vorgang wurde verarbeitet." : "Ablehnungsgrund wurde gespeichert.",
      });
      await loadCaseFiles();
      await loadEscalationSuggestions();
    } catch (error) {
      console.error("Error reviewing escalation suggestion:", error);
      toast({
        title: "Fehler",
        description: "Eskalationsvorschlag konnte nicht verarbeitet werden.",
        variant: "destructive",
      });
    } finally {
      setProcessingSuggestionId(null);
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
        <div className="flex items-center justify-end pb-1">
          <Button size="sm" onClick={() => navigate("/casefiles?action=create")}>
            <Briefcase className="mr-2 h-4 w-4" />
            Akte erstellen
          </Button>
        </div>

        {suggestions.map((suggestion) => {
          const shortId = suggestion.case_items.id.slice(0, 8);
          const selectedCaseFileId = selectedCaseFileBySuggestion[suggestion.id] ?? "";
          const rejectionReason = rejectionReasonBySuggestion[suggestion.id] ?? "";
          const isProcessing = processingSuggestionId === suggestion.id;

          return (
            <div key={suggestion.id} className="rounded-lg border border-amber-500/40 bg-amber-500/5 p-3 space-y-3">
              <div className="flex items-center gap-2 flex-wrap">
                <Badge variant="secondary">Eskalationsvorschlag</Badge>
                <Badge variant="outline">Vorgang {shortId}</Badge>
                <Badge variant="outline">{suggestion.case_items.priority}</Badge>
                {suggestion.suggestion_payload?.daysOld !== undefined && (
                  <Badge variant="outline">{suggestion.suggestion_payload.daysOld} Tage alt</Badge>
                )}
              </div>

              <div className="flex flex-wrap gap-1">
                {(suggestion.suggestion_payload?.reasonLabels ?? suggestion.reason_codes).map((reason) => (
                  <Badge key={`${suggestion.id}-${reason}`} variant="outline" className="text-xs">
                    {reason}
                  </Badge>
                ))}
              </div>

              <div className="flex items-center gap-2 flex-wrap">
                <Button
                  size="sm"
                  disabled={isProcessing}
                  onClick={() => reviewSuggestion(suggestion.id, "accepted", { createCaseFile: true })}
                >
                  Akte anlegen
                </Button>
                <select
                  className="h-9 rounded-md border bg-background px-2 text-sm"
                  value={selectedCaseFileId}
                  onChange={(event) =>
                    setSelectedCaseFileBySuggestion((prev) => ({ ...prev, [suggestion.id]: event.target.value }))
                  }
                >
                  <option value="">Bestehende Akte wählen</option>
                  {caseFiles.map((caseFile) => (
                    <option key={caseFile.id} value={caseFile.id}>
                      {caseFile.title}
                    </option>
                  ))}
                </select>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={isProcessing || !selectedCaseFileId}
                  onClick={() => reviewSuggestion(suggestion.id, "accepted", { targetCaseFileId: selectedCaseFileId })}
                >
                  Bestehender Akte zuordnen
                </Button>
              </div>

              <div className="flex items-center gap-2">
                <Input
                  placeholder="Ablehnungsgrund"
                  value={rejectionReason}
                  onChange={(event) =>
                    setRejectionReasonBySuggestion((prev) => ({ ...prev, [suggestion.id]: event.target.value }))
                  }
                />
                <Button
                  size="sm"
                  variant="ghost"
                  disabled={isProcessing || rejectionReason.trim().length < 3}
                  onClick={() => reviewSuggestion(suggestion.id, "rejected", { rejectionReason })}
                >
                  Keine Eskalation
                </Button>
              </div>
            </div>
          );
        })}

        <div className="flex items-center gap-2 pb-2">
          <Button size="sm" variant={scaleFilter === "all" ? "secondary" : "outline"} onClick={() => setScaleFilter("all")}>Alle ({scaleCounts.all})</Button>
          <Button size="sm" variant={scaleFilter === "small" ? "secondary" : "outline"} onClick={() => setScaleFilter("small")}>Kleine Vorgänge ({scaleCounts.small})</Button>
          <Button size="sm" variant={scaleFilter === "large" ? "secondary" : "outline"} onClick={() => setScaleFilter("large")}>Große Akten ({scaleCounts.large})</Button>
        </div>

        {filteredCaseFiles.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <Briefcase className="h-10 w-10 mx-auto mb-2 opacity-50" />
            <p>
              {scaleFilter === "all"
                ? "Keine aktiven FallAkten"
                : scaleFilter === "small"
                  ? "Keine kleinen Vorgänge"
                  : "Keine großen Akten"}
            </p>
          </div>
        ) : (
          filteredCaseFiles.map((caseFile) => (
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
