import { notify } from "@/lib/notify";
import { useEffect, useRef, useState } from "react";
import "pdfjs-dist/web/pdf_viewer.css";
import type { PDFDocumentProxy } from "pdfjs-dist";
import { AnnotationLayer, AnnotationShape, PolygonPreview, type AnnotationEditingProps } from "./AnnotationShapes";
import { useShapeDrawing } from "./useShapeDrawing";
import { pdfTextLayerVariables, selectionRectsToFrac } from "../annotationModel";
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
    setError(null); setPdf(null);
    let cancelled = false; let task: { destroy: () => Promise<void> } | null = null;
    (async () => {
      try {
        const pdfjs = await import("@/lib/pdfjs");
        if (cancelled) return;
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
  const [size, setSize] = useState<{ w: number; h: number; userUnit: number } | null>(null);
  const [textState, setTextState] = useState<"loading" | "ready" | "empty" | "error">("loading");
  const [pageError, setPageError] = useState<string | null>(null);
  const selecting = useRef(false);
  const draftCallback = useRef(onDraft);
  draftCallback.current = onDraft;
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
    setTextState("loading"); setPageError(null);
    (async () => {
      const page = await pdf.getPage(pageNumber);
      const vp = page.getViewport({ scale });
      if (cancelled) return;
      setSize({ w: vp.width, h: vp.height, userUnit: vp.userUnit });
      if (!visible) return;
      const canvas = canvasRef.current, textDiv = textRef.current; if (!canvas || !textDiv) return;
      const ratio = window.devicePixelRatio || 1;
      canvas.width = Math.floor(vp.width * ratio); canvas.height = Math.floor(vp.height * ratio);
      canvas.style.width = `${vp.width}px`; canvas.style.height = `${vp.height}px`;
      const task = page.render({ canvas, viewport: vp, transform: ratio !== 1 ? [ratio, 0, 0, ratio, 0, 0] : undefined });
      renderTask = task;
      await task.promise;
      if (cancelled) return;
      const pdfjs = await import("@/lib/pdfjs");
      if (cancelled) return;
      textDiv.replaceChildren();
      const content = await page.getTextContent();
      if (cancelled) return;
      const layer = new pdfjs.TextLayer({ textContentSource: content, container: textDiv, viewport: vp });
      textLayer = layer;
      await layer.render();
      if (!cancelled) setTextState(content.items.some(item => 'str' in item && item.str.trim().length > 0) ? "ready" : "empty");
    })().catch(error => {
      if (!cancelled) { setTextState("error"); setPageError(error instanceof Error ? error.message : "PDF-Seite konnte nicht geladen werden"); }
    });
    return () => { cancelled = true; renderTask?.cancel(); textLayer?.cancel(); };
  }, [pdf, pageNumber, scale, visible]);

  const { handlers, preview, arrowPreview, points, cursor } = useShapeDrawing(
    tool,
    r => onDraft({ annotation_type: "rect", page_number: pageNumber, target_selector: { rects: [r] }, quote_text: null }),
    points => onDraft({ annotation_type: "polygon", page_number: pageNumber, target_selector: { points }, quote_text: null }),
    { onArrow: points => onDraft({ annotation_type: "arrow", page_number: pageNumber, target_selector: { points }, quote_text: null }),
      onNote: point => onDraft({ annotation_type: "note", page_number: pageNumber, target_selector: { points: [point] }, quote_text: null }) },
  );

  useEffect(() => {
    if (tool !== "highlight" || !visible) return;
    let frame: number | null = null;
    const finish = () => {
      if (!selecting.current) return;
      selecting.current = false;
      if (pageRef.current) pageRef.current.dataset.annotationDragging = "false";
      frame = requestAnimationFrame(() => {
        const sel = window.getSelection(), page = pageRef.current, textLayer = textRef.current;
        if (!sel || sel.isCollapsed || !sel.rangeCount || !page || !textLayer) return;
        const range = sel.getRangeAt(0).cloneRange();
        if (!range.intersectsNode(textLayer)) return;
        if (!page.contains(range.commonAncestorContainer)) {
          notify.info("Bitte Text innerhalb einer PDF-Seite markieren."); return;
        }
        const textBounds = document.createRange(); textBounds.selectNodeContents(textLayer);
        if (range.compareBoundaryPoints(Range.START_TO_START, textBounds) < 0) range.setStart(textBounds.startContainer, textBounds.startOffset);
        if (range.compareBoundaryPoints(Range.END_TO_END, textBounds) > 0) range.setEnd(textBounds.endContainer, textBounds.endOffset);
        const rects = selectionRectsToFrac(Array.from(range.getClientRects()), page.getBoundingClientRect());
        const text = range.toString().trim();
        if (rects.length && text) {
          sel.removeAllRanges();
          draftCallback.current({ annotation_type: "highlight", page_number: pageNumber, target_selector: { rects }, quote_text: text.slice(0, 2000) });
        }
      });
    };
    const cancel = (e: KeyboardEvent) => { if (e.key === "Escape") { selecting.current = false; if (pageRef.current) pageRef.current.dataset.annotationDragging = "false"; if (frame !== null) cancelAnimationFrame(frame); } };
    window.addEventListener("mouseup", finish); window.addEventListener("keydown", cancel);
    return () => { selecting.current = false; if (pageRef.current) pageRef.current.dataset.annotationDragging = "false"; if (frame !== null) cancelAnimationFrame(frame); window.removeEventListener("mouseup", finish); window.removeEventListener("keydown", cancel); };
  }, [tool, visible, pageNumber]);

  const pageAnnotations = annotations.filter(a => a.page_number === pageNumber);
  const drawing = tool === "rect" || tool === "polygon" || tool === "arrow" || tool === "note";
  return (
    <div ref={pageRef} data-annotation-page={pageNumber} data-annotation-surface className="relative bg-card shadow-md" style={{ width: size?.w ?? 600, height: size?.h ?? 800, ...pdfTextLayerVariables(scale, size?.userUnit ?? 1) }}>
      <canvas ref={canvasRef} className="block" />
      <div ref={textRef} className="textLayer aw-pdf-text" data-selectable={tool === "highlight"}
        onMouseDown={e => { if (e.button === 0 && tool === "highlight" && textState === "ready") { selecting.current = true; if (pageRef.current) pageRef.current.dataset.annotationDragging = "true"; } }}
        style={{ pointerEvents: tool === "highlight" ? "auto" : "none", userSelect: tool === "highlight" ? "text" : "none" }} />
      {tool === "highlight" && textState === "empty" && <p className="aw-pdf-text-status" role="status">Diese Seite enthält keinen auswählbaren Text. Bei Scans kannst du Bereiche markieren.</p>}
      {pageError && <p className="aw-pdf-text-status text-destructive" role="alert">Textschicht konnte nicht geladen werden: {pageError}</p>}
      <AnnotationLayer annotations={pageAnnotations} activeId={activeId} onSelect={onSelect} interactive={tool === "select"} canEdit={canEdit} onChange={onChange} draft={draft?.page_number === pageNumber ? draft : null} draftColor={color} onDraftChange={onDraftChange} hidden={hidden} numbers={numbers}>
        {preview && <AnnotationShape type="rect" selector={{ rects: [preview] }} color={color} active />}
        {arrowPreview && <AnnotationShape type="arrow" selector={{ points: arrowPreview }} color={color} active />}
        <PolygonPreview points={points} cursor={cursor} color={color} />
      </AnnotationLayer>
      {drawing && <div className="absolute inset-0" style={{ cursor: "crosshair", touchAction: "none" }} {...handlers} />}
      <span className="absolute -left-xl top-0 text-caption text-muted-foreground tabular-nums">{pageNumber}</span>
    </div>
  );
}
