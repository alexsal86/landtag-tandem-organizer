import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import type { Json, Tables, TablesInsert } from "@/integrations/supabase/types";
import { historyQueryKey, saveHistoryEntry } from "./historyApi";
import { dateLabel, dateWarnings, type HistoryEntry, type HistoryLine } from "./historyModel";

export const historySelectClass = "h-9 w-full rounded-md border border-input bg-background px-2 text-sm";
const fieldClass = "grid gap-1.5 text-sm font-medium";
const revisionFormat = new Intl.DateTimeFormat("de-DE", { dateStyle: "medium", timeStyle: "short" });

const revisionFields = {
  name: "Name", starts_on: "Beginn", ends_on: "Ende", line_id: "Ministerium",
  assignment_confirmed: "Zuordnung", party: "Partei", office: "Amtsbezeichnung", note: "Anmerkung",
  citation: "Fundstelle", source_detail: "Quellendetail", source_url: "Quellenlink", source_verified: "Quellenstatus",
};

function revisionField(snapshot: Json | null, key: string) {
  return snapshot && typeof snapshot === "object" && !Array.isArray(snapshot) ? snapshot[key] ?? null : null;
}

function ChangeHistory({ entry, lines }: { entry: HistoryEntry; lines: HistoryLine[] }) {
  const query = useQuery({
    queryKey: [...historyQueryKey, "changes", entry.id],
    queryFn: async ({ signal }): Promise<Tables<"ministry_history_changes">[]> => {
      const { data, error } = await supabase.from("ministry_history_changes").select("*")
        .eq("entry_id", entry.id).order("revision", { ascending: false }).limit(30).abortSignal(signal);
      if (error) throw new Error(error.message);
      return data ?? [];
    },
  });
  const display = (key: string, value: Json) => {
    if (value === null) return "—";
    if (key === "line_id") return lines.find(line => line.id === value)?.label ?? String(value);
    if (key === "assignment_confirmed") return value ? "Bestätigt" : "Offen";
    if (key === "source_verified") return value ? "Geprüft" : "Ungeprüft";
    return String(value);
  };

  if (query.isPending) return <p role="status">Änderungen werden geladen …</p>;
  if (query.isError) return <p role="alert">Änderungen konnten nicht geladen werden.</p>;
  if (!query.data?.length) return <p className="text-muted-foreground">Keine Änderungen seit der Übernahme.</p>;
  return <ol className="space-y-3">
    {query.data.map(change => {
      const fields = Object.entries(revisionFields).filter(([key]) =>
        revisionField(change.before_data, key) !== revisionField(change.after_data, key));
      return <li key={change.id} className="rounded-md border p-3">
        <p className="font-medium">{revisionFormat.format(new Date(change.changed_at))} · Version {change.revision}</p>
        {change.changed_by && <p className="break-all text-xs text-muted-foreground">Benutzer-ID {change.changed_by}</p>}
        {change.before_data ? <dl className="mt-2 space-y-1">
          {fields.map(([key, label]) => <div key={key}>
            <dt className="inline font-medium">{label} </dt>
            <dd className="inline break-words">
              <del>{display(key, revisionField(change.before_data, key))}</del>
              {" → "}{display(key, revisionField(change.after_data, key))}
            </dd>
          </div>)}
          {!fields.length && <div>Angaben unverändert.</div>}
        </dl> : <p>Eintrag angelegt.</p>}
      </li>;
    })}
    {query.data.length === 30 && <li className="text-muted-foreground">Die letzten 30 Änderungen werden angezeigt.</li>}
  </ol>;
}

export type EditorTarget = { kind: "phase" | "term"; existing?: HistoryEntry; lineId?: string };

export default function HistoryEntryDialog({
  target, entries, lines, onClose,
}: {
  target: EditorTarget;
  entries: HistoryEntry[];
  lines: HistoryLine[];
  onClose: () => void;
}) {
  const { existing, kind, lineId } = target;
  const client = useQueryClient();
  const [showChanges, setShowChanges] = useState(false);
  const [draft, setDraft] = useState({
    kind,
    line_id: existing?.line_id ?? lineId ?? "",
    name: existing?.name ?? "",
    starts_on: existing?.starts_on ?? "",
    ends_on: existing?.ends_on ?? "",
    party: existing?.party ?? "",
    office: existing?.office ?? "",
    note: existing?.note ?? "",
    citation: existing?.citation ?? "",
    source_detail: existing?.source_detail ?? "",
    source_url: existing?.source_url ?? "",
    source_verified: existing?.source_verified ?? false,
    assignment_confirmed: existing?.assignment_confirmed ?? Boolean(lineId),
  });
  const set = <K extends keyof typeof draft,>(key: K, value: (typeof draft)[K]) =>
    setDraft(previous => ({ ...previous, [key]: value }));
  const optional = (value: string) => value.trim() || null;

  const save = useMutation({
    mutationFn: () => {
      const values: TablesInsert<"ministry_history_entries"> = {
        ...draft,
        line_id: draft.line_id || null,
        name: draft.name.trim(),
        ends_on: draft.ends_on || null,
        party: kind === "term" ? optional(draft.party) : null,
        office: kind === "term" ? optional(draft.office) : null,
        note: optional(draft.note),
        citation: draft.citation.trim(),
        source_detail: optional(draft.source_detail),
        source_url: optional(draft.source_url),
        assignment_confirmed: Boolean(draft.line_id) && draft.assignment_confirmed,
      };
      return saveHistoryEntry(values, existing);
    },
    onSuccess: async () => {
      await client.invalidateQueries({ queryKey: historyQueryKey });
      onClose();
    },
    onError: () => client.invalidateQueries({ queryKey: historyQueryKey, exact: true }),
  });

  const reversed = Boolean(draft.ends_on && draft.ends_on < draft.starts_on);
  const boundariesChanged = !existing || existing.starts_on !== draft.starts_on
    || (existing.ends_on ?? "") !== draft.ends_on || (existing.line_id ?? "") !== draft.line_id;
  const warnings = boundariesChanged ? dateWarnings({
    ...draft, ends_on: draft.ends_on || null, line_id: draft.line_id || null,
  }, entries, existing?.id) : [];

  return <Dialog open onOpenChange={open => { if (!open && !save.isPending) onClose(); }}>
    <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-2xl">
      <DialogHeader>
        <DialogTitle>{kind === "phase" ? "Namensphase" : "Amtszeit"} {existing ? "bearbeiten" : "anlegen"}</DialogTitle>
        <DialogDescription>{existing
          ? `${existing.name} · ${dateLabel(existing.starts_on, existing.ends_on)}`
          : "Erfasse den Zeitraum mit seiner Quelle. Die Zuordnung kannst du offen lassen."}</DialogDescription>
      </DialogHeader>
      <form className="space-y-4" onSubmit={event => { event.preventDefault(); save.mutate(); }}>
        <fieldset disabled={save.isPending} className="space-y-4">
          <label className={fieldClass}>{kind === "phase" ? "Ministeriumsname" : "Name der Ministerin oder des Ministers"}
            <Input required value={draft.name} onChange={event => set("name", event.target.value)} />
          </label>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className={fieldClass}>Beginn
              <Input type="date" required value={draft.starts_on} onChange={event => set("starts_on", event.target.value)} />
            </label>
            <label className={fieldClass}>Ende (leer bei laufendem Abschnitt)
              <Input type="date" min={draft.starts_on || undefined} value={draft.ends_on}
                onChange={event => set("ends_on", event.target.value)} />
            </label>
          </div>
          <label className={fieldClass}>Ministerium zuordnen
            <select className={historySelectClass} value={draft.line_id} onChange={event => {
              const value = event.target.value;
              setDraft(previous => ({ ...previous, line_id: value, assignment_confirmed: Boolean(value) }));
            }}>
              <option value="">Ohne Zuordnung</option>
              {lines.map(line => <option key={line.id} value={line.id}>{line.label}</option>)}
            </select>
          </label>
          {draft.line_id && <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={draft.assignment_confirmed}
              onChange={event => set("assignment_confirmed", event.target.checked)} />
            Zuordnung bestätigen
          </label>}
          {warnings.length > 0 && <ul className="list-disc rounded-md border border-amber-500/50 bg-amber-500/10 py-2 pl-7 pr-3 text-sm" aria-live="polite">
            {warnings.map(warning => <li key={warning}>{warning}</li>)}
          </ul>}
          {kind === "term" && <div className="grid gap-3 sm:grid-cols-[1fr_2fr]">
            <label className={fieldClass}>Partei<Input value={draft.party} onChange={event => set("party", event.target.value)} /></label>
            <label className={fieldClass}>Amtsbezeichnung<Input value={draft.office} onChange={event => set("office", event.target.value)} /></label>
          </div>}
          <label className={fieldClass}>Fundstelle<Input required value={draft.citation} onChange={event => set("citation", event.target.value)} /></label>
          <label className={fieldClass}>Quellendetail<Input value={draft.source_detail} onChange={event => set("source_detail", event.target.value)} /></label>
          <label className={fieldClass}>Quellenlink
            <Input type="url" pattern="https?://.*" value={draft.source_url} onChange={event => set("source_url", event.target.value)} />
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={draft.source_verified} onChange={event => set("source_verified", event.target.checked)} />
            Quelle im Original geprüft
          </label>
          <label className={fieldClass}>Anmerkung<Textarea value={draft.note} onChange={event => set("note", event.target.value)} /></label>
        </fieldset>
        {existing && <details className="space-y-2 text-sm" onToggle={event => setShowChanges(event.currentTarget.open)}>
          <summary className="cursor-pointer font-medium">Änderungsverlauf</summary>
          {showChanges && <ChangeHistory entry={existing} lines={lines} />}
        </details>}
        {save.isError && <p role="alert" className="text-sm text-destructive">{save.error.message}</p>}
        <DialogFooter>
          <Button type="button" variant="outline" disabled={save.isPending} onClick={onClose}>Abbrechen</Button>
          <Button disabled={save.isPending || reversed || !draft.name.trim() || !draft.citation.trim()}>
            {save.isPending ? "Speichert …" : "Speichern"}
          </Button>
        </DialogFooter>
      </form>
    </DialogContent>
  </Dialog>;
}
