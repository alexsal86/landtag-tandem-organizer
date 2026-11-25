import { describe, expect, it } from "vitest";
import { layoutStateMachine, nodeWidth } from "./graphLayout";
import { stateMachineArtifact, type StateMachine } from "./stateMachines";

const buildMachine = (overrides: Partial<StateMachine> = {}): StateMachine => ({
  id: "tasks.status",
  table: "tasks",
  column: "status",
  enumType: null,
  states: [
    { value: "todo", sources: ["default:a.sql"] },
    { value: "in_progress", sources: ["write:a.sql"] },
    { value: "done", sources: ["write:a.sql"] },
    { value: "verwaist", sources: ["guard:a.sql"] },
  ],
  initialStates: ["todo"],
  transitions: [
    { from: null, to: "todo", kind: "initial", param: null, guards: [], sources: ["a.sql"] },
    { from: ["todo"], to: "in_progress", kind: "write", param: null, guards: [], sources: ["a.sql"] },
    { from: ["in_progress"], to: "done", kind: "write", param: null, guards: [], sources: ["a.sql"] },
  ],
  guards: [],
  reconciliation: null,
  limitations: [],
  findings: [
    { kind: "unerreichbar", severity: "warn", states: ["verwaist"], message: "" },
    { kind: "sackgasse", severity: "info", states: ["done"], message: "" },
  ],
  ...overrides,
});

describe("Zustandsgraph: Layout", () => {
  it("legt Startzustände in die erste Spalte und entfernte Zustände nach rechts", () => {
    const model = layoutStateMachine(buildMachine());
    const column = (id: string) => model.nodes.find((node) => node.id === id)!.column;
    expect(column("todo")).toBe(0);
    expect(column("in_progress")).toBe(1);
    expect(column("done")).toBe(2);
    expect(column("verwaist")).toBe(3);
    expect(model.columns).toBe(4);
  });

  it("erzeugt für jede belegte Kante genau einen Pfad ohne ungültige Koordinaten", () => {
    const model = layoutStateMachine(buildMachine());
    expect(model.edges).toHaveLength(3);
    for (const edge of model.edges) {
      expect(edge.path.startsWith("M ")).toBe(true);
      expect(edge.path).not.toMatch(/NaN|Infinity/);
    }
    expect(model.width).toBeGreaterThan(0);
    expect(model.height).toBeGreaterThan(0);
  });

  it("zeichnet Startkanten als Quelle ohne Knoten und Selbstbezüge als Schleife", () => {
    const model = layoutStateMachine(
      buildMachine({
        transitions: [
          { from: ["todo"], to: "todo", kind: "write", param: null, guards: [], sources: ["a.sql"] },
          { from: null, to: "done", kind: "parametric", param: "_status", guards: [], sources: ["a.sql"] },
        ],
      }),
    );
    expect(model.edges.find((edge) => edge.from === null)?.path).toContain("L ");
    expect(model.edges.find((edge) => edge.selfLoop)?.path).toContain("C ");
    expect(model.edges.filter((edge) => edge.from === null)).toHaveLength(1);
  });

  it("ist deterministisch und vergrößert die Knotenbreite nur bis zur Obergrenze", () => {
    const first = layoutStateMachine(buildMachine());
    const second = layoutStateMachine(buildMachine());
    expect(second).toEqual(first);
    expect(nodeWidth("a")).toBe(72);
    expect(nodeWidth("x".repeat(200))).toBe(200);
  });

  it("bricht hohe Spalten um, statt alle Zustände zu stapeln", () => {
    const states = ["a", "b", "c", "d", "e", "f"].map((value) => ({ value, sources: ["default:a.sql"] }));
    const model = layoutStateMachine(buildMachine({ states, initialStates: [], transitions: [], findings: [] }));
    expect(model.columns).toBe(2);
    const rows = model.nodes.filter((node) => node.column === 0).map((node) => node.y);
    expect(new Set(rows).size).toBe(rows.length);
    expect(model.nodes.filter((node) => node.column === 0)).toHaveLength(4);
  });

  it("führt Rückkanten unterhalb aller Knoten statt durch die Spalte", () => {
    const model = layoutStateMachine(
      buildMachine({
        transitions: [
          { from: ["todo"], to: "done", kind: "write", param: null, guards: [], sources: ["a.sql"] },
          { from: ["done"], to: "todo", kind: "write", param: null, guards: [], sources: ["a.sql"] },
        ],
        findings: [],
      }),
    );
    const back = model.edges.find((edge) => edge.from === "done" && edge.to === "todo");
    expect(back).toBeDefined();
    const bottom = Math.max(...model.nodes.map((node) => node.y + node.height));
    const coordinates = back!.path.match(/-?\d+(?:\.\d+)?/g)?.map(Number) ?? [];
    expect(Math.max(...coordinates)).toBeGreaterThan(bottom);
    expect(model.height).toBeGreaterThan(bottom);
  });

  it("startet Kanten ohne Ausgangszustand senkrecht über dem Ziel", () => {
    const model = layoutStateMachine(buildMachine());
    const start = model.edges.find((edge) => edge.from === null)!;
    const node = model.nodes.find((entry) => entry.id === "todo")!;
    const coordinates = start.path.match(/-?\d+(?:\.\d+)?/g)?.map(Number) ?? [];
    const [x1, y1, x2, y2] = coordinates;
    expect(x1).toBe(x2);
    expect(y1).toBeLessThan(node.y);
    expect(y2).toBe(node.y);
  });

  it("erzeugt für jede Maschine des Artefakts gültige Koordinaten", () => {
    for (const machine of stateMachineArtifact.machines) {
      const model = layoutStateMachine(machine);
      expect(model.nodes.length).toBe(machine.states.length);
      expect(model.edges.length).toBeGreaterThanOrEqual(machine.transitions.length);
      for (const node of model.nodes) {
        expect(Number.isFinite(node.x) && Number.isFinite(node.y)).toBe(true);
        expect(node.x).toBeGreaterThanOrEqual(0);
        expect(node.y).toBeGreaterThanOrEqual(0);
      }
      for (const edge of model.edges) expect(edge.path).not.toMatch(/NaN|Infinity/);
    }
  });

  it("bleibt bei einer Maschine ohne Übergänge stabil", () => {
    const model = layoutStateMachine(
      buildMachine({
        states: [{ value: "nur", sources: ["default:a.sql"] }],
        initialStates: ["nur"],
        transitions: [],
        findings: [],
      }),
    );
    expect(model.nodes).toHaveLength(1);
    expect(model.edges).toHaveLength(0);
    expect(model.columns).toBe(1);
  });
});
