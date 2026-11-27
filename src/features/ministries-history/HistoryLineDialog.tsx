import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { historySelectClass } from "./HistoryEntryDialog";
import { historyQueryKey } from "./historyApi";
import type { HistoryLine } from "./historyModel";

export default function HistoryLineDialog({ line, lines, onClose, onCreated }: {
  line?: HistoryLine;
  lines: HistoryLine[];
  onClose: () => void;
  onCreated: (id: string) => void;
}) {
  const client = useQueryClient();
  const [text, setText] = useState("");
  const [direction, setDirection] = useState("successor");
  const [other, setOther] = useState("");
  const [date, setDate] = useState("");
  const save = useMutation({
    mutationFn: async (): Promise<string | null> => {
      if (!line) {
        const { data, error } = await supabase.from("ministry_history_lines").insert({ label: text.trim() }).select("id").single();
        if (error?.code === "23505") throw new Error("Ein Ministerium mit diesem Namen ist bereits vorhanden.");
        if (error) throw new Error(error.message);
        return data.id;
      }
      const { error } = await supabase.from("ministry_history_links").insert({
        predecessor_id: direction === "successor" ? line.id : other,
        successor_id: direction === "successor" ? other : line.id,
        effective_on: date,
        note: text.trim(),
      });
      if (error?.code === "23505") throw new Error("Diese Verknüpfung ist bereits vorhanden.");
      if (error) throw new Error(error.message);
      return null;
    },
    onSuccess: async id => {
      await client.invalidateQueries({ queryKey: historyQueryKey, exact: true });
      if (id) onCreated(id);
      onClose();
    },
  });
  return <Dialog open onOpenChange={open => { if (!open && !save.isPending) onClose(); }}>
    <DialogContent>
      <DialogHeader>
        <DialogTitle>{line ? "Vorgänger oder Nachfolger verknüpfen" : "Ministerium anlegen"}</DialogTitle>
        <DialogDescription>{line ? line.label : "Lege eine eigene Ressortlinie an, um ihr Namensphasen und Amtszeiten zuzuordnen."}</DialogDescription>
      </DialogHeader>
      <form className="space-y-4" onSubmit={event => { event.preventDefault(); save.mutate(); }}>
        <fieldset disabled={save.isPending} className="space-y-3">
          {line ? <>
            <label className="grid gap-1 text-sm font-medium">Beziehung
              <select className={historySelectClass} value={direction} onChange={event => setDirection(event.target.value)}>
                <option value="successor">Nachfolger</option>
                <option value="predecessor">Vorgänger</option>
              </select>
            </label>
            <label className="grid gap-1 text-sm font-medium">Ministerium
              <select className={historySelectClass} required value={other} onChange={event => setOther(event.target.value)}>
                <option value="">Bitte auswählen</option>
                {lines.filter(candidate => candidate.id !== line.id).map(candidate =>
                  <option key={candidate.id} value={candidate.id}>{candidate.label}</option>)}
              </select>
            </label>
            <label className="grid gap-1 text-sm font-medium">Wirksam ab
              <Input type="date" required value={date} onChange={event => setDate(event.target.value)} />
            </label>
            <label className="grid gap-1 text-sm font-medium">Hintergrund und Quelle
              <Textarea required value={text} onChange={event => setText(event.target.value)} />
            </label>
          </> : <label className="grid gap-1 text-sm font-medium">Name
            <Input required value={text} onChange={event => setText(event.target.value)} />
          </label>}
        </fieldset>
        {save.isError && <p role="alert" className="text-sm text-destructive">{save.error.message}</p>}
        <DialogFooter>
          <Button variant="outline" type="button" disabled={save.isPending} onClick={onClose}>Abbrechen</Button>
          <Button disabled={save.isPending || !text.trim() || Boolean(line && (!date || !other))}>Speichern</Button>
        </DialogFooter>
      </form>
    </DialogContent>
  </Dialog>;
}
