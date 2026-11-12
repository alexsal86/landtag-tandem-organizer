import { createContext, useContext, useEffect, useRef, useState } from "react";
import { annotationBounds, moveAnnotationHandle, moveAnnotationSelector, type AnnotationHandle } from "../annotationModel";
import type { DocumentAnnotation, AnnotationColor, AnnotationSelector, AnnotationType, FracPoint, DraftAnnotation } from "../types";

export const colorVar = (c: AnnotationColor) => `var(--annotation-${c})`;
const SurfaceSize = createContext({ width: 1000, height: 1000 });

function Vertex({ point, color, onPointerDown }: { point: FracPoint; color: AnnotationColor; onPointerDown?: (e: React.PointerEvent<SVGEllipseElement>) => void }) {
  const size = useContext(SurfaceSize);
  return <ellipse cx={point.x} cy={point.y} rx={5 / size.width} ry={5 / size.height}
    fill="white" stroke={`hsl(${colorVar(color)})`} strokeWidth={2} vectorEffect="non-scaling-stroke"
    style={{ pointerEvents: onPointerDown ? "all" : "none", cursor: onPointerDown ? "crosshair" : undefined }} onPointerDown={onPointerDown} />;
}

interface ShapeProps {
  type: AnnotationType; selector: AnnotationSelector; color: AnnotationColor;
  active?: boolean; dimmed?: boolean; onClick?: () => void; draggable?: boolean;
  onPointerDown?: (e: React.PointerEvent<SVGElement>, handle?: AnnotationHandle) => void;
}

/** Geometry remains fractional; strokes and circular corner handles keep their screen size. */
export function AnnotationShape({ type, selector, color, active, dimmed, onClick, onPointerDown, draggable }: ShapeProps) {
  const size = useContext(SurfaceSize);
  const stroke = `hsl(${colorVar(color)})`;
  const common = {
    className: "aw-shape", fill: `hsl(${colorVar(color)})`, fillOpacity: type === "highlight" ? .35 : active ? .3 : .16,
    stroke: active || type !== "highlight" ? stroke : "none", strokeWidth: active ? 3 : 1.5,
    strokeDasharray: dimmed ? "6 4" : undefined,
    vectorEffect: "non-scaling-stroke" as const,
    style: { cursor: draggable ? "move" : onClick ? "pointer" : undefined, pointerEvents: onClick ? "all" as const : "none" as const },
    onClick: onClick ? (e: React.MouseEvent) => { e.stopPropagation(); onClick(); } : undefined,
    onPointerDown: onPointerDown ? (e: React.PointerEvent<SVGElement>) => onPointerDown(e) : undefined,
  };
  const vertices = (type === "polygon" || type === "arrow" || type === "note") ? (selector.points ?? []).map((point, index) => ({ point, handle: { kind: "point", index } as AnnotationHandle }))
    : (selector.rects ?? []).flatMap((r, index) => [
      { x: r.x, y: r.y }, { x: r.x + r.w, y: r.y }, { x: r.x + r.w, y: r.y + r.h }, { x: r.x, y: r.y + r.h },
    ].map((point, corner) => ({ point, handle: { kind: "rect", index, corner } as AnnotationHandle })));
  const endpoints = type === "arrow" && selector.points?.length === 2 ? selector.points : null;
  const from = endpoints && { x: endpoints[0].x * size.width, y: endpoints[0].y * size.height };
  const to = endpoints && { x: endpoints[1].x * size.width, y: endpoints[1].y * size.height };
  const angle = from && to ? Math.atan2(to.y - from.y, to.x - from.x) : 0;
  const headLength = from && to ? Math.min(13, Math.hypot(to.x - from.x, to.y - from.y) * .65) : 0;
  const head = to ? `M ${to.x - headLength * Math.cos(angle - Math.PI / 6)} ${to.y - headLength * Math.sin(angle - Math.PI / 6)} L ${to.x} ${to.y} L ${to.x - headLength * Math.cos(angle + Math.PI / 6)} ${to.y - headLength * Math.sin(angle + Math.PI / 6)}` : '';
  const anchor = type === "note" ? selector.points?.[0] : null;
  return <g opacity={dimmed ? .45 : 1}>
    {type === "arrow" ? from && to && <g transform={`scale(${1 / size.width} ${1 / size.height})`}>
      <line {...common} x1={from.x} y1={from.y} x2={to.x} y2={to.y} stroke="transparent" strokeWidth={16} fill="none" />
      <line x1={from.x} y1={from.y} x2={to.x} y2={to.y} stroke={stroke} strokeWidth={active ? 3 : 2} strokeDasharray={dimmed ? '6 4' : undefined} style={{ pointerEvents: 'none' }} />
      <path d={head} stroke={stroke} strokeWidth={active ? 3 : 2} strokeLinecap="round" strokeLinejoin="round" fill="none" style={{ pointerEvents: 'none' }} />
    </g> : type === "note" ? anchor && <g transform={`translate(${anchor.x} ${anchor.y}) scale(${1 / size.width} ${1 / size.height})`}>
      <path {...common} d="M -12 -15 H 6 L 14 -7 V 14 H -12 Z" fillOpacity={.95} strokeWidth={1.5} />
      <path d="M 6 -15 V -7 H 14 M -6 0 H 8 M -6 5 H 4" fill="none" stroke="white" strokeWidth={1.5} strokeLinecap="round" style={{ pointerEvents: 'none' }} />
    </g> : type === "polygon" ? <polygon points={(selector.points ?? []).map(p => `${p.x},${p.y}`).join(" ")} {...common} />
      : (selector.rects ?? []).map((r, i) => <rect key={i} x={r.x} y={r.y} width={r.w} height={r.h} {...common} />)}
    {active && vertices.map(({ point, handle }, i) => <Vertex key={i} point={point} color={color}
      onPointerDown={draggable && onPointerDown ? e => onPointerDown(e, handle) : undefined} />)}
  </g>;
}

/** Even the first polygon point and the rubber-band edge are visible immediately. */
export function PolygonPreview({ points, cursor, color }: { points: FracPoint[]; cursor: FracPoint | null; color: AnnotationColor }) {
  if (!points.length) return null;
  const path = cursor ? [...points, cursor] : points;
  return <g style={{ pointerEvents: "none" }}>
    <polyline points={path.map(p => `${p.x},${p.y}`).join(" ")} fill={path.length >= 3 ? `hsl(${colorVar(color)} / .15)` : "none"}
      stroke={`hsl(${colorVar(color)})`} strokeWidth={2} vectorEffect="non-scaling-stroke" />
    {cursor && points.length >= 2 && <line x1={cursor.x} y1={cursor.y} x2={points[0].x} y2={points[0].y}
      stroke={`hsl(${colorVar(color)})`} strokeWidth={1.5} strokeDasharray="5 4" vectorEffect="non-scaling-stroke" />}
    {points.map((point, i) => <Vertex key={i} point={point} color={color} />)}
  </g>;
}

interface Drag {
  id: string; pointerId: number; start: FracPoint; clientStart: FracPoint;
  original: AnnotationSelector; handle?: AnnotationHandle; moved: boolean;
}
export interface AnnotationEditingProps {
  canEdit: (annotation: DocumentAnnotation) => boolean;
  onChange: (id: string, selector: AnnotationSelector) => Promise<void>;
  onDraftChange?: (selector: AnnotationSelector) => void;
  hidden?: boolean;
  numbers?: Record<string, number>;
}

export function AnnotationLayer({ annotations, activeId, onSelect, interactive = true, canEdit, onChange, draft, draftColor = "yellow", onDraftChange, hidden = false, numbers = {}, children }: {
  annotations: DocumentAnnotation[]; activeId: string | null; onSelect: (id: string) => void;
  interactive?: boolean; children?: React.ReactNode; draft?: DraftAnnotation | null; draftColor?: AnnotationColor;
} & Partial<AnnotationEditingProps>) {
  const svgRef = useRef<SVGSVGElement>(null);
  const drag = useRef<Drag | null>(null);
  const suppressClick = useRef(false);
  const [size, setSize] = useState({ width: 1000, height: 1000 });
  const [preview, setPreview] = useState<{ id: string; selector: AnnotationSelector } | null>(null);
  const [saving, setSaving] = useState(false);
  useEffect(() => {
    const svg = svgRef.current; if (!svg) return;
    const observer = new ResizeObserver(([entry]) => {
      if (entry.contentRect.width && entry.contentRect.height) setSize({ width: entry.contentRect.width, height: entry.contentRect.height });
    });
    observer.observe(svg); return () => observer.disconnect();
  }, []);
  const cancel = () => {
    const current = drag.current; drag.current = null;
    if (!current) return;
    if (svgRef.current?.hasPointerCapture(current.pointerId)) svgRef.current.releasePointerCapture(current.pointerId);
    setPreview(null);
  };
  useEffect(() => {
    const key = (e: KeyboardEvent) => { if (e.key === "Escape") cancel(); };
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  }, []);
  useEffect(() => { if (!interactive || hidden) cancel(); }, [interactive, hidden]);

  const local = (e: React.PointerEvent) => {
    const rect = svgRef.current!.getBoundingClientRect();
    return { x: (e.clientX - rect.left) / rect.width, y: (e.clientY - rect.top) / rect.height };
  };
  const selectorAt = (current: Drag, e: React.PointerEvent) => {
    const p = local(e);
    return current.handle ? moveAnnotationHandle(current.original, current.handle, p)
      : moveAnnotationSelector(current.original, { x: p.x - current.start.x, y: p.y - current.start.y });
  };
  const shapes = annotations.filter(a => !a.parent_id && !hidden).map(a => ({
    id: a.id, annotation_type: a.annotation_type, target_selector: a.target_selector, color: a.color,
    resolved: a.resolved, active: a.id === activeId, editable: !!onChange && !!canEdit?.(a),
  }));
  if (draft) shapes.push({ id: "__draft__", annotation_type: draft.annotation_type, target_selector: draft.target_selector,
    color: draftColor, resolved: false, active: activeId === "__draft__", editable: !!onDraftChange });
  return <SurfaceSize.Provider value={size}>
    <svg aria-label="Markierungen" ref={svgRef} className="absolute inset-0 h-full w-full overflow-visible" viewBox="0 0 1 1" preserveAspectRatio="none"
      data-annotation-dragging={!!drag.current} style={{ pointerEvents: "none", touchAction: interactive ? "none" : undefined }}
      onClickCapture={e => { if (suppressClick.current) { suppressClick.current = false; e.stopPropagation(); } }}
      onPointerMove={e => {
        const current = drag.current; if (!current || e.pointerId !== current.pointerId) return;
        e.stopPropagation();
        current.moved ||= Math.hypot(e.clientX - current.clientStart.x, e.clientY - current.clientStart.y) >= 3;
        if (current.moved) setPreview({ id: current.id, selector: selectorAt(current, e) });
      }}
      onPointerUp={async e => {
        const current = drag.current; if (!current || e.pointerId !== current.pointerId) return;
        e.stopPropagation();
        const selector = selectorAt(current, e);
        drag.current = null;
        if (svgRef.current?.hasPointerCapture(e.pointerId)) svgRef.current.releasePointerCapture(e.pointerId);
        if (!current.moved) { setPreview(null); return; }
        suppressClick.current = true;
        setPreview({ id: current.id, selector }); setSaving(true);
        try {
          if (current.id === "__draft__") onDraftChange?.(selector);
          else await onChange?.(current.id, selector);
        } catch { /* The workspace reports the error; restore the saved position. */ }
        finally { setSaving(false); setPreview(null); }
      }}
      onPointerCancel={cancel} onLostPointerCapture={cancel}>
      {shapes.map(a => {
        const editable = interactive && !saving && a.editable;
        return <g key={a.id} data-annotation-id={a.id}>
          <AnnotationShape type={a.annotation_type} selector={preview?.id === a.id ? preview.selector : a.target_selector} color={a.color}
            active={a.active} dimmed={a.resolved} draggable={editable}
            onClick={interactive ? () => onSelect(a.id) : undefined}
            onPointerDown={interactive ? (e, handle) => {
              if (e.button !== 0) return;
              e.stopPropagation(); e.preventDefault(); onSelect(a.id);
              if (!editable) return;
              suppressClick.current = false;
              drag.current = { id: a.id, pointerId: e.pointerId, start: local(e), clientStart: { x: e.clientX, y: e.clientY }, original: a.target_selector, handle, moved: false };
              svgRef.current?.setPointerCapture(e.pointerId);
            } : undefined} />
        </g>;
      })}
      {children}
      {!hidden && annotations.filter(a => !a.parent_id).map(a => {
        const bounds = annotationBounds(preview?.id === a.id ? preview.selector : a.target_selector);
        if (!bounds) return null;
        return <g key={`pin-${a.id}`} transform={`translate(${bounds.x + (a.annotation_type === "note" ? 19 / size.width : 0)} ${bounds.y - (a.annotation_type === "note" ? 16 / size.height : 0)}) scale(${1 / size.width} ${1 / size.height})`}
          role="button" aria-label={`Anmerkung ${numbers[a.id] ?? ''} auswählen`} tabIndex={interactive ? 0 : -1}
          style={{ pointerEvents: interactive ? 'all' : 'none', cursor: 'pointer', opacity: a.resolved ? .6 : 1 }}
          onPointerDown={e => e.stopPropagation()} onClick={e => { e.stopPropagation(); onSelect(a.id); }}
          onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onSelect(a.id); } }}>
          {activeId === a.id && <circle r={16} fill="none" stroke="var(--aw-fg, currentColor)" strokeWidth={2} />}
          <circle r={12} fill={`hsl(${colorVar(a.color)})`} stroke="white" strokeWidth={2} />
          <text textAnchor="middle" dominantBaseline="central" fill="white" fontSize={12} fontWeight={700} style={{ pointerEvents: 'none' }}>{a.resolved ? '✓' : numbers[a.id]}</text>
        </g>;
      })}
    </svg>
  </SurfaceSize.Provider>;
}
