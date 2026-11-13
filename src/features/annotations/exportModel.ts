import type { DocumentAnnotation, FracPoint, FracRect } from "./types";
export function exportPoint(
  point: FracPoint,
  width: number,
  height: number,
): FracPoint {
  return { x: point.x * width, y: (1 - point.y) * height };
}
export function exportRect(rect: FracRect, width: number, height: number) {
  return {
    x: rect.x * width,
    y: (1 - rect.y - rect.h) * height,
    width: rect.w * width,
    height: rect.h * height,
  };
}
export function exportAnnotationPages(
  annotation: Pick<DocumentAnnotation, "target_selector" | "page_number">,
): number[] {
  return (
    annotation.target_selector.pages?.map((p) => p.page_number) ?? [
      annotation.page_number ?? 1,
    ]
  );
}
