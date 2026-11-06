import { SharedRunHistory } from "./SharedRunHistory";
import { saveRun } from "../history";
import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Loader2, CheckCircle2, XCircle, Clock, SkipForward, Play, Trash2, AlertTriangle, Download, Square } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useTenant } from "@/hooks/useTenant";
import { notify } from "@/lib/notify";
import { SELFTEST_SCENARIOS } from "../registry";
import { cleanupCreated, runSuite } from "../runner";
import { downloadReports, needsCleanup, readReports, saveReport, toReport, type RunReport } from "../reports";
import type { ScenarioRunState, StepStatus, TestScenario } from "../types";
import coverage from "../coverage-summary.json";
import { findLegacySelftestRecords } from "../artifacts";

const labels: Record<ScenarioRunState["status"], string> = {
  idle: "Noch nicht geprüft", running: "Läuft", ok: "Bestanden", failed: "Fehlgeschlagen", cancelled: "Abgebrochen", blocked: "Voraussetzung fehlt",
};
function StatusIcon({ status }: { status: StepStatus }) {
  if (status === "ok") return <CheckCircle2 aria-label="Bestanden" className="h-4 w-4 text-palette-green" />;
  if (status === "failed") return <XCircle aria-label="Fehlgeschlagen" className="h-4 w-4 text-destructive" />;
  if (status === "running") return <Loader2 aria-label="Läuft" className="h-4 w-4 animate-spin" />;
  if (status === "skipped") return <SkipForward aria-label="Übersprungen" className="h-4 w-4 text-muted-foreground" />;
  return <Clock aria-label="Ausstehend" className="h-4 w-4 text-muted-foreground" />;
}
const pure = (scenario: TestScenario) => scenario.steps.every(s => s.kind === "logic");

export function SelftestView() {
  const { user } = useAuth();
  const { currentTenant } = useTenant();
  const navigate = useNavigate();
  const [runs, setRuns] = useState<Record<string, ScenarioRunState>>({});
  const [reports, setReports] = useState<RunReport[]>([]);
  const [busy, setBusy] = useState(false);
  const [stopping, setStopping] = useState(false);
  const [storageFailed, setStorageFailed] = useState(false);
  const [selection, setSelection] = useState("all");
  const [summary, setSummary] = useState("");
  const lock = useRef(false);
  const controller = useRef<AbortController | null>(null);
  const tenantId = currentTenant?.id ?? "";
  const userId = user?.id ?? "";

  useEffect(() => {
    setReports(readReports(tenantId, userId));
    setRuns({});
    setSummary("");
    return () => { controller.current?.abort(); };
  }, [tenantId, userId]);

  const selected = SELFTEST_SCENARIOS.filter(s => selection === "all" ||
    (selection === "logic" ? pure(s) : selection === "permissions" ? s.features.includes("permissions") : !pure(s)));

  const remember = (state: ScenarioRunState) => {
    setRuns(previous => ({ ...previous, [state.scenarioId]: state }));
    const report = toReport(state);
    if (!saveReport(report)) setStorageFailed(true);
    setReports(previous => [report, ...previous.filter(r => r.runId !== state.runId)]);
  };

  const handleRun = async (scenarios: TestScenario[], keepData = false) => {
    if (lock.current || !scenarios.length) return;
    const writes = scenarios.some(s => !pure(s));
    if (writes && (!tenantId || !userId)) return;
    if (writes && !window.confirm(`${scenarios.length} Szenario(en) im Büro „${currentTenant?.name}“ starten?\n\nEs entstehen echte Testdatensätze und Dateien. ${keepData ? "Erfolgreiche Demo-Daten werden behalten." : "Testdaten werden anschließend aufgeräumt."}`)) return;
    lock.current = true;
    setBusy(true);
    setStopping(false);
    setSummary("");
    const activeController = new AbortController();
    controller.current = activeController;
    try {
      const results = await runSuite(scenarios, { tenantId, userId, keepData, signal: activeController.signal, onUpdate: remember });
      if (tenantId && userId) {
        for (const result of results) {
          const scenario = scenarios.find(s => s.id === result.scenarioId)!;
          await saveRun(result, { tenantId, userId, title: scenario.title, keepData });
        }
      }
      const counts = { ok: 0, failed: 0, blocked: 0, cancelled: 0 };
      results.forEach(r => { if (r.status in counts) counts[r.status as keyof typeof counts] += 1; });
      const text = `${counts.ok} bestanden · ${counts.failed} fehlgeschlagen · ${counts.blocked} Voraussetzung fehlt · ${counts.cancelled} abgebrochen · ${scenarios.length - results.length} nicht gestartet`;
      setSummary(text);
      if (counts.ok === scenarios.length) notify.success("Testsuite bestanden", { description: text });
      else notify.error("Testsuite nicht vollständig bestanden", { description: text });
    } catch (error) {
      setSummary("Testsuite konnte nicht vollständig ausgeführt werden.");
      notify.error("Testlauf unterbrochen", { description: error instanceof Error ? error.message : String(error) });
    } finally {
      controller.current = null;
      lock.current = false;
      setBusy(false);
      setStopping(false);
    }
  };

  const scopedReports = reports.filter(r => r.tenantId === tenantId && r.userId === userId);
  const pending = scopedReports.filter(needsCleanup);
  const handleFindLegacy = async () => {
    if (lock.current || !userId || !tenantId) return;
    lock.current = true;
    setBusy(true);
    try {
      const found = await findLegacySelftestRecords(tenantId, userId);
      const records = found.filter(record => !pending.some(run => run.records.some(r => r.table === record.table && r.id === record.id)));
      if (!records.length) { notify.info("Keine zusätzlichen eigenen Testdaten gefunden"); return; }
      const report = toReport({ runId: crypto.randomUUID(), scenarioId: "recovered-demo-data", tenantId, userId,
        status: "cancelled", mode: "demo", startedAt: Date.now(), finishedAt: Date.now(), steps: [], records, storageObjects: [],
        cleanup: { status: "pending", message: "Ältere eigene Testdaten gefunden; noch nicht entfernt." } });
      if (!saveReport(report)) setStorageFailed(true);
      setReports(previous => [report, ...previous]);
      notify.info(`${records.length} eigene Testdatensätze gefunden`, { description: "Über „Läufe aufräumen“ gezielt entfernen." });
    } catch (error) {
      notify.error("Suche nach Testdaten fehlgeschlagen", { description: error instanceof Error ? error.message : String(error) });
    } finally { lock.current = false; setBusy(false); }
  };
  const handleCleanup = async () => {
    if (lock.current || !userId || !tenantId || !pending.length) return;
    if (!window.confirm(`Testdaten aus ${pending.length} aufgezeichneten Läufen in diesem Büro entfernen?`)) return;
    lock.current = true;
    setBusy(true);
    try {
      let failed = 0;
      for (let run of pending) {
        const result = await cleanupCreated(run.cleanup.remaining ?? run.records, run.cleanup.storageRemaining ?? run.storageObjects, (records, storageObjects) => {
          run = { ...run, records, storageObjects, cleanup: { ...run.cleanup, remaining: records, storageRemaining: storageObjects } };
          if (!saveReport(run)) setStorageFailed(true);
        });
        const updated: RunReport = { ...run, links: [], status: run.status === "running" ? "cancelled" : run.status,
          finishedAt: run.finishedAt ?? Date.now(), cleanup: { status: result.ok ? "ok" : "failed", message: [result.message, ...result.errors].join(" "), remaining: result.remaining, storageRemaining: result.storageRemaining } };
        if (!saveReport(updated)) setStorageFailed(true);
        if (!result.ok) failed++;
        setReports(previous => [updated, ...previous.filter(r => r.runId !== updated.runId)]);
        setRuns(previous => { const next = { ...previous }; if (next[run.scenarioId]?.runId === run.runId) delete next[run.scenarioId]; return next; });
      }
      if (failed) notify.error(`${failed} Lauf/Läufe konnten nicht vollständig aufgeräumt werden`, { description: "Verbliebene Daten und Fehlermeldungen stehen bei den offenen Läufen." });
      else notify.success("Aufgezeichnete Testdaten aufgeräumt");
    } finally { lock.current = false; setBusy(false); }
  };

  return <div data-testid="selftest-center" data-tenant-id={tenantId} className="container mx-auto p-6 max-w-5xl space-y-6">
    <div>
      <h1 className="text-2xl font-bold">Selbsttest-Center</h1>
      <p className="text-muted-foreground mt-1">Geschäftsregeln, Datenhaltung und ausgewählte Fachabläufe prüfen. Für jeden Lauf siehst du Prüfumfang, Ergebnis und Aufräumstatus.</p>
    </div>
    <Alert>
      <AlertTriangle className="h-4 w-4" />
      <AlertTitle>Testumgebung und Prüfumfang</AlertTitle>
      <AlertDescription>Die Workflow-Tests erzeugen echte Daten im Büro „{currentTenant?.name ?? "kein Büro gewählt"}“. Nutze dafür vorzugsweise ein Testbüro. Ein bestandener Lauf bestätigt die aufgeführten Prüfungen. Die vollständige Bedienung aller Oberflächen und externer E-Mail-Versand sind damit nicht abgedeckt.</AlertDescription>
    </Alert>
    {storageFailed && <Alert variant="destructive"><AlertTitle>Lokale Speicherung nicht verfügbar</AlertTitle><AlertDescription>Die Laufhistorie konnte nicht gespeichert werden. Exportiere den Bericht vor dem Schließen dieser Seite.</AlertDescription></Alert>}
    <Card>
      <CardHeader><CardTitle>Testsuite starten</CardTitle><CardDescription>Szenarien laufen nacheinander. Fehler eines Szenarios verhindern die anderen Prüfungen nicht.</CardDescription></CardHeader>
      <CardContent className="space-y-3">
        <div className="flex gap-3 flex-wrap items-center">
          <select aria-label="Testsuite" className="border rounded-md bg-background p-2" value={selection} onChange={e => setSelection(e.target.value)} disabled={busy}>
            <option value="all">Alle Szenarien</option><option value="logic">Nur Geschäftsregeln (ohne Schreibzugriff)</option><option value="workflows">Datenbank und Fachabläufe</option><option value="permissions">Zugriffsschutz</option>
          </select>
          <Button onClick={() => handleRun(selected)} disabled={busy || (selected.some(s => !pure(s)) && (!userId || !tenantId))}><Play className="h-4 w-4 mr-2" />Testsuite ausführen ({selected.length})</Button>
          {busy && controller.current && <Button variant="outline" disabled={stopping} onClick={() => { controller.current?.abort(); setStopping(true); }}><Square className="h-4 w-4 mr-2" />{stopping ? "Warte auf laufenden Schritt …" : "Nach diesem Schritt stoppen"}</Button>}
          <Button variant="outline" disabled={!scopedReports.length} onClick={() => downloadReports(scopedReports)}><Download className="h-4 w-4 mr-2" />Bericht exportieren</Button>
        </div>
        <p role="status" data-testid="suite-result" className="text-sm" aria-live="polite">{summary || (busy ? "Testsuite läuft …" : "Bereit.")}</p>
      </CardContent>
    </Card>
    <Card>
      <CardHeader><CardTitle>Abdeckung und offene Bereiche</CardTitle><CardDescription>Ein vorhandenes Szenario ist noch kein erfolgreicher Testlauf.</CardDescription></CardHeader>
      <CardContent className="space-y-3 text-sm">
        <p>{coverage.counts.scenario} von {coverage.counts.total} Tabellen haben ein Szenario. {coverage.counts.deferred} sind als Ausbau offen, {coverage.counts.excluded} ausgenommen und {coverage.counts.missing} noch nicht eingeordnet. Ausnahmen zählen nicht als bestanden.</p>
        <details><summary className="cursor-pointer">Offene Fachbereiche ansehen</summary><p className="mt-2 text-muted-foreground break-words">{coverage.tables.filter(t => t.status === "deferred" || t.status === "missing").map(t => t.table).join(", ")}</p></details>
      </CardContent>
    </Card>
    {tenantId && <SharedRunHistory tenantId={tenantId} refreshKey={summary} />}
    {SELFTEST_SCENARIOS.map(scenario => {
      const live = runs[scenario.id];
      const state = live?.tenantId === tenantId && live.userId === userId ? live : scopedReports.find(r => r.scenarioId === scenario.id);
      const running = state?.status === "running" && busy;
      return <Card key={scenario.id} data-testid={`scenario-${scenario.id}`}>
        <CardHeader>
          <div className="flex flex-wrap justify-between gap-3">
            <div className="space-y-2"><CardTitle className="text-base">{scenario.title}</CardTitle>
              <div className="flex gap-2 flex-wrap"><Badge variant="outline">{pure(scenario) ? "Geschäftsregeln" : scenario.steps.some(s => s.kind === "workflow") ? "Fachablauf + Datenbank" : "Datenbank"}</Badge>
                <Badge data-testid="scenario-result" variant={state?.status === "failed" || state?.status === "blocked" ? "destructive" : "secondary"}>{state ? state.status === "running" && !busy ? "Unterbrochener Lauf" : labels[state.status] : "Noch nicht geprüft"}</Badge>
              </div>
              <CardDescription>{scenario.description}</CardDescription>
            </div>
            <div className="flex gap-2 items-start"><Button disabled={busy || (!pure(scenario) && (!userId || !tenantId))} onClick={() => handleRun([scenario])}>{running ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Play className="h-4 w-4 mr-2" />}Ausführen</Button>
              {!pure(scenario) && <Button variant="secondary" disabled={busy || !userId || !tenantId} onClick={() => handleRun([scenario], true)}>Demo-Daten erzeugen</Button>}</div>
          </div>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <p><strong>Geprüft:</strong> {(scenario.checks ?? ["Anlegen, Ändern und Rücklesen der im Szenario verwendeten Datensätze"]).join(" · ")}</p>
          <p className="text-muted-foreground"><strong>Grenzen:</strong> {(scenario.limitations ?? ["Keine vollständige Bedienprüfung der Oberfläche oder externer Dienste"]).join(" · ")}</p>
          {scenario.requiredRoles && <p>Benötigte Rolle: {scenario.requiredRoles.join(" oder ")}.</p>}
          {state && <>
            <p className="text-xs text-muted-foreground">Lauf {state.runId} · {state.mode === "demo" ? "Demo" : "Test"} · {state.startedAt ? new Date(state.startedAt).toLocaleString("de-DE") : ""}</p>
            {state.message && <p className="text-destructive">{state.message}</p>}
            <ol className="space-y-2">{state.steps.map(s => <li key={s.step.id} className="flex gap-3 border-l-2 pl-3 py-1">
              <StatusIcon status={s.status} /><div className="flex-1 min-w-0"><div>{s.step.label}</div>{s.message && <p className={s.status === "failed" ? "text-destructive text-xs" : "text-muted-foreground text-xs"}>{s.message}</p>}
                {s.details !== undefined && <details className="mt-1"><summary className="cursor-pointer text-xs">Prüfdetails / Soll und Ist</summary><pre className="whitespace-pre-wrap break-all bg-muted rounded p-2 text-xs">{JSON.stringify(s.details, null, 2)}</pre></details>}
              </div>{s.durationMs !== undefined && <span className="text-xs tabular-nums">{s.durationMs} ms</span>}
            </li>)}</ol>
            <div className="flex gap-3 border-t pt-3"><StatusIcon status={state.cleanup.status} /><p><strong>Aufräumen:</strong> {state.cleanup.message ?? "Ausstehend"}</p></div>
            {state.links?.map(link => <Button variant="outline" key={link.href} onClick={() => navigate(link.href)}>{link.label}</Button>)}
          </>}
        </CardContent>
      </Card>;
    })}
    <Card>
      <CardHeader><CardTitle>Aufgezeichnete Testdaten aufräumen</CardTitle><CardDescription>Entfernt gezielt die Datensätze und Dateien der in diesem Browser aufgezeichneten Läufe im aktuellen Büro. Dazu gehören Demo-Daten und unterbrochene Läufe.</CardDescription></CardHeader>
      <CardContent className="space-y-3"><div className="flex gap-3 flex-wrap"><Button variant="destructive" disabled={busy || !userId || !tenantId || !pending.length} onClick={handleCleanup}><Trash2 className="h-4 w-4 mr-2" />{pending.length} Lauf/Läufe aufräumen</Button><Button variant="outline" disabled={busy || !userId || !tenantId} onClick={handleFindLegacy}>Ältere eigene Testdaten suchen</Button></div>
        {pending.length > 0 && <details><summary className="cursor-pointer text-sm">Offene Läufe und Aufräumfehler</summary><ul className="space-y-2 mt-2 text-xs">{pending.map(run => <li key={run.runId} className="break-words">{run.scenarioId} · {run.runId}: {run.cleanup.message ?? "Aufräumen steht aus."}</li>)}</ul></details>}
      </CardContent>
    </Card>
  </div>;
}
