import { useEffect, useRef, useState } from "react";
import pdfWorkerUrl from "pdfjs-dist/build/pdf.worker.min.mjs?url";
import "pdfjs-dist/web/pdf_viewer.css";
import type { PDFDocumentProxy } from "pdfjs-dist";
import { AnnotationLayer, AnnotationShape, type AnnotationEditingProps } from "./AnnotationShapes";
import { useShapeDrawing } from "./useShapeDrawing";
import { selectionRectsToFrac } from "../annotationModel";
import type { AnnotationColor, AnnotationTool, DocumentAnnotation, DraftAnnotation } from "../types";
import { LoadingState } from "@/components/ui-patterns";

interface Props extends AnnotationEditingProps {
  data: ArrayBuffer; zoom: number; tool: AnnotationTool; color: AnnotationColor;
  annotations: DocumentAnnotation[]; activeId: string | null; draft: DraftAnnotation | null;
  onSelect: (id: string) => void; onDraft: (d: DraftAnnotation) => void;
}

export function PdfAnnotator(props: Props) {
  const [pdf, setPdf] = useState<PDFDocumentProxy | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    let cancelled = false; let task: { destroy: () => Promise<void> } | null = null;
    (async () => {
      try {
        const pdfjs = await import("pdfjs-dist");
        pdfjs.GlobalWorkerOptions.workerSrc = pdfWorkerUrl;
        const loading = pdfjs.getDocument({ data: props.data.slice(0) }); task = loading;
        const doc = await loading.promise;
        if (!cancelled) setPdf(doc);
      } catch (e) { if (!cancelled) setError(e instanceof Error ? e.message : "PDF konnte nicht geladen werden"); }
    })();
    return () => { cancelled = true; void task?.destroy(); };
  }, [props.data]);
  if (error) return <p className="p-lg text-destructive">{error}</p>;
  if (!pdf) return <LoadingState label="PDF wird geladen…" />;
  return (
    <div className="flex min-h-full w-max min-w-full flex-col items-center gap-lg px-10 pb-[70px] pt-[84px]">
      {Array.from({ length: pdf.numPages }, (_, i) => <PdfPage key={i} pdf={pdf} pageNumber={i + 1} {...props} />)}
    </div>
  );
}

function PdfPage({ pdf, pageNumber, zoom, tool, color, annotations, activeId, draft, onSelect, onDraft, canEdit, onChange, onDraftChange, hidden, numbers }: Props & { pdf: PDFDocumentProxy; pageNumber: number }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const textRef = useRef<HTMLDivElement>(null);
  const pageRef = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState<{ w: number; h: number } | null>(null);
  const [visible, setVisible] = useState(pageNumber <= 2);
  const scale = zoom * 1.4;

  useEffect(() => {
    const el = pageRef.current; if (!el) return;
    const io = new IntersectionObserver(([e]) => { if (e.isIntersecting) setVisible(true); }, { rootMargin: "600px" });
    io.observe(el); return () => io.disconnect();
  }, []);

  useEffect(() => {
    let cancelled = false;
    let renderTask: { cancel: () => void } | null = null;
    let textLayer: { cancel: () => void } | null = null;
    (async () => {
      const page = await pdf.getPage(pageNumber);
      const vp = page.getViewport({ scale });
      if (cancelled) return;
      setSize({ w: vp.width, h: vp.height });
      if (!visible) return;
      const canvas = canvasRef.current, textDiv = textRef.current; if (!canvas || !textDiv) return;
      const ratio = window.devicePixelRatio || 1;
      canvas.width = Math.floor(vp.width * ratio); canvas.height = Math.floor(vp.height * ratio);
      canvas.style.width = `${vp.width}px`; canvas.style.height = `${vp.height}px`;
      const task = page.render({ canvas, viewport: vp, transform: ratio !== 1 ? [ratio, 0, 0, ratio, 0, 0] : undefined });
      renderTask = task;
      await task.promise.catch(() => undefined);
      if (cancelled) return;
      const pdfjs = await import("pdfjs-dist");
      if (cancelled) return;
      textDiv.replaceChildren();
      const layer = new pdfjs.TextLayer({ textContentSource: page.streamTextContent(), container: textDiv, viewport: vp });
      textLayer = layer;
      await layer.render().catch(() => undefined);
    })();
    return () => { cancelled = true; renderTask?.cancel(); textLayer?.cancel(); };
  }, [pdf, pageNumber, scale, visible]);

  const { handlers, preview } = useShapeDrawing(
    tool,
    r => onDraft({ annotation_type: "rect", page_number: pageNumber, target_selector: { rects: [r] }, quote_text: null }),
    () => undefined,
  );

  const onMouseUp = () => {
    if (tool !== "highlight") return;
    const sel = window.getSelection(); const page = pageRef.current;
    if (!sel || sel.isCollapsed || !page) return;
    const range = sel.getRangeAt(0);
    if (!page.contains(range.commonAncestorContainer)) return;
    const rects = selectionRectsToFrac(Array.from(range.getClientRects()), page.getBoundingClientRect());
    const text = sel.toString().trim();
    sel.removeAllRanges();
    if (rects.length && text) onDraft({ annotation_type: "highlight", page_number: pageNumber, target_selector: { rects }, quote_text: text.slice(0, 2000) });
  };

  const pageAnnotations = annotations.filter(a => a.page_number === pageNumber);
  const drawing = tool === "rect";
  return (
    <div ref={pageRef} data-annotation-page={pageNumber} data-annotation-surface className="relative bg-card shadow-md" style={{ width: size?.w ?? 600, height: size?.h ?? 800, ["--scale-factor" as string]: scale }}
      onMouseUp={onMouseUp}>
      <canvas ref={canvasRef} className="block" />
      <div ref={textRef} className="textLayer" style={{ pointerEvents: tool === "highlight" ? "auto" : "none" }} />
      <AnnotationLayer annotations={pageAnnotations} activeId={activeId} onSelect={onSelect} interactive={tool === "select"} canEdit={canEdit} onChange={onChange} draft={draft?.page_number === pageNumber ? draft : null} draftColor={color} onDraftChange={onDraftChange} hidden={hidden} numbers={numbers}>
        {preview && <AnnotationShape type="rect" selector={{ rects: [preview] }} color={color} active />}
      </AnnotationLayer>
      {drawing && <div className="absolute inset-0" style={{ cursor: "crosshair", touchAction: "none" }} {...handlers} />}
      <span className="absolute -left-xl top-0 text-caption text-muted-foreground tabular-nums">{pageNumber}</span>
    </div>
  );
}
