import { OcrTextLayer } from "./OcrTextLayer";
import { useAnnotationOcr } from "../useAnnotationOcr";
import { highlightOnPage, textHighlightDraft, updateHighlightPage } from "../textHighlights";
import { notify } from "@/lib/notify";
import { useEffect, useRef, useState } from "react";
import "pdfjs-dist/web/pdf_viewer.css";
import type { PDFDocumentProxy } from "pdfjs-dist";
import { AnnotationLayer, AnnotationShape, PolygonPreview, type AnnotationEditingProps } from "./AnnotationShapes";
import { useShapeDrawing } from "./useShapeDrawing";
import { pdfTextLayerVariables, selectionRectsToFrac } from "../annotationModel";
import type { AnnotationColor, AnnotationTool, DocumentAnnotation, DraftAnnotation, AnnotationTextPage } from "../types";
import { LoadingState } from "@/components/ui-patterns";

interface Props extends AnnotationEditingProps {
  data: ArrayBuffer; zoom: number; tool: AnnotationTool; color: AnnotationColor;
  annotations: DocumentAnnotation[]; activeId: string | null; draft: DraftAnnotation | null;
  onSelect: (id: string) => void; onDraft: (d: DraftAnnotation) => void;
}

export function PdfAnnotator(props: Props) {
  const [pdf, setPdf] = useState<PDFDocumentProxy | null>(null);
  const [error, setError] = useState<string | null>(null);
  const root = useRef<HTMLDivElement>(null);
  const selecting = useRef(false);
  const draftCallback = useRef(props.onDraft);
  draftCallback.current = props.onDraft;
  useEffect(() => {
    if (props.tool !== 'highlight') return;
    let frame: number | null = null;
    const clearDrag = () => { selecting.current = false; if (root.current) root.current.dataset.annotationDragging = 'false'; };
    const finish = () => {
      if (!selecting.current) return;
      clearDrag();
      frame = requestAnimationFrame(() => {
        const selection = window.getSelection();
        if (!selection || selection.isCollapsed || !selection.rangeCount || !root.current) return;
        const selected = selection.getRangeAt(0).cloneRange();
        const pages: AnnotationTextPage[] = [];
        for (const textLayer of root.current.querySelectorAll<HTMLElement>('.aw-pdf-text:not([hidden])')) {
          if (!selected.intersectsNode(textLayer)) continue;
          if (textLayer.dataset.textState === 'loading' || textLayer.dataset.textState === 'error') {
            notify.info('Die Textschicht einer ausgewählten Seite ist noch nicht verfügbar. Bitte die Auswahl wiederholen.'); return;
          }
          const range = selected.cloneRange(), bounds = document.createRange(); bounds.selectNodeContents(textLayer);
          if (range.compareBoundaryPoints(Range.START_TO_START, bounds) < 0) range.setStart(bounds.startContainer, bounds.startOffset);
          if (range.compareBoundaryPoints(Range.END_TO_END, bounds) > 0) range.setEnd(bounds.endContainer, bounds.endOffset);
          const page = textLayer.closest<HTMLElement>('[data-annotation-page]');
          if (!page) continue;
          const rects = selectionRectsToFrac(Array.from(range.getClientRects()), page.getBoundingClientRect());
          const text = range.toString().trim();
          if (rects.length && text) pages.push({ page_number: Number(page.dataset.annotationPage), rects, quote_text: text.slice(0, 2000) });
        }
        const draft = textHighlightDraft(pages);
        if (draft) { selection.removeAllRanges(); draftCallback.current(draft); }
      });
    };
    const cancel = (e: KeyboardEvent) => { if (e.key === 'Escape') { clearDrag(); if (frame !== null) cancelAnimationFrame(frame); } };
    window.addEventListener('mouseup', finish); window.addEventListener('keydown', cancel);
    return () => { clearDrag(); if (frame !== null) cancelAnimationFrame(frame); window.removeEventListener('mouseup', finish); window.removeEventListener('keydown', cancel); };
  }, [props.tool, props.data]);

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
    <div ref={root} onMouseDownCapture={e => {
      if (props.tool === 'highlight' && e.button === 0 && e.target instanceof HTMLElement && e.target.closest('.aw-pdf-text[data-text-state="ready"]')) {
        selecting.current = true; if (root.current) root.current.dataset.annotationDragging = 'true';
      }
    }} className="flex min-h-full w-max min-w-full flex-col items-center gap-lg px-10 pb-[70px] pt-[84px]">
      {Array.from({ length: pdf.numPages }, (_, i) => <PdfPage key={i} pdf={pdf} pageNumber={i + 1} {...props} />)}
    </div>
  );
}

function PdfPage({ pdf, pageNumber, zoom, tool, color, annotations, activeId, draft, onSelect, onDraft, canEdit, onChange, onDraftChange, hidden, numbers }: Props & { pdf: PDFDocumentProxy; pageNumber: number }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const textRef = useRef<HTMLDivElement>(null);
  const ocr = useAnnotationOcr();
  const pageRef = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState<{ w: number; h: number; userUnit: number } | null>(null);
  const [textState, setTextState] = useState<"loading" | "ready" | "empty" | "error">("loading");
  const [pageError, setPageError] = useState<string | null>(null);
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

  const pageAnnotations = annotations.map(a => highlightOnPage(a, pageNumber)).filter((a): a is DocumentAnnotation => a !== null);
  const pageDraft = draft ? highlightOnPage(draft, pageNumber) : null;
  const drawing = tool === "rect" || tool === "polygon" || tool === "arrow" || tool === "note";
  return (
    <div ref={pageRef} data-annotation-page={pageNumber} data-annotation-surface className="relative bg-card shadow-md" style={{ width: size?.w ?? 600, height: size?.h ?? 800, ...pdfTextLayerVariables(scale, size?.userUnit ?? 1) }}>
      <canvas ref={canvasRef} className="block" />
      <div ref={textRef} hidden={!!ocr.words?.length} className="textLayer aw-pdf-text" data-selectable={tool === "highlight"} data-text-state={textState}
        style={{ pointerEvents: tool === "highlight" ? "auto" : "none", userSelect: tool === "highlight" ? "text" : "none" }} />
      {!!ocr.words?.length && size && <OcrTextLayer words={ocr.words} width={size.w} height={size.h} selectable={tool === 'highlight'} />}
      {tool === 'highlight' && (textState === 'empty' || textState === 'error') && !ocr.words?.length && <div className="aw-pdf-text-status !pointer-events-auto" role="status">
        {ocr.busy ? `Texterkennung läuft … ${ocr.progress} %` : ocr.error ?? pageError ?? 'Diese Seite enthält keinen auswählbaren Text.'}
        <button type="button" className="aw-button ml-2" onClick={() => {
          if (ocr.busy) { ocr.cancel(); return; }
          void ocr.recognize(async signal => {
            const page = await pdf.getPage(pageNumber);
            if (signal.aborted) throw new Error('Abgebrochen');
            const base = page.getViewport({ scale: 1 });
            const vp = page.getViewport({ scale: Math.min(2, 2200 / base.width) });
            const canvas = document.createElement('canvas'); canvas.width = Math.ceil(vp.width); canvas.height = Math.ceil(vp.height);
            const task = page.render({ canvas, viewport: vp });
            const cancel = () => task.cancel(); signal.addEventListener('abort', cancel, { once: true });
            try { await task.promise; } finally { signal.removeEventListener('abort', cancel); }
            return canvas;
          });
        }}>{ocr.busy ? 'Abbrechen' : 'Text erkennen (OCR)'}</button>
        <small className="block">Deutsch · Erkennung lokal im Browser. Erkannten Text bitte prüfen.</small>
      </div>}
      <AnnotationLayer annotations={pageAnnotations} activeId={activeId} onSelect={onSelect} interactive={tool === "select"} canEdit={canEdit} onChange={(id, selector) => {
        const original = annotations.find(a => a.id === id);
        return onChange(id, original ? updateHighlightPage(original.target_selector, pageNumber, selector) : selector);
      }} draft={pageDraft} draftColor={color} onDraftChange={selector => onDraftChange?.(draft ? updateHighlightPage(draft.target_selector, pageNumber, selector) : selector)} hidden={hidden} numbers={numbers}>
        {preview && <AnnotationShape type="rect" selector={{ rects: [preview] }} color={color} active />}
        {arrowPreview && <AnnotationShape type="arrow" selector={{ points: arrowPreview }} color={color} active />}
        <PolygonPreview points={points} cursor={cursor} color={color} />
      </AnnotationLayer>
      {drawing && <div className="absolute inset-0" style={{ cursor: "crosshair", touchAction: "none" }} {...handlers} />}
      <span className="absolute -left-xl top-0 text-caption text-muted-foreground tabular-nums">{pageNumber}</span>
    </div>
  );
}
