import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useTenant } from "@/hooks/useTenant";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useToast } from "@/components/ui/use-toast";
import { ClipboardCheck, Loader2, CheckCircle2, AlertTriangle, AlertCircle, RefreshCcw, ExternalLink } from "lucide-react";
import { useNavigate } from "react-router-dom";

interface LintFinding {
  id: string;
  scope: string;
  severity: string;
  entity_type: string;
  entity_id: string | null;
  issue: string;
  detected_at: string;
}

const SCOPE_LABELS: Record<string, string> = {
  contacts_missing_category: "Kontakte ohne Kategorie",
  contacts_missing_name: "Kontakte ohne Name",
  tasks_missing_assignee: "Aufgaben ohne Bearbeiter",
  cases_missing_owner: "Vorgänge ohne Owner",
};

const SEVERITY_VARIANT: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  info: "secondary",
  warning: "outline",
  error: "destructive",
};

export function DataLintDashboard() {
  const { currentTenant } = useTenant();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [findings, setFindings] = useState<LintFinding[]>([]);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);

  const load = useCallback(async () => {
    if (!currentTenant?.id) return;
    setLoading(true);
    const { data, error } = await supabase
      .from("data_lint_findings")
      .select("id, scope, severity, entity_type, entity_id, issue, detected_at")
      .eq("tenant_id", currentTenant.id)
      .is("resolved_at", null)
      .order("severity", { ascending: false })
      .order("detected_at", { ascending: false })
      .limit(500);
    if (error) {
      toast({ title: "Fehler beim Laden", description: error.message, variant: "destructive" });
    } else {
      setFindings((data ?? []) as LintFinding[]);
    }
    setLoading(false);
  }, [currentTenant?.id, toast]);

  useEffect(() => { void load(); }, [load]);

  const runScan = async () => {
    if (!currentTenant?.id) return;
    setRunning(true);
    const { data, error } = await supabase.rpc("run_data_lint", { _tenant_id: currentTenant.id });
    setRunning(false);
    if (error) {
      toast({ title: "Lint fehlgeschlagen", description: error.message, variant: "destructive" });
      return;
    }
    const total = (data ?? []).reduce((s: number, r: { finding_count?: number }) => s + (r.finding_count ?? 0), 0);
    toast({ title: "Daten-Lint abgeschlossen", description: `${total} Hinweise gefunden.` });
    void load();
  };

  const resolveFinding = async (id: string) => {
    const { error } = await supabase
      .from("data_lint_findings")
      .update({ resolved_at: new Date().toISOString() })
      .eq("id", id);
    if (error) {
      toast({ title: "Fehler", description: error.message, variant: "destructive" });
      return;
    }
    setFindings(prev => prev.filter(f => f.id !== id));
  };

  const navigateTo = (f: LintFinding) => {
    if (!f.entity_id) return;
    if (f.entity_type === "contact") navigate(`/contacts/${f.entity_id}`);
    else if (f.entity_type === "case_item") navigate(`/vorgaenge/${f.entity_id}`);
    else if (f.entity_type === "task") navigate(`/tasks/${f.entity_id}`);
  };

  const grouped = findings.reduce<Record<string, LintFinding[]>>((acc, f) => {
    (acc[f.scope] ??= []).push(f);
    return acc;
  }, {});

  const severityIcon = (s: string) =>
    s === "error" ? <AlertCircle className="h-4 w-4 text-destructive" /> :
    s === "warning" ? <AlertTriangle className="h-4 w-4 text-orange-500" /> :
    <CheckCircle2 className="h-4 w-4 text-muted-foreground" />;

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-4">
        <div>
          <CardTitle className="flex items-center gap-2">
            <ClipboardCheck className="h-5 w-5" />
            Daten-Lint
          </CardTitle>
          <CardDescription>
            Erkennt unvollständige oder verwaiste Datensätze in Ihrem Mandanten.
            Score: <strong>{findings.length}</strong> offene Hinweise.
          </CardDescription>
        </div>
        <Button onClick={runScan} disabled={running || !currentTenant?.id} size="sm">
          {running ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <RefreshCcw className="h-4 w-4 mr-2" />}
          Scan starten
        </Button>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="flex items-center gap-2 text-muted-foreground py-8 justify-center">
            <Loader2 className="h-4 w-4 animate-spin" /> Lade Befunde…
          </div>
        ) : findings.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <CheckCircle2 className="h-10 w-10 mx-auto mb-2 text-green-500" />
            Keine offenen Hinweise. Ihre Daten sind sauber.
          </div>
        ) : (
          <ScrollArea className="h-[60vh]">
            <div className="space-y-6 pr-4">
              {Object.entries(grouped).map(([scope, items]) => (
                <div key={scope}>
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="font-medium">{SCOPE_LABELS[scope] ?? scope}</h4>
                    <Badge variant="secondary">{items.length}</Badge>
                  </div>
                  <div className="space-y-1">
                    {items.slice(0, 50).map(f => (
                      <div key={f.id} className="flex items-center gap-3 p-2 rounded-md border bg-card hover:bg-muted/40">
                        {severityIcon(f.severity)}
                        <span className="flex-1 text-sm truncate">{f.issue}</span>
                        <Badge variant={SEVERITY_VARIANT[f.severity] ?? "secondary"} className="text-xs">{f.severity}</Badge>
                        {f.entity_id && (
                          <Button size="sm" variant="ghost" onClick={() => navigateTo(f)}>
                            <ExternalLink className="h-3.5 w-3.5" />
                          </Button>
                        )}
                        <Button size="sm" variant="ghost" onClick={() => resolveFinding(f.id)}>
                          <CheckCircle2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    ))}
                    {items.length > 50 && (
                      <p className="text-xs text-muted-foreground pl-2">… und {items.length - 50} weitere</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </ScrollArea>
        )}
      </CardContent>
    </Card>
  );
}
