import { useMemo } from "react";
import { layoutStateMachine } from "./graphLayout";
import {
  indexTransitionsByEdge,
  transitionKey,
  transitionKindLabel,
  type StateMachine,
  type StateMachineTransition,
} from "./stateMachines";

type NodeKind = "initial" | "unreachable" | "guard-only" | "sink" | "normal";

const NODE_CLASS: Record<NodeKind, string> = {
  initial: "fill-primary stroke-primary",
  unreachable: "fill-destructive stroke-destructive",
  "guard-only": "fill-card stroke-secondary",
  sink: "fill-muted stroke-muted-foreground/70",
  normal: "fill-card stroke-border",
};

/** Deckkraft als Attribut statt als Tailwind-Opazitäts-Modifier: der Modifier
 * wird für `destructive` nicht zuverlässig aufgelöst und füllt den Knoten dann
 * deckend, sodass die Beschriftung unlesbar wird. */
const NODE_OPACITY: Record<NodeKind, number> = {
  initial: 0.14,
  unreachable: 0.1,
  "guard-only": 1,
  sink: 1,
  normal: 1,
};

const EDGE_CLASS = (transition: StateMachineTransition | undefined): string => {
  if (!transition) return "stroke-muted-foreground";
  if (transition.kind === "initial") return "stroke-primary";
  if (transition.kind === "parametric") return "stroke-muted-foreground";
  return "stroke-muted-foreground";
};

const dashFor = (kind: StateMachineTransition["kind"] | undefined): string | undefined =>
  kind === "write" ? undefined : kind === "parametric" ? "2 3" : "4 3";

function nodeKinds(machine: StateMachine): Map<string, NodeKind> {
  const kinds = new Map<string, NodeKind>();
  for (const finding of machine.findings) {
    if (finding.kind === "unerreichbar") for (const state of finding.states) kinds.set(state, "unreachable");
    if (finding.kind === "nur-im-guard") for (const state of finding.states) kinds.set(state, "guard-only");
    if (finding.kind === "sackgasse") for (const state of finding.states) if (!kinds.has(state)) kinds.set(state, "sink");
  }
  for (const state of machine.initialStates) kinds.set(state, "initial");
  return kinds;
}

interface StateMachineGraphProps {
  machine: StateMachine;
}

/**
 * SVG-Darstellung einer Zustandsmaschine. Die Positionen kommen aus
 * `graphLayout.ts`; die Farbe markiert Startzustände, unerreichbare Zustände,
 * Sackgassen und Werte, die nur in Guards vorkommen.
 */
export function StateMachineGraph({ machine }: StateMachineGraphProps) {
  const model = useMemo(() => layoutStateMachine(machine), [machine]);
  const kinds = useMemo(() => nodeKinds(machine), [machine]);
  const transitionsByEdge = useMemo(() => indexTransitionsByEdge(machine), [machine]);
  const markerId = `arrow-${machine.id.replace(/[^a-zA-Z0-9_-]/g, "-")}`;

  if (!model.nodes.length) {
    return <p className="text-xs text-muted-foreground">Kein Zustand belegt; kein Graph verfügbar.</p>;
  }

  return (
    <div className="space-y-2">
      <div className="overflow-x-auto rounded border bg-muted/20 p-2">
        <svg
          role="img"
          aria-label={`Zustandsgraph für ${machine.id}`}
          viewBox={`0 0 ${model.width} ${model.height}`}
          width={model.width}
          height={model.height}
          className="min-w-full"
        >
          <defs>
            <marker id={markerId} viewBox="0 0 10 10" refX="10" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
              <path d="M 0 0 L 10 5 L 0 10 z" className="fill-muted-foreground" />
            </marker>
          </defs>

          {model.edges.map((edge) => {
            const transition = transitionsByEdge.get(transitionKey(edge.from, edge.to, edge.kind));
            const source = edge.from ? machine.states.find((state) => state.value === edge.from) : undefined;
            return (
              <path
                key={edge.id}
                d={edge.path}
                fill="none"
                strokeWidth={1.2}
                strokeDasharray={dashFor(edge.kind)}
                markerEnd={`url(#${markerId})`}
                className={EDGE_CLASS(transition)}
              >
                <title>
                  {`${edge.from ?? "∅"} → ${edge.to} (${transitionKindLabel(edge.kind)})`}
                  {transition?.param ? `\nParameter: ${transition.param}` : ""}
                  {transition?.guards.length ? `\ngeprüft von: ${transition.guards.join(", ")}` : ""}
                  {source?.sources.length ? `\nQuelle: ${source.sources[0]}` : ""}
                </title>
              </path>
            );
          })}

          {[...new Set(model.edges.filter((edge) => edge.from === null).map((edge) => edge.to))].map((state) => {
            const node = model.nodes.find((entry) => entry.id === state);
            if (!node) return null;
            return (
              <text
                key={`start-${state}`}
                x={node.x + 2}
                y={node.y - 4}
                className="fill-muted-foreground text-[0.55rem]"
              >
                ∅
              </text>
            );
          })}

          {model.nodes.map((node) => {
            const kind = kinds.get(node.id) ?? "normal";
            const state = machine.states.find((entry) => entry.value === node.id);
            return (
              <g key={node.id}>
                <rect
                  x={node.x}
                  y={node.y}
                  width={node.width}
                  height={node.height}
                  rx={6}
                  strokeWidth={1.4}
                  fillOpacity={NODE_OPACITY[kind]}
                  strokeDasharray={kind === "guard-only" ? "4 3" : undefined}
                  className={NODE_CLASS[kind]}
                >
                  <title>{`${node.id}\n${state?.sources.join("\n") ?? ""}`}</title>
                </rect>
                <text
                  x={node.x + node.width / 2}
                  y={node.y + node.height / 2 + 4}
                  textAnchor="middle"
                  className="fill-foreground font-mono text-[0.6rem]"
                >
                  {node.id}
                </text>
              </g>
            );
          })}
        </svg>
      </div>
      <ul className="flex flex-wrap gap-x-4 gap-y-1 text-[0.65rem] text-muted-foreground">
        <li className="flex items-center gap-1">
          <span className="inline-block h-2 w-3 rounded border border-primary bg-primary/15" /> Startzustand
        </li>
        <li className="flex items-center gap-1">
          <span className="inline-block h-2 w-3 rounded border border-destructive bg-destructive/10" /> unerreichbar
        </li>
        <li className="flex items-center gap-1">
          <span className="inline-block h-2 w-3 rounded border border-dashed border-secondary bg-card" /> nur im Guard
        </li>
        <li className="flex items-center gap-1">
          <span className="inline-block h-2 w-3 rounded border border-muted-foreground/70 bg-muted" /> Sackgasse
        </li>
        <li className="flex items-center gap-1">
          <span className="inline-block h-3 w-0 border-l-2 border-dashed border-primary" /> Startkante
        </li>
        <li className="flex items-center gap-1">
          <span className="inline-block h-0 w-4 border-t border-dotted border-muted-foreground" /> parametrisch
        </li>
      </ul>
    </div>
  );
}
