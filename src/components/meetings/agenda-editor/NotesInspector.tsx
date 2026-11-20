import { stripHtml } from "@/utils/textDiff";
import { useState } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { GlobalQuickNoteDialog } from "@/components/search/GlobalQuickNoteDialog";
import { supabase } from "@/integrations/supabase/client";
import { notify } from "@/lib/notify";
import { parseMeetingResults } from "../platformAgendaRules";
import { agendaSubpointNumber, orderSystemSubpoints } from "./systemSubpoints";
import { generatedAgendaKey } from "./liveAgenda";
import type { AgendaItem, LinkedQuickNote } from "../types";

export function NotesInspector({ parent, notes, number, selectedKey, onSelect, onChange }: {
  parent: AgendaItem; notes: LinkedQuickNote[]; number?: string; selectedKey: string | null;
  onSelect: (key: string) => void; onChange?: (value: string) => void;
}) {
  const [pending, setPending] = useState<string | null>(null);
  const [created, setCreated] = useState<Set<string>>(new Set());
  const [creating, setCreating] = useState(false);
  const [filter, setFilter] = useState("");
  const results = parseMeetingResults(parent.result_text);
  const entries = orderSystemSubpoints(notes, results);
  const parentKey = parent.localKey || parent.id!;
  const selected = entries.findIndex(note => generatedAgendaKey(parentKey, note.id) === selectedKey);
  const current = entries[selected];
  const convert = async (note: LinkedQuickNote) => {
    setPending(note.id);
    try {
      const { error } = await supabase.rpc("create_note_work", { p_note_id: note.id, p_kind: "task" });
      if (error) throw error;
      setCreated(previous => new Set(previous).add(note.id));
      notify.success("Aufgabe erstellt");
    } catch (error) {
      notify.error("Aufgabe konnte nicht erstellt werden", { description: error instanceof Error ? error.message : undefined });
    } finally { setPending(null); }
  };
  const date = (note: LinkedQuickNote) => "Notiz vom " + new Date(note.created_at).toLocaleDateString("de-DE", { weekday: "short" });
  const taskButton = (note: LinkedQuickNote) => note.task_id ? (
    <Button asChild variant="outline" size="sm"><Link to={`/mywork?tab=tasks&task=${note.task_id}`}>→ Aufgabe</Link></Button>
  ) : (
    <Button variant="outline" size="sm" disabled={pending !== null || created.has(note.id)} onClick={() => void convert(note)}>
      {created.has(note.id) ? "Aufgabe erstellt" : "→ Aufgabe"}
    </Button>
  );
  return <aside className="sticky top-4 space-y-3 rounded-xl border bg-card p-4">
    {current ? <>
      <p className="text-xs text-muted-foreground">Unterpunkt von {number} {parent.title}</p>
      <h3 className="font-semibold">{agendaSubpointNumber(number, selected)} {current.title || "Notiz"}</h3>
      <p className="text-xs text-muted-foreground">{date(current)}</p>
      <p className="whitespace-pre-wrap break-words text-sm">{stripHtml(current.content)}</p>
      {taskButton(current)}
      <Button variant="ghost" size="sm" onClick={() => onSelect(parentKey)}>Alle Unterpunkte</Button>
    </> : <>
      <h3 className="font-semibold">Unterpunkte ({entries.length})</h3>
      {filter && <Input aria-label="Notiz zum Umwandeln suchen" value={filter === " " ? "" : filter} onChange={event => setFilter(event.target.value || " ")} placeholder="Notiz auswählen …" />}
      {entries.filter(note => !filter.trim() || (note.title || note.content).toLocaleLowerCase().includes(filter.trim().toLocaleLowerCase())).map(note => (
        <div key={note.id} className="flex items-center gap-2 border-b border-dashed py-3">
          <Checkbox aria-label={`Erledigt: ${note.title || "Notiz"}`} disabled={!onChange} checked={!!results[note.id]?.completed}
            onCheckedChange={value => onChange?.(JSON.stringify({ ...results, [note.id]: { ...results[note.id], result: results[note.id]?.result ?? "", completed: value === true } }))} />
          <button className="min-w-0 flex-1 text-left text-sm" onClick={() => onSelect(generatedAgendaKey(parentKey, note.id))}>
            {note.title || "Notiz"}<span className="block text-xs text-muted-foreground">{date(note)}</span>
          </button>
          {taskButton(note)}
        </div>
      ))}
      <div className="flex flex-wrap gap-2">
        <Button variant="outline" size="sm" onClick={() => setCreating(true)}>+ Notiz</Button>
        <Button variant="outline" size="sm" onClick={() => setFilter(" ")}>In Aufgabe umwandeln</Button>
      </div>
    </>}
    <GlobalQuickNoteDialog open={creating} onOpenChange={setCreating} />
  </aside>;
}
