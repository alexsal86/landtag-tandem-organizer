import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAnnotationMembers } from "../useAnnotationMembers";
import { annotationTaskDefaults } from "../taskModel";
import { useQuery } from "@tanstack/react-query";
import { Highlighter, MousePointer2, Square, Pentagon, ZoomIn, ZoomOut, X, Eye, EyeOff, Undo2, Redo2, Maximize, MoveUpRight, FlagTriangleRight, Download } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { LoadingState, ErrorState } from "@/components/ui-patterns";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { notify } from "@/lib/notify";
import { ANNOTATION_COLORS, defaultAnnotationTool, annotationNumbers, annotationPatchMatches, annotationShortcut, fileVersionOf, getAnnotationFileKind } from "../annotationModel";
import { useAnnotations } from "../useAnnotations";
import { canManageAnnotation, canResolveAnnotation } from "../permissions";
import { useAnnotationHistory } from "../useAnnotationHistory";
import { colorVar } from "./AnnotationShapes";
import { PdfAnnotator } from "./PdfAnnotator";
import { ImageAnnotator } from "./ImageAnnotator";
import { useAnnotationZoom } from "./useAnnotationZoom";
import { AnnotationSidebar } from "./AnnotationSidebar";
import { AnnotationComposer } from "./AnnotationComposer";
import type { AnnotatableDocument, AnnotationColor, AnnotationTool, DraftAnnotation, AnnotationSelector, DocumentAnnotation, AnnotationPatch } from "../types";
import "./annotations.css";

interface Props { document: AnnotatableDocument | null; open: boolean; onOpenChange: (open: boolean) => void; initialAnnotationId?: string | null }
interface PendingDelete { timer: ReturnType<typeof setTimeout> | null; toast: string | number }
const errorText = (error: unknown, fallback: string) => error && typeof error === 'object' && 'message' in error ? String(error.message) : fallback;

export function AnnotationWorkspace({ document: doc, open, onOpenChange, initialAnnotationId }: Props) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const members = useAnnotationMembers(doc?.tenant_id, open);
  const viewerRef = useRef<HTMLDivElement>(null), canvasRef = useRef<HTMLDivElement>(null);
  const focusedLink = useRef<string | null>(null);
  const shortcuts = useRef<(event: KeyboardEvent) => void>(() => {});
  const pendingDeletes = useRef(new Map<string, PendingDelete>());
  const mounted = useRef(true), editLock = useRef(false);
  const [pendingIds, setPendingIds] = useState(new Set<string>());
  const [tool, setTool] = useState<AnnotationTool>(() => defaultAnnotationTool(doc ? getAnnotationFileKind(doc.file_name, doc.file_type) : null));
  const [color, setColor] = useState<AnnotationColor>("yellow");
  const [hidden, setHidden] = useState(false);
  const [draft, setDraft] = useState<DraftAnnotation | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [text, setText] = useState('');
  const [activeId, setActiveId] = useState<string | null>(null);
  const [imageSize, setImageSize] = useState<{ width: number; height: number } | null>(null);
  const kind = doc ? getAnnotationFileKind(doc.file_name, doc.file_type) : null;
  const { zoom, changeZoom } = useAnnotationZoom(viewerRef, open ? doc?.id : undefined);
  const api = useAnnotations(open && doc ? doc.id : null);
  const history = useAnnotationHistory((id, patch, expected) => api.update.mutateAsync({ id, patch, expected }));
  const annotations = api.annotations.filter(a => !pendingIds.has(a.id) && (!a.parent_id || !pendingIds.has(a.parent_id)));
  const numbers = annotationNumbers(annotations);
  const editing = annotations.find(a => a.id === editingId);
  const composerTarget = draft ?? (editing?.parent_id ? annotations.find(a => a.id === editing.parent_id) : editing);
  const [locating, setLocating] = useState(false);
  const busy = locating || api.create.isPending || api.update.isPending || api.remove.isPending || api.createTask.isPending || history.busy;

  useEffect(() => {
    const key = (e: KeyboardEvent) => shortcuts.current(e);
    window.addEventListener('keydown', key); return () => window.removeEventListener('keydown', key);
  }, []);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      // Leaving the document commits pending deletions; no timer or undo action leaks into another document.
      for (const [id, entry] of pendingDeletes.current) {
        notify.dismiss(entry.toast);
        if (entry.timer) {
          clearTimeout(entry.timer);
          void api.remove.mutateAsync(id).catch(error => notify.error(errorText(error, 'Anmerkung konnte nicht gelöscht werden')));
        }
      }
      pendingDeletes.current.clear();
    };
  }, []);

  const file = useQuery({
    queryKey: ["annotation-file", doc?.file_path], enabled: open && !!doc && !!kind, staleTime: 5 * 60_000,
    queryFn: async () => {
      const { data, error } = await supabase.storage.from("documents").download(doc!.file_path);
      if (error) throw error;
      return data;
    },
  });
  const [buffer, setBuffer] = useState<ArrayBuffer | null>(null), [imgUrl, setImgUrl] = useState<string | null>(null);
  useEffect(() => {
    if (!file.data) return;
    let cancelled = false, url: string | null = null;
    if (kind === 'pdf') void file.data.arrayBuffer().then(value => { if (!cancelled) setBuffer(value); });
    else { url = URL.createObjectURL(file.data); setImgUrl(url); }
    return () => { cancelled = true; if (url) URL.revokeObjectURL(url); setBuffer(null); setImgUrl(null); };
  }, [file.data, kind]);
  const authorIds = useMemo(() => Array.from(new Set(api.annotations.flatMap(a => a.assigned_to ? [a.created_by, a.assigned_to] : [a.created_by]))), [api.annotations]);
  const authors = useQuery({
    queryKey: ["annotation-authors", authorIds.join(',')], enabled: authorIds.length > 0, staleTime: 5 * 60_000,
    queryFn: async () => {
      const { data } = await supabase.from('profiles').select('user_id, display_name').in('user_id', authorIds);
      return Object.fromEntries((data ?? []).map(row => [row.user_id, row.display_name ?? 'Unbekannt'])) as Record<string, string>;
    },
  });
  const roles = useQuery({
    queryKey: ["annotation-permissions", doc?.tenant_id, user?.id], enabled: !!user?.id && !!doc?.tenant_id, staleTime: 60_000,
    queryFn: async () => {
      const [assigned, membership] = await Promise.all([
        supabase.from('user_roles').select('role').eq('user_id', user!.id),
        supabase.from('user_tenant_memberships').select('user_id').eq('tenant_id', doc!.tenant_id).eq('user_id', user!.id).eq('is_active', true).limit(1),
      ]);
      if (assigned.error) throw assigned.error;
      if (membership.error) throw membership.error;
      return { roles: (assigned.data ?? []).map(row => row.role), member: !!membership.data?.length };
    },
  });
  useEffect(() => {
    if (!initialAnnotationId || focusedLink.current === initialAnnotationId) return;
    const selected = api.annotations.find(a => a.id === initialAnnotationId);
    const viewer = viewerRef.current;
    if (!selected || !viewer) return;
    const rootId = selected.parent_id ?? selected.id;
    setActiveId(rootId); setHidden(false);
    const observer = new MutationObserver(() => focus());
    const focus = () => {
      const shape = viewer.querySelector(`[data-annotation-id="${rootId}"]`);
      if (shape) { shape.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'center' }); focusedLink.current = initialAnnotationId; observer.disconnect(); }
    };
    observer.observe(viewer, { childList: true, subtree: true });
    const frame = requestAnimationFrame(focus);
    return () => { observer.disconnect(); cancelAnimationFrame(frame); };
  }, [initialAnnotationId, api.annotations, buffer, imgUrl]);

  const [exporting, setExporting] = useState(false);
  const [reselect, setReselect] = useState<DocumentAnnotation | null>(null);
  if (!doc || !open) return null;
  const version = fileVersionOf(doc);
  const actor = { userId: user?.id, tenantMember: roles.data?.member ?? false, roles: roles.data?.roles ?? [] };
  const canEdit = (a: DocumentAnnotation) => canManageAnnotation(a.created_by, actor);
  const cancelComposer = () => { setReselect(null); if (draft?.annotation_type === 'highlight') setTool('highlight'); setDraft(null); setEditingId(null); setText(''); if (activeId === '__draft__') setActiveId(null); };
  const patchAnnotation = async (id: string, patch: AnnotationPatch, baseline?: DocumentAnnotation): Promise<boolean> => {
    const before = baseline ?? api.annotations.find(a => a.id === id);
    if (!before || busy || editLock.current) return false;
    if (Object.keys(patch).some(key => key !== "resolved") ? !canEdit(before) : !canResolveAnnotation(actor)) return false;
    if (annotationPatchMatches(before, patch)) return true;
    const previous = Object.fromEntries(Object.keys(patch).map(key => [key, before[key as keyof DocumentAnnotation]])) as AnnotationPatch;
    editLock.current = true;
    try {
      await api.update.mutateAsync({ id, patch, expected: previous });
      history.record({ id, before: previous, after: patch }); return true;
    } catch (error) { notify.error(errorText(error, 'Änderung nicht möglich')); return false; }
    finally { editLock.current = false; }
  };
  const selectAnnotation = (id: string, scroll = true) => {
    const selected = annotations.find(a => a.id === id), targetId = selected?.parent_id ?? id;
    setActiveId(targetId);
    if (scroll) {
      const shape = viewerRef.current?.querySelector(`[data-annotation-id="${targetId}"]`);
      const page = viewerRef.current?.querySelector(`[data-annotation-page="${selected?.page_number ?? 1}"]`);
      (shape ?? page)?.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'center' });
    }
  };
  const editAnnotation = (a: DocumentAnnotation) => {
    if (!canEdit(a) || busy) return;
    setReselect(null); setDraft(null); setEditingId(a.id); setText(a.content); setColor(a.color); setHidden(false); setTool('select'); selectAnnotation(a.id);
  };
  const exportPdf = async () => {
    if (!file.data || !kind || exporting || busy || pendingIds.size) return;
    setExporting(true);
    try {
      const { exportAnnotatedPdf } = await import('../exportPdf');
      const bytes = await exportAnnotatedPdf(file.data, kind, doc.title, annotations, version,
        id => id === user?.id ? 'Du' : authors.data?.[id] ?? 'Unbekannt');
      const url = URL.createObjectURL(new Blob([bytes.slice().buffer as ArrayBuffer], { type: 'application/pdf' }));
      const link = document.createElement('a'); link.href = url; link.download = `${doc.title.replace(/[<>:"/\\|?*]/g, '_')}-Anmerkungen.pdf`;
      link.click(); setTimeout(() => URL.revokeObjectURL(url), 30_000);
      notify.success('PDF-Kopie mit Anmerkungen und Kommentarliste exportiert');
    } catch (error) { notify.error(errorText(error, 'PDF-Export nicht möglich')); }
    finally { setExporting(false); }
  };
  const locateText = async (a: DocumentAnnotation) => {
    if (!buffer || !canEdit(a) || busy) return;
    setLocating(true);
    try {
      const { suggestTextLocation } = await import('../relocateText');
      const candidate = await suggestTextLocation(buffer, a);
      if (!mounted.current) return;
      if (!candidate) { notify.info('Textstelle nicht eindeutig gefunden. Bitte die Markierung manuell neu verorten.'); return; }
      setReselect(a); setEditingId(null); setDraft(candidate); setColor(a.color); setTool('select'); setActiveId('__draft__'); setHidden(false);
      requestAnimationFrame(() => viewerRef.current?.querySelector(`[data-annotation-page="${candidate.page_number}"]`)?.scrollIntoView({ behavior: 'smooth', block: 'center' }));
    } catch (error) { notify.error(errorText(error, 'Textstelle konnte nicht gesucht werden')); }
    finally { setLocating(false); }
  };
  const reselectAnnotation = (a: DocumentAnnotation) => {
    if (!canEdit(a) || busy || a.annotation_type !== 'highlight') return;
    setDraft(null); setEditingId(null); setText(''); setReselect(a); setColor(a.color); setTool('highlight'); setHidden(false); selectAnnotation(a.id);
  };
  const reanchorAnnotation = (a: DocumentAnnotation) => {
    if (!canEdit(a) || busy) return;
    setDraft(null); setEditingId(null); setText(''); setReselect(a); setColor(a.color); setTool(a.annotation_type); setHidden(false); selectAnnotation(a.id);
  };
  const startDraft = (next: DraftAnnotation) => {
    if (reselect) {
      void patchAnnotation(reselect.id, { target_selector: next.target_selector, quote_text: next.quote_text,
        page_number: next.page_number, file_version: version }, reselect).then(saved => {
          if (saved) { setReselect(null); setDraft(null); setActiveId(reselect.id); setTool('select'); notify.success('Markierung in aktueller Datei gespeichert'); }
        });
      return;
    }
    setDraft(next); setEditingId(null); setText(''); setActiveId('__draft__'); setTool('select'); setHidden(false);
  };
  const saveComposer = async () => {
    if (!user || !kind || busy) return;
    if (editing) {
      if (await patchAnnotation(editing.id, { content: text.trim(), color })) cancelComposer();
    } else if (draft) {
      try {
        const saved = await api.create.mutateAsync({ tenantId: doc.tenant_id, fileKind: kind, fileVersion: version, draft, color, content: text.trim(), userId: user.id });
        cancelComposer(); setActiveId(saved.id); history.clear(); notify.success('Anmerkung gespeichert');
      } catch (error) { notify.error(errorText(error, 'Anmerkung konnte nicht gespeichert werden')); }
    }
  };
  const reply = async (parentId: string, content: string): Promise<boolean> => {
    const parent = annotations.find(a => a.id === parentId);
    if (!parent || !user || !kind || busy) return false;
    try {
      await api.create.mutateAsync({ tenantId: doc.tenant_id, fileKind: kind, fileVersion: parent.file_version ?? version,
        draft: parent, color: parent.color, content, userId: user.id, parentId });
      history.clear(); notify.success('Antwort gespeichert'); return true;
    } catch (error) { notify.error(errorText(error, 'Antwort konnte nicht gespeichert werden')); return false; }
  };
  const deleteAnnotation = (id: string) => {
    const annotation = annotations.find(a => a.id === id);
    if (!annotation || !canEdit(annotation) || busy || pendingDeletes.current.has(id)) return;
    history.clear(); if (editingId === id || editing?.parent_id === id) cancelComposer();
    const childIds = annotation.parent_id ? [] : api.annotations.filter(a => a.parent_id === id).map(a => a.id);
    // Deleting a thread also covers any replies already waiting for deletion.
    for (const childId of childIds) {
      const child = pendingDeletes.current.get(childId);
      if (child?.timer) { clearTimeout(child.timer); notify.dismiss(child.toast); pendingDeletes.current.delete(childId); }
    }
    setPendingIds(current => { const next = new Set(current); for (const childId of childIds) next.delete(childId); return next.add(id); });
    const entry: PendingDelete = { timer: null, toast: 0 };
    entry.toast = notify.success('Anmerkung gelöscht', { duration: 5000, action: { label: 'Rückgängig', onClick: () => {
      if (!entry.timer || pendingDeletes.current.get(id) !== entry) return;
      clearTimeout(entry.timer); pendingDeletes.current.delete(id);
      if (mounted.current) setPendingIds(current => { const next = new Set(current); next.delete(id); return next; });
    } } });
    entry.timer = setTimeout(async () => {
      entry.timer = null;
      try { await api.remove.mutateAsync(id); }
      catch (error) { notify.error(errorText(error, 'Anmerkung konnte nicht gelöscht werden')); }
      finally {
        pendingDeletes.current.delete(id);
        if (mounted.current) setPendingIds(current => { const next = new Set(current); next.delete(id); return next; });
      }
    }, 5000);
    pendingDeletes.current.set(id, entry);
  };
  const createAnnotationTask = async (annotation: DocumentAnnotation) => {
    if (!user || busy || !api.workflowReady) return;
    const defaults = annotationTaskDefaults(annotation, doc.title, user.id);
    try {
      const id = await api.createTask.mutateAsync({ annotationId: annotation.id, title: defaults.title, assigneeId: defaults.assigneeId });
      notify.success('Aufgabe angelegt', { action: { label: 'Öffnen', onClick: () => navigate(`/tasks?highlight=${encodeURIComponent(id)}`) } });
    } catch (error) { notify.error(errorText(error, 'Aufgabe konnte nicht erstellt werden')); }
  };
  const chooseColor = (next: AnnotationColor) => {
    setColor(next);
    const selected = annotations.find(a => a.id === activeId);
    if (!reselect && !composerTarget && selected && canEdit(selected)) void patchAnnotation(selected.id, { color: next });
  };
  const chooseTool = (next: AnnotationTool) => {
    if (busy || (composerTarget && next !== 'select')) return;
    if (reselect && next !== reselect.annotation_type) { setReselect(null); setDraft(null); setActiveId(reselect.id); }
    setTool(next); if (next !== 'select') { setHidden(false); setActiveId(null); }
  };
  const fit = () => {
    if (kind === 'image') { changeZoom(1); return; }
    const viewer = viewerRef.current;
    const surfaces = Array.from(viewer?.querySelectorAll<HTMLElement>('[data-annotation-surface]') ?? []);
    const surface = surfaces.find(el => { const r = el.getBoundingClientRect(); const v = viewer!.getBoundingClientRect(); return r.bottom > v.top + 84 && r.top < v.bottom - 70; }) ?? surfaces[0];
    if (viewer && surface) {
      const r = surface.getBoundingClientRect();
      changeZoom(current => current * Math.min(Math.max(1, viewer.clientWidth - 80) / r.width, Math.max(1, viewer.clientHeight - 154) / r.height));
    }
  };
  shortcuts.current = e => {
    if (e.isComposing || e.repeat) return;
    if (e.target instanceof HTMLElement && e.target.closest('input,textarea,select,[contenteditable="true"],[role="menu"]')) return;
    const key = e.key.toLowerCase();
    if ((e.ctrlKey || e.metaKey) && key === 'z') { e.preventDefault(); if (!busy) void (e.shiftKey ? history.redo() : history.undo()); return; }
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    const action = kind ? annotationShortcut(key, kind) : null;
    if (action) {
      e.preventDefault();
      if (busy) return;
      if (action.action === 'color') chooseColor(action.color);
      else if (action.action === 'tool') chooseTool(action.tool);
      else if (action.action === 'delete') {
        const selected = editingId ?? activeId;
        if (selected === '__draft__') cancelComposer();
        else if (selected) deleteAnnotation(selected);
      } else { cancelComposer(); setActiveId(null); setTool('select'); }
      return;
    }
    if (key === 'v') chooseTool('select');
    else if (key === '+' || key === '=') { e.preventDefault(); changeZoom(current => current + .1); }
    else if (key === '-') { e.preventDefault(); changeZoom(current => current - .1); }
    else if (key === '0') { e.preventDefault(); fit(); }
  };
  const tools: { id: AnnotationTool; label: string; icon: typeof Square; show: boolean }[] = [
    { id: 'select', label: 'Auswählen (V)', icon: MousePointer2, show: true },
    { id: 'rect', label: 'Rechteck (R)', icon: Square, show: true },
    { id: 'polygon', label: 'Polygon (P)', icon: Pentagon, show: true },
    { id: 'arrow', label: 'Pfeil ziehen', icon: MoveUpRight, show: true },
    { id: 'note', label: 'Notiz-Nadel setzen', icon: FlagTriangleRight, show: true },
  ];
  const hint = tool === 'polygon' ? 'Punkte setzen · Doppelklick oder Enter schließt die Form · Esc bricht ab'
    : tool === 'arrow' ? 'Pfeil vom Startpunkt zur Zielstelle ziehen' : tool === 'note' ? 'Ins Dokument klicken, um eine Notiz anzuheften'
    : tool === 'rect' ? 'Rahmen aufziehen – danach Kommentar schreiben' : tool === 'highlight' ? 'Text auswählen – danach Kommentar schreiben'
    : '1–4: Farben · Entf: Löschen · Esc: Abbrechen · Mausrad: Zoom';
  const editorProps = { zoom, tool, color, annotations, activeId, draft, numbers, hidden,
    onSelect: (id: string) => selectAnnotation(id, false), onDraft: startDraft,
    canEdit: (a: DocumentAnnotation) => !busy && canEdit(a),
    onChange: async (id: string, selector: AnnotationSelector) => { if (!await patchAnnotation(id, { target_selector: selector })) throw new Error('Position konnte nicht gespeichert werden'); },
    onDraftChange: (selector: AnnotationSelector) => setDraft(current => current ? { ...current, target_selector: selector } : null),
  };
  const iconButton = (label: string, Icon: typeof Square, onClick: () => void, options: { active?: boolean; disabled?: boolean } = {}) => <Tooltip>
    <TooltipTrigger asChild><button type="button" className={`aw-icon ${options.active ? 'on' : ''}`} aria-label={label} aria-pressed={options.active} title={label}
      disabled={options.disabled} onClick={onClick}><Icon /></button></TooltipTrigger><TooltipContent>{label}</TooltipContent>
  </Tooltip>;
  return <div className="annotation-shell"><section aria-label="Dokument annotieren" className="annotation-workspace">
    <TooltipProvider>
      <header className="aw-header">
        <div className="min-w-0 flex-1"><div className="aw-title"><h2 className="max-w-full truncate">{doc.title}</h2><span className="aw-original">Original bleibt unverändert</span></div>
          <p className="aw-subtitle truncate">{doc.file_name}{imageSize && kind === 'image' ? ` · ${imageSize.width} × ${imageSize.height} px` : kind === 'pdf' ? ' · PDF' : ''}</p></div>
        {busy && <span className="text-xs text-muted-foreground" role="status">{locating ? 'Textstelle wird gesucht …' : 'Speichert …'}</span>}
        {iconButton(exporting ? 'PDF wird exportiert …' : 'PDF mit Anmerkungen exportieren', Download, () => { void exportPdf(); }, { disabled: exporting || busy || !file.data || !!pendingIds.size })}
        {iconButton(hidden ? 'Markierungen einblenden' : 'Markierungen ausblenden', hidden ? EyeOff : Eye, () => setHidden(current => !current), { active: hidden })}
        {iconButton('Zurück zu den Dokumenten', X, () => onOpenChange(false))}
      </header>
      <div ref={canvasRef} className="aw-canvas">
        {reselect && <div className="absolute left-4 top-4 z-30 rounded-md border bg-background p-3 text-sm shadow" role="status">
          {draft ? 'Vorschlag prüfen: Grenzen umfassen ganze Textabschnitte.' : reselect.annotation_type === 'highlight' ? 'Text neu auswählen' : 'Markierung neu zeichnen'} · Anmerkung {numbers[reselect.id]}
          {draft && <button type="button" className="aw-button ml-2" disabled={busy} onClick={() => startDraft(draft)}>Position übernehmen</button>}
          <button type="button" className="aw-button ml-2" disabled={busy} onClick={() => { setReselect(null); setDraft(null); setTool('select'); setActiveId(reselect.id); }}>Abbrechen</button>
        </div>}
        <div ref={viewerRef} className="aw-viewport">
          {!kind ? <ErrorState title="Dateityp nicht unterstützt" description="Annotation ist für PDF, JPG, PNG und WebP möglich." />
            : file.isError ? <ErrorState title="Datei konnte nicht geladen werden" />
            : kind === 'pdf' ? buffer ? <PdfAnnotator data={buffer} {...editorProps} /> : <LoadingState label="Datei wird geladen …" />
            : imgUrl ? <ImageAnnotator src={imgUrl} alt={doc.title} onImageSize={setImageSize} {...editorProps} /> : <LoadingState label="Datei wird geladen …" />}
        </div>
        <div className="aw-float aw-tools" role="toolbar" aria-label="Annotationswerkzeuge">
          {kind === 'pdf' && <button type="button" className={`aw-text-marker ${tool === 'highlight' ? 'on' : ''}`}
            aria-label="Text markieren (H)" aria-keyshortcuts="H" aria-pressed={tool === 'highlight'}
            title="Text mit der Maus auswählen und markieren (H)" disabled={busy || !!composerTarget} onClick={() => chooseTool('highlight')}>
            <Highlighter /><span>Text markieren</span><kbd>H</kbd>
          </button>}
          {tools.filter(t => t.show).map(t => <span key={t.id}>{iconButton(t.label, t.icon, () => chooseTool(t.id), { active: tool === t.id, disabled: busy || (!!composerTarget && t.id !== 'select') })}</span>)}
          <span className="aw-separator" />
          {ANNOTATION_COLORS.map((c, index) => <Tooltip key={c.value}><TooltipTrigger asChild><button type="button" className={`aw-color ${c.value === color ? 'on' : ''}`}
            aria-label={`${c.label} (${index + 1})`} aria-keyshortcuts={String(index + 1)} aria-pressed={c.value === color} disabled={busy} onClick={() => chooseColor(c.value)}><span style={{ background: `hsl(${colorVar(c.value)})` }} /></button></TooltipTrigger><TooltipContent>{c.label} ({index + 1})</TooltipContent></Tooltip>)}
          <span className="aw-separator" />
          {iconButton('Bearbeitung rückgängig (Strg+Z)', Undo2, () => { void history.undo(); }, { disabled: busy || !history.canUndo })}
          {iconButton('Bearbeitung wiederholen (Strg+Shift+Z)', Redo2, () => { void history.redo(); }, { disabled: busy || !history.canRedo })}
        </div>
        <div className="aw-float aw-zoom" role="group" aria-label="Zoom">
          {iconButton('Verkleinern (−)', ZoomOut, () => changeZoom(current => current - .1))}<span className="aw-zoom-label">{Math.round(zoom * 100)} %</span>
          {iconButton('Vergrößern (+)', ZoomIn, () => changeZoom(current => current + .1))}<span className="aw-separator" />{iconButton('Einpassen (0)', Maximize, fit)}
        </div>
        <p className="aw-float aw-hint" title={hint}>{hint}</p>
        {composerTarget && !reselect && <AnnotationComposer key={editingId ?? 'draft'} target={composerTarget} viewer={viewerRef} canvas={canvasRef} zoom={zoom} tenantId={doc.tenant_id}
          text={text} color={color} editing={!!editingId} saving={busy} onText={setText} onColor={setColor} onSave={() => { void saveComposer(); }} onCancel={cancelComposer} />}
      </div>
      <AnnotationSidebar documentId={doc.id} tenantId={doc.tenant_id} saving={busy} loading={api.isLoading} failed={api.isError} onRetry={() => { void api.refetch(); }}
        annotations={annotations} numbers={numbers} activeId={activeId} userId={user?.id} workflowReady={api.workflowReady}
        members={members.data ?? []} membersUnavailable={members.isLoading || members.isError} onCreateTask={a => { void createAnnotationTask(a); }} currentVersion={version} canManage={canEdit} canResolve={canResolveAnnotation(actor)}
        authorName={id => id === user?.id ? 'Du' : authors.data?.[id] ?? '…'} onSelect={id => selectAnnotation(id)} onEdit={editAnnotation} onReanchor={reanchorAnnotation} onLocateText={kind === 'pdf' ? a => { void locateText(a); } : undefined} onReselect={kind === 'pdf' ? reselectAnnotation : undefined}
        onUpdate={patchAnnotation} onDelete={deleteAnnotation} onReply={reply} />
    </TooltipProvider>
  </section></div>;
}
