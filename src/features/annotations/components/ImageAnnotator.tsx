import { useEffect, useRef, useState } from "react";
import { AnnotationLayer, AnnotationShape, PolygonPreview, type AnnotationEditingProps } from "./AnnotationShapes";
import { useShapeDrawing } from "./useShapeDrawing";
import type { AnnotationColor, AnnotationTool, DocumentAnnotation, DraftAnnotation } from "../types";

interface Props extends AnnotationEditingProps {
  src: string; alt: string; zoom: number; tool: AnnotationTool; color: AnnotationColor;
  annotations: DocumentAnnotation[]; activeId: string | null; draft: DraftAnnotation | null;
  onImageSize?: (size: { width: number; height: number }) => void;
  onSelect: (id: string) => void; onDraft: (d: DraftAnnotation) => void;
}

export function ImageAnnotator({ src, alt, zoom, tool, color, annotations, activeId, draft, onSelect, onDraft, canEdit, onChange, onDraftChange, hidden, numbers, onImageSize }: Props) {
  const frame = useRef<HTMLDivElement>(null);
  const [viewport, setViewport] = useState({ width: 800, height: 600 });
  const [natural, setNatural] = useState({ width: 800, height: 600 });
  useEffect(() => {
    const el = frame.current; if (!el) return;
    const observer = new ResizeObserver(([entry]) => {
      if (entry.contentRect.width && entry.contentRect.height) setViewport({ width: entry.contentRect.width, height: entry.contentRect.height });
    });
    observer.observe(el); return () => observer.disconnect();
  }, []);
  const { handlers, preview, arrowPreview, points, cursor } = useShapeDrawing(
    tool,
    r => onDraft({ annotation_type: "rect", page_number: null, target_selector: { rects: [r] }, quote_text: null }),
    p => onDraft({ annotation_type: "polygon", page_number: null, target_selector: { points: p }, quote_text: null }),
    { onArrow: points => onDraft({ annotation_type: "arrow", page_number: null, target_selector: { points }, quote_text: null }),
      onNote: point => onDraft({ annotation_type: "note", page_number: null, target_selector: { points: [point] }, quote_text: null }) },
  );
  // Fit the complete image at 100%; fixed pixel sizes prevent flex shrinking above 100%.
  const fit = Math.min(Math.max(1, viewport.width - 80) / natural.width, Math.max(1, viewport.height - 154) / natural.height, 1);
  const width = natural.width * fit * zoom, height = natural.height * fit * zoom;
  return (
    <div ref={frame} className="h-full w-full">
      <div className="flex" style={{ padding: "84px 40px 70px", width: Math.max(viewport.width, width + 80), height: Math.max(viewport.height, height + 154) }}>
        <div data-annotation-surface className="relative m-auto shrink-0 select-none shadow-md"
          style={{ width, height, cursor: tool === "select" ? "default" : "crosshair", touchAction: "none" }} {...handlers}>
          <img src={src} alt={alt} className="block h-full w-full max-w-none" draggable={false}
            onLoad={e => { const size = { width: e.currentTarget.naturalWidth, height: e.currentTarget.naturalHeight }; setNatural(size); onImageSize?.(size); }} />
          <AnnotationLayer annotations={annotations} activeId={activeId} onSelect={onSelect} interactive={tool === "select"} canEdit={canEdit} onChange={onChange} draft={draft} draftColor={color} onDraftChange={onDraftChange} hidden={hidden} numbers={numbers}>
            {preview && <AnnotationShape type="rect" selector={{ rects: [preview] }} color={color} active />}
            {arrowPreview && <AnnotationShape type="arrow" selector={{ points: arrowPreview }} color={color} active />}
            <PolygonPreview points={points} cursor={cursor} color={color} />
          </AnnotationLayer>
        </div>
      </div>
    </div>
  );
}
