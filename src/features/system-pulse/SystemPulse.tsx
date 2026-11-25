import type { ReactElement } from "react";
import { Fragment, useEffect, useMemo, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Activity, ArrowDown, ArrowLeft, ArrowRight, ExternalLink, Shield } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { notify } from "@/lib/notify";
import { useAuth } from "@/hooks/useAuth";
import { useTenant } from "@/hooks/useTenant";
import { supabase } from "@/integrations/supabase/client";
import { featureCatalogHref } from "@/features/feature-catalog/securityLinks";
import { stepDiagnostic } from "@/features/selftest/stepDiagnostics";
import {
  PULSE_AREAS, PULSE_GROUPS, areaAssessment, assessRun, consecutiveFailures, durationTrend,
  gapSummary, historyByScenario, latestRunDetails, latestRuns, latestRunSteps, mergeRuns,
  type AreaAssessment, type GapsState, type HistoryRun, type PersistedRun, type PulseArea, type PulseLevel, type PulseWorkflow,
} from "./pulse";

interface Props { gaps: Array<{ table_name: string; severity: string }>; gapsState: GapsState }

type LevelEntry = { area: PulseArea; level: PulseLevel };

const dot: Record<PulseLevel, string> = { green: "bg-palette-green", yellow: "bg-warning", red: "bg-destructive", grey: "bg-muted-foreground/40" };
const text: Record<PulseLevel, string> = { green: "Alles in Ordnung", yellow: "Prüfen", red: "Fehler", grey: "Noch nie getestet" };
const stamp = (iso: string) => new Date(iso).toLocaleString("de-DE", { dateStyle: "short", timeStyle: "short" });
const statusLabel = (status?: string) =>
  status === "ok" ? "bestanden"
    : status === "failed" ? "fehlgeschlagen"
      : status === "running" ? "läuft …"
        : status === "blocked" ? "Voraussetzung fehlt"
          : status === "cancelled" ? "abgebrochen"
            : status ?? "noch nie gelaufen";
const stepLevel = (status?: string): PulseLevel => status === "ok" ? "green" : status === "failed" ? "red" : "grey";
const formatDuration = (ms?: number) => ms === undefined
  ? "Dauer unbekannt"
  : ms < 1000
    ? `${ms} ms`
    : `${(ms / 1000).toLocaleString("de-DE", { maximumFractionDigits: 1 })} s`;

const CURRENT_VERSION = import.meta.env.VITE_COMMIT_SHA as string | undefined;

const stepWidth = 160;
const connectorWidth = 24;

function ProcessChain({ title, children }: { title: string; children: ReactElement[] }) {
  const chainRef = useRef<HTMLDivElement>(null);
  const [columns, setColumns] = useState(1);

  useEffect(() => {
    const chain = chainRef.current;
    if (!chain) return;

    const observer = new ResizeObserver(([entry]) => {
      const width = entry.contentRect.width;
      setColumns(Math.max(1, Math.floor((width + connectorWidth) / (stepWidth + connectorWidth))));
    });
    observer.observe(chain);
    return () => observer.disconnect();
  }, []);

  const stepColumns = Math.min(columns, children.length);
  return (
    <div
      ref={chainRef}
      role="group"
      aria-label={`Prozesskette ${title}`}
      className="grid min-w-0"
      style={{
        gridTemplateColumns: Array.from({ length: stepColumns }, () => "minmax(0, 1fr)").join(` ${connectorWidth}px `),
      }}
    >
      {children.map((step, index) => {
        const row = Math.floor(index / stepColumns);
        const position = index % stepColumns;
        const goesLeft = row % 2 === 1;
        const cardColumn = (goesLeft ? stepColumns - 1 - position : position) * 2 + 1;
        const cardRow = row * 2 + 1;
        const wraps = position === stepColumns - 1;
        const Arrow = wraps ? ArrowDown : goesLeft ? ArrowLeft : ArrowRight;

        return (
          <Fragment key={step.key}>
            <div className="min-w-0" style={{ gridColumn: cardColumn, gridRow: cardRow }}>
              {step}
            </div>
            {index < children.length - 1 && (
              <span
                aria-hidden="true"
                className="grid h-6 place-items-center self-center text-muted-foreground"
                style={{
                  gridColumn: wraps ? cardColumn : cardColumn + (goesLeft ? -1 : 1),
                  gridRow: wraps ? cardRow + 1 : cardRow,
                }}
              >
                <Arrow className="h-4 w-4" />
              </span>
            )}
          </Fragment>
        );
      })}
    </div>
  );
}

export function SystemPulse({ gaps, gapsState }: Props) {
  const { currentTenant } = useTenant();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [open, setOpen] = useState<string | null>(null);
  const [openStep, setOpenStep] = useState<string | null>(null);
  const [onlyFailed, setOnlyFailed] = useState(false);
  const [liveRuns, setLiveRuns] = useState<Record<string, string>>({});
  const [runningArea, setRunningArea] = useState<string | null>(null);
  const [lastRunNotice, setLastRunNotice] = useState("");
  const controller = useRef<AbortController | null>(null);
  const runLock = useRef(false);

  // Mandantenweite Sicht: RLS lässt alle Mitglieder die Läufe des Mandanten lesen,
  // und der Puls soll den Systemzustand zeigen, nicht nur den letzten Lauf eines Nutzers.
  const runsQuery = useQuery({
    queryKey: ["selftest_runs_pulse", currentTenant?.id],
    enabled: Boolean(currentTenant?.id),
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_latest_selftest_runs", { p_tenant_id: currentTenant!.id });
      if (error) throw error;
      return (data ?? []) as PersistedRun[];
    },
    staleTime: 60_000,
  });

  // Verlauf ist eine eigene, optionale Abfrage: Fehlt die Verlaufs-RPC noch,
  // bleibt die Ampel nutzbar und nur Trend/Wiederholungen entfallen.
  const historyQuery = useQuery({
    queryKey: ["selftest_run_history", currentTenant?.id],
    enabled: Boolean(currentTenant?.id),
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_selftest_run_history", {
        p_tenant_id: currentTenant!.id, p_runs_per_scenario: 8,
      });
      if (error) throw error;
      return (data ?? []) as HistoryRun[];
    },
    staleTime: 60_000,
  });

  useEffect(() => { setLiveRuns({}); setOpenStep(null); setOnlyFailed(false); }, [currentTenant?.id]);

  const runs = useMemo(
    () => mergeRuns(latestRuns(runsQuery.data ?? []), liveRuns),
    [runsQuery.data, liveRuns],
  );
  const stepsByScenario = useMemo(() => latestRunSteps(runsQuery.data ?? []), [runsQuery.data]);
  const runDetails = useMemo(() => latestRunDetails(runsQuery.data ?? []), [runsQuery.data]);
  const histories = useMemo(() => historyByScenario(historyQuery.data ?? []), [historyQuery.data]);
  const loadingRuns = Boolean(currentTenant?.id) && runsQuery.isPending;
  const unknownRuns = !currentTenant?.id || runsQuery.isError;
  const latest = runsQuery.data?.[0]?.created_at;
  const now = Date.now();
  const assessScenario = (scenarioId: string) => assessRun(runDetails[scenarioId], { now, currentVersion: CURRENT_VERSION });

  const assessments = new Map<string, AreaAssessment>(PULSE_AREAS.map((area) => [
    area.id,
    areaAssessment(area, { runs, details: runDetails, now, currentVersion: CURRENT_VERSION }),
  ]));
  const levels: LevelEntry[] = PULSE_AREAS.map((area) => ({ area, level: assessments.get(area.id)!.level }));
  const count = (level: PulseLevel) => levels.filter((entry) => entry.level === level).length;
  const selected = levels.find((entry) => entry.area.id === open);
  const security = gapSummary(gaps, gapsState);
  const byId = new Map(levels.map((entry) => [entry.area.id, entry]));
  const grouped = new Set(PULSE_GROUPS.flatMap((group) => group.areas));
  const restLevels = levels.filter((entry) => !grouped.has(entry.area.id));

  const runScenarios = async (area: PulseArea, ids: string[], key: string) => {
    if (runLock.current || runningArea || !currentTenant?.id || !user?.id) return;
    runLock.current = true;
    const tenantId = currentTenant.id;
    const userId = user.id;
    try {
      const [{ SELFTEST_SCENARIOS }, { runSuite }, { saveRun }] = await Promise.all([
        import("@/features/selftest/registry"),
        import("@/features/selftest/runner"),
        import("@/features/selftest/history"),
      ]);
      const scenarios = ids
        .map((id) => SELFTEST_SCENARIOS.find((scenario) => scenario.id === id))
        .filter((scenario): scenario is (typeof SELFTEST_SCENARIOS)[number] => scenario !== undefined);
      if (scenarios.length === 0) {
        notify.error("Keine Szenarien zugeordnet", { description: area.title });
        return;
      }
      const writes = scenarios.some((scenario) => scenario.steps.some((step) => step.kind !== "logic"));
      if (writes && !window.confirm(`${scenarios.length} Selbsttest(s) für „${area.title}“ jetzt starten?\n\nEs entstehen echte Testdatensätze und Dateien, die anschließend aufgeräumt werden.`)) return;

      setRunningArea(key);
      setLiveRuns({});
      setLastRunNotice("");
      const activeController = new AbortController();
      controller.current = activeController;
      const results = await runSuite(scenarios, {
        tenantId, userId, keepData: false, signal: activeController.signal,
        onUpdate: (state) => setLiveRuns((previous) => ({ ...previous, [state.scenarioId]: state.status })),
      });
      for (const result of results) {
        const scenario = SELFTEST_SCENARIOS.find((entry) => entry.id === result.scenarioId);
        if (scenario) await saveRun(result, { tenantId, userId, title: scenario.title, keepData: false });
      }
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["selftest_runs_pulse", tenantId] }),
        queryClient.invalidateQueries({ queryKey: ["selftest_run_history", tenantId] }),
      ]);
      const failed = results.filter((result) => result.status !== "ok").length;
      const notice = `${area.title}: ${results.length - failed} von ${results.length} Tests bestanden`;
      setLastRunNotice(notice);
      if (failed > 0) notify.error(`${area.title}: ${failed} von ${results.length} Tests nicht bestanden`);
      else notify.success(`${area.title}: ${results.length} Tests bestanden`);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      setLastRunNotice(`${area.title}: Testlauf fehlgeschlagen – ${message}`);
      notify.error("Bereichstest fehlgeschlagen", { description: message });
    } finally {
      runLock.current = false;
      controller.current = null;
      // Live-Status ist nur während des Laufs gültig; danach zählt der
      // gespeicherte neueste Lauf aus der Abfrage.
      setLiveRuns({});
      setRunningArea(null);
    }
  };
  const runArea = (area: PulseArea) => void runScenarios(area, area.scenarios, area.id);
  const runWorkflow = (area: PulseArea, workflow: PulseWorkflow) =>
    void runScenarios(area, [workflow.scenario], `scenario:${workflow.scenario}`);
  const attentionIds = (area: PulseArea) =>
    area.scenarios.filter((id) => ["red", "yellow"].includes(assessScenario(id).level));
  const runAttention = (area: PulseArea) => void runScenarios(area, attentionIds(area), `attention:${area.id}`);

  const tile = ({ area, level }: LevelEntry) => {
    const active = runningArea === area.id;
    const assessment = assessments.get(area.id)!;
    const summary = active ? "Läuft …"
      : loadingRuns ? "wird geladen …"
        : unknownRuns ? "unbekannt"
          : assessment.level === "grey" && assessment.covered === 0 ? text.grey
            : assessment.reasons[0] ?? text[level];
    return (
      <button key={area.id} type="button" onClick={() => { setOpen(open === area.id ? null : area.id); setOpenStep(null); setOnlyFailed(false); }}
        aria-expanded={open === area.id} title={assessment.reasons.join("\n") || undefined}
        className={cn("rounded-lg border bg-card p-3 text-left transition-colors hover:bg-muted", open === area.id && "ring-2 ring-ring")}>
        <div className="flex items-center gap-2">
          <span aria-hidden className={cn("h-3 w-3 rounded-full", dot[level])} />
          <span className="font-medium">{area.title}</span>
        </div>
        <div className={cn("mt-1 text-xs", level === "red" ? "text-destructive" : "text-muted-foreground")}>{summary}</div>
        <div className="mt-0.5 text-[11px] tabular-nums text-muted-foreground">{assessment.covered}/{assessment.total} geprüft</div>
      </button>
    );
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2"><Activity className="h-4 w-4" /> System-Puls</CardTitle>
        <CardDescription>
          {loadingRuns ? "Testlage wird geladen …" : unknownRuns ? "Testlage unbekannt – Abfrage der gespeicherten Selbsttests fehlgeschlagen." : (
            <>
              {count("green")} grün · {count("yellow")} prüfen · {count("red")} Fehler · {count("grey")} ungetestet — aus den letzten funktionalen Selbsttests des Mandanten
              {latest ? ` · Stand ${stamp(latest)}` : ""}.
            </>
          )}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <details className="rounded-lg border p-2 text-xs text-muted-foreground">
          <summary className="cursor-pointer">Was bedeuten die Farben?</summary>
          <ul className="mt-2 grid gap-1 sm:grid-cols-2">
            <li className="flex items-center gap-1.5"><span aria-hidden className={cn("h-2 w-2 rounded-full", dot.green)} /> grün: aktuell bestanden (max. 7 Tage)</li>
            <li className="flex items-center gap-1.5"><span aria-hidden className={cn("h-2 w-2 rounded-full", dot.yellow)} /> gelb: unvollständig, veraltet, Demo-Lauf oder Aufräumen offen</li>
            <li className="flex items-center gap-1.5"><span aria-hidden className={cn("h-2 w-2 rounded-full", dot.red)} /> rot: mindestens ein Test fehlgeschlagen</li>
            <li className="flex items-center gap-1.5"><span aria-hidden className={cn("h-2 w-2 rounded-full", dot.grey)} /> grau: nie oder seit über 30 Tagen nicht getestet</li>
          </ul>
        </details>
        {PULSE_GROUPS.map((group) => {
          const groupLevels = group.areas
            .map((id) => byId.get(id))
            .filter((entry): entry is LevelEntry => Boolean(entry));
          if (groupLevels.length === 0) return null;
          return (
            <section key={group.id} className="space-y-2" aria-label={group.title}>
              <h3 className="text-xs font-medium text-muted-foreground">{group.title}</h3>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">{groupLevels.map(tile)}</div>
            </section>
          );
        })}
        {restLevels.length > 0 && (
          <section className="space-y-2" aria-label="Weitere Bereiche">
            <h3 className="text-xs font-medium text-muted-foreground">Weitere Bereiche</h3>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">{restLevels.map(tile)}</div>
          </section>
        )}
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border p-3">
          <div className="flex items-center gap-2">
            <Shield aria-hidden className="h-4 w-4 text-muted-foreground" />
            <span className="font-medium">Sicherheitsprüfung (RLS)</span>
            <span className="text-xs text-muted-foreground">getrennt von den Funktions-Selbsttests</span>
          </div>
          <div className="flex items-center gap-2 text-sm" role="status">
            <span aria-hidden className={cn("h-2.5 w-2.5 rounded-full", dot[security.level])} />
            {security.unknown ? (
              <span className="text-muted-foreground">
                unbekannt{gapsState === "error" ? " – Abfrage fehlgeschlagen" : " – wird geladen …"}
              </span>
            ) : (
              <span>
                <strong className="tabular-nums">{security.critical}</strong> kritische Lücken ·{" "}
                <strong className="tabular-nums">{security.warning}</strong> Warnungen
              </span>
            )}
          </div>
        </div>
        {selected && (() => {
          const selectedAssessment = assessments.get(selected.area.id)!;
          const areaGaps = [...new Map(
            gaps.filter((gap) => selected.area.tables.includes(gap.table_name)).map((gap) => [`${gap.table_name}|${gap.severity}`, gap]),
          ).values()];
          return (
            <div className="rounded-lg border bg-muted/40 p-3 text-sm space-y-2">
              <div className="space-y-0.5">
                <div className="font-medium">{selected.area.title}: {text[selected.level]}</div>
                {selectedAssessment.reasons.length > 0 && (
                  <p className="text-xs text-muted-foreground">Auffällig: {selectedAssessment.reasons.join(" · ")}</p>
                )}
              </div>
              {selected.area.tables.length > 0 && (
                <div className="flex flex-wrap items-center gap-1.5 text-xs">
                  <span className="text-muted-foreground">Haupttabellen:</span>
                  {selected.area.tables.map((table) => (
                    <code key={table} className="rounded border bg-background px-1.5 py-0.5 font-mono text-[11px]">{table}</code>
                  ))}
                </div>
              )}
              {areaGaps.length > 0 && (
                <p className="text-xs text-muted-foreground">
                  <strong className="text-foreground">RLS-Befunde in den Haupttabellen:</strong>{" "}
                  {areaGaps.map((gap) => `${gap.table_name} (${gap.severity})`).join(" · ")}
                </p>
              )}
              {(loadingRuns || unknownRuns) && (
                <p className="text-xs text-muted-foreground">
                  Ergebnisse {loadingRuns ? "werden geladen …" : "sind unbekannt."}
                </p>
              )}
              {historyQuery.isError && (
                <p className="text-xs text-muted-foreground">
                  Verlauf nicht verfügbar – die Verlaufs-RPC antwortet nicht.
                </p>
              )}
              <div className="flex flex-wrap items-center justify-between gap-2">
                <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <input type="checkbox" checked={onlyFailed} onChange={(event) => setOnlyFailed(event.target.checked)} />
                  Nur fehlgeschlagene Schritte
                </label>
                <span className="text-[11px] text-muted-foreground">{selectedAssessment.covered}/{selectedAssessment.total} Szenarien geprüft</span>
              </div>
              {selected.area.workflows.map((workflow) => {
                const results = stepsByScenario[workflow.scenario] ?? {};
                const storedRun = runDetails[workflow.scenario];
                const assessment = assessScenario(workflow.scenario);
                const title = storedRun?.title ?? workflow.title;
                const declaredIds = new Set(workflow.steps.map((step) => step.id));
                const extraSteps = Object.values(results)
                  .filter((result) => !declaredIds.has(result.id))
                  .map((result) => ({ id: result.id, label: result.label ?? result.id }));
                const chain = [...workflow.steps, ...extraSteps];
                const counts = { ok: 0, failed: 0, other: 0 };
                for (const step of chain) {
                  const status = results[step.id]?.status;
                  if (status === "ok") counts.ok += 1;
                  else if (status === "failed") counts.failed += 1;
                  else counts.other += 1;
                }
                const failedSteps = storedRun?.failedSteps ?? counts.failed;
                const visibleSteps = onlyFailed ? chain.filter((step) => results[step.id]?.status === "failed") : chain;
                const history = histories[workflow.scenario] ?? [];
                const streak = consecutiveFailures(history);
                const trend = durationTrend(history);
                const slowest = chain.reduce<{ label: string; durationMs: number } | null>((best, step) => {
                  const durationMs = results[step.id]?.durationMs;
                  if (durationMs === undefined) return best;
                  return !best || durationMs > best.durationMs ? { label: step.label, durationMs } : best;
                }, null);
                const runningWorkflow = runningArea === `scenario:${workflow.scenario}`;
                const workflowGaps = gaps.filter((gap) => workflow.tables?.includes(gap.table_name));
                const historyLabel = [...history].reverse()
                  .map((run) => `${stamp(run.created_at)} ${statusLabel(run.status)}`)
                  .join(", ");

                return (
                  <div key={workflow.scenario} className="space-y-1.5">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div className="min-w-0 space-y-0.5">
                        <div className="flex flex-wrap items-baseline gap-2">
                          <span className="text-xs font-medium">{title}</span>
                          <code className="hidden text-[10px] text-muted-foreground sm:inline">{workflow.scenario}</code>
                          {assessment.level !== "green" && assessment.reason && (
                            <span className={cn(
                              "rounded px-1.5 py-0.5 text-[10px]",
                              assessment.level === "red" ? "bg-destructive/10 text-destructive" : "bg-background text-muted-foreground",
                            )}>{assessment.reason}</span>
                          )}
                        </div>
                        <p className="text-[11px] tabular-nums text-muted-foreground">
                          {storedRun ? (
                            <>
                              Zuletzt {stamp(storedRun.createdAt)} · {formatDuration(storedRun.durationMs)}
                              {(storedRun.totalSteps ?? 0) > 0 && (
                                <> · {storedRun.totalSteps} Schritte · {failedSteps} fehlgeschlagen</>
                              )}
                            </>
                          ) : "Noch kein gespeicherter Lauf"}
                        </p>
                      </div>
                      <Button size="sm" variant="outline" onClick={() => runWorkflow(selected.area, workflow)}
                        disabled={runningArea !== null} aria-label={`${title} erneut testen`}>
                        {runningWorkflow ? "Läuft …" : "Erneut testen"}
                      </Button>
                    </div>
                    {workflow.description && <p className="text-xs text-muted-foreground">{workflow.description}</p>}
                    {workflow.checks && workflow.checks.length > 0 && (
                      <details className="text-xs text-muted-foreground">
                        <summary className="cursor-pointer">Geprüft ({workflow.checks.length})</summary>
                        <p className="mt-1">{workflow.checks.join(" · ")}</p>
                      </details>
                    )}
                    {workflow.features.length > 0 && (
                      <details className="text-xs text-muted-foreground">
                        <summary className="cursor-pointer">Betroffene Funktionen ({workflow.features.length})</summary>
                        <div className="mt-1 flex flex-wrap gap-1">
                          {workflow.features.map((feature) => (
                            <Link key={feature} to={featureCatalogHref(feature)}
                              className="rounded border bg-background px-1.5 py-0.5 font-mono text-[10px] hover:bg-muted">
                              {feature}
                            </Link>
                          ))}
                        </div>
                        {workflow.tables && workflow.tables.length > 0 && (
                          <p className="mt-1">Tabellen: {workflow.tables.join(" · ")}</p>
                        )}
                        {workflowGaps.length > 0 && (
                          <p className="mt-1">RLS: {workflowGaps.map((gap) => `${gap.table_name} (${gap.severity})`).join(" · ")}</p>
                        )}
                      </details>
                    )}
                    {history.length > 0 && (
                      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
                        <span className="flex items-center gap-1">
                          Verlauf:
                          <span className="flex items-center gap-0.5" aria-label={`Letzte ${history.length} Läufe: ${historyLabel}`}>
                            {[...history].reverse().map((run, index) => (
                              <span key={`${run.created_at}-${index}`} aria-hidden
                                title={`${stamp(run.created_at)} · ${statusLabel(run.status)}${run.duration_ms !== null ? ` · ${formatDuration(run.duration_ms)}` : ""}`}
                                className={cn("h-1.5 w-1.5 rounded-full", dot[stepLevel(run.status)])} />
                            ))}
                          </span>
                        </span>
                        {streak > 1 && <span className="text-destructive">{streak}× in Folge fehlgeschlagen</span>}
                        {trend && trend.direction !== "flat" && (
                          <span>Dauer {trend.deltaPct > 0 ? "+" : ""}{trend.deltaPct} % zum Vorlauf</span>
                        )}
                        {slowest && <span>langsamster Schritt: {slowest.label} ({formatDuration(slowest.durationMs)})</span>}
                      </div>
                    )}
                    {visibleSteps.length === 0 ? (
                      <p className="text-xs text-muted-foreground">Keine fehlgeschlagenen Schritte in diesem Workflow.</p>
                    ) : (
                      <ProcessChain title={title}>
                        {visibleSteps.map((step) => {
                          const key = `${workflow.scenario}:${step.id}`;
                          const result = results[step.id];
                          const level = stepLevel(result?.status);
                          const position = chain.findIndex((entry) => entry.id === step.id) + 1;
                          return (
                            <div key={step.id} data-testid="pulse-step" className={cn(
                              "relative h-full rounded border bg-background p-1.5 pr-6 text-xs",
                              level === "red" && "border-destructive/50",
                              level === "green" && "border-emerald-500/40",
                            )}>
                              <div className="flex items-center gap-1">
                                <span className="text-[10px] tabular-nums text-muted-foreground">{position}</span>
                                <span aria-hidden className={cn("h-2 w-2 shrink-0 rounded-full", dot[level])} />
                              </div>
                              {result?.status === "failed" ? (
                                <button type="button" onClick={() => setOpenStep(openStep === key ? null : key)}
                                  aria-expanded={openStep === key} aria-label={`${step.label}: fehlgeschlagen`}
                                  className="mt-0.5 block w-full whitespace-normal break-words text-left leading-snug underline-offset-2 hover:underline">
                                  {step.label}
                                </button>
                              ) : (
                                <span aria-label={`${step.label}: ${statusLabel(result?.status)}`}
                                  className="mt-0.5 block whitespace-normal break-words leading-snug">
                                  {step.label}
                                </span>
                              )}
                              {(() => {
                                const diagnostic = result ? stepDiagnostic(result) : null;
                                if (!diagnostic || (!diagnostic.code && !diagnostic.summary)) return null;
                                return (
                                  <div data-testid="pulse-step-diagnostic" className="mt-0.5 break-words text-[10px] leading-snug text-destructive">
                                    {diagnostic.code ? <span className="font-mono">Code {diagnostic.code}</span> : null}
                                    {diagnostic.code && diagnostic.summary ? " · " : ""}
                                    {diagnostic.summary}
                                  </div>
                                );
                              })()}
                              {result?.durationMs !== undefined && (
                                <div className="mt-1 text-[10px] tabular-nums text-muted-foreground">{formatDuration(result.durationMs)}</div>
                              )}
                              {workflow.features[0] && (
                                <Link to={featureCatalogHref(workflow.features[0])} aria-label={`${step.label} im Funktionskatalog öffnen`}
                                  className="absolute right-1.5 top-1.5 text-muted-foreground hover:text-foreground">
                                  <ExternalLink aria-hidden className="h-3 w-3" />
                                </Link>
                              )}
                            </div>
                          );
                        })}
                      </ProcessChain>
                    )}
                    {extraSteps.length > 0 && (
                      <p className="text-[11px] text-muted-foreground">
                        {extraSteps.length} Schritt(e) aus dem Lauf ergänzt – nicht im Artefakt deklariert.
                      </p>
                    )}
                    {workflow.steps.map((step) => ({ step, result: results[step.id] }))
                      .filter(({ step, result }) => openStep === `${workflow.scenario}:${step.id}` && result?.message)
                      .map(({ step, result }) => (
                        <p key={step.id} role="alert" className="rounded border border-destructive/40 bg-destructive/5 p-2 text-xs text-destructive">
                          {result?.message}
                        </p>
                      ))}
                  </div>
                );
              })}
              <p role="status" aria-live="polite" className="min-h-4 text-xs text-muted-foreground">
                {lastRunNotice || (runningArea ? "Test läuft …" : "")}
              </p>
              <div className="flex flex-wrap gap-2 pt-1">
                <Button size="sm" onClick={() => runArea(selected.area)} disabled={runningArea !== null}>
                  {runningArea === selected.area.id ? "Läuft …" : "▶ Diesen Bereich jetzt testen"}
                </Button>
                <Button size="sm" variant="outline" onClick={() => runAttention(selected.area)}
                  disabled={runningArea !== null || attentionIds(selected.area).length === 0}>
                  Nur auffällige testen ({attentionIds(selected.area).length})
                </Button>
                {runningArea && (
                  <Button size="sm" variant="outline" onClick={() => controller.current?.abort()}>
                    Nach diesem Schritt stoppen
                  </Button>
                )}
                <Button size="sm" variant="outline" onClick={() => navigate("/selbsttest")}>
                  Selbsttests öffnen <ArrowRight className="ml-1 h-3 w-3" />
                </Button>
              </div>
            </div>
          );
        })()}
      </CardContent>
    </Card>
  );
}
