import { Link } from "react-router-dom";
import { assignedAnnotationThreads } from "../taskModel";
import { plainAnnotationComment as plainComment } from "../mentions";
import { useEffect, useRef, useState, type CSSProperties } from "react";
import { format } from "date-fns";
import { de } from "date-fns/locale";
import { Check, Pencil, Trash2, RotateCcw, AlertTriangle, MoreVertical, Send, ListTodo, ArrowUpRight } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { AnnotationCommentInput } from "./AnnotationCommentInput";
import { ANNOTATION_COLORS, type AnnotationFilter } from "../annotationModel";
import { colorVar } from "./AnnotationShapes";
import type { DocumentAnnotation, AnnotationPatch } from "../types";

interface Props {
  userId?: string; workflowReady: boolean; membersUnavailable: boolean;
  members: { user_id: string; display_name: string | null }[];
  onCreateTask: (annotation: DocumentAnnotation) => void;
  tenantId: string; saving: boolean; loading: boolean; failed: boolean; onRetry: () => void;
  annotations: DocumentAnnotation[]; numbers: Record<string, number>; activeId: string | null;
  currentVersion: string; canManage: (annotation: DocumentAnnotation) => boolean; canResolve: boolean;
  authorName: (id: string) => string; onSelect: (id: string) => void;
  onEdit: (annotation: DocumentAnnotation) => void; onUpdate: (id: string, patch: AnnotationPatch) => Promise<boolean>;
  onDelete: (id: string) => void; onReply: (id: string, content: string) => Promise<boolean>;
}
const TYPE_LABEL: Record<DocumentAnnotation["annotation_type"], string> = { highlight: "Textmarkierung", rect: "Bereich", polygon: "Polygon", arrow: "Pfeil", note: "Notiz-Nadel" };

const timestamp = (text: string) => format(new Date(text), "dd.MM. HH:mm", { locale: de });

export function AnnotationSidebar(p: Props) {
  const [filter, setFilter] = useState<AnnotationFilter>("open");
  const [onlyMine, setOnlyMine] = useState(false);
  const [replyId, setReplyId] = useState<string | null>(null);
  const [replyText, setReplyText] = useState("");
  const list = useRef<HTMLDivElement>(null);
  const lastSelected = useRef<string | null>(null);
  const roots = assignedAnnotationThreads(p.annotations, filter, p.userId, onlyMine);
  const total = assignedAnnotationThreads(p.annotations, 'all', p.userId, onlyMine).length;
  const open = assignedAnnotationThreads(p.annotations, 'open', p.userId, onlyMine).length;
  useEffect(() => {
    if (p.activeId === lastSelected.current) return;
    lastSelected.current = p.activeId;
    const selected = p.annotations.find(a => a.id === p.activeId);
    if (selected) {
      setFilter(current => current === 'all' ? current : selected.resolved ? 'done' : 'open');
      if (selected.assigned_to !== p.userId) setOnlyMine(false);
    }
  }, [p.activeId, p.annotations]);
  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      if (p.activeId) list.current?.querySelector(`[data-annotation-thread="${p.activeId}"]`)?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    });
    return () => cancelAnimationFrame(frame);
  }, [p.activeId, filter]);
  const menu = (a: DocumentAnnotation) => p.canManage(a) && <DropdownMenu>
    <DropdownMenuTrigger asChild><button type="button" className="aw-icon ml-auto !p-1" aria-label="Weitere Aktionen" disabled={p.saving}><MoreVertical /></button></DropdownMenuTrigger>
    <DropdownMenuContent align="end">
      <DropdownMenuItem onClick={() => p.onEdit(a)}><Pencil className="mr-2 h-4 w-4" />Bearbeiten</DropdownMenuItem>
      <DropdownMenuItem className="text-destructive focus:text-destructive" onClick={() => p.onDelete(a.id)}><Trash2 className="mr-2 h-4 w-4" />Löschen<span className="ml-auto pl-4 text-xs opacity-60">Entf</span></DropdownMenuItem>
    </DropdownMenuContent>
  </DropdownMenu>;
  return <aside className="aw-sidebar" aria-label="Anmerkungen">
    <div className="aw-sidebar-header"><h3>Anmerkungen</h3><div className="aw-segments" role="group" aria-label="Anmerkungen filtern">
      {([['open', 'Offen', open], ['done', 'Erledigt', total - open], ['all', 'Alle', total]] as const).map(([id, label, count]) =>
        <button type="button" key={id} className={filter === id ? 'on' : ''} aria-pressed={filter === id} onClick={() => setFilter(id)}>{label} ({count})</button>)}
    </div>
      <label className="mt-3 flex cursor-pointer items-center gap-2 text-xs"><input type="checkbox" checked={onlyMine} disabled={!p.userId || !p.workflowReady}
        style={{ accentColor: 'var(--aw-primary)' }} onChange={e => setOnlyMine(e.target.checked)} />Nur mir zugewiesene Anmerkungen</label>
    </div>
    <div ref={list} className="aw-list">
      {p.loading ? <p className="aw-empty" role="status">Anmerkungen werden geladen …</p>
        : p.failed ? <div className="aw-empty" role="alert">Anmerkungen konnten nicht geladen werden.<br /><button className="aw-button mt-3" onClick={p.onRetry}>Erneut versuchen</button></div>
        : roots.length === 0 ? <div className="aw-empty">{onlyMine ? 'Keine passenden Zuweisungen' : filter === 'open' && total > 0 ? 'Alles erledigt' : 'Keine Anmerkungen'}<br /><small>{onlyMine ? "Hebe den Zuweisungsfilter auf, um alle Anmerkungen zu sehen." : "Zeichne einen Bereich ins Dokument, um zu starten."}</small></div>
        : roots.map(a => <article key={a.id} data-annotation-thread={a.id} tabIndex={0}
          aria-label={`Anmerkung ${p.numbers[a.id]} auswählen`} onClick={() => p.onSelect(a.id)}
          onKeyDown={e => { if (e.target === e.currentTarget && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); p.onSelect(a.id); } }}
          style={{ '--aw-color': `hsl(${colorVar(a.color)})` } as CSSProperties}
          className={`aw-card ${a.id === p.activeId ? 'selected' : ''} ${a.resolved ? 'done' : ''}`}>
          <div className="aw-card-head"><span className="aw-number">{p.numbers[a.id]}</span>
            <span className="aw-card-kind">{ANNOTATION_COLORS.find(c => c.value === a.color)?.label}</span>
            <span className="aw-byline" title={`${p.authorName(a.created_by)} · ${timestamp(a.created_at)}`}>· {p.authorName(a.created_by)} · {timestamp(a.created_at)}</span>
            <span onClick={e => e.stopPropagation()} className="ml-auto">{menu(a)}</span>
          </div>
          <p className="mt-1 text-[11px] text-muted-foreground">{TYPE_LABEL[a.annotation_type]}{a.page_number ? ` · Seite ${a.page_number}` : ""}</p>
          {a.file_version && a.file_version !== p.currentVersion && <p className="mt-2 flex gap-1 text-xs text-warning"><AlertTriangle className="h-3.5 w-3.5 shrink-0" />Ältere Dateiversion – Position kann abweichen</p>}
          {a.quote_text && <blockquote className="mt-2 line-clamp-3 border-l-2 pl-2 text-xs italic text-muted-foreground">„{a.quote_text}“</blockquote>}
          <p className="aw-text">{a.content ? plainComment(a.content) : 'Ohne Kommentar'}</p>
          {p.annotations.filter(r => r.parent_id === a.id).map(r => <div className="aw-reply" key={r.id}>
            <div className="flex items-center gap-1"><span className="min-w-0 flex-1 whitespace-pre-wrap">{plainComment(r.content)}</span><span onClick={e => e.stopPropagation()}>{menu(r)}</span></div>
            <small>{p.authorName(r.created_by)} · {timestamp(r.created_at)}</small>
          </div>)}
          <label className="aw-assignee" title={!p.workflowReady ? "Zuweisung ist noch nicht verfügbar" : undefined} onClick={e => e.stopPropagation()}>
            <span>Zuständig</span><select aria-label={`Zuständig für Anmerkung ${p.numbers[a.id]}`} value={a.assigned_to ?? ''}
              disabled={p.saving || !p.workflowReady || p.membersUnavailable || !p.canManage(a)}
              onChange={e => { void p.onUpdate(a.id, { assigned_to: e.target.value || null }); }}>
              <option value="">Nicht zugewiesen</option>
              {a.assigned_to && !p.members.some(m => m.user_id === a.assigned_to) && <option value={a.assigned_to} disabled>{p.authorName(a.assigned_to)} (nicht aktiv)</option>}
              {p.members.map(member => <option key={member.user_id} value={member.user_id}>{member.display_name ?? 'Mitarbeiter'}</option>)}
            </select>
          </label>
          <div className="aw-actions" onClick={e => e.stopPropagation()}>
            <button className="aw-button" disabled={p.saving || !p.canResolve} onClick={() => { void p.onUpdate(a.id, { resolved: !a.resolved }); }}>
              {a.resolved ? <RotateCcw /> : <Check />}{a.resolved ? 'Wieder öffnen' : 'Erledigt'}</button>
            <button className="aw-button" disabled={p.saving || !p.canResolve} onClick={() => { setReplyId(replyId === a.id ? null : a.id); setReplyText(''); }}>Antworten</button>
          </div>
          <div className="aw-actions mt-2" onClick={e => e.stopPropagation()}>
            {a.task_id ? <Link className="aw-button" to={`/tasks?highlight=${encodeURIComponent(a.task_id)}`}><ArrowUpRight />Aufgabe öffnen</Link>
              : <button className="aw-button" disabled={p.saving || !p.workflowReady || !p.canResolve}
                title={!p.workflowReady ? 'Aufgaben aus Anmerkungen sind noch nicht verfügbar' : a.assigned_to ? `Zugewiesen an ${p.authorName(a.assigned_to)}` : 'Wird dir als Stafette-Aufgabe zugewiesen'} onClick={() => p.onCreateTask(a)}><ListTodo />Als Aufgabe übernehmen</button>}
          </div>
          {replyId === a.id && <form className="mt-2 space-y-2" onClick={e => e.stopPropagation()} onSubmit={async e => {
            e.preventDefault(); if (replyText.trim() && !p.saving && await p.onReply(a.id, replyText.trim())) { setReplyId(null); setReplyText(''); }
          }}>
            <AnnotationCommentInput tenantId={p.tenantId} value={replyText} onChange={setReplyText} placeholder="Antwort … @ für Erwähnung" autoFocus rows={2} maxLength={5000} />
            <div className="flex justify-end gap-2"><button type="button" className="aw-button" onClick={() => setReplyId(null)}>Abbrechen</button>
              <button type="submit" className="aw-button primary" disabled={!replyText.trim() || p.saving}><Send />Senden</button></div>
          </form>}
        </article>)}
    </div>
  </aside>;
}
