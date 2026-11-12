import { useEffect, useLayoutEffect, useRef, useState, type RefObject } from "react";
import { annotationZoom } from "../annotationModel";

/** Wheel events are non-passive so zooming stays inside the document workspace. */
export function useAnnotationZoom(viewer: RefObject<HTMLDivElement | null>, documentId?: string) {
  const [zoom, setZoom] = useState(1);
  const anchor = useRef<{ x: number; y: number; fractionX: number; fractionY: number; surface: HTMLElement } | null>(null);
  const changeZoom = (value: number | ((current: number) => number), point?: { x: number; y: number }) => {
    const el = viewer.current;
    if (el) {
      const box = el.getBoundingClientRect();
      const x = point?.x ?? box.left + box.width / 2, y = point?.y ?? box.top + box.height / 2;
      const surfaces = Array.from(el.querySelectorAll<HTMLElement>("[data-annotation-surface]"));
      const surface = surfaces.find(s => { const r = s.getBoundingClientRect(); return x >= r.left && x <= r.right && y >= r.top && y <= r.bottom; }) ?? surfaces[0];
      if (surface) {
        const r = surface.getBoundingClientRect();
        anchor.current = { x, y, fractionX: (x - r.left) / r.width, fractionY: (y - r.top) / r.height, surface };
      }
    }
    setZoom(current => annotationZoom(typeof value === "function" ? value(current) : value));
  };
  useEffect(() => { setZoom(1); anchor.current = null; }, [documentId]);
  useEffect(() => {
    const el = viewer.current; if (!el) return;
    const wheel = (e: WheelEvent) => {
      if (e.shiftKey && !e.ctrlKey && !e.metaKey) return;
      e.preventDefault();
      if (el.querySelector('[data-annotation-dragging="true"]')) return;
      const delta = e.deltaY * (e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? el.clientHeight : 1);
      changeZoom(current => current * Math.exp(-Math.max(-150, Math.min(150, delta)) * .002), { x: e.clientX, y: e.clientY });
    };
    el.addEventListener("wheel", wheel, { passive: false });
    return () => el.removeEventListener("wheel", wheel);
  }, [viewer, documentId]);
  useLayoutEffect(() => {
    const current = anchor.current, el = viewer.current;
    if (!current || !el) return;
    // Image dimensions update synchronously; PDF page dimensions may arrive just after render.
    const adjust = () => {
      if (!current.surface.isConnected) return;
      const r = current.surface.getBoundingClientRect();
      el.scrollLeft += r.left + current.fractionX * r.width - current.x;
      el.scrollTop += r.top + current.fractionY * r.height - current.y;
    };
    adjust();
    const observer = new ResizeObserver(adjust);
    observer.observe(current.surface);
    return () => observer.disconnect();
  }, [zoom, viewer]);
  return { zoom, changeZoom };
}
