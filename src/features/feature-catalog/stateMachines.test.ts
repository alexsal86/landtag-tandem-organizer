import { describe, expect, it } from "vitest";
import {
  filterStateMachines,
  guardKindLabel,
  sourceLabel,
  stateMachineArtifact,
  summarizeStateMachines,
  transitionLabel,
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
    expect(summary.migrationCount).toBeGreaterThan(0);
  });

  it("enthält die Aufgaben-Statusmaschine mit belegten Quellen", () => {
    const tasks = stateMachineArtifact.machines.find((machine) => machine.id === "tasks.status");
    expect(tasks).toBeDefined();
    expect(tasks?.states.map((state) => state.value)).toContain("completed");
    expect(tasks?.guards.some((guard) => guard.kind === "guard")).toBe(true);
    expect(tasks?.transitions.every((transition) => transition.sources.length > 0)).toBe(true);
    expect(tasks?.states.every((state) => state.sources.length > 0)).toBe(true);
  });

  it("filtert nach Tabelle, Zustand und Guard", () => {
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
  });

  it("kennzeichnet unbestimmte Ausgangszustände statt sie zu erfinden", () => {
    expect(transitionLabel({ from: null, to: "todo", sources: ["x"] })).toBe("unbestimmt → todo");
    expect(transitionLabel({ from: ["a", "b"], to: "c", sources: [] })).toBe("a | b → c");
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
