import artifact from "./generated/state-machines.json";

/**
 * Anzeige-Modell des generierten Zustandsartefakts.
 *
 * Quelle ist ausschließlich `generated/state-machines.json`, das
 * `scripts/build-state-artifact.mjs` aus Statusspalten, CHECK-Constraints,
 * Schreibvorgängen und Guard-Triggern erzeugt. Im Inventar werden keine
 * Übergänge gepflegt; die Drift-Prüfung hält das Artefakt am Quellcode.
 */

export interface StateMachineState {
  value: string;
  sources: string[];
}

export interface StateMachineTransition {
  /** `null` bedeutet: Ausgangszustand ist im Quellcode nicht belegt. */
  from: string[] | null;
  to: string;
  sources: string[];
}

export interface StateMachineGuard {
  trigger: string;
  function: string;
  timing: string;
  events: string;
  source: string;
  functionSource: string;
  kind: "guard" | "trigger";
  readsOld: boolean;
  readsNew: boolean;
  raises: boolean;
  states: string[];
}

export interface StateMachine {
  id: string;
  table: string;
  column: string;
  enumType: string | null;
  states: StateMachineState[];
  transitions: StateMachineTransition[];
  guards: StateMachineGuard[];
  limitations: string[];
}

export interface UnresolvedStateColumn {
  table: string;
  column: string;
  reason: string;
}

export interface StateMachineAnomaly {
  machine: string;
  values: string[];
  reason: string;
}

export interface StateMachineArtifact {
  version: number;
  generatedBy: string;
  description: string;
  sources: {
    types: string;
    migrationsDirectory: string;
    migrationCount: number;
  };
  machineCount: number;
  anomalies: StateMachineAnomaly[];
  machines: StateMachine[];
  unresolved: UnresolvedStateColumn[];
}

export const stateMachineArtifact = artifact as unknown as StateMachineArtifact;

export interface StateMachineSummary {
  machines: number;
  states: number;
  transitions: number;
  guards: number;
  observers: number;
  anomalies: number;
  unresolved: number;
  migrationCount: number;
}

export function summarizeStateMachines(
  machines: readonly StateMachine[] = stateMachineArtifact.machines,
): StateMachineSummary {
  const guards = machines.flatMap((machine) => machine.guards);
  return {
    machines: machines.length,
    states: machines.reduce((sum, machine) => sum + machine.states.length, 0),
    transitions: machines.reduce((sum, machine) => sum + machine.transitions.length, 0),
    guards: guards.filter((guard) => guard.kind === "guard").length,
    observers: guards.filter((guard) => guard.kind === "trigger").length,
    anomalies: stateMachineArtifact.anomalies.length,
    unresolved: stateMachineArtifact.unresolved.length,
    migrationCount: stateMachineArtifact.sources.migrationCount,
  };
}

export function transitionLabel(transition: StateMachineTransition): string {
  const from = transition.from?.length ? transition.from.join(" | ") : "unbestimmt";
  return `${from} → ${transition.to}`;
}

const normalize = (value: string) => value.toLocaleLowerCase("de").normalize("NFKD");

export function matchesStateMachine(machine: StateMachine, query: string): boolean {
  const term = normalize(query.trim());
  if (!term) return true;
  const haystack = normalize(
    [
      machine.id,
      machine.table,
      machine.column,
      machine.enumType ?? "",
      ...machine.states.map((state) => state.value),
      ...machine.transitions.map((transition) => transitionLabel(transition)),
      ...machine.guards.flatMap((guard) => [guard.trigger, guard.function, guard.kind]),
    ].join(" "),
  );
  return haystack.includes(term);
}

export function filterStateMachines(machines: readonly StateMachine[], query: string): StateMachine[] {
  return machines.filter((machine) => matchesStateMachine(machine, query));
}

/** Dateiname für die Anzeige; der vollständige Pfad bleibt als Titel verfügbar. */
export function sourceLabel(source: string): string {
  const marker = source.startsWith("supabase/migrations/") ? "supabase/migrations/" : "";
  return marker ? source.slice(marker.length) : source;
}

export function guardKindLabel(kind: StateMachineGuard["kind"]): string {
  return kind === "guard" ? "Guard (bricht ab)" : "Trigger (beobachtend)";
}
