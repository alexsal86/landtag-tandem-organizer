import type { DocumentAnnotation, AnnotationColor, AnnotationSelector, AnnotationType } from "../types";

export const colorVar = (c: AnnotationColor) => `var(--annotation-${c})`;

interface ShapeProps {
  type: AnnotationType;
  selector: AnnotationSelector;
  color: AnnotationColor;
  active?: boolean;
  dimmed?: boolean;
  onClick?: () => void;
}

/** Renders one annotation inside an SVG with viewBox 0 0 1 1 (fraction coordinates). */
export function AnnotationShape({ type, selector, color, active, dimmed, onClick }: ShapeProps) {
  const fill = `hsl(${colorVar(color)} / ${type === "highlight" ? 0.35 : 0.15})`;
  const stroke = `hsl(${colorVar(color)})`;
  const common = {
    fill, stroke: type === "highlight" ? "none" : stroke, strokeWidth: active ? 3 : 1.5,
    vectorEffect: "non-scaling-stroke" as const, opacity: dimmed ? 0.45 : 1,
    style: { cursor: onClick ? "pointer" : undefined, pointerEvents: onClick ? ("auto" as const) : ("none" as const) },
    onClick: onClick ? (e: React.MouseEvent) => { e.stopPropagation(); onClick(); } : undefined,
  };
  if (type === "polygon" && selector.points) {
    return <polygon points={selector.points.map(p => `${p.x},${p.y}`).join(" ")} {...common} />;
  }
  return (
    <g>
      {(selector.rects ?? []).map((r, i) => (
        <rect key={i} x={r.x} y={r.y} width={r.w} height={r.h} {...common}
          stroke={active ? stroke : common.stroke} />
      ))}
    </g>
  );
}

export function AnnotationLayer({ annotations, activeId, onSelect, children }: {
  annotations: DocumentAnnotation[]; activeId: string | null; onSelect: (id: string) => void; children?: React.ReactNode;
}) {
  return (
    <svg className="absolute inset-0 h-full w-full" viewBox="0 0 1 1" preserveAspectRatio="none" style={{ pointerEvents: "none" }}>
      {annotations.filter(a => !a.parent_id).map(a => (
        <g key={a.id} data-annotation-id={a.id}><AnnotationShape type={a.annotation_type} selector={a.target_selector} color={a.color}
          active={a.id === activeId} dimmed={a.resolved} onClick={() => onSelect(a.id)} /></g>
      ))}
      {children}
    </svg>
  );
}
