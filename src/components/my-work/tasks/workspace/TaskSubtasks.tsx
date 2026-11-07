import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { CornerDownRight, Plus, Repeat, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { notify } from "@/lib/notify";
import { cn } from "@/lib/utils";
import { RECURRENCE_LABELS, isRecurrenceRule, subtaskProgress, type RecurrenceRule } from "@/features/tasks/templates";

interface Props {
  taskId: string;
  tenantId?: string;
  userId?: string;
  nameOf: (id: string | null | undefined) => string | undefined;
  profiles: Array<{ user_id: string; display_name: string | null }>;
}

export function TaskSubtasks({ taskId, tenantId, userId, profiles }: Props) {
  const qc = useQueryClient();
  const key = ["task-subtasks", taskId];
  const [title, setTitle] = useState("");
  const { data: subtasks = [] } = useQuery({
    queryKey: key,
    staleTime: 30_000,
    queryFn: async () => {
      const { data } = await supabase.from("tasks").select("id, title, status, due_date, assigned_to").eq("parent_task_id", taskId).order("created_at");
      return data ?? [];
    },
  });
  const progress = subtaskProgress(subtasks);
  const refresh = () => qc.invalidateQueries({ queryKey: key });

  const add = async () => {
    const t = title.trim();
    if (!t || !userId || !tenantId) return;
    setTitle("");
    const { error } = await supabase.from("tasks").insert({ id: crypto.randomUUID(), title: t, status: "todo", priority: "medium", category: "personal", user_id: userId, tenant_id: tenantId, assigned_to: userId, parent_task_id: taskId });
    if (error) notify.error("Unteraufgabe konnte nicht angelegt werden");
    void refresh();
  };
  const update = async (id: string, patch: { status?: string; assigned_to?: string | null; due_date?: string | null }) => {
    qc.setQueryData(key, subtasks.map((s) => (s.id === id ? { ...s, ...patch } : s)));
    const { error } = await supabase.from("tasks").update(patch).eq("id", id);
    if (error) notify.error("Speichern fehlgeschlagen");
    void refresh();
  };
  const remove = async (id: string) => {
    const { error } = await supabase.from("tasks").delete().eq("id", id);
    if (error) notify.error("Löschen fehlgeschlagen");
    void refresh();
  };

  return (
    <section className="rounded-lg border p-md space-y-sm">
      <div className="section-label flex items-center gap-xs">
        <CornerDownRight className="h-3.5 w-3.5" />Unteraufgaben{progress.total ? ` (${progress.done}/${progress.total})` : ""}
      </div>
      {progress.total > 0 && <Progress value={progress.percent} className="h-1.5" />}
      <ul className="space-y-2xs">
        {subtasks.map((s) => (
          <li key={s.id} className="group flex items-center gap-xs">
            <Checkbox checked={s.status === "completed"} aria-label={s.title}
              onCheckedChange={(v) => update(s.id, { status: v ? "completed" : "todo" })} />
            <span className={cn("flex-1 text-body truncate", s.status === "completed" && "line-through text-muted-foreground")}>{s.title}</span>
            <Input type="date" value={s.due_date?.slice(0, 10) ?? ""} onChange={(e) => update(s.id, { due_date: e.target.value || null })} className="h-7 w-36 text-caption" aria-label="Frist" />
            <Select value={s.assigned_to && !s.assigned_to.includes(",") ? s.assigned_to : "none"} onValueChange={(v) => update(s.id, { assigned_to: v === "none" ? null : v })}>
              <SelectTrigger className="h-7 w-32 text-caption" aria-label="Zuständig"><SelectValue placeholder="Person" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Niemand</SelectItem>
                {profiles.map((p) => <SelectItem key={p.user_id} value={p.user_id}>{p.display_name ?? "Unbenannt"}</SelectItem>)}
              </SelectContent>
            </Select>
            <button type="button" aria-label="Unteraufgabe entfernen" className="opacity-0 group-hover:opacity-100 text-muted-foreground" onClick={() => remove(s.id)}>
              <X className="h-3.5 w-3.5" />
            </button>
          </li>
        ))}
      </ul>
      <div className="flex items-center gap-xs">
        <Plus className="h-4 w-4 text-muted-foreground" />
        <Input value={title} onChange={(e) => setTitle(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); void add(); } }}
          placeholder="Unteraufgabe hinzufügen, Enter für die nächste" className="h-8" />
      </div>
    </section>
  );
}

export function TaskRecurrence({ taskId, value, onChanged }: { taskId: string; value: string | null | undefined; onChanged: () => void }) {
  const current = isRecurrenceRule(value) ? value : "none";
  const change = async (v: string) => {
    const { error } = await supabase.from("tasks").update({ recurrence_rule: v === "none" ? null : v }).eq("id", taskId);
    if (error) { notify.error("Speichern fehlgeschlagen"); return; }
    notify.success(v === "none" ? "Wiederholung entfernt" : `Wiederholt sich ${RECURRENCE_LABELS[v as RecurrenceRule].toLowerCase()}`);
    onChanged();
  };
  return (
    <div className="flex items-center gap-xs">
      <Repeat className="h-4 w-4 text-muted-foreground" />
      <Select value={current} onValueChange={change}>
        <SelectTrigger className="h-8 w-48" aria-label="Wiederholung"><SelectValue /></SelectTrigger>
        <SelectContent>
          <SelectItem value="none">Keine Wiederholung</SelectItem>
          {(Object.keys(RECURRENCE_LABELS) as RecurrenceRule[]).map((k) => <SelectItem key={k} value={k}>{RECURRENCE_LABELS[k]}</SelectItem>)}
        </SelectContent>
      </Select>
      {current !== "none" && <span className="text-caption text-muted-foreground">Nach dem Abschließen kommt die nächste automatisch.</span>}
    </div>
  );
}
