import type { AnnotationColor, AnnotationFileKind, AnnotationTool, AnnotationSelector, FracPoint, FracRect } from "./types";

export const ANNOTATION_COLORS: { value: AnnotationColor; label: string }[] = [
  { value: "yellow", label: "Hinweis" },
  { value: "green", label: "Passt" },
  { value: "red", label: "Fehler" },
  { value: "blue", label: "Frage" },
];

const IMAGE_EXT = ["png", "jpg", "jpeg", "webp"];

export function getAnnotationFileKind(fileName: string, mime?: string | null): AnnotationFileKind | null {
  const ext = fileName.split(".").pop()?.toLowerCase() ?? "";
  if (ext === "pdf" || mime === "application/pdf") return "pdf";
  if (IMAGE_EXT.includes(ext) || (mime && ["image/png", "image/jpeg", "image/webp"].includes(mime))) return "image";
  return null;
}

/** Version stamp of the stored file; annotations made on another version get flagged. */
export function fileVersionOf(doc: { file_path: string; file_size?: number | null; updated_at?: string }): string {
  return `${doc.file_path}:${doc.file_size ?? 0}`;
}

const clamp = (v: number) => Math.min(1, Math.max(0, v));

export function toFracRect(a: { x: number; y: number }, b: { x: number; y: number }, width: number, height: number): FracRect {
  const x1 = clamp(Math.min(a.x, b.x) / width), x2 = clamp(Math.max(a.x, b.x) / width);
  const y1 = clamp(Math.min(a.y, b.y) / height), y2 = clamp(Math.max(a.y, b.y) / height);
  return { x: x1, y: y1, w: x2 - x1, h: y2 - y1 };
}

export function toFracPoint(p: { x: number; y: number }, width: number, height: number): FracPoint {
  return { x: clamp(p.x / width), y: clamp(p.y / height) };
}

/** Rects smaller than ~0.5% of the page are treated as accidental clicks. */
export function isMeaningfulRect(r: FracRect): boolean {
  return r.w > 0.005 && r.h > 0.005;
}

/** Converts browser selection rects into page fractions, dropping empty and duplicate line rects. */
export function selectionRectsToFrac(
  rects: { left: number; top: number; width: number; height: number }[],
  page: { left: number; top: number; width: number; height: number },
): FracRect[] {
  const out: FracRect[] = [];
  for (const r of rects) {
    if (r.width < 1 || r.height < 1) continue;
    const f = toFracRect({ x: r.left - page.left, y: r.top - page.top }, { x: r.left - page.left + r.width, y: r.top - page.top + r.height }, page.width, page.height);
    if (f.w <= 0 || f.h <= 0) continue;
    if (out.some(o => Math.abs(o.x - f.x) < 0.002 && Math.abs(o.y - f.y) < 0.002 && Math.abs(o.w - f.w) < 0.002)) continue;
    out.push(f);
  }
  return out;
}

export function polygonIsValid(points: FracPoint[]): boolean {
  return points.length >= 3;
}

export type AnnotationHandle = { kind: "point"; index: number } | { kind: "rect"; index: number; corner: 0 | 1 | 2 | 3 };

/** Translate the entire selection, keeping its shape and all vertices within the page. */
export function moveAnnotationSelector(selector: AnnotationSelector, delta: FracPoint): AnnotationSelector {
  const vertices = [
    ...(selector.points ?? []),
    ...(selector.rects ?? []).flatMap(r => [{ x: r.x, y: r.y }, { x: r.x + r.w, y: r.y + r.h }]),
  ];
  if (!vertices.length) return selector;
  const dx = Math.max(-Math.min(...vertices.map(p => p.x)), Math.min(delta.x, 1 - Math.max(...vertices.map(p => p.x))));
  const dy = Math.max(-Math.min(...vertices.map(p => p.y)), Math.min(delta.y, 1 - Math.max(...vertices.map(p => p.y))));
  return {
    ...selector,
    ...(selector.points && { points: selector.points.map(p => ({ x: clamp(p.x + dx), y: clamp(p.y + dy) })) }),
    ...(selector.rects && { rects: selector.rects.map(r => ({ ...r, x: clamp(r.x + dx), y: clamp(r.y + dy) })) }),
  };
}

/** Rectangle corners keep the opposite corner fixed; polygon vertices move independently. */
export function moveAnnotationHandle(selector: AnnotationSelector, handle: AnnotationHandle, point: FracPoint): AnnotationSelector {
  const p = { x: clamp(point.x), y: clamp(point.y) };
  if (handle.kind === "point") {
    const points = selector.points?.map((old, i) => i === handle.index ? p : old);
    if (points?.length === 2 && points[0].x === points[1].x && points[0].y === points[1].y) return selector;
    return { ...selector, points };
  }
  return { ...selector, rects: selector.rects?.map((r, i) => {
    if (i !== handle.index) return r;
    const opposite = { x: handle.corner === 0 || handle.corner === 3 ? r.x + r.w : r.x,
      y: handle.corner < 2 ? r.y + r.h : r.y };
    const next = toFracRect(p, opposite, 1, 1);
    return isMeaningfulRect(next) ? next : r;
  }) };
}

export function annotationZoom(value: number): number {
  return Math.max(0.25, Math.min(4, Math.round(value * 100) / 100));
}

/** Bounding box shared by canvas pins and the comment composer. */
export function annotationBounds(selector: AnnotationSelector): FracRect | null {
  const points = [...(selector.points ?? []), ...(selector.rects ?? []).flatMap(r => [{ x: r.x, y: r.y }, { x: r.x + r.w, y: r.y + r.h }])];
  if (!points.length) return null;
  const x = Math.min(...points.map(p => p.x)), y = Math.min(...points.map(p => p.y));
  return { x, y, w: Math.max(...points.map(p => p.x)) - x, h: Math.max(...points.map(p => p.y)) - y };
}

export type AnnotationFilter = "open" | "done" | "all";
export function annotationThreads<T extends { parent_id: string | null; resolved: boolean }>(annotations: T[], filter: AnnotationFilter): T[] {
  return annotations.filter(a => !a.parent_id && (filter === "all" || a.resolved === (filter === "done")));
}

export function annotationNumbers(annotations: { id: string; parent_id: string | null }[]): Record<string, number> {
  return Object.fromEntries(annotations.filter(a => !a.parent_id).map((a, i) => [a.id, i + 1]));
}

export function canCloseAnnotationPolygon(points: FracPoint[], point: FracPoint, width: number, height: number): boolean {
  return polygonIsValid(points) && Math.hypot((point.x - points[0].x) * width, (point.y - points[0].y) * height) <= 12;
}

/** JSONB key order is immaterial; compare only fields affected by the local operation. */
export function annotationPatchMatches(record: object, patch: object): boolean {
  const normalize = (value: unknown): unknown => Array.isArray(value) ? value.map(normalize)
    : value && typeof value === "object" ? Object.fromEntries(Object.entries(value).sort(([a], [b]) => a.localeCompare(b)).map(([k, v]) => [k, normalize(v)])) : value;
  return Object.entries(patch).every(([key, value]) => JSON.stringify(normalize((record as Record<string, unknown>)[key])) === JSON.stringify(normalize(value)));
}


export function pointAnnotationIsValid(type: "arrow" | "note", points: FracPoint[]): boolean {
  if (points.length !== (type === "arrow" ? 2 : 1)) return false;
  if (points.some(p => !Number.isFinite(p.x) || !Number.isFinite(p.y) || p.x < 0 || p.x > 1 || p.y < 0 || p.y > 1)) return false;
  return type === "note" || points[0].x !== points[1].x || points[0].y !== points[1].y;
}

export function isMeaningfulArrow(points: FracPoint[], width: number, height: number): boolean {
  return pointAnnotationIsValid("arrow", points) && Math.hypot((points[1].x - points[0].x) * width, (points[1].y - points[0].y) * height) >= 8;
}

export type AnnotationShortcut = { action: "color"; color: AnnotationColor } | { action: "tool"; tool: AnnotationTool } | { action: "delete" | "cancel" };
export function annotationShortcut(key: string, kind: AnnotationFileKind): AnnotationShortcut | null {
  const index = ["1", "2", "3", "4"].indexOf(key);
  if (index >= 0) return { action: "color", color: ANNOTATION_COLORS[index].value };
  switch (key.toLowerCase()) {
    case "h": return kind === "pdf" ? { action: "tool", tool: "highlight" } : null;
    case "r": return { action: "tool", tool: "rect" };
    case "p": return { action: "tool", tool: "polygon" };
    case "delete": return { action: "delete" };
    case "escape": return { action: "cancel" };
    default: return null;
  }
}
