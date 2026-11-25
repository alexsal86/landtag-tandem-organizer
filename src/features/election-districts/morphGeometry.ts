/**
 * Geometry morph between two boundary states of the map.
 *
 * A period switch should not cut. Districts are paired only when they share a
 * name or clearly overlap in area – never by district number, because numbers
 * are period-specific and a reform must not morph foreign areas into each
 * other. Paired districts are resampled to the same number of ring points,
 * projected to Web-Mercator pixels, aligned and interpolated. Everything else
 * (splits, merges, new or vanished districts, different ring structure, budget
 * overrun) is reported as a fade so the caller can cross-fade instead.
 *
 * Pure functions only: the caller owns Leaflet and the animation loop.
 */

/** [longitude, latitude] like GeoJSON positions. */
export type Position = [number, number];
/** One ring, closed or open; morphing treats it as cyclic. */
export type Ring = Position[];
/** One polygon: outer ring first, then holes. */
export type PolygonRings = Ring[];
/** MultiPolygon: one entry per polygon. */
export type ShapePolygons = PolygonRings[];

export interface MorphGeometryInput {
  /** Period-local key, e.g. the district number; identifies the drawn layer. */
  key: string;
  /** District name; the only cross-period identity signal besides the area. */
  name: string;
  polygons: ShapePolygons;
  /** Keeps the GeoJSON nesting (Polygon vs MultiPolygon) on the Leaflet layer. */
  multi: boolean;
}

export interface MorphPair {
  key: string;
  multi: boolean;
  /** Projected pixels, resampled to equal ring point counts. */
  from: ShapePolygons;
  to: ShapePolygons;
}

export interface MorphPlan {
  pairs: MorphPair[];
  /** Shapes without a counterpart; the caller fades them in instead. */
  fadeKeys: string[];
}

export interface MorphOptions {
  zoom?: number;
  maxPointsPerRing?: number;
  maxTotalPoints?: number;
  /** Minimum symmetric overlap of both areas; below it the shape fades. */
  minOverlap?: number;
}

/** ~192 points per ring keep the morph cheap; the whole transition stays linear. */
export const MORPH_DEFAULTS = {
  zoom: 8,
  maxPointsPerRing: 192,
  maxTotalPoints: 24_000,
  minOverlap: 0.5,
} as const;

const MAX_LAT = 85.05112878;
const TILE_SIZE = 256;
const SAMPLE_LIMIT = 96;
const BBOX_PREFILTER = 0.15;

export function projectPosition([lng, lat]: Position, zoom: number): Position {
  const scale = TILE_SIZE * 2 ** zoom;
  const clamped = Math.max(-MAX_LAT, Math.min(MAX_LAT, lat));
  const sin = Math.sin((clamped * Math.PI) / 180);
  return [
    ((lng + 180) / 360) * scale,
    (0.5 - Math.log((1 + sin) / (1 - sin)) / (4 * Math.PI)) * scale,
  ];
}

export function unprojectPosition([x, y]: Position, zoom: number): Position {
  const scale = TILE_SIZE * 2 ** zoom;
  const lng = (x / scale) * 360 - 180;
  const n = Math.PI - (2 * Math.PI * y) / scale;
  const lat = (180 / Math.PI) * Math.atan(0.5 * (Math.exp(n) - Math.exp(-n)));
  return [lng, lat];
}

const samePosition = (a: Position, b: Position) => a[0] === b[0] && a[1] === b[1];

/** Drops a duplicated closing vertex; morphing treats rings as cyclic. */
export function openRing(ring: Ring): Ring {
  return ring.length > 1 && samePosition(ring[0], ring[ring.length - 1]) ? ring.slice(0, -1) : ring;
}

/** Shoelace area; the sign carries the winding direction. */
export function ringArea(ring: Ring): number {
  const points = openRing(ring);
  let area = 0;
  for (let i = 0; i < points.length; i++) {
    const [x1, y1] = points[i];
    const [x2, y2] = points[(i + 1) % points.length];
    area += x1 * y2 - x2 * y1;
  }
  return area / 2;
}

/** Case/whitespace-insensitive district name; never derived from numbers. */
export function normalizeDistrictName(name: string): string {
  return name.trim().toLocaleLowerCase('de-DE').replace(/\s+/g, ' ');
}

/** Resamples a cyclic ring to exactly `count` points spaced by arc length. */
export function resampleRing(ring: Ring, count: number): Ring {
  const points = openRing(ring);
  if (points.length < 3 || count < 3) return points.slice(0, Math.max(0, count));

  const segmentLengths: number[] = [];
  let total = 0;
  for (let i = 0; i < points.length; i++) {
    const a = points[i];
    const b = points[(i + 1) % points.length];
    const length = Math.hypot(b[0] - a[0], b[1] - a[1]);
    segmentLengths.push(length);
    total += length;
  }
  if (total === 0) return Array.from({ length: count }, () => [...points[0]] as Position);

  const result: Ring = [];
  let segment = 0;
  let segmentStart = 0;
  for (let i = 0; i < count; i++) {
    const target = (i / count) * total;
    while (segment < points.length - 1 && segmentStart + segmentLengths[segment] < target) {
      segmentStart += segmentLengths[segment];
      segment += 1;
    }
    const ratio = segmentLengths[segment]
      ? Math.max(0, Math.min(1, (target - segmentStart) / segmentLengths[segment]))
      : 0;
    const a = points[segment];
    const b = points[(segment + 1) % points.length];
    result.push([a[0] + (b[0] - a[0]) * ratio, a[1] + (b[1] - a[1]) * ratio]);
  }
  return result;
}

/**
 * Aligns the start of `to` with `from` (and flips its winding when needed), so
 * equal rings do not twist around each other during the morph.
 */
export function alignRing(from: Ring, to: Ring): Ring {
  const n = from.length;
  if (n < 3 || to.length !== n) return to;
  const flipped = Math.sign(ringArea(from)) !== Math.sign(ringArea(to)) ? [...to].reverse() : to;
  const stride = Math.max(1, Math.floor(n / 64));
  let bestOffset = 0;
  let bestCost = Infinity;
  for (let offset = 0; offset < n; offset += stride) {
    let cost = 0;
    for (let i = 0; i < n; i++) {
      const a = from[i];
      const b = flipped[(i + offset) % n];
      cost += (a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2;
      if (cost >= bestCost) break;
    }
    if (cost < bestCost) {
      bestCost = cost;
      bestOffset = offset;
    }
  }
  return bestOffset === 0 ? flipped : flipped.map((_, i) => flipped[(i + bestOffset) % n]);
}

function projectShape(polygons: ShapePolygons, zoom: number): ShapePolygons {
  return polygons.map(polygon => polygon.map(ring => ring.map(point => projectPosition(point, zoom))));
}

interface Bounds {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

function shapeBounds(polygons: ShapePolygons): Bounds | null {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const polygon of polygons) {
    for (const ring of polygon) {
      for (const [x, y] of ring) {
        if (x < minX) minX = x;
        if (y < minY) minY = y;
        if (x > maxX) maxX = x;
        if (y > maxY) maxY = y;
      }
    }
  }
  return Number.isFinite(minX) && Number.isFinite(minY) ? { minX, minY, maxX, maxY } : null;
}

/** Cheap prefilter: bounding-box intersection over union. */
function boundsOverlapRatio(a: Bounds, b: Bounds): number {
  const width = Math.min(a.maxX, b.maxX) - Math.max(a.minX, b.minX);
  const height = Math.min(a.maxY, b.maxY) - Math.max(a.minY, b.minY);
  if (width <= 0 || height <= 0) return 0;
  const intersection = width * height;
  const union = (a.maxX - a.minX) * (a.maxY - a.minY) + (b.maxX - b.minX) * (b.maxY - b.minY) - intersection;
  return union > 0 ? intersection / union : 0;
}

function ringContainsPoint(ring: Ring, x: number, y: number): boolean {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i];
    const [xj, yj] = ring[j];
    if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

function polygonContainsPoint(polygon: PolygonRings, x: number, y: number): boolean {
  if (polygon.length === 0 || !ringContainsPoint(polygon[0], x, y)) return false;
  return !polygon.slice(1).some(hole => ringContainsPoint(hole, x, y));
}

function shapeContainsPoint(polygons: ShapePolygons, [x, y]: Position): boolean {
  return polygons.some(polygon => polygonContainsPoint(polygon, x, y));
}

/** Grid samples inside the shape; boundary-only samples underestimate overlap. */
function areaSamples(polygons: ShapePolygons): Position[] {
  const bounds = shapeBounds(polygons);
  if (!bounds) return [];
  const width = bounds.maxX - bounds.minX;
  const height = bounds.maxY - bounds.minY;
  if (width <= 0 || height <= 0) return [];
  const steps = Math.ceil(Math.sqrt(SAMPLE_LIMIT));
  const samples: Position[] = [];
  for (let i = 0; i < steps; i++) {
    for (let j = 0; j < steps; j++) {
      const point: Position = [
        bounds.minX + ((i + 0.5) / steps) * width,
        bounds.minY + ((j + 0.5) / steps) * height,
      ];
      if (shapeContainsPoint(polygons, point)) samples.push(point);
    }
  }
  return samples;
}

function shareInside(samples: Position[], polygons: ShapePolygons): number {
  return samples.length === 0
    ? 0
    : samples.filter(point => shapeContainsPoint(polygons, point)).length / samples.length;
}

/**
 * Symmetric overlap of two projected shapes: the smaller share of each shape's
 * area samples that lies inside the other shape. A small district fully inside
 * a large one therefore counts as a split, not as a match.
 */
export function projectedOverlapRatio(a: ShapePolygons, b: ShapePolygons): number {
  return Math.min(shareInside(areaSamples(a), b), shareInside(areaSamples(b), a));
}

/** Overlap of two shapes in [lng, lat] at the given zoom. */
export function polygonOverlapRatio(a: ShapePolygons, b: ShapePolygons, zoom = MORPH_DEFAULTS.zoom): number {
  return projectedOverlapRatio(projectShape(a, zoom), projectShape(b, zoom));
}

/**
 * Normalises a GeoJSON Polygon/MultiPolygon to morph input; anything unusable
 * returns null so the caller keeps its regular rendering path.
 */
export function geometryToMorphPolygons(
  geometry: { type: string; coordinates: unknown } | null | undefined,
): { polygons: ShapePolygons; multi: boolean } | null {
  if (!geometry) return null;
  const polygons: unknown = geometry.type === 'Polygon'
    ? [geometry.coordinates]
    : geometry.type === 'MultiPolygon' ? geometry.coordinates : null;
  if (!Array.isArray(polygons) || polygons.length === 0) return null;

  const normalized: ShapePolygons = [];
  for (const polygon of polygons) {
    if (!Array.isArray(polygon) || polygon.length === 0) return null;
    const rings: PolygonRings = [];
    for (const ring of polygon) {
      if (!Array.isArray(ring) || ring.length < 3) return null;
      const points: Ring = [];
      for (const point of ring) {
        if (!Array.isArray(point) || point.length < 2) return null;
        const [lng, lat] = point as unknown[];
        if (typeof lng !== 'number' || typeof lat !== 'number'
          || !Number.isFinite(lng) || !Number.isFinite(lat)) return null;
        points.push([lng, lat]);
      }
      rings.push(points);
    }
    normalized.push(rings);
  }
  return { polygons: normalized, multi: geometry.type === 'MultiPolygon' };
}

/**
 * Decides per shape whether it morphs or fades. A pair needs the same name or a
 * clear area overlap; the district number is never used as identity. Shapes
 * must also share their polygon/ring structure and fit the shared point budget.
 */
export function planMorph(
  previous: MorphGeometryInput[],
  next: MorphGeometryInput[],
  options: MorphOptions = {},
): MorphPlan {
  const zoom = options.zoom ?? MORPH_DEFAULTS.zoom;
  const maxPoints = Math.max(4, options.maxPointsPerRing ?? MORPH_DEFAULTS.maxPointsPerRing);
  const budget = options.maxTotalPoints ?? MORPH_DEFAULTS.maxTotalPoints;
  const minOverlap = options.minOverlap ?? MORPH_DEFAULTS.minOverlap;

  const previousPx = new Map<string, ShapePolygons>();
  const previousBounds = new Map<string, Bounds | null>();
  const previousSamples = new Map<string, Position[]>();
  const previousByName = new Map<string, MorphGeometryInput[]>();
  for (const shape of previous) {
    const projected = projectShape(shape.polygons, zoom);
    previousPx.set(shape.key, projected);
    previousBounds.set(shape.key, shapeBounds(projected));
    previousSamples.set(shape.key, areaSamples(projected));
    const name = normalizeDistrictName(shape.name);
    if (!name) continue;
    const list = previousByName.get(name) ?? [];
    list.push(shape);
    previousByName.set(name, list);
  }

  const used = new Set<string>();
  const pairs: MorphPair[] = [];
  const fadeKeys: string[] = [];
  let totalPoints = 0;

  const findCounterpart = (shape: MorphGeometryInput): MorphGeometryInput | undefined => {
    const byName = previousByName.get(normalizeDistrictName(shape.name)) ?? [];
    const named = byName.find(candidate => !used.has(candidate.key));
    if (named) return named;

    const nextPx = projectShape(shape.polygons, zoom);
    const nextBounds = shapeBounds(nextPx);
    if (!nextBounds) return undefined;
    const nextSamples = areaSamples(nextPx);
    let best: MorphGeometryInput | undefined;
    let bestRatio = 0;
    for (const candidate of previous) {
      if (used.has(candidate.key)) continue;
      const candidateBounds = previousBounds.get(candidate.key);
      if (!candidateBounds || boundsOverlapRatio(candidateBounds, nextBounds) < BBOX_PREFILTER) continue;
      const ratio = Math.min(
        shareInside(previousSamples.get(candidate.key) ?? [], nextPx),
        shareInside(nextSamples, previousPx.get(candidate.key) ?? []),
      );
      if (ratio > bestRatio) {
        bestRatio = ratio;
        best = candidate;
      }
    }
    return bestRatio >= minOverlap ? best : undefined;
  };

  for (const shape of next) {
    const old = findCounterpart(shape);
    if (!old || old.multi !== shape.multi || old.polygons.length !== shape.polygons.length
      || old.polygons.some((polygon, index) => polygon.length !== shape.polygons[index]?.length)) {
      fadeKeys.push(shape.key);
      continue;
    }
    used.add(old.key);

    const from: ShapePolygons = [];
    const to: ShapePolygons = [];
    let points = 0;
    let usable = true;

    for (let p = 0; p < shape.polygons.length && usable; p++) {
      const fromPolygon: PolygonRings = [];
      const toPolygon: PolygonRings = [];
      for (let r = 0; r < shape.polygons[p].length; r++) {
        const fromRing = old.polygons[p][r];
        const toRing = shape.polygons[p][r];
        if (openRing(fromRing).length < 3 || openRing(toRing).length < 3) {
          usable = false;
          break;
        }
        const count = Math.max(4, Math.min(maxPoints, Math.max(fromRing.length, toRing.length)));
        const projectedFrom = resampleRing(fromRing.map(point => projectPosition(point, zoom)), count);
        const projectedTo = alignRing(projectedFrom,
          resampleRing(toRing.map(point => projectPosition(point, zoom)), count));
        fromPolygon.push(projectedFrom);
        toPolygon.push(projectedTo);
        points += count;
      }
      if (usable) {
        from.push(fromPolygon);
        to.push(toPolygon);
      }
    }

    if (!usable) {
      fadeKeys.push(shape.key);
      continue;
    }
    totalPoints += points;
    if (totalPoints > budget) {
      return { pairs: [], fadeKeys: next.map(item => item.key) };
    }
    pairs.push({ key: shape.key, multi: shape.multi, from, to });
  }

  return { pairs, fadeKeys };
}

/** Frame of a pair at `t` (0 = previous state, 1 = new state) as [lng, lat]. */
export function interpolateMorph(pair: MorphPair, t: number, zoom: number): ShapePolygons {
  const progress = Math.max(0, Math.min(1, t));
  return pair.from.map((polygon, p) => polygon.map((ring, r) => ring.map((point, i) => {
    const target = pair.to[p][r][i];
    return unprojectPosition([
      point[0] + (target[0] - point[0]) * progress,
      point[1] + (target[1] - point[1]) * progress,
    ], zoom);
  })));
}
