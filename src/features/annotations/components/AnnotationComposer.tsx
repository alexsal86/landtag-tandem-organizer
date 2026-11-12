import { useLayoutEffect, useState, type RefObject } from "react";
import { annotationBounds, ANNOTATION_COLORS } from "../annotationModel";
import { AnnotationCommentInput } from "./AnnotationCommentInput";
import { colorVar } from "./AnnotationShapes";
import type { AnnotationColor, DraftAnnotation } from "../types";

export function AnnotationComposer({ target, viewer, canvas, zoom, tenantId, text, color, editing, saving, onText, onColor, onSave, onCancel }: {
  target: DraftAnnotation; viewer: RefObject<HTMLDivElement | null>; canvas: RefObject<HTMLDivElement | null>; zoom: number;
  tenantId: string; text: string; color: AnnotationColor; editing: boolean; saving: boolean;
  onText: (text: string) => void; onColor: (color: AnnotationColor) => void; onSave: () => void; onCancel: () => void;
}) {
  const [position, setPosition] = useState({ left: 12, top: 84, width: 290 });
  useLayoutEffect(() => {
    const viewport = viewer.current, container = canvas.current; if (!viewport || !container) return;
    let surface = viewport.querySelector<HTMLElement>(target.page_number ? `[data-annotation-page="${target.page_number}"]` : '[data-annotation-surface]');
    const place = () => {
      const b = annotationBounds(target.target_selector), outer = container.getBoundingClientRect();
      const width = Math.min(290, Math.max(1, outer.width - 24));
      if (!surface || !b) { setPosition({ left: 12, top: 84, width }); return; }
      const r = surface.getBoundingClientRect();
      const x = r.left - outer.left + (b.x + b.w) * r.width + 12;
      const left = x + width <= outer.width - 12 ? x : r.left - outer.left + b.x * r.width - width - 12;
      setPosition({ left: Math.max(12, Math.min(left, outer.width - width - 12)),
        top: Math.max(12, Math.min(r.top - outer.top + b.y * r.height, outer.height - 240)), width });
    };
    place(); const frame = requestAnimationFrame(place);
    const observer = new ResizeObserver(place); observer.observe(container); if (surface) observer.observe(surface);
    const content = new MutationObserver(() => {
      if (surface?.isConnected) return;
      surface = viewport.querySelector<HTMLElement>(target.page_number ? `[data-annotation-page="${target.page_number}"]` : '[data-annotation-surface]');
      if (surface) { observer.observe(surface); place(); }
    });
    content.observe(viewport, { childList: true, subtree: true });
    viewport.addEventListener('scroll', place);
    return () => { cancelAnimationFrame(frame); content.disconnect(); observer.disconnect(); viewport.removeEventListener('scroll', place); };
  }, [target.page_number, target.target_selector, zoom, viewer, canvas]);
  return <form className="aw-composer" style={{ ...position, maxHeight: `calc(100% - ${position.top + 12}px)` }} role="dialog" aria-label={editing ? "Anmerkung bearbeiten" : "Neue Anmerkung"}
    onSubmit={e => { e.preventDefault(); if (!saving) onSave(); }}
    onKeyDown={e => {
      if (e.key === 'Escape') { e.stopPropagation(); e.preventDefault(); if (!saving) onCancel(); }
      if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); if (!saving) onSave(); }
    }}>
    <AnnotationCommentInput tenantId={tenantId} autoFocus value={text} onChange={onText} placeholder="Kommentar schreiben … @ für Erwähnung" rows={3} maxLength={5000} />
    <div className="aw-composer-colors">{ANNOTATION_COLORS.map(c => <button key={c.value} type="button" aria-pressed={c.value === color}
      className={`aw-category ${c.value === color ? 'on' : ''}`} onClick={() => onColor(c.value)}>
      <i style={{ background: `hsl(${colorVar(c.value)})` }} />{c.label}</button>)}</div>
    <div className="aw-composer-actions"><small>Strg + Enter</small><button type="button" className="aw-button" disabled={saving} onClick={onCancel}>Abbrechen</button>
      <button type="submit" className="aw-button primary" disabled={saving}>{saving ? 'Speichert …' : editing ? 'Speichern' : 'Anmerken'}</button></div>
  </form>;
}
