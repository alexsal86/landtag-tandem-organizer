import { useState } from "react";
import { format } from "date-fns";
import { de } from "date-fns/locale";
import { Check, Pencil, Trash2, RotateCcw, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { AnnotationCommentInput } from "./AnnotationCommentInput";
import { EmptyState } from "@/components/ui-patterns";
import { ANNOTATION_COLORS } from "../annotationModel";
import { colorVar } from "./AnnotationShapes";
import type { AnnotationColor, DocumentAnnotation, DraftAnnotation } from "../types";

interface Props {
  tenantId: string; saving: boolean; onReply: (id: string, content: string) => Promise<boolean>;
  annotations: DocumentAnnotation[]; activeId: string | null; draft: DraftAnnotation | null;
  draftColor: AnnotationColor; currentVersion: string; userId: string | undefined; canModerate: boolean;
  authorName: (id: string) => string;
  onSelect: (id: string) => void; onSaveDraft: (content: string) => void; onCancelDraft: () => void;
  onUpdate: (id: string, patch: Partial<Pick<DocumentAnnotation, "content" | "color" | "resolved">>) => void;
  onDelete: (id: string) => void;
}

const TYPE_LABEL = { highlight: "Textmarkierung", rect: "Bereich", polygon: "Polygon" } as const;

export function AnnotationSidebar(p: Props) {
  const [filter, setFilter] = useState<"open" | "all">("open");
  const [draftText, setDraftText] = useState("");
  const [editId, setEditId] = useState<string | null>(null);
  const [editText, setEditText] = useState("");
  const [replyId, setReplyId] = useState<string | null>(null);
  const [replyText, setReplyText] = useState("");
  const roots = p.annotations.filter(a => !a.parent_id && (filter === "all" || !a.resolved));
  const list = roots.flatMap(a => [a, ...p.annotations.filter(r => r.parent_id === a.id)]);

  return (
    <aside className="flex h-full w-[340px] shrink-0 flex-col border-l bg-card">
      <div className="flex items-center justify-between border-b p-md">
        <span className="section-label">Anmerkungen ({p.annotations.filter(a => !a.parent_id && !a.resolved).length} offen)</span>
        <div className="flex gap-2xs">
          <Button size="sm" variant={filter === "open" ? "secondary" : "ghost"} onClick={() => setFilter("open")}>Offen</Button>
          <Button size="sm" variant={filter === "all" ? "secondary" : "ghost"} onClick={() => setFilter("all")}>Alle</Button>
        </div>
      </div>

      {p.draft && (
        <div className="space-y-sm border-b bg-muted/40 p-md">
          <p className="text-label font-medium">Neue {TYPE_LABEL[p.draft.annotation_type]}{p.draft.page_number ? ` · Seite ${p.draft.page_number}` : ""}</p>
          {p.draft.quote_text && <blockquote className="border-l-2 pl-sm text-caption italic text-muted-foreground line-clamp-3">„{p.draft.quote_text}"</blockquote>}
          <AnnotationCommentInput tenantId={p.tenantId} autoFocus value={draftText} onChange={setDraftText} placeholder="Kommentar (optional) … @ für Erwähnung" rows={3} maxLength={5000} />
          <div className="flex justify-end gap-xs">
            <Button size="sm" variant="ghost" onClick={() => { setDraftText(""); p.onCancelDraft(); }}>Verwerfen</Button>
            <Button size="sm" disabled={p.saving} onClick={() => { p.onSaveDraft(draftText.trim()); setDraftText(""); }}>Speichern</Button>
          </div>
        </div>
      )}

      <div className="flex-1 overflow-y-auto">
        {list.length === 0 ? (
          <EmptyState title={filter === "open" ? "Keine offenen Anmerkungen" : "Noch keine Anmerkungen"} description="Wähle oben ein Werkzeug und markiere eine Stelle im Dokument." />
        ) : list.map(a => {
          const mine = a.created_by === p.userId; const canEdit = mine || p.canModerate;
          return (
            <div key={a.id} onClick={() => p.onSelect(a.id)}
              className={`${a.parent_id ? "ml-md border-l" : ""} cursor-pointer space-y-xs border-b p-md transition-colors duration-fast ${a.id === p.activeId ? "bg-accent" : "hover:bg-muted/50"} ${a.resolved ? "opacity-60" : ""}`}>
              <div className="flex items-center gap-xs text-caption text-muted-foreground">
                <span className="h-3 w-3 rounded-pill" style={{ background: `hsl(${colorVar(a.color)})` }} />
                <span>{a.parent_id ? "Antwort" : TYPE_LABEL[a.annotation_type]}{a.page_number ? ` · S. ${a.page_number}` : ""}</span>
                <span className="ml-auto">{p.authorName(a.created_by)} · {format(new Date(a.created_at), "dd.MM. HH:mm", { locale: de })}</span>
              </div>
              {a.file_version && a.file_version !== p.currentVersion && (
                <p className="flex items-center gap-2xs text-caption text-warning"><AlertTriangle className="h-3 w-3" />Zu einer älteren Dateiversion erstellt – Position kann abweichen</p>
              )}
              {a.quote_text && <blockquote className="border-l-2 pl-sm text-caption italic text-muted-foreground line-clamp-3">„{a.quote_text}"</blockquote>}
              {editId === a.id ? (
                <div className="space-y-xs" onClick={e => e.stopPropagation()}>
                  <AnnotationCommentInput tenantId={p.tenantId} value={editText} onChange={setEditText} rows={3} maxLength={5000} />
                  <div className="flex flex-wrap gap-2xs">
                    {ANNOTATION_COLORS.map(c => (
                      <button key={c.value} title={c.label} aria-label={c.label} onClick={() => p.onUpdate(a.id, { color: c.value })}
                        className={`h-5 w-5 rounded-pill border-2 ${a.color === c.value ? "border-foreground" : "border-transparent"}`} style={{ background: `hsl(${colorVar(c.value)})` }} />
                    ))}
                  </div>
                  <div className="flex justify-end gap-xs">
                    <Button size="sm" variant="ghost" onClick={() => setEditId(null)}>Abbrechen</Button>
                    <Button size="sm" onClick={() => { p.onUpdate(a.id, { content: editText.trim() }); setEditId(null); }}>Speichern</Button>
                  </div>
                </div>
              ) : a.content ? <p className="whitespace-pre-wrap text-body">{a.content.replace(/@\[([^\]]*)\]\([0-9a-f-]{36}\)/gi, "@$1")}</p> : <p className="text-caption text-muted-foreground">Ohne Kommentar</p>}
              {editId !== a.id && (
                <div className="flex gap-2xs" onClick={e => e.stopPropagation()}>
                  {!a.parent_id && <Button size="sm" variant="ghost" className="h-7 px-xs" onClick={() => p.onUpdate(a.id, { resolved: !a.resolved })}>
                    {a.resolved ? <><RotateCcw className="mr-2xs h-3.5 w-3.5" />Wieder öffnen</> : <><Check className="mr-2xs h-3.5 w-3.5" />Erledigt</>}
                  </Button>}
                  {!a.parent_id && <Button size="sm" variant="ghost" onClick={() => { setReplyId(a.id); setReplyText(""); }}>Antworten</Button>}
                  {canEdit && <Button size="sm" variant="ghost" className="h-7 px-xs" aria-label="Bearbeiten" onClick={() => { setEditId(a.id); setEditText(a.content); }}><Pencil className="h-3.5 w-3.5" /></Button>}
                  {canEdit && <Button size="sm" variant="ghost" className="h-7 px-xs text-destructive" aria-label="Löschen" onClick={() => { if (window.confirm("Anmerkung löschen?")) p.onDelete(a.id); }}><Trash2 className="h-3.5 w-3.5" /></Button>}
                </div>
              )}
              {replyId === a.id && <div className="space-y-xs" onClick={e => e.stopPropagation()}>
                <AnnotationCommentInput tenantId={p.tenantId} value={replyText} onChange={setReplyText} placeholder="Antwort … @ für Erwähnung" autoFocus rows={3} maxLength={5000} />
                <Button size="sm" variant="ghost" onClick={() => setReplyId(null)}>Abbrechen</Button>
                <Button size="sm" disabled={!replyText.trim() || p.saving} onClick={async () => { if (await p.onReply(a.id, replyText.trim())) { setReplyId(null); setReplyText(""); } }}>Antwort speichern</Button>
              </div>}
            </div>
          );
        })}
      </div>
    </aside>
  );
}
