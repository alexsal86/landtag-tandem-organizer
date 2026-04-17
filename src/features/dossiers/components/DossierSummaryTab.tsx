import { useState, useRef, useCallback } from "react";
import type { Dossier, DossierEntry } from "../types";
import { useUpdateDossier } from "../hooks/useDossiers";
import { useDossierLinks } from "../hooks/useDossierLinks";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { type EntryType } from "../types";
import { formatDistanceToNow } from "date-fns";
import { de } from "date-fns/locale";
import { Save, Loader2, HelpCircle, Users, MessageSquare, ClipboardList, Scale, Link2, FileText, Mail, NotebookPen, Quote, PenLine } from "lucide-react";
import DossierBlockEditor from "@/components/dossier-editor/DossierBlockEditor";

interface DossierSummaryTabProps {
  dossier: Dossier;
  recentEntries?: DossierEntry[];
}

export function DossierSummaryTab({ dossier, recentEntries }: DossierSummaryTabProps) {
  const updateDossier = useUpdateDossier();
  const { data: links } = useDossierLinks(dossier.id);
  const [editingSummary, setEditingSummary] = useState(false);
  const [summary, setSummary] = useState(dossier.summary ?? "");
  const [editingQuestions, setEditingQuestions] = useState(false);
  const [questions, setQuestions] = useState(dossier.open_questions ?? "");
  const [editingPositions, setEditingPositions] = useState(false);
  const [positions, setPositions] = useState(dossier.positions ?? "");
  const [notesHtml, setNotesHtml] = useState(dossier.notes_html ?? "");
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleNotesChange = useCallback((html: string) => {
    setNotesHtml(html);
    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    saveTimeoutRef.current = setTimeout(() => {
      updateDossier.mutate({ id: dossier.id, notes_html: html });
    }, 1500);
  }, [dossier.id, updateDossier]);

  const handleSaveSummary = () => {
    updateDossier.mutate(
      { id: dossier.id, summary },
      { onSuccess: () => setEditingSummary(false) }
    );
  };

  const handleSaveQuestions = () => {
    updateDossier.mutate(
      { id: dossier.id, open_questions: questions },
      { onSuccess: () => setEditingQuestions(false) }
    );
  };

  const handleSavePositions = () => {
    updateDossier.mutate(
      { id: dossier.id, positions },
      { onSuccess: () => setEditingPositions(false) }
    );
  };

  const recent5 = recentEntries?.slice(0, 5) ?? [];
  const quotes = (recentEntries ?? []).filter((e) => e.entry_type === "zitat").slice(0, 8);
  const tagCounts = (() => {
    const map = new Map<string, number>();
    (recentEntries ?? []).forEach((e) => e.tags.forEach((t) => map.set(t, (map.get(t) ?? 0) + 1)));
    return Array.from(map.entries()).sort((a, b) => b[1] - a[1]).slice(0, 20);
  })();
  const contactLinks = links?.filter((l) => l.linked_type === "contact") ?? [];
  const recentEntryIcons: Record<EntryType, typeof NotebookPen> = {
    notiz: NotebookPen,
    datei: FileText,
    link: Link2,
    email: Mail,
    zitat: Quote,
  };

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Kurzlage */}
        <section>
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-sm font-semibold flex items-center gap-1.5">
            <ClipboardList className="h-4 w-4 text-primary" /> Kurzlage
          </h3>
          {!editingSummary && (
            <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => setEditingSummary(true)}>
              Bearbeiten
            </Button>
          )}
        </div>
        {editingSummary ? (
          <div className="space-y-2">
            <Textarea
              value={summary}
              onChange={(e) => setSummary(e.target.value)}
              placeholder="Worum geht es in diesem Dossier? Aktuelle Lage …"
              className="min-h-[100px] text-sm"
              autoFocus
            />
            <div className="flex gap-2">
              <Button size="sm" onClick={handleSaveSummary} disabled={updateDossier.isPending}>
                {updateDossier.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : <Save className="h-3 w-3" />}
                Speichern
              </Button>
              <Button variant="ghost" size="sm" onClick={() => { setEditingSummary(false); setSummary(dossier.summary ?? ""); }}>
                Abbrechen
              </Button>
            </div>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground whitespace-pre-wrap leading-relaxed rounded-md bg-muted/30 p-3 min-h-[48px]">
            {dossier.summary || 'Noch keine Zusammenfassung. Klicke "Bearbeiten", um die aktuelle Lage zu beschreiben.'}
          </p>
        )}
        </section>

        {/* Offene Fragen */}
        <section>
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-sm font-semibold flex items-center gap-1.5">
            <HelpCircle className="h-4 w-4 text-warning" /> Offene Fragen
          </h3>
          {!editingQuestions && (
            <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => setEditingQuestions(true)}>
              Bearbeiten
            </Button>
          )}
        </div>
        {editingQuestions ? (
          <div className="space-y-2">
            <Textarea
              value={questions}
              onChange={(e) => setQuestions(e.target.value)}
              placeholder="Welche Fragen sind noch ungeklärt?"
              className="min-h-[80px] text-sm"
              autoFocus
            />
            <div className="flex gap-2">
              <Button size="sm" onClick={handleSaveQuestions} disabled={updateDossier.isPending}>
                {updateDossier.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : <Save className="h-3 w-3" />}
                Speichern
              </Button>
              <Button variant="ghost" size="sm" onClick={() => { setEditingQuestions(false); setQuestions(dossier.open_questions ?? ""); }}>
                Abbrechen
              </Button>
            </div>
          </div>
        ) : dossier.open_questions?.trim() ? (
          <p className="text-sm text-muted-foreground whitespace-pre-wrap leading-relaxed rounded-md bg-warning/5 border border-warning/20 p-3">
            {dossier.open_questions}
          </p>
        ) : (
          <p className="text-xs text-muted-foreground italic">Keine offenen Fragen erfasst</p>
        )}
        </section>

        {/* Positionen */}
        <section>
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-semibold flex items-center gap-1.5">
              <Scale className="h-4 w-4 text-blue-600" /> Positionen
            </h3>
            {!editingPositions && (
              <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => setEditingPositions(true)}>
                Bearbeiten
              </Button>
            )}
          </div>
          {editingPositions ? (
            <div className="space-y-2">
              <Textarea
                value={positions}
                onChange={(e) => setPositions(e.target.value)}
                placeholder="Welche Positionen/Standpunkte gibt es?"
                className="min-h-[80px] text-sm"
                autoFocus
              />
              <div className="flex gap-2">
                <Button size="sm" onClick={handleSavePositions} disabled={updateDossier.isPending}>
                  {updateDossier.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : <Save className="h-3 w-3" />}
                  Speichern
                </Button>
                <Button variant="ghost" size="sm" onClick={() => { setEditingPositions(false); setPositions(dossier.positions ?? ""); }}>
                  Abbrechen
                </Button>
              </div>
            </div>
          ) : dossier.positions?.trim() ? (
            <p className="text-sm text-muted-foreground whitespace-pre-wrap leading-relaxed rounded-md bg-blue-50/60 border border-blue-200/70 p-3">
              {dossier.positions}
            </p>
          ) : (
            <p className="text-xs text-muted-foreground italic">Keine Positionen erfasst</p>
          )}
        </section>
      </div>

      {/* Notizen + Letzte Einträge — 50/50 */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Notizen (Lexical Editor) */}
        <section>
          <h3 className="text-sm font-semibold flex items-center gap-1.5 mb-2">
            <PenLine className="h-4 w-4 text-primary" /> Notizen
          </h3>
          <DossierBlockEditor
            key={dossier.id}
            initialContent={notesHtml}
            contentVersion={dossier.id}
            onChange={handleNotesChange}
            placeholder="Schreibe '/' für Befehle …"
            minHeight="200px"
          />
        </section>

        {/* Letzte Einträge */}
        <section>
          <h3 className="text-sm font-semibold flex items-center gap-1.5 mb-2">
            <MessageSquare className="h-4 w-4" /> Letzte Einträge
          </h3>
          {recent5.length > 0 ? (
            <div className="space-y-1.5">
              {recent5.map((entry) => {
                const iconKey = entry.entry_type as EntryType;
                const EntryIcon = recentEntryIcons[iconKey] ?? FileText;
                return (
                  <div key={entry.id} className="flex items-center gap-2 text-sm rounded-md px-2 py-1.5 bg-muted/30">
                    <EntryIcon className="h-4 w-4 text-muted-foreground" />
                    <span className="truncate flex-1 text-foreground">{entry.title || "Ohne Titel"}</span>
                    <span className="text-[11px] text-muted-foreground whitespace-nowrap">
                      {formatDistanceToNow(new Date(entry.created_at), { addSuffix: true, locale: de })}
                    </span>
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="text-xs text-muted-foreground italic">Noch keine Einträge vorhanden</p>
          )}
        </section>
      </div>

      {/* Verknüpfte Kontakte (preview) */}
      {contactLinks.length > 0 && (
        <section>
          <h3 className="text-sm font-semibold flex items-center gap-1.5 mb-2">
            <Users className="h-4 w-4" /> Verknüpfte Kontakte
          </h3>
          <div className="flex flex-wrap gap-2">
            {contactLinks.slice(0, 5).map((link) => (
              <span key={link.id} className="text-xs px-2.5 py-1 rounded-full bg-primary/10 text-primary font-medium">
                <ContactName linkedId={link.linked_id} />
              </span>
            ))}
            {contactLinks.length > 5 && (
              <span className="text-xs px-2.5 py-1 rounded-full bg-muted text-muted-foreground">
                +{contactLinks.length - 5} weitere
              </span>
            )}
          </div>
        </section>
      )}
    </div>
  );
}

/** Minimal contact name resolver */
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

function ContactName({ linkedId }: { linkedId: string }) {
  const { data } = useQuery({
    queryKey: ["contact-name", linkedId],
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      const { data } = await supabase.from("contacts").select("name").eq("id", linkedId).maybeSingle();
      return data?.name ?? linkedId;
    },
  });
  return <>{data ?? "…"}</>;
}
