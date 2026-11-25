import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Activity, ArrowRight, Shield } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { notify } from "@/lib/notify";
import { useAuth } from "@/hooks/useAuth";
import { useTenant } from "@/hooks/useTenant";
import { supabase } from "@/integrations/supabase/client";
import {
  PULSE_AREAS, PULSE_FLOW, areaLevel, flowPath, gapSummary, latestRuns,
  type FlowBox, type GapsState, type PersistedRun, type PulseArea, type PulseLevel,
} from "./pulse";

interface Props { gaps: Array<{ table_name: string; severity: string }>; gapsState: GapsState }

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

export function SystemPulse({ gaps, gapsState }: Props) {
  const { currentTenant } = useTenant();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [open, setOpen] = useState<string | null>(null);
  const [liveRuns, setLiveRuns] = useState<Record<string, string>>({});
  const [runningArea, setRunningArea] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const tileRefs = useRef(new Map<string, HTMLButtonElement>());
  const [paths, setPaths] = useState<Array<{ key: string; d: string }>>([]);
  const flowKey = PULSE_FLOW.join("|");

  // Mandantenweite Sicht: RLS lässt alle Mitglieder die Läufe des Mandanten lesen,
  // und der Puls soll den Systemzustand zeigen, nicht nur den letzten Lauf eines Nutzers.
  const runsQuery = useQuery({
    queryKey: ["selftest_runs_pulse", currentTenant?.id],
    enabled: Boolean(currentTenant?.id),
    queryFn: async () => {
      // DISTINCT ON in der Datenbank: genau der neueste Lauf je Szenario, ohne Zeilenfenster.
      const { data, error } = await supabase.rpc("get_latest_selftest_runs", { p_tenant_id: currentTenant!.id });
      if (error) throw error;
      return (data ?? []) as PersistedRun[];
    },
    staleTime: 60_000,
  });

  useEffect(() => { setLiveRuns({}); }, [currentTenant?.id]);

  const runs = useMemo(
    () => ({ ...latestRuns(runsQuery.data ?? []), ...liveRuns }),
    [runsQuery.data, liveRuns],
  );
  const loadingRuns = Boolean(currentTenant?.id) && runsQuery.isPending;
  const unknownRuns = !currentTenant?.id || runsQuery.isError;
  const latest = runsQuery.data?.[0]?.created_at;

  const levels = PULSE_AREAS.map((area) => ({ area, level: areaLevel(area, { runs }) }));
  const flowLevels = PULSE_FLOW
    .map((id) => levels.find((entry) => entry.area.id === id))
    .filter((entry): entry is { area: PulseArea; level: PulseLevel } => Boolean(entry));
  const restLevels = levels.filter((entry) => !PULSE_FLOW.includes(entry.area.id));
  const count = (level: PulseLevel) => levels.filter((entry) => entry.level === level).length;
  const selected = levels.find((entry) => entry.area.id === open);
  const security = gapSummary(gaps, gapsState);

  useLayoutEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const measure = () => {
      const base = container.getBoundingClientRect();
      const boxes = new Map<string, FlowBox>();
      for (const [id, element] of tileRefs.current) {
        if (!element) continue;
        const rect = element.getBoundingClientRect();
        boxes.set(id, { x: rect.left - base.left, y: rect.top - base.top, w: rect.width, h: rect.height });
      }
      const next: Array<{ key: string; d: string }> = [];
      for (let index = 0; index < PULSE_FLOW.length - 1; index += 1) {
        const from = boxes.get(PULSE_FLOW[index]);
        const to = boxes.get(PULSE_FLOW[index + 1]);
        if (from && to) next.push({ key: `${PULSE_FLOW[index]}-${PULSE_FLOW[index + 1]}`, d: flowPath(from, to) });
      }
      setPaths(next);
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(container);
    for (const element of tileRefs.current.values()) observer.observe(element);
    return () => observer.disconnect();
  }, [flowKey]);

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

  const tile = ({ area, level }: { area: PulseArea; level: PulseLevel }) => {
    const active = runningArea === area.id;
    return (
      <button key={area.id} type="button" onClick={() => setOpen(open === area.id ? null : area.id)}
        ref={(element) => {
          if (element) tileRefs.current.set(area.id, element);
          else tileRefs.current.delete(area.id);
        }}
        aria-expanded={open === area.id}
        className={cn("relative z-10 rounded-lg border bg-card p-3 text-left transition-colors hover:bg-muted", open === area.id && "ring-2 ring-ring")}>
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
        <p className="sr-only">
          Arbeitsablauf: {flowLevels.map((entry) => entry.area.title).join(" → ")}.
        </p>
        <div ref={containerRef} className="relative">
          <svg aria-hidden focusable="false" className="pointer-events-none absolute inset-0 z-0 h-full w-full overflow-visible text-muted-foreground">
            <defs>
              <marker id="pulse-flow-arrow" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
                <path d="M 0 0 L 10 5 L 0 10 z" fill="currentColor" />
              </marker>
            </defs>
            {paths.map((path) => (
              <path key={path.key} d={path.d} fill="none" stroke="currentColor" strokeWidth={1.5} markerEnd="url(#pulse-flow-arrow)" />
            ))}
          </svg>
          <div className="grid grid-cols-1 gap-x-6 gap-y-8 sm:grid-cols-2 lg:grid-cols-3">
            {flowLevels.map(tile)}
          </div>
        </div>
        {restLevels.length > 0 && (
          <div className="space-y-2">
            <p className="text-xs font-medium text-muted-foreground">Weitere Bereiche</p>
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">{restLevels.map(tile)}</div>
          </div>
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
            {loadingRuns || unknownRuns ? (
              <p className="text-muted-foreground">
                Ergebnisse {loadingRuns ? "werden geladen …" : "sind unbekannt."}
              </p>
            ) : (
              <ul className="space-y-1">
                {selected.area.scenarios.map((scenarioId) => (
                  <li key={scenarioId} className="flex items-center gap-2">
                    <span aria-hidden className={cn("h-2 w-2 rounded-full", dot[runs[scenarioId] === "ok" ? "green" : runs[scenarioId] === "failed" ? "red" : runs[scenarioId] ? "yellow" : "grey"])} />
                    Test „{scenarioId}“: {statusLabel(runs[scenarioId])}
                  </li>
                ))}
              </ul>
            )}
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
