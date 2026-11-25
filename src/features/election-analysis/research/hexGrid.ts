export interface HexPoint {
  number: number;
  name: string;
  /** Longitude or any west-east coordinate. */
  x: number;
  /** Latitude or any north-south coordinate; larger values lie further north. */
  y: number;
}

export interface HexCell extends HexPoint {
  column: number;
  row: number;
  cx: number;
  cy: number;
}

export interface HexLayoutOptions {
  columns?: number;
  size?: number;
  margin?: number;
}

export interface HexLayout {
  cells: HexCell[];
  width: number;
  height: number;
  size: number;
}

/**
 * Snaps district centroids to an odd-r hex grid. Each district keeps its rough
 * north-south and west-east position; collisions are resolved to the nearest free
 * cell, so the result is a kartogramm, never a boundary-accurate map.
 */
export function hexGridLayout(
  points: HexPoint[],
  options: HexLayoutOptions = {},
): HexLayout {
  const uniquePoints = [
    ...new Map(points.filter((p) => Number.isFinite(p.x) && Number.isFinite(p.y)).map((p) => [p.number, p])).values(),
  ];
  const size = options.size ?? 22;
  const margin = options.margin ?? 14;
  if (!uniquePoints.length) return { cells: [], width: 0, height: 0, size };
  const columns = Math.max(
    2,
    Math.min(12, Math.round(options.columns ?? Math.sqrt(uniquePoints.length * 1.5))),
  );
  const rows = Math.max(1, Math.ceil(uniquePoints.length / columns));
  const xs = uniquePoints.map((p) => p.x);
  const ys = uniquePoints.map((p) => p.y);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  const normX = (value: number) =>
    maxX === minX ? 0.5 : (value - minX) / (maxX - minX);
  // Screen coordinates grow downward while latitude grows northward.
  const normY = (value: number) =>
    maxY === minY ? 0.5 : 1 - (value - minY) / (maxY - minY);
  const taken = new Map<string, HexCell>();
  const cells: HexCell[] = [];
  let extraRow = rows;
  for (const point of uniquePoints) {
    const targetColumn = Math.round(normX(point.x) * (columns - 1));
    const targetRow = Math.round(normY(point.y) * (rows - 1));
    let column = targetColumn;
    let row = targetRow;
    if (taken.has(`${column}:${row}`)) {
      let found = false;
      for (let radius = 1; radius <= columns + rows * 2 && !found; radius += 1) {
        let best: { column: number; row: number; distance: number } | null = null;
        for (let dc = -radius; dc <= radius; dc += 1) {
          for (let dr = -radius; dr <= radius; dr += 1) {
            if (Math.max(Math.abs(dc), Math.abs(dr)) !== radius) continue;
            const candidateColumn = targetColumn + dc;
            const candidateRow = targetRow + dr;
            if (candidateColumn < 0 || candidateColumn >= columns || candidateRow < 0) continue;
            if (taken.has(`${candidateColumn}:${candidateRow}`)) continue;
            const distance = Math.hypot(
              dc,
              dr * 0.9,
            );
            if (!best || distance < best.distance)
              best = { column: candidateColumn, row: candidateRow, distance };
          }
        }
        if (best) {
          column = best.column;
          row = best.row;
          found = true;
        }
      }
      if (!found) {
        column = 0;
        row = extraRow;
        extraRow += 1;
      }
    }
    const cx =
      margin + size * Math.sqrt(3) * (column + 0.5 + (row % 2) * 0.5);
    const cy = margin + size + size * 1.5 * row;
    const cell: HexCell = { ...point, column, row, cx, cy };
    taken.set(`${column}:${row}`, cell);
    cells.push(cell);
  }
  const maxColumn = Math.max(...cells.map((cell) => cell.column));
  const maxRow = Math.max(...cells.map((cell) => cell.row));
  return {
    cells,
    width: margin * 2 + size * Math.sqrt(3) * (maxColumn + 1.5),
    height: margin * 2 + size * 2 + size * 1.5 * maxRow,
    size,
  };
}

/** Pointy-top hexagon around a center. */
export function hexPolygon(cx: number, cy: number, size: number): string {
  return Array.from({ length: 6 }, (_, index) => {
    const angle = (Math.PI / 180) * (60 * index - 30);
    return `${(cx + size * Math.cos(angle)).toFixed(2)},${(cy + size * Math.sin(angle)).toFixed(2)}`;
  }).join(" ");
}

interface LooseGeometry {
  type: string;
  coordinates: unknown;
}

export interface LooseFeature {
  properties: Record<string, unknown> | null;
  geometry: LooseGeometry | null;
}

type Position = [number, number];

/**
 * One centroid per district, taken from the largest ring of its geometry. This is
 * only a layout anchor for the kartogramm and never a vote or identity statement.
 */
export function districtCentroids(features: LooseFeature[]): HexPoint[] {
  const result: HexPoint[] = [];
  for (const feature of features) {
    const properties = feature.properties ?? {};
    const raw = properties.Nummer ?? properties.WKR_NR ?? properties.WKRNR ?? properties.NR;
    const number = Number(raw);
    if (!Number.isInteger(number) || !feature.geometry) continue;
    const rings: Position[][] = [];
    const coordinates = feature.geometry.coordinates;
    if (feature.geometry.type === "Polygon" && Array.isArray(coordinates)) {
      for (const ring of coordinates) if (Array.isArray(ring)) rings.push(ring as Position[]);
    } else if (feature.geometry.type === "MultiPolygon" && Array.isArray(coordinates)) {
      for (const polygon of coordinates)
        if (Array.isArray(polygon) && Array.isArray(polygon[0]))
          rings.push(polygon[0] as Position[]);
    }
    const ring = rings.sort((a, b) => b.length - a.length)[0];
    if (!ring?.length) continue;
    let sx = 0;
    let sy = 0;
    let count = 0;
    for (const position of ring) {
      if (!Array.isArray(position) || position.length < 2) continue;
      const [x, y] = position;
      if (!Number.isFinite(x) || !Number.isFinite(y)) continue;
      sx += x;
      sy += y;
      count += 1;
    }
    if (!count) continue;
    result.push({
      number,
      name: String(properties.NAME ?? properties.Name ?? properties.name ?? `Wahlkreis ${number}`),
      x: sx / count,
      y: sy / count,
    });
  }
  return result.sort((a, b) => a.number - b.number);
}
