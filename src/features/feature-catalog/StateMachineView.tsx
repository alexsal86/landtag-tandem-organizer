import { useMemo, useState } from "react";
import { AlertTriangle, ArrowRight, Info, Search } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  filterStateMachines,
  findingLabel,
  guardKindLabel,
  sourceLabel,
  stateMachineArtifact,
  summarizeStateMachines,
  transitionKindLabel,
  transitionLabel,
  type StateMachine,
  type StateMachineGuard,
  type StateMachineReconciliation,
} from "./stateMachines";
import { StateMachineGraph } from "./StateMachineGraph";
import type { ResolvedFeature } from "./types";

interface StateMachineViewProps {
  features: ResolvedFeature[];
  onOpenFeature: (id: string) => void;
}

function SourceRef({ source }: { source: string }) {
  return (
    <span className="font-mono text-[0.65rem] text-muted-foreground" title={source}>
      {sourceLabel(source)}
    </span>
  );
}

function FindingBadge({ count }: { count: number }) {
  if (!count) return null;
  return <Badge variant="destructive">{count} Warnung{count === 1 ? "" : "en"}</Badge>;
}

function GuardRow({ guard }: { guard: StateMachineGuard }) {
  return (
    <li className="rounded border p-2 text-xs">
      <div className="flex flex-wrap items-center gap-2">
        <span className="font-mono font-medium">{guard.trigger}</span>
        <Badge variant={guard.kind === "guard" ? "default" : "secondary"}>{guardKindLabel(guard.kind)}</Badge>
        <span className="text-muted-foreground">
          {guard.timing} {guard.events}
        </span>
        <SourceRef source={guard.source} />
      </div>

      {guard.message ? (
        <p className="mt-1 rounded bg-muted px-2 py-1 font-mono text-[0.65rem] text-muted-foreground">{guard.message}</p>
      ) : null}

      <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-muted-foreground">
        <span>
          Funktion: <code className="font-mono">{guard.function}</code>
        </span>
        {guard.blockedTo.length ? <span>blockiert als Ziel: {guard.blockedTo.map((value) => `"${value}"`).join(", ")}</span> : null}
        {guard.blockedFrom.length ? <span>blockiert als Ausgang: {guard.blockedFrom.map((value) => `"${value}"`).join(", ")}</span> : null}
        {guard.readsOld ? <span>liest OLD</span> : null}
        {guard.readsNew ? <span>liest NEW</span> : null}
      </div>

      {guard.checks.length ? (
        <ul className="mt-1 space-y-0.5 font-mono text-[0.65rem] text-muted-foreground">
          {guard.checks.map((check, index) => (
            <li key={`${check.side}-${check.operator}-${index}`}>
              {check.side} {check.operator} {check.values.map((value) => `"${value}"`).join(", ")}
              {check.negated ? " (ausgeschlossen)" : ""}
            </li>
          ))}
        </ul>
      ) : null}
    </li>
  );
}

function ReconciliationBlock({ reconciliation }: { reconciliation: StateMachineReconciliation }) {
  const hasDrift =
    reconciliation.onlyInCode.length > 0 ||
    reconciliation.onlyInArtifact.length > 0 ||
    reconciliation.clientValues.length > 0;
  return (
    <details className="rounded border p-2 text-xs" open={hasDrift}>
      <summary className="cursor-pointer font-semibold">
        Abgleich mit Code und Client
        {hasDrift ? <span className="ml-2 text-destructive">Abweichung</span> : <span className="ml-2 text-muted-foreground">deckungsgleich</span>}
      </summary>
      {reconciliation.source ? (
        <p className="mt-1 text-muted-foreground">
          TS-Regelmodul: <SourceRef source={reconciliation.source} />
          {reconciliation.label ? ` (${reconciliation.label})` : ""}
        </p>
      ) : null}
      {reconciliation.valuesNotInDatabase.length ? (
        <div className="mt-1">
          <div className="font-medium text-destructive">Zustände ohne DB-Beleg</div>
          <ul className="mt-0.5 flex flex-wrap gap-1">
            {reconciliation.valuesNotInDatabase.map((value) => (
              <li key={value} className="rounded bg-destructive/10 px-1.5 py-0.5 font-mono text-[0.65rem]">
                {value}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
      {reconciliation.onlyInCode.length ? (
        <div className="mt-1">
          <div className="font-medium">TS-Kanten ohne Schreibbeleg</div>
          <ul className="mt-0.5 flex flex-wrap gap-1">
            {reconciliation.onlyInCode.map((pair) => (
              <li key={`${pair.from}->${pair.to}`} className="rounded bg-destructive/10 px-1.5 py-0.5 font-mono text-[0.65rem]">
                {pair.from} → {pair.to}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
      {reconciliation.onlyInArtifact.length ? (
        <div className="mt-1">
          <div className="font-medium">Nur in der Datenbank belegt</div>
          <ul className="mt-0.5 flex flex-wrap gap-1">
            {reconciliation.onlyInArtifact.map((pair) => (
              <li key={`${pair.from}->${pair.to}`} className="rounded bg-muted px-1.5 py-0.5 font-mono text-[0.65rem]">
                {pair.from} → {pair.to}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
      {reconciliation.clientValues.length ? (
        <div className="mt-1">
          <div className="font-medium">Client-Schreibvorgänge</div>
          <ul className="mt-0.5 space-y-0.5">
            {reconciliation.clientValues.map((entry) => (
              <li key={`${entry.value}:${entry.source}`} className="flex flex-wrap items-center gap-2">
                <span className="font-mono">{entry.value}</span>
                <SourceRef source={entry.source} />
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </details>
  );
}

function StateMachineCard({
  machine,
  relatedFeatures,
  onOpenFeature,
}: {
  machine: StateMachine;
  relatedFeatures: ResolvedFeature[];
  onOpenFeature: (id: string) => void;
}) {
  const warnings = machine.findings.filter((finding) => finding.severity === "warn").length;

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex flex-wrap items-center gap-2">
          <CardTitle className="text-base">
            <span className="font-mono text-sm">{machine.id}</span>
          </CardTitle>
          {machine.enumType ? <Badge variant="secondary">Enum: {machine.enumType}</Badge> : null}
          <Badge variant="outline">{machine.states.length} Zustände</Badge>
          <Badge variant="outline">{machine.initialStates.length} Start</Badge>
          <Badge variant="outline">{machine.transitions.length} Übergänge</Badge>
          <Badge variant="outline">{machine.guards.length} Trigger</Badge>
          <FindingBadge count={warnings} />
        </div>
        {relatedFeatures.length ? (
          <CardDescription className="text-xs">
            Zugeordnete Funktionen:{" "}
            {relatedFeatures.map((feature, index) => (
              <span key={feature.id}>
                {index > 0 ? ", " : ""}
                <button
                  type="button"
                  className="underline underline-offset-2 hover:text-foreground"
                  onClick={() => onOpenFeature(feature.id)}
                >
                  {feature.name}
                </button>
              </span>
            ))}
          </CardDescription>
        ) : (
          <CardDescription className="text-xs">Keine Funktion deklariert diese Tabelle.</CardDescription>
        )}
      </CardHeader>
      <CardContent className="space-y-3">
        <StateMachineGraph machine={machine} />

        {machine.findings.length ? (
          <ul className="space-y-1">
            {machine.findings.map((finding) => (
              <li key={`${finding.kind}:${finding.states.join(",")}`} className="flex items-start gap-2 text-xs">
                {finding.severity === "warn" ? (
                  <AlertTriangle aria-hidden="true" className="mt-0.5 h-3 w-3 shrink-0 text-destructive" />
                ) : (
                  <Info aria-hidden="true" className="mt-0.5 h-3 w-3 shrink-0 text-muted-foreground" />
                )}
                <div>
                  <span className="font-medium">{findingLabel(finding.kind)}</span>
                  {finding.states.length ? (
                    <span className="ml-1 font-mono text-muted-foreground">{finding.states.join(", ")}</span>
                  ) : null}
                  <span className="ml-1 text-muted-foreground">{finding.message}</span>
                </div>
              </li>
            ))}
          </ul>
        ) : null}

        <div>
          <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Zustände</div>
          <ul className="mt-1 flex flex-wrap gap-1">
            {machine.states.map((state) => {
              const isInitial = machine.initialStates.includes(state.value);
              return (
                <li key={state.value}>
                  <span
                    className={`rounded px-1.5 py-0.5 font-mono text-[0.7rem] ${
                      isInitial ? "border border-primary text-primary" : "bg-muted"
                    }`}
                    title={state.sources.join("\n")}
                  >
                    {isInitial ? "∅ " : ""}
                    {state.value}
                  </span>
                </li>
              );
            })}
            {machine.states.length === 0 ? <li className="text-sm text-muted-foreground">Keine belegt.</li> : null}
          </ul>
        </div>

        <div>
          <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Belegte Übergänge</div>
          {machine.transitions.length ? (
            <ul className="mt-1 space-y-1">
              {machine.transitions.map((transition) => (
                <li
                  key={`${transition.kind}:${transition.from?.join(",") ?? "∅"}>${transition.to}`}
                  className="flex flex-wrap items-center gap-2 text-xs"
                >
                  <ArrowRight aria-hidden="true" className="h-3 w-3 text-muted-foreground" />
                  <span className="font-mono">{transitionLabel(transition)}</span>
                  <Badge variant="outline">{transitionKindLabel(transition.kind)}</Badge>
                  {transition.param ? <span className="font-mono text-muted-foreground">{transition.param}</span> : null}
                  {transition.guards.length ? (
                    <span className="text-muted-foreground">geprüft: {transition.guards.join(", ")}</span>
                  ) : null}
                  <SourceRef source={transition.sources[0]} />
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-1 text-sm text-muted-foreground">
              Keine belegten Schreibvorgänge; Übergänge werden nicht geraten.
            </p>
          )}
        </div>

        {machine.guards.length ? (
          <details className="text-xs" open={false}>
            <summary className="cursor-pointer font-semibold uppercase tracking-wide text-muted-foreground">
              Guards und Trigger ({machine.guards.length})
            </summary>
            <ul className="mt-1 space-y-1.5">
              {machine.guards.map((guard) => (
                <GuardRow key={guard.trigger} guard={guard} />
              ))}
            </ul>
          </details>
        ) : (
          <p className="text-sm text-muted-foreground">Kein Trigger im Migrationsbestand gefunden.</p>
        )}

        {machine.reconciliation ? <ReconciliationBlock reconciliation={machine.reconciliation} /> : null}

        {machine.limitations.length ? (
          <ul className="list-disc space-y-0.5 pl-5 text-[0.7rem] text-muted-foreground">
            {machine.limitations.map((limitation) => (
              <li key={limitation}>{limitation}</li>
            ))}
          </ul>
        ) : null}
      </CardContent>
    </Card>
  );
}

/**
 * Zustandsansicht des Funktionskatalogs.
 *
 * Zeigt ausschließlich das generierte Artefakt: Zustände, Startzustände,
 * belegte Übergänge, Guards, berechnete Befunde und den Abgleich mit
 * TS-Regelmodulen und Client-Schreibvorgängen. Es gibt keine Eingabemöglichkeit
 * und keine handgepflegten Übergänge.
 */
export function StateMachineView({ features, onOpenFeature }: StateMachineViewProps) {
  const [query, setQuery] = useState("");
  const [onlyWarnings, setOnlyWarnings] = useState(false);
  const summary = useMemo(() => summarizeStateMachines(), []);
  const machines = useMemo(
    () => filterStateMachines(stateMachineArtifact.machines, query, { onlyWarnings }),
    [query, onlyWarnings],
  );
  const featuresByTable = useMemo(() => {
    const index = new Map<string, ResolvedFeature[]>();
    for (const feature of features) {
      for (const table of feature.tables) {
        if (!index.has(table)) index.set(table, []);
        index.get(table)!.push(feature);
      }
    }
    return index;
  }, [features]);
  const drifts = useMemo(
    () =>
      stateMachineArtifact.machines.filter(
        (machine) =>
          machine.reconciliation &&
          (machine.reconciliation.onlyInCode.length > 0 ||
            machine.reconciliation.onlyInArtifact.length > 0 ||
            machine.reconciliation.clientValues.length > 0),
      ),
    [],
  );

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold">Zustandsmaschinen</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Automatisch aus Statusspalten, Enum-Typen, CHECK-Constraints, Defaults, INSERT-/UPDATE-Schreibvorgängen,
          Funktionsparametern und Guard-Triggern der {summary.migrationCount} Migrationen erzeugt. Befunde und
          Abgleich mit TS-Regelmodulen und Client-Schreibvorgängen werden berechnet, nicht gepflegt.
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        <Badge variant="outline">{summary.machines} Maschinen</Badge>
        <Badge variant="outline">{summary.states} Zustände</Badge>
        <Badge variant="outline">{summary.initialStates} Startzustände</Badge>
        <Badge variant="outline">{summary.transitions} belegte Übergänge</Badge>
        <Badge variant="outline">{summary.guards} Guards</Badge>
        <Badge variant="outline">{summary.observers} beobachtende Trigger</Badge>
        {summary.warnings ? <Badge variant="destructive">{summary.warnings} Warnungen</Badge> : null}
        {summary.hints ? <Badge variant="secondary">{summary.hints} Hinweise</Badge> : null}
        {summary.drift ? <Badge variant="destructive">{summary.drift} Abweichungen zum Code</Badge> : null}
        {summary.anomalies ? <Badge variant="destructive">{summary.anomalies} Schreibweisen-Befund</Badge> : null}
        {summary.unresolved ? <Badge variant="secondary">{summary.unresolved} Spalten ohne Beleg</Badge> : null}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div className="relative max-w-md flex-1">
          <Search aria-hidden="true" className="pointer-events-none absolute left-2 top-2 h-4 w-4 text-muted-foreground" />
          <Input
            aria-label="Zustandsmaschinen durchsuchen"
            placeholder="Tabelle, Spalte, Zustand, Guard oder Befund …"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            className="h-8 pl-8 text-xs"
          />
        </div>
        <Button
          type="button"
          size="sm"
          variant={onlyWarnings ? "default" : "outline"}
          aria-pressed={onlyWarnings}
          onClick={() => setOnlyWarnings((value) => !value)}
          className="h-8 text-xs"
        >
          Nur Warnungen
        </Button>
        <span className="text-xs text-muted-foreground">
          {machines.length} von {stateMachineArtifact.machines.length}
        </span>
      </div>

      {stateMachineArtifact.anomalies.length ? (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Schreibweisen-Befunde</CardTitle>
            <CardDescription className="text-xs">
              Diese Werte unterscheiden sich im Quellcode, obwohl sie gleich klingen. Sie werden nicht normalisiert.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="space-y-1 text-xs">
              {stateMachineArtifact.anomalies.map((anomaly) => (
                <li key={`${anomaly.machine}:${anomaly.values.join(",")}`}>
                  <span className="font-mono">{anomaly.machine}</span>:{" "}
                  {anomaly.values.map((value) => `"${value}"`).join(" und ")}
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      ) : null}

      {drifts.length ? (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Abgleich mit Code und Client</CardTitle>
            <CardDescription className="text-xs">
              TS-Regelmodule und Client-Schreibvorgänge gegen die abgeleitete Datenbanklogik. Abweichungen sind
              Prüfaufträge, keine automatische Wahrheit.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="space-y-1 text-xs">
              {drifts.map((machine) => (
                <li key={machine.id} className="flex flex-wrap items-center gap-2">
                  <span className="font-mono">{machine.id}</span>
                  {machine.reconciliation!.onlyInCode.length ? (
                    <Badge variant="destructive">
                      {machine.reconciliation!.onlyInCode.length} nur im TS
                    </Badge>
                  ) : null}
                  {machine.reconciliation!.onlyInArtifact.length ? (
                    <Badge variant="secondary">
                      {machine.reconciliation!.onlyInArtifact.length} nur in der DB
                    </Badge>
                  ) : null}
                  {machine.reconciliation!.clientValues.length ? (
                    <Badge variant="outline">
                      {machine.reconciliation!.clientValues.length} Client-Werte
                    </Badge>
                  ) : null}
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      ) : null}

      <div className="space-y-3">
        {machines.map((machine) => (
          <StateMachineCard
            key={machine.id}
            machine={machine}
            relatedFeatures={featuresByTable.get(machine.table) ?? []}
            onOpenFeature={onOpenFeature}
          />
        ))}
        {machines.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            {onlyWarnings ? "Keine Maschine hat Warnungen." : "Keine Maschine entspricht der Suche."}
          </p>
        ) : null}
      </div>

      {stateMachineArtifact.unresolved.length ? (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Statusspalten ohne belegte Zustände</CardTitle>
            <CardDescription className="text-xs">
              Prüfauftrag, keine Aussage über Verwaistheit: Für diese Spalten enthält der Migrationsbestand keine
              Enum-, CHECK-, Default- oder literalen Schreibbelege.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="flex flex-wrap gap-1">
              {stateMachineArtifact.unresolved.map((entry) => (
                <li key={`${entry.table}.${entry.column}`}>
                  <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-[0.7rem]">
                    {entry.table}.{entry.column}
                  </code>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
