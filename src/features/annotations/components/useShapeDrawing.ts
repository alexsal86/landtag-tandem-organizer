import { useState } from "react";
import { isMeaningfulRect, polygonIsValid, toFracPoint, toFracRect } from "../annotationModel";
import type { AnnotationTool, FracPoint, FracRect } from "../types";

/** Pointer handling for rectangle dragging and polygon clicking on a sized surface. */
export function useShapeDrawing(tool: AnnotationTool, onRect: (r: FracRect) => void, onPolygon: (p: FracPoint[]) => void) {
  const [start, setStart] = useState<{ x: number; y: number } | null>(null);
  const [preview, setPreview] = useState<FracRect | null>(null);
  const [points, setPoints] = useState<FracPoint[]>([]);

  const local = (e: React.PointerEvent | React.MouseEvent) => {
    const box = (e.currentTarget as HTMLElement).getBoundingClientRect();
    return { p: { x: e.clientX - box.left, y: e.clientY - box.top }, w: box.width, h: box.height };
  };

  const handlers = {
    onPointerDown: (e: React.PointerEvent) => {
      if (tool !== "rect") return;
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
      setStart(local(e).p);
    },
    onPointerMove: (e: React.PointerEvent) => {
      if (tool !== "rect" || !start) return;
      const { p, w, h } = local(e);
      setPreview(toFracRect(start, p, w, h));
    },
    onPointerUp: (e: React.PointerEvent) => {
      if (tool !== "rect" || !start) return;
      const { p, w, h } = local(e);
      const r = toFracRect(start, p, w, h);
      setStart(null); setPreview(null);
      if (isMeaningfulRect(r)) onRect(r);
    },
    onClick: (e: React.MouseEvent) => {
      if (tool !== "polygon") return;
      const { p, w, h } = local(e);
      setPoints(prev => [...prev, toFracPoint(p, w, h)]);
    },
    onDoubleClick: () => {
      if (tool !== "polygon") return;
      // the double click also added a point via onClick; drop the duplicate
      const pts = points.slice(0, -1);
      setPoints([]);
      if (polygonIsValid(pts)) onPolygon(pts);
    },
  };
  const cancel = () => { setPoints([]); setStart(null); setPreview(null); };
  return { handlers, preview, points, cancel };
}
