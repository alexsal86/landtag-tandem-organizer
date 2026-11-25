import type { StateMachine, StateMachineTransition } from "./stateMachines";

/**
 * Layout des Zustandsgraphen. Reine Funktion ohne DOM: dieselbe Berechnung
 * liefert die Tests und die SVG-Darstellung, damit Kanten und Knoten nicht
 * auseinanderlaufen.
 *
 * Regeln:
 *  - Spalten entstehen aus der Entfernung zum Startzustand, innerhalb der
 *    Spalte alphabetisch; mehr als `MAX_ROWS` Zustände werden umgebrochen,
 *    damit keine endlos hohe Einzelspalte entsteht.
 *  - Kanten ohne Ausgangszustand beginnen als kurzer Stummel über dem Ziel.
 *  - Rückkanten und Kanten innerhalb einer Spalte laufen in einem Bus unter
 *    allen Knoten, statt quer durch die Spalte zu schneiden.
 */

export interface GraphNode {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  column: number;
}

export interface GraphEdge {
  id: string;
  from: string | null;
  to: string;
  path: string;
  kind: StateMachineTransition["kind"];
  selfLoop: boolean;
}

export interface StateMachineGraphModel {
  nodes: GraphNode[];
  edges: GraphEdge[];
  width: number;
  height: number;
  columns: number;
}

const NODE_HEIGHT = 28;
const ROW_GAP = 26;
const ROW_PITCH = NODE_HEIGHT + ROW_GAP;
const COLUMN_GAP = 88;
const PADDING = 24;
const LOOP_ROOM = 54;
const START_STUB = 16;
const MAX_RANK = 7;
const MAX_ROWS = 4;

export function nodeWidth(label: string): number {
  return Math.min(200, Math.max(72, 26 + label.length * 7.2));
}

function assignRanks(machine: StateMachine): Map<string, number> {
  const ranks = new Map<string, number>();
  for (const state of machine.initialStates) ranks.set(state, 0);

  for (let pass = 0; pass < 24; pass += 1) {
    let changed = false;
    for (const transition of machine.transitions) {
      if (!transition.from) continue;
      for (const from of transition.from) {
        const base = ranks.get(from);
        if (base === undefined) continue;
        const next = Math.min(MAX_RANK, base + 1);
        if ((ranks.get(transition.to) ?? -1) < next) {
          ranks.set(transition.to, next);
          changed = true;
        }
      }
    }
    if (!changed) break;
  }

  const known = [...ranks.values()];
  const maxRank = known.length ? Math.max(...known) : 0;
  const hasUnknownOrigin = machine.transitions.some((transition) => transition.from === null && transition.kind !== 'initial');
  const fallback = hasUnknownOrigin || maxRank > 0 ? 1 : 0;

  for (const state of machine.states) {
    if (ranks.has(state.value)) continue;
    const hasIncoming = machine.transitions.some((transition) => transition.to === state.value);
    ranks.set(state.value, hasIncoming ? fallback : maxRank + 1);
  }
  return ranks;
}

/** Spalten: Ränge in Reihenfolge, jeder Rang höchstens `MAX_ROWS` hoch. */
function buildColumns(machine: StateMachine, ranks: Map<string, number>): string[][] {
  const byRank = new Map<number, string[]>();
  for (const state of machine.states) {
    const rank = ranks.get(state.value) ?? 0;
    if (!byRank.has(rank)) byRank.set(rank, []);
    byRank.get(rank)!.push(state.value);
  }

  const initial = new Set(machine.initialStates);
  const columns: string[][] = [];
  for (const rank of [...byRank.keys()].sort((a, b) => a - b)) {
    const values = byRank.get(rank)!.sort((a, b) => {
      const initialDelta = Number(initial.has(b)) - Number(initial.has(a));
      return initialDelta || a.localeCompare(b);
    });
    for (let index = 0; index < values.length; index += MAX_ROWS) {
      columns.push(values.slice(index, index + MAX_ROWS));
    }
  }
  return columns;
}

export function layoutStateMachine(machine: StateMachine): StateMachineGraphModel {
  const ranks = assignRanks(machine);
  const columns = buildColumns(machine, ranks);

  const columnWidths = columns.map((values) => Math.max(...values.map(nodeWidth)));
  const columnX: number[] = [];
  let cursor = PADDING;
  for (let index = 0; index < columns.length; index += 1) {
    columnX.push(cursor);
    cursor += columnWidths[index] + COLUMN_GAP;
  }

  const nodes: GraphNode[] = [];
  let tallest = 1;
  columns.forEach((values, column) => {
    tallest = Math.max(tallest, values.length);
    values.forEach((value, row) => {
      nodes.push({
        id: value,
        x: columnX[column],
        y: PADDING + row * ROW_PITCH,
        width: nodeWidth(value),
        height: NODE_HEIGHT,
        column,
      });
    });
  });

  const index = new Map(nodes.map((node) => [node.id, node]));
  const contentBottom = PADDING + tallest * ROW_PITCH - ROW_GAP;
  let busCount = 0;
  const busY = () => contentBottom + 20 + busCount++ * 12;
  const edges: GraphEdge[] = [];
  const pairs = new Map<string, number>();
  const stubCounts = new Map<string, number>();

  for (const transition of machine.transitions) {
    const origins = transition.from && transition.from.length ? transition.from : [null];
    for (const from of origins) {
      const target = index.get(transition.to);
      if (!target) continue;
      const source = from ? index.get(from) : undefined;
      const key = `${from ?? '∅'}->${transition.to}:${transition.kind}`;
      const parallelIndex = pairs.get(key) ?? 0;
      pairs.set(key, parallelIndex + 1);

      if (!source) {
        const stubIndex = stubCounts.get(transition.to) ?? 0;
        stubCounts.set(transition.to, stubIndex + 1);
        const stubX = target.x + 14 + stubIndex * 9;
        edges.push({
          id: `${key}:${parallelIndex}`,
          from,
          to: transition.to,
          path: `M ${stubX} ${target.y - START_STUB} L ${stubX} ${target.y}`,
          kind: transition.kind,
          selfLoop: false,
        });
        continue;
      }

      if (source.id === target.id) {
        const bulge = 34 + parallelIndex * 12;
        edges.push({
          id: `${key}:${parallelIndex}`,
          from,
          to: transition.to,
          path: `M ${source.x + source.width} ${source.y + 7} C ${source.x + source.width + bulge} ${source.y - 16}, ${source.x + source.width + bulge} ${source.y + NODE_HEIGHT + 16}, ${source.x + source.width} ${source.y + NODE_HEIGHT - 7}`,
          kind: transition.kind,
          selfLoop: true,
        });
        continue;
      }

      if (target.x === source.x) {
        // Gleiche Spalte: um die gesamte Spaltenbreite herumführen, damit auch
        // breitere Nachbarknoten nicht geschnitten werden.
        const columnRight = columnX[source.column] + columnWidths[source.column];
        const detour = columnRight + 24 + parallelIndex * 10;
        edges.push({
          id: `${key}:${parallelIndex}`,
          from,
          to: transition.to,
          path: `M ${source.x + source.width} ${source.y + NODE_HEIGHT / 2} C ${detour} ${source.y + NODE_HEIGHT / 2}, ${detour} ${target.y + NODE_HEIGHT / 2}, ${target.x + target.width} ${target.y + NODE_HEIGHT / 2}`,
          kind: transition.kind,
          selfLoop: false,
        });
        continue;
      }

      if (target.x > source.x) {
        const sx = source.x + source.width;
        const sy = source.y + NODE_HEIGHT / 2;
        const ty = target.y + NODE_HEIGHT / 2;
        const mid = (sx + target.x) / 2;
        edges.push({
          id: `${key}:${parallelIndex}`,
          from,
          to: transition.to,
          path: `M ${sx} ${sy} C ${mid} ${sy}, ${mid} ${ty}, ${target.x} ${ty}`,
          kind: transition.kind,
          selfLoop: false,
        });
        continue;
      }

      // Rückkante: im Bus unter allen Knoten führen, mit geradem Lauf auf der
      // Bus-Höhe. Zwei Kontrollpunkte allein erreichen die Bus-Höhe nicht und
      // schneiden die Knoten.
      const dip = busY();
      const sx = source.x + source.width;
      const sy = source.y + NODE_HEIGHT / 2;
      const ty = target.y + NODE_HEIGHT / 2;
      edges.push({
        id: `${key}:${parallelIndex}`,
        from,
        to: transition.to,
        path: `M ${sx} ${sy} C ${sx + 18} ${sy}, ${sx + 18} ${dip}, ${sx + 34} ${dip} L ${target.x - 34} ${dip} C ${target.x - 18} ${dip}, ${target.x - 18} ${ty}, ${target.x} ${ty}`,
        kind: transition.kind,
        selfLoop: false,
      });
    }
  }

  const width = cursor - COLUMN_GAP + LOOP_ROOM + PADDING;
  const height = busCount
    ? contentBottom + 20 + (busCount - 1) * 12 + PADDING
    : contentBottom + PADDING;

  return { nodes, edges, width, height, columns: columns.length };
}
