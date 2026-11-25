import { describe, expect, it } from "vitest";
import {
  filterStateMachines,
  findingLabel,
  guardKindLabel,
  hasWarnings,
  indexTransitionsByEdge,
  sourceLabel,
  stateMachineArtifact,
  summarizeStateMachines,
  transitionKey,
  transitionKindLabel,
  transitionLabel,
  type StateMachine,
} from "./stateMachines";

describe("Zustandsansicht: Anzeige-Modell", () => {
  it("liest das generierte Artefakt und zählt es konsistent", () => {
    const summary = summarizeStateMachines();
    expect(summary.machines).toBe(stateMachineArtifact.machines.length);
    expect(summary.machines).toBeGreaterThan(0);
    expect(summary.transitions).toBeGreaterThan(0);
    expect(summary.guards + summary.observers).toBe(
      stateMachineArtifact.machines.reduce((sum, machine) => sum + machine.guards.length, 0),
    );
    expect(summary.warnings + summary.hints).toBe(
      stateMachineArtifact.machines.reduce((sum, machine) => sum + machine.findings.length, 0),
    );
    expect(summary.initialStates).toBeGreaterThan(0);
    expect(summary.migrationCount).toBeGreaterThan(0);
  });

  it("enthält die Aufgaben-Statusmaschine mit Startzustand und belegten Quellen", () => {
    const tasks = stateMachineArtifact.machines.find((machine) => machine.id === "tasks.status");
    expect(tasks).toBeDefined();
    expect(tasks?.states.map((state) => state.value)).toContain("completed");
    expect(tasks?.initialStates).toContain("todo");
    expect(tasks?.guards.some((guard) => guard.kind === "guard")).toBe(true);
    expect(tasks?.transitions.every((transition) => transition.sources.length > 0)).toBe(true);
    expect(tasks?.states.every((state) => state.sources.length > 0)).toBe(true);
    expect(tasks?.findings.every((finding) => ["warn", "info"].includes(finding.severity))).toBe(true);
  });

  it("filtert nach Tabelle, Zustand, Guard und Warnungen", () => {
    expect(filterStateMachines(stateMachineArtifact.machines, "leave_requests").map((machine) => machine.id)).toContain(
      "leave_requests.status",
    );
    expect(filterStateMachines(stateMachineArtifact.machines, "completed").some((machine) => machine.id === "tasks.status")).toBe(
      true,
    );
    expect(
      filterStateMachines(stateMachineArtifact.machines, "case_step_task_journal").some(
        (machine) => machine.id === "tasks.status",
      ),
    ).toBe(true);
    expect(filterStateMachines(stateMachineArtifact.machines, "gibt-es-nicht")).toEqual([]);

    const warningsOnly = filterStateMachines(stateMachineArtifact.machines, "", { onlyWarnings: true });
    expect(warningsOnly.length).toBeGreaterThan(0);
    expect(warningsOnly.every((machine) => hasWarnings(machine))).toBe(true);
    expect(warningsOnly.length).toBeLessThan(stateMachineArtifact.machines.length);
  });

  it("kennzeichnet Start- und parametrische Kanten statt sie zu erfinden", () => {
    expect(transitionLabel({ from: null, to: "todo", kind: "write", param: null, guards: [], sources: ["x"] })).toBe(
      "unbestimmt → todo",
    );
    expect(transitionLabel({ from: null, to: "todo", kind: "initial", param: null, guards: [], sources: ["x"] })).toBe(
      "∅ → todo",
    );
    expect(transitionLabel({ from: ["a", "b"], to: "c", kind: "write", param: null, guards: [], sources: [] })).toBe("a | b → c");
    expect(transitionKindLabel("initial")).toBe("Start");
    expect(transitionKindLabel("parametric")).toBe("parametrisch");
    expect(findingLabel("unerreichbar")).toBe("Unerreichbar");
    expect(findingLabel("gibt-es-nicht")).toBe("gibt-es-nicht");
  });

  it("ordnet Kanten über Ausgang, Ziel und Art zu, nicht nur über das Ziel", () => {
    const machine: StateMachine = {
      id: "tasks.status",
      table: "tasks",
      column: "status",
      enumType: null,
      states: [
        { value: "todo", sources: ["default:a.sql"] },
        { value: "done", sources: ["write:a.sql"] },
      ],
      initialStates: ["todo"],
      transitions: [
        { from: null, to: "todo", kind: "initial", param: null, guards: [], sources: ["a.sql"] },
        { from: null, to: "done", kind: "parametric", param: "_status", guards: ["g"], sources: ["a.sql"] },
        { from: ["todo"], to: "done", kind: "write", param: null, guards: [], sources: ["b.sql"] },
        { from: ["todo"], to: "todo", kind: "write", param: null, guards: [], sources: ["c.sql"] },
      ],
      guards: [],
      reconciliation: null,
      limitations: [],
      findings: [],
    };
    const index = indexTransitionsByEdge(machine);
    expect(index.size).toBe(4);
    expect(index.get(transitionKey(null, "done", "parametric"))?.param).toBe("_status");
    expect(index.get(transitionKey("todo", "done", "write"))?.sources).toEqual(["b.sql"]);
    expect(index.get(transitionKey(null, "todo", "initial"))?.sources).toEqual(["a.sql"]);
    expect(index.get(transitionKey("todo", "todo", "write"))?.sources).toEqual(["c.sql"]);
  });

  it("kürzt Quellenpfade und benennt Guard-Arten", () => {
    expect(sourceLabel("supabase/migrations/20261110160000_routine_workflow_runtime.sql")).toBe(
      "20261110160000_routine_workflow_runtime.sql",
    );
    expect(sourceLabel("src/example.ts")).toBe("src/example.ts");
    expect(guardKindLabel("guard")).toContain("bricht ab");
    expect(guardKindLabel("trigger")).toContain("beobachtend");
  });
});
