import { Fragment, useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Activity, ArrowRight, ExternalLink, Shield } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { notify } from "@/lib/notify";
import { useAuth } from "@/hooks/useAuth";
import { useTenant } from "@/hooks/useTenant";
import { supabase } from "@/integrations/supabase/client";
import { featureCatalogHref } from "@/features/feature-catalog/securityLinks";
import {
  PULSE_AREAS, PULSE_GROUPS, areaLevel, gapSummary, latestRunDetails, latestRuns, latestRunSteps,
  type GapsState, type PersistedRun, type PulseArea, type PulseLevel,
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

type ScenarioInfo = { title: string; description: string; checks?: string[] };

export function SystemPulse({ gaps, gapsState }: Props) {
  const { currentTenant } = useTenant();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [open, setOpen] = useState<string | null>(null);
  const [openStep, setOpenStep] = useState<string | null>(null);
  const [liveRuns, setLiveRuns] = useState<Record<string, string>>({});
  const [runningArea, setRunningArea] = useState<string | null>(null);
  const [scenarioInfo, setScenarioInfo] = useState<Record<string, ScenarioInfo>>({});

  // Mandantenweite Sicht: RLS lässt alle Mitglieder die Läufe des Mandanten lesen,
  // und der Puls soll den Systemzustand zeigen, nicht nur den letzten Lauf eines Nutzers.
  const runsQuery = useQuery({
    queryKey: ["selftest_runs_pulse", currentTenant?.id],
    enabled: Boolean(currentTenant?.id),
    queryFn: async () => {
      // DISTINCT ON in der Datenbank: genau der neueste Lauf je Szenario, inklusive Schritten.
      const { data, error } = await supabase.rpc("get_latest_selftest_runs", { p_tenant_id: currentTenant!.id });
      if (error) throw error;
      return (data ?? []) as PersistedRun[];
    },
    staleTime: 60_000,
  });

  useEffect(() => { setLiveRuns({}); setOpenStep(null); }, [currentTenant?.id]);

  // Beschreibung und Prüfumfang stehen nur in der Szenario-Registry. Sie wird
  // erst beim Öffnen eines Bereichs geladen, damit das Cockpit leicht bleibt.
  useEffect(() => {
    const area = open ? PULSE_AREAS.find((entry) => entry.id === open) : undefined;
    if (!area) return;
    let active = true;
    void import("@/features/selftest/registry").then(({ SELFTEST_SCENARIOS }) => {
      if (!active) return;
      const byId = new Map(SELFTEST_SCENARIOS.map((scenario) => [scenario.id, scenario]));
      setScenarioInfo((previous) => {
        const next = { ...previous };
        for (const id of area.scenarios) {
          const scenario = byId.get(id);
          if (scenario) next[id] = { title: scenario.title, description: scenario.description, checks: scenario.checks };
        }
        return next;
      });
    }).catch(() => {
      // Die Lauf-Metadaten bleiben sichtbar; nur Beschreibung und Prüfumfang fehlen.
    });
    return () => { active = false; };
  }, [open]);

  const runs = useMemo(
    () => ({ ...latestRuns(runsQuery.data ?? []), ...liveRuns }),
    [runsQuery.data, liveRuns],
  );
  const stepsByScenario = useMemo(() => latestRunSteps(runsQuery.data ?? []), [runsQuery.data]);
  const runDetails = useMemo(() => latestRunDetails(runsQuery.data ?? []), [runsQuery.data]);
  const loadingRuns = Boolean(currentTenant?.id) && runsQuery.isPending;
  const unknownRuns = !currentTenant?.id || runsQuery.isError;
  const latest = runsQuery.data?.[0]?.created_at;

  const levels: LevelEntry[] = PULSE_AREAS.map((area) => ({ area, level: areaLevel(area, { runs }) }));
  const count = (level: PulseLevel) => levels.filter((entry) => entry.level === level).length;
  const selected = levels.find((entry) => entry.area.id === open);
  const security = gapSummary(gaps, gapsState);
  const byId = new Map(levels.map((entry) => [entry.area.id, entry]));
  const grouped = new Set(PULSE_GROUPS.flatMap((group) => group.areas));
  const restLevels = levels.filter((entry) => !grouped.has(entry.area.id));

  const runArea = async (area: PulseArea) => {
    if (runningArea || !currentTenant?.id || !user?.id) return;
    if (!window.confirm(`${area.scenarios.length} Selbsttest(s) für „${area.title}“ jetzt starten?\n\nEs entstehen echte Testdatensätze und Dateien, die anschließend aufgeräumt werden.`)) return;
    const tenantId = currentTenant.id;
    const userId = user.id;
    setRunningArea(area.id);
    try {
      const [{ SELFTEST_SCENARIOS }, { runSuite }, { saveRun }] = await Promise.all([
        import("@/features/selftest/registry"),
        import("@/features/selftest/runner"),
        import("@/features/selftest/history"),
      ]);
      const scenarios = area.scenarios
        .map((id) => SELFTEST_SCENARIOS.find((scenario) => scenario.id === id))
        .filter((scenario): scenario is (typeof SELFTEST_SCENARIOS)[number] => scenario !== undefined);
      if (scenarios.length === 0) {
        notify.error("Keine Szenarien zugeordnet", { description: area.title });
        return;
      }
      const results = await runSuite(scenarios, {
        tenantId, userId, keepData: false,
        onUpdate: (state) => setLiveRuns((previous) => ({ ...previous, [state.scenarioId]: state.status })),
      });
      for (const result of results) {
        const scenario = SELFTEST_SCENARIOS.find((entry) => entry.id === result.scenarioId);
        if (scenario) await saveRun(result, { tenantId, userId, title: scenario.title, keepData: false });
      }
      await queryClient.invalidateQueries({ queryKey: ["selftest_runs_pulse", tenantId] });
      const failed = results.filter((result) => result.status !== "ok").length;
      if (failed > 0) notify.error(`${area.title}: ${failed} von ${results.length} Tests nicht bestanden`);
      else notify.success(`${area.title}: ${results.length} Tests bestanden`);
    } catch (error) {
      notify.error("Bereichstest fehlgeschlagen", { description: error instanceof Error ? error.message : String(error) });
    } finally {
      setRunningArea(null);
    }
  };

  const tile = ({ area, level }: LevelEntry) => {
    const active = runningArea === area.id;
    return (
      <button key={area.id} type="button" onClick={() => { setOpen(open === area.id ? null : area.id); setOpenStep(null); }}
        aria-expanded={open === area.id}
        className={cn("rounded-lg border bg-card p-3 text-left transition-colors hover:bg-muted", open === area.id && "ring-2 ring-ring")}>
        <div className="flex items-center gap-2">
          <span aria-hidden className={cn("h-3 w-3 rounded-full", dot[level])} />
          <span className="font-medium">{area.title}</span>
        </div>
        <div className="mt-1 text-xs text-muted-foreground">
          {active ? "Läuft …" : loadingRuns ? "wird geladen …" : unknownRuns ? "unbekannt" : text[level]}
        </div>
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
        {selected && (
          <div className="rounded-lg border bg-muted/40 p-3 text-sm space-y-2">
            <div className="font-medium">{selected.area.title}: {text[selected.level]}</div>
            {selected.area.tables.length > 0 && (
              <div className="flex flex-wrap items-center gap-1.5 text-xs">
                <span className="text-muted-foreground">Haupttabellen:</span>
                {selected.area.tables.map((table) => (
                  <code key={table} className="rounded border bg-background px-1.5 py-0.5 font-mono text-[11px]">{table}</code>
                ))}
              </div>
            )}
            {(loadingRuns || unknownRuns) && (
              <p className="text-xs text-muted-foreground">
                Ergebnisse {loadingRuns ? "werden geladen …" : "sind unbekannt."}
              </p>
            )}
            {selected.area.workflows.map((workflow) => {
              const results = stepsByScenario[workflow.scenario] ?? {};
              const storedRun = runDetails[workflow.scenario];
              const info = scenarioInfo[workflow.scenario];
              const title = storedRun?.title ?? info?.title ?? workflow.title;
              const counts = { ok: 0, failed: 0, other: 0 };
              for (const step of workflow.steps) {
                const status = results[step.id]?.status;
                if (status === "ok") counts.ok += 1;
                else if (status === "failed") counts.failed += 1;
                else counts.other += 1;
              }
              const failedSteps = storedRun?.failedSteps ?? counts.failed;
              return (
                <div key={workflow.scenario} className="space-y-1.5">
                  <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5">
                    <div className="flex min-w-0 items-baseline gap-2">
                      <span className="text-xs font-medium">{title}</span>
                      <code className="hidden text-[10px] text-muted-foreground sm:inline">{workflow.scenario}</code>
                    </div>
                    <span className="text-[11px] tabular-nums text-muted-foreground">
                      {workflow.steps.length} Schritte
                      {counts.failed > 0 && <span className="text-destructive"> · {counts.failed} fehlgeschlagen</span>}
                      {counts.ok > 0 && <> · {counts.ok} bestanden</>}
                      {counts.other > 0 && <> · {counts.other} ungetestet</>}
                    </span>
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
                  {info?.description && <p className="text-xs text-muted-foreground">{info.description}</p>}
                  {info?.checks && info.checks.length > 0 && (
                    <details className="text-xs text-muted-foreground">
                      <summary className="cursor-pointer">Geprüft ({info.checks.length})</summary>
                      <p className="mt-1">{info.checks.join(" · ")}</p>
                    </details>
                  )}
                  <div className="-mx-1 overflow-x-auto rounded pb-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    tabIndex={0} role="group" aria-label={`Prozesskette ${title}`}>
                    <div className="flex w-max items-stretch gap-1 px-1">
                      {workflow.steps.map((step, index) => {
                        const key = `${workflow.scenario}:${step.id}`;
                        const result = results[step.id];
                        const level = stepLevel(result?.status);
                        return (
                          <Fragment key={step.id}>
                            {index > 0 && <ArrowRight aria-hidden className="h-3 w-3 shrink-0 self-center text-muted-foreground" />}
                            <div className={cn(
                              "relative w-40 shrink-0 rounded border bg-background p-1.5 pr-6 text-xs",
                              level === "red" && "border-destructive/50",
                              level === "green" && "border-emerald-500/40",
                            )}>
                              <div className="flex items-center gap-1">
                                <span className="text-[10px] tabular-nums text-muted-foreground">{index + 1}</span>
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
                          </Fragment>
                        );
                      })}
                    </div>
                  </div>
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
            <div className="flex flex-wrap gap-2 pt-1">
              <Button size="sm" onClick={() => void runArea(selected.area)} disabled={runningArea !== null}>
                {runningArea === selected.area.id ? "Läuft …" : "▶ Diesen Bereich jetzt testen"}
              </Button>
              <Button size="sm" variant="outline" onClick={() => navigate("/selbsttest")}>
                Selbsttests öffnen <ArrowRight className="ml-1 h-3 w-3" />
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
