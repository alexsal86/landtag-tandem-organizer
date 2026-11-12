import { AnnotationLayer, AnnotationShape } from "./AnnotationShapes";
import { useShapeDrawing } from "./useShapeDrawing";
import type { AnnotationColor, AnnotationTool, DocumentAnnotation, DraftAnnotation } from "../types";

interface Props {
  src: string; alt: string; zoom: number; tool: AnnotationTool; color: AnnotationColor;
  annotations: DocumentAnnotation[]; activeId: string | null; draft: DraftAnnotation | null;
  onSelect: (id: string) => void; onDraft: (d: DraftAnnotation) => void;
}

export function ImageAnnotator({ src, alt, zoom, tool, color, annotations, activeId, draft, onSelect, onDraft }: Props) {
  const { handlers, preview, points } = useShapeDrawing(
    tool,
    r => onDraft({ annotation_type: "rect", page_number: null, target_selector: { rects: [r] }, quote_text: null }),
    p => onDraft({ annotation_type: "polygon", page_number: null, target_selector: { points: p }, quote_text: null }),
  );
  return (
    <div className="flex justify-center p-lg">
      <div className="relative inline-block select-none shadow-md" style={{ width: `${zoom * 100}%`, maxWidth: zoom <= 1 ? "100%" : undefined, cursor: tool === "select" ? "default" : "crosshair", touchAction: "none" }} {...handlers}>
        <img src={src} alt={alt} className="block h-auto w-full" draggable={false} />
        <AnnotationLayer annotations={annotations} activeId={activeId} onSelect={onSelect}>
          {draft && <AnnotationShape type={draft.annotation_type} selector={draft.target_selector} color={color} active />}
          {preview && <AnnotationShape type="rect" selector={{ rects: [preview] }} color={color} active />}
          {points.length > 0 && <AnnotationShape type="polygon" selector={{ points }} color={color} active />}
        </AnnotationLayer>
      </div>
    </div>
  );
}
