import type { AnnotationColor, AnnotationFileKind, FracPoint, FracRect } from "./types";

export const ANNOTATION_COLORS: { value: AnnotationColor; label: string }[] = [
  { value: "yellow", label: "Wichtig" },
  { value: "green", label: "Zustimmung / ok" },
  { value: "red", label: "Klärungsbedarf" },
  { value: "blue", label: "Info / Hinweis" },
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
