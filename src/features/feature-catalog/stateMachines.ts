import artifact from "./generated/state-machines.json";

/**
 * Anzeige-Modell des generierten Zustandsartefakts.
 *
 * Quelle ist ausschließlich `generated/state-machines.json`, das
 * `scripts/build-state-artifact.mjs` aus Statusspalten, CHECK-Constraints,
 * Defaults, INSERT-/UPDATE-Schreibvorgängen und Guard-Triggern erzeugt. Im
 * Inventar werden keine Übergänge gepflegt; die Drift-Prüfung hält das
 * Artefakt am Quellcode.
 */

export interface StateMachineState {
  value: string;
  sources: string[];
}

export type TransitionKind = "write" | "initial" | "parametric";

export interface StateMachineTransition {
  /** `null` bedeutet: Ausgangszustand ist im Quellcode nicht belegt. */
  from: string[] | null;
  to: string;
  /** `initial` = Startzustand, `parametric` = Zielwert aus Funktionsparameter. */
  kind: TransitionKind;
  param: string | null;
  /** Trigger, die diesen Übergang prüfen. */
  guards: string[];
  sources: string[];
}

export interface GuardCheck {
  side: "OLD" | "NEW";
  operator: string;
  negated: boolean;
  values: string[];
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
  message: string | null;
  /** Vergleiche im Funktionskörper, mit Seite und Polarität. */
  checks: GuardCheck[];
  states: string[];
  blockedTo: string[];
  blockedFrom: string[];
  allowedTo: string[];
  allowedFrom: string[];
}

export type FindingSeverity = "warn" | "info";

export interface StateMachineFinding {
  kind: string;
  severity: FindingSeverity;
  states: string[];
  message: string;
}

export interface TransitionPair {
  from: string;
  to: string;
}

export interface StateMachineReconciliation {
  source: string | null;
  label: string | null;
  onlyInCode: TransitionPair[];
  onlyInArtifact: TransitionPair[];
  clientValues: { value: string; source: string }[];
}

export interface StateMachine {
  id: string;
  table: string;
  column: string;
  enumType: string | null;
  states: StateMachineState[];
  initialStates: string[];
  transitions: StateMachineTransition[];
  guards: StateMachineGuard[];
  reconciliation: StateMachineReconciliation | null;
  limitations: string[];
  findings: StateMachineFinding[];
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
    tsModules: string[];
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
  initialStates: number;
  transitions: number;
  guards: number;
  observers: number;
  warnings: number;
  hints: number;
  drift: number;
  anomalies: number;
  unresolved: number;
  migrationCount: number;
}

export function summarizeStateMachines(
  machines: readonly StateMachine[] = stateMachineArtifact.machines,
): StateMachineSummary {
  const guards = machines.flatMap((machine) => machine.guards);
  const findings = machines.flatMap((machine) => machine.findings);
  return {
    machines: machines.length,
    states: machines.reduce((sum, machine) => sum + machine.states.length, 0),
    initialStates: machines.reduce((sum, machine) => sum + machine.initialStates.length, 0),
    transitions: machines.reduce((sum, machine) => sum + machine.transitions.length, 0),
    guards: guards.filter((guard) => guard.kind === "guard").length,
    observers: guards.filter((guard) => guard.kind === "trigger").length,
    warnings: findings.filter((finding) => finding.severity === "warn").length,
    hints: findings.filter((finding) => finding.severity === "info").length,
    drift: machines.filter(
      (machine) =>
        machine.reconciliation &&
        (machine.reconciliation.onlyInCode.length > 0 ||
          machine.reconciliation.onlyInArtifact.length > 0 ||
          machine.reconciliation.clientValues.length > 0),
    ).length,
    anomalies: stateMachineArtifact.anomalies.length,
    unresolved: stateMachineArtifact.unresolved.length,
    migrationCount: stateMachineArtifact.sources.migrationCount,
  };
}

/**
 * Schlüssel einer Kante: Ausgangszustand, Ziel und Art. Ohne den Ausgang wären
 * zwei Schreibvorgänge auf dasselbe Ziel nicht unterscheidbar, und Tooltips
 * sowie Guard-Angaben würden die falsche Kante zeigen.
 */
export function transitionKey(from: string | null, to: string, kind: TransitionKind): string {
  return `${from ?? "∅"}|${to}|${kind}`;
}

/** Index aller Kanten eines Zustandsgraphen, aufgelöst nach Ausgang, Ziel und Art. */
export function indexTransitionsByEdge(
  machine: StateMachine,
): Map<string, StateMachineTransition> {
  const index = new Map<string, StateMachineTransition>();
  for (const transition of machine.transitions) {
    const origins = transition.from?.length ? transition.from : [null];
    for (const origin of origins) index.set(transitionKey(origin, transition.to, transition.kind), transition);
  }
  return index;
}

export function transitionLabel(transition: StateMachineTransition): string {
  const from = transition.from?.length
    ? transition.from.join(" | ")
    : transition.kind === "initial"
      ? "∅"
      : "unbestimmt";
  return `${from} → ${transition.to}`;
}

export const transitionKindLabel = (kind: TransitionKind): string =>
  kind === "initial" ? "Start" : kind === "parametric" ? "parametrisch" : "Schreibvorgang";

const FINDING_LABELS: Record<string, string> = {
  "kein-startzustand": "Kein Startzustand",
  unerreichbar: "Unerreichbar",
  isoliert: "Isoliert",
  sackgasse: "Sackgasse",
  "nur-im-guard": "Nur im Guard",
  "unbelegter-start": "Ausgang unbestimmt",
  parametrisch: "Parametrisch",
  "guard-widerspruch": "Guard blockiert alles",
  "client-wert-unbelegt": "Client-Wert ohne Beleg",
  "nur-im-code": "Nur im TS-Code",
  "nur-in-der-datenbank": "Nur in der Datenbank",
};

export const findingLabel = (kind: string): string => FINDING_LABELS[kind] ?? kind;

export function hasWarnings(machine: StateMachine): boolean {
  return machine.findings.some((finding) => finding.severity === "warn");
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
      ...machine.initialStates,
      ...machine.transitions.map((transition) => `${transitionLabel(transition)} ${transition.param ?? ""}`),
      ...machine.guards.flatMap((guard) => [guard.trigger, guard.function, guard.kind, guard.message ?? ""]),
      ...machine.findings.flatMap((finding) => [finding.kind, finding.message]),
      ...(machine.reconciliation?.onlyInCode ?? []).map((pair) => `${pair.from} ${pair.to}`),
      ...(machine.reconciliation?.clientValues ?? []).map((entry) => entry.value),
    ].join(" "),
  );
  return haystack.includes(term);
}

export interface StateMachineFilterOptions {
  onlyWarnings?: boolean;
}

export function filterStateMachines(
  machines: readonly StateMachine[],
  query: string,
  options: StateMachineFilterOptions = {},
): StateMachine[] {
  return machines.filter(
    (machine) => matchesStateMachine(machine, query) && (!options.onlyWarnings || hasWarnings(machine)),
  );
}

/** Dateiname für die Anzeige; der vollständige Pfad bleibt als Titel verfügbar. */
export function sourceLabel(source: string): string {
  const marker = source.startsWith("supabase/migrations/") ? "supabase/migrations/" : "";
  return marker ? source.slice(marker.length) : source;
}

export function guardKindLabel(kind: StateMachineGuard["kind"]): string {
  return kind === "guard" ? "Guard (bricht ab)" : "Trigger (beobachtend)";
}
