import { useEffect, useRef, useState } from "react";
import { canCloseAnnotationPolygon, isMeaningfulArrow, isMeaningfulRect, polygonIsValid, toFracPoint, toFracRect } from "../annotationModel";
import type { AnnotationTool, FracPoint, FracRect } from "../types";

/** Fractions stay stable during zoom; the unfinished polygon follows the pointer. */
export function useShapeDrawing(tool: AnnotationTool, onRect: (r: FracRect) => void, onPolygon: (p: FracPoint[]) => void, extra?: { onArrow?: (points: FracPoint[]) => void; onNote?: (point: FracPoint) => void }) {
  const start = useRef<FracPoint | null>(null);
  const pointRef = useRef<FracPoint[]>([]);
  const [arrowPreview, setArrowPreview] = useState<FracPoint[] | null>(null);
  const [preview, setPreview] = useState<FracRect | null>(null);
  const [points, setPoints] = useState<FracPoint[]>([]);
  const [cursor, setCursor] = useState<FracPoint | null>(null);
  const cancel = () => { pointRef.current = []; start.current = null; setPoints([]); setPreview(null); setCursor(null); setArrowPreview(null); };
  useEffect(() => { cancel(); }, [tool]);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLElement && e.target.closest('input,textarea,select,[contenteditable="true"]')) return;
      if (e.key === "Escape") cancel();
      if (e.key === "Enter" && tool === "polygon" && polygonIsValid(pointRef.current)) {
        e.preventDefault(); const complete = pointRef.current; cancel(); onPolygon(complete);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [tool, onPolygon]);

  const local = (e: React.PointerEvent | React.MouseEvent) => {
    const box = e.currentTarget.getBoundingClientRect();
    return toFracPoint({ x: e.clientX - box.left, y: e.clientY - box.top }, box.width, box.height);
  };
  const handlers = {
    onPointerDown: (e: React.PointerEvent) => {
      if ((tool !== "rect" && tool !== "arrow") || e.button !== 0) return;
      e.preventDefault();
      e.currentTarget.setPointerCapture(e.pointerId);
      start.current = local(e);
    },
    onPointerMove: (e: React.PointerEvent) => {
      const p = local(e);
      if (tool === "polygon") setCursor(p);
      if (tool === "rect" && start.current) setPreview(toFracRect(start.current, p, 1, 1));
      if (tool === "arrow" && start.current) setArrowPreview([start.current, p]);
    },
    onPointerUp: (e: React.PointerEvent) => {
      if ((tool !== "rect" && tool !== "arrow") || !start.current) return;
      const from = start.current, to = local(e), box = e.currentTarget.getBoundingClientRect();
      start.current = null; setPreview(null); setArrowPreview(null);
      if (e.currentTarget.hasPointerCapture(e.pointerId)) e.currentTarget.releasePointerCapture(e.pointerId);
      if (tool === "arrow") {
        if (isMeaningfulArrow([from, to], box.width, box.height)) extra?.onArrow?.([from, to]);
      } else {
        const rect = toFracRect(from, to, 1, 1);
        if (isMeaningfulRect(rect)) onRect(rect);
      }
    },
    onPointerCancel: cancel,
    onLostPointerCapture: () => { start.current = null; setPreview(null); setArrowPreview(null); },
    onPointerLeave: () => setCursor(null),
    onClick: (e: React.MouseEvent) => {
      if (tool === "note" && e.button === 0 && e.detail <= 1) { extra?.onNote?.(local(e)); return; }
      if (tool !== "polygon" || e.button !== 0 || e.detail > 1) return;
      const point = local(e), box = e.currentTarget.getBoundingClientRect();
      if (canCloseAnnotationPolygon(pointRef.current, point, box.width, box.height)) {
        const complete = pointRef.current; cancel(); onPolygon(complete); return;
      }
      pointRef.current = [...pointRef.current, point];
      setPoints(pointRef.current);
    },
    onDoubleClick: (e: React.MouseEvent) => {
      if (tool !== "polygon") return;
      e.preventDefault();
      const complete = pointRef.current;
      if (!polygonIsValid(complete)) return;
      cancel(); onPolygon(complete);
    },
  };
  return { handlers, preview, arrowPreview, points, cursor, cancel };
}
