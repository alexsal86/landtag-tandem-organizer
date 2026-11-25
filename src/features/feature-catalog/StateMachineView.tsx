import { useMemo, useState } from "react";
import { ArrowRight, Search } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  filterStateMachines,
  guardKindLabel,
  sourceLabel,
  stateMachineArtifact,
  summarizeStateMachines,
  transitionLabel,
  type StateMachine,
} from "./stateMachines";
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

function StateMachineCard({
  machine,
  relatedFeatures,
  onOpenFeature,
}: {
  machine: StateMachine;
  relatedFeatures: ResolvedFeature[];
  onOpenFeature: (id: string) => void;
}) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex flex-wrap items-center gap-2">
          <CardTitle className="text-base">
            <span className="font-mono text-sm">{machine.id}</span>
          </CardTitle>
          {machine.enumType ? <Badge variant="secondary">Enum: {machine.enumType}</Badge> : null}
          <Badge variant="outline">{machine.states.length} Zustände</Badge>
          <Badge variant="outline">{machine.transitions.length} Übergänge</Badge>
          <Badge variant="outline">{machine.guards.length} Trigger</Badge>
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
        <div>
          <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Zustände</div>
          <ul className="mt-1 flex flex-wrap gap-1">
            {machine.states.map((state) => (
              <li key={state.value}>
                <span
                  className="rounded bg-muted px-1.5 py-0.5 font-mono text-[0.7rem]"
                  title={state.sources.join("\n")}
                >
                  {state.value}
                </span>
              </li>
            ))}
            {machine.states.length === 0 ? <li className="text-sm text-muted-foreground">Keine belegt.</li> : null}
          </ul>
        </div>

        <div>
          <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Belegte Übergänge</div>
          {machine.transitions.length ? (
            <ul className="mt-1 space-y-1">
              {machine.transitions.map((transition) => (
                <li
                  key={`${transition.from?.join(",") ?? "*"}>${transition.to}`}
                  className="flex flex-wrap items-center gap-2 text-xs"
                >
                  <ArrowRight aria-hidden="true" className="h-3 w-3 text-muted-foreground" />
                  <span className="font-mono">{transitionLabel(transition)}</span>
                  {transition.from === null ? <Badge variant="outline">Ausgang unbestimmt</Badge> : null}
                  <SourceRef source={transition.sources[0]} />
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-1 text-sm text-muted-foreground">
              Keine belegten literalen Schreibvorgänge; Übergänge werden nicht geraten.
            </p>
          )}
        </div>

        <div>
          <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Guards und Trigger</div>
          {machine.guards.length ? (
            <ul className="mt-1 space-y-1.5">
              {machine.guards.map((guard) => (
                <li key={guard.trigger} className="rounded border p-2 text-xs">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-mono font-medium">{guard.trigger}</span>
                    <Badge variant={guard.kind === "guard" ? "default" : "secondary"}>{guardKindLabel(guard.kind)}</Badge>
                    <span className="text-muted-foreground">
                      {guard.timing} {guard.events}
                    </span>
                    <SourceRef source={guard.source} />
                  </div>
                  <div className="mt-1 flex flex-wrap gap-2 text-muted-foreground">
                    <span>Funktion: <code className="font-mono">{guard.function}</code></span>
                    {guard.states.length ? (
                      <span>geprüfte Werte: {guard.states.map((value) => `"${value}"`).join(", ")}</span>
                    ) : null}
                    {guard.readsOld ? <span>liest OLD</span> : null}
                    {guard.readsNew ? <span>liest NEW</span> : null}
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-1 text-sm text-muted-foreground">Kein Trigger im Migrationsbestand gefunden.</p>
          )}
        </div>

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
 * Zeigt ausschließlich das generierte Artefakt: Zustände, belegte Übergänge und
 * Guards. Es gibt keine Eingabemöglichkeit und keine handgepflegten Übergänge.
 */
export function StateMachineView({ features, onOpenFeature }: StateMachineViewProps) {
  const [query, setQuery] = useState("");
  const summary = useMemo(() => summarizeStateMachines(), []);
  const machines = useMemo(() => filterStateMachines(stateMachineArtifact.machines, query), [query]);
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

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold">Zustandsmaschinen</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Automatisch aus Statusspalten, Enum-Typen, CHECK-Constraints, belegten Schreibvorgängen und Guard-Triggern
          der {summary.migrationCount} Migrationen erzeugt. Übergänge werden nicht im Inventar gepflegt und nicht
          geraten; die Drift-Prüfung hält das Artefakt am Quellcode.
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        <Badge variant="outline">{summary.machines} Maschinen</Badge>
        <Badge variant="outline">{summary.states} Zustände</Badge>
        <Badge variant="outline">{summary.transitions} belegte Übergänge</Badge>
        <Badge variant="outline">{summary.guards} Guards</Badge>
        <Badge variant="outline">{summary.observers} beobachtende Trigger</Badge>
        {summary.anomalies ? <Badge variant="destructive">{summary.anomalies} Schreibweisen-Befund</Badge> : null}
        {summary.unresolved ? <Badge variant="secondary">{summary.unresolved} Spalten ohne Beleg</Badge> : null}
      </div>

      <div className="relative max-w-md">
        <Search aria-hidden="true" className="pointer-events-none absolute left-2 top-2 h-4 w-4 text-muted-foreground" />
        <Input
          aria-label="Zustandsmaschinen durchsuchen"
          placeholder="Tabelle, Spalte, Zustand oder Guard …"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          className="h-8 pl-8 text-xs"
        />
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
          <p className="text-sm text-muted-foreground">Keine Maschine entspricht der Suche.</p>
        ) : null}
      </div>

      {stateMachineArtifact.unresolved.length ? (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Statusspalten ohne belegte Zustände</CardTitle>
            <CardDescription className="text-xs">
              Prüfauftrag, keine Aussage über Verwaistheit: Für diese Spalten enthält der Migrationsbestand keine
              Enum-, CHECK- oder literalen Schreibbelege.
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
