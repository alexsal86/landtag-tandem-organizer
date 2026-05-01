import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useTenant } from "@/hooks/useTenant";
import { useToast } from "@/components/ui/use-toast";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { AlertTriangle, Loader2, RefreshCw, RotateCcw } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { de } from "date-fns/locale";

interface FailedRun {
  id: string;
  rule_id: string;
  error_message: string | null;
  started_at: string;
  finished_at: string | null;
  retry_count: number;
  max_retries: number;
  rule_name?: string;
}

interface AutomationErrorDashboardProps {
  onRetrigger?: () => void;
}

export function AutomationErrorDashboard({ onRetrigger }: AutomationErrorDashboardProps) {
  const { currentTenant } = useTenant();
  const { toast } = useToast();
  const [failedRuns, setFailedRuns] = useState<FailedRun[]>([]);
  const [loading, setLoading] = useState(true);
  const [retrying, setRetrying] = useState<string | null>(null);

  const loadFailedRuns = async () => {
    if (!currentTenant) return;
    setLoading(true);

    const { data: runs, error } = await supabase
      .from("automation_rule_runs")
      .select("id, rule_id, error_message, started_at, finished_at, retry_count, max_retries")
      .eq("tenant_id", currentTenant.id)
      .eq("status", "failed")
      .order("started_at", { ascending: false })
      .limit(50);

    if (error) {
      toast({ title: "Fehler", description: error.message, variant: "destructive" });
      setLoading(false);
      return;
    }

    // Fetch rule names
    const ruleIds = [...new Set((runs || []).map((r: { rule_id: string }) => r.rule_id))];
    let ruleMap: Record<string, string> = {};

    if (ruleIds.length > 0) {
      const { data: rules } = await supabase
        .from("automation_rules")
        .select("id, name")
        .in("id", ruleIds);
      ruleMap = (rules || []).reduce((acc: Record<string, string>, r: { id: string; name: string }) => {
        acc[r.id] = r.name;
        return acc;
      }, {});
    }

    setFailedRuns(
      (runs || []).map((r: { rule_id: string; [k: string]: unknown }) => ({
        ...r,
        rule_name: ruleMap[r.rule_id] || r.rule_id.slice(0, 8) + "…",
      }))
    );
    setLoading(false);
  };

  useEffect(() => {
    loadFailedRuns();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentTenant?.id]);

  const retryRun = async (run: FailedRun) => {
    setRetrying(run.id);
    const idempotencyKey = crypto.randomUUID();

    const { error } = await supabase.functions.invoke("run-automation-rule", {
      body: {
        ruleId: run.rule_id,
        dryRun: false,
        idempotencyKey,
        sourcePayload: { retry_of: run.id },
      },
    });

    setRetrying(null);
    if (error) {
      toast({ title: "Retry fehlgeschlagen", description: error.message, variant: "destructive" });
      return;
    }

    toast({ title: "Regel erneut ausgeführt" });
    loadFailedRuns();
    onRetrigger?.();
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-destructive" />
            <div>
              <CardTitle>Fehler-Monitor</CardTitle>
              <CardDescription>
                {failedRuns.length} fehlgeschlagene Run{failedRuns.length !== 1 ? "s" : ""}
              </CardDescription>
            </div>
          </div>
          <Button variant="outline" size="sm" onClick={loadFailedRuns} disabled={loading}>
            <RefreshCw className={`h-4 w-4 mr-1 ${loading ? "animate-spin" : ""}`} />
            Aktualisieren
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="flex items-center justify-center py-8 text-muted-foreground gap-2">
            <Loader2 className="h-4 w-4 animate-spin" /> Laden…
          </div>
        ) : failedRuns.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-8">
            Keine fehlgeschlagenen Runs — alles läuft rund! 🎉
          </p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Regel</TableHead>
                <TableHead>Zeitpunkt</TableHead>
                <TableHead>Fehler</TableHead>
                <TableHead>Retries</TableHead>
                <TableHead className="text-right">Aktion</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {failedRuns.map((run) => (
                <TableRow key={run.id}>
                  <TableCell className="font-medium text-sm">{run.rule_name}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {formatDistanceToNow(new Date(run.started_at), { addSuffix: true, locale: de })}
                  </TableCell>
                  <TableCell>
                    <p className="text-xs text-destructive max-w-[300px] truncate" title={run.error_message || ""}>
                      {run.error_message || "Unbekannter Fehler"}
                    </p>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className="text-xs">
                      {run.retry_count}/{run.max_retries}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => retryRun(run)}
                      disabled={retrying === run.id}
                      className="gap-1"
                    >
                      {retrying === run.id ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <RotateCcw className="h-3.5 w-3.5" />
                      )}
                      Retry
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}
