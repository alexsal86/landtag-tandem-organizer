import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Loader2, CheckCircle2, XCircle, Clock, SkipForward, Play, Trash2, AlertTriangle } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useTenant } from "@/hooks/useTenant";
import { useToast } from "@/hooks/use-toast";
import { SELFTEST_SCENARIOS } from "../registry";
import { purgeAllSelftestData, runScenario } from "../runner";
import type { ScenarioRunState, StepStatus } from "../types";

const StatusIcon = ({ status }: { status: StepStatus }) => {
  switch (status) {
    case "ok":
      return <CheckCircle2 className="h-4 w-4 text-green-600" />;
    case "failed":
      return <XCircle className="h-4 w-4 text-destructive" />;
    case "running":
      return <Loader2 className="h-4 w-4 animate-spin text-primary" />;
    case "skipped":
      return <SkipForward className="h-4 w-4 text-muted-foreground" />;
    default:
      return <Clock className="h-4 w-4 text-muted-foreground" />;
  }
};

export function SelftestView() {
  const { user } = useAuth();
  const { currentTenant } = useTenant();
  const { toast } = useToast();
  const [runs, setRuns] = useState<Record<string, ScenarioRunState>>({});
  const [busy, setBusy] = useState<string | null>(null);
  const [purging, setPurging] = useState(false);

  const canRun = !!user && !!currentTenant;

  const handleRun = async (scenarioId: string) => {
    if (!user || !currentTenant) {
      toast({ title: "Nicht bereit", description: "Login und Tenant erforderlich.", variant: "destructive" });
      return;
    }
    const scenario = SELFTEST_SCENARIOS.find((s) => s.id === scenarioId);
    if (!scenario) return;

    if (!window.confirm(`„${scenario.title}" jetzt gegen die echte Datenbank ausführen?\n\nEs werden temporäre Datensätze angelegt und am Ende wieder entfernt.`)) {
      return;
    }

    setBusy(scenarioId);
    try {
      const result = await runScenario(scenario, {
        tenantId: currentTenant.id,
        userId: user.id,
        onUpdate: (state) => setRuns((prev) => ({ ...prev, [scenarioId]: state })),
      });
      toast({
        title: result.status === "ok" ? "Selbsttest erfolgreich" : "Selbsttest mit Fehlern",
        description: scenario.title,
        variant: result.status === "ok" ? "default" : "destructive",
      });
    } finally {
      setBusy(null);
    }
  };

  const handlePurge = async () => {
    if (!currentTenant) return;
    if (!window.confirm("Wirklich ALLE Test-Datensätze (Prefix [SELFTEST]) im aktuellen Tenant löschen?")) return;
    setPurging(true);
    try {
      const result = await purgeAllSelftestData(currentTenant.id);
      toast({
        title: result.ok ? "Aufräumen erfolgreich" : "Aufräumen mit Fehlern",
        description: result.message,
        variant: result.ok ? "default" : "destructive",
      });
    } finally {
      setPurging(false);
    }
  };

  return (
    <div className="container mx-auto p-6 max-w-4xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Selbsttest-Center</h1>
        <p className="text-muted-foreground mt-1">
          End-to-End-Szenarien gegen die echte Datenbank ausführen. Alle erzeugten Datensätze werden am Ende automatisch entfernt.
        </p>
      </div>

      <Alert>
        <AlertTriangle className="h-4 w-4" />
        <AlertTitle>Achtung: echte Schreiboperationen</AlertTitle>
        <AlertDescription>
          Diese Tests erstellen reale Datensätze im aktuellen Tenant ({currentTenant?.name ?? "—"}) und löschen sie wieder. Sollte ein Cleanup fehlschlagen, nutze unten den Notfall-Aufräumknopf.
        </AlertDescription>
      </Alert>

      <div className="space-y-4">
        {SELFTEST_SCENARIOS.map((scenario) => {
          const state = runs[scenario.id];
          const isRunning = busy === scenario.id;
          return (
            <Card key={scenario.id}>
              <CardHeader>
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <CardTitle className="flex items-center gap-2">
                      {scenario.title}
                      {state?.status === "ok" && <Badge variant="default" className="bg-green-600">OK</Badge>}
                      {state?.status === "failed" && <Badge variant="destructive">Fehler</Badge>}
                    </CardTitle>
                    <CardDescription>{scenario.description}</CardDescription>
                  </div>
                  <Button onClick={() => handleRun(scenario.id)} disabled={!canRun || isRunning}>
                    {isRunning ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Play className="h-4 w-4 mr-2" />}
                    Ausführen
                  </Button>
                </div>
              </CardHeader>
              {state && (
                <CardContent>
                  <ol className="space-y-2">
                    {state.steps.map((s) => (
                      <li key={s.step.id} className="flex items-start gap-3 text-sm border-l-2 pl-3 py-1" style={{ borderColor: s.status === "failed" ? "hsl(var(--destructive))" : s.status === "ok" ? "hsl(142 71% 45%)" : "hsl(var(--border))" }}>
                        <StatusIcon status={s.status} />
                        <div className="flex-1 min-w-0">
                          <div className="font-medium">{s.step.label}</div>
                          {s.message && (
                            <div className={`text-xs ${s.status === "failed" ? "text-destructive" : "text-muted-foreground"} break-words`}>{s.message}</div>
                          )}
                        </div>
                        {s.durationMs !== undefined && (
                          <span className="text-xs text-muted-foreground tabular-nums">{s.durationMs}ms</span>
                        )}
                      </li>
                    ))}
                    <li className="flex items-start gap-3 text-sm border-l-2 pl-3 py-1 mt-3 border-dashed">
                      <StatusIcon status={state.cleanup.status} />
                      <div className="flex-1">
                        <div className="font-medium">Cleanup (Aufräumen)</div>
                        {state.cleanup.message && (
                          <div className={`text-xs ${state.cleanup.status === "failed" ? "text-destructive" : "text-muted-foreground"}`}>
                            {state.cleanup.message}
                            {state.cleanup.remaining && state.cleanup.remaining.length > 0 && (
                              <div className="mt-1">Verblieben: {state.cleanup.remaining.map((r) => `${r.table}/${r.id.slice(0, 8)}`).join(", ")}</div>
                            )}
                          </div>
                        )}
                      </div>
                    </li>
                  </ol>
                </CardContent>
              )}
            </Card>
          );
        })}
      </div>

      <Card className="border-destructive/40">
        <CardHeader>
          <CardTitle className="text-base">Notfall: Test-Daten aufräumen</CardTitle>
          <CardDescription>
            Löscht alle Datensätze mit dem Prefix <code>[SELFTEST]</code> im aktuellen Tenant aus den Tabellen meetings, appointments, meeting_agenda_items und tasks.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button variant="destructive" onClick={handlePurge} disabled={!canRun || purging}>
            {purging ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Trash2 className="h-4 w-4 mr-2" />}
            Test-Datenmüll entfernen
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
