import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { notify } from "@/lib/notify";
import { cn } from "@/lib/utils";
import { subtaskProgress } from "@/features/tasks/templates";

interface Props {
  taskId: string;
  tenantId?: string;
  userId?: string;
  category?: string | null;
  profiles: Array<{ user_id: string; display_name: string | null }>;
}

export function TaskSubtasks({ taskId, tenantId, userId, category, profiles }: Props) {
  const qc = useQueryClient();
  const key = ["task-subtasks", taskId];
  const [adding, setAdding] = useState(false);
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
    if (!t || adding) return;
    if (!userId || !tenantId) {
      notify.error("Unteraufgabe konnte nicht angelegt werden", { description: "Aufgabe oder Benutzer konnte keinem Mandanten zugeordnet werden." });
      return;
    }

    setAdding(true);
    try {
      const { error } = await supabase.from("tasks").insert({
        title: t, status: "todo", priority: "medium", category: category || "personal",
        user_id: userId, tenant_id: tenantId, assigned_to: userId, parent_task_id: taskId,
      });
      if (error) {
        notify.error("Unteraufgabe konnte nicht angelegt werden", { description: error.message });
        return;
      }
      setTitle("");
      await refresh();
    } finally {
      setAdding(false);
    }
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
    <section className="space-y-sm">
      <h3 className="flex items-center gap-2 text-base font-semibold">
        Unteraufgaben
        {progress.total > 0 && <span className="font-normal text-muted-foreground">{progress.done} von {progress.total}</span>}
      </h3>
      {progress.total > 0 && <Progress value={progress.percent} className="h-1.5" />}
      <ul className="space-y-2xs">
        {subtasks.map((s) => (
          <li key={s.id} className="group flex items-center gap-3">
            <Checkbox checked={s.status === "completed"} aria-label={s.title} className="size-5 shrink-0 rounded-sm border-muted-foreground [&_svg]:size-3.5"
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
      <form className="flex items-center gap-xs" onSubmit={(event) => { event.preventDefault(); void add(); }}>
        <Button type="submit" size="icon" variant="ghost" aria-label="Unteraufgabe hinzufügen" disabled={adding || !title.trim()}>
          <Plus />
        </Button>
        <Input aria-label="Titel der Unteraufgabe" value={title} onChange={(event) => setTitle(event.target.value)} disabled={adding}
          placeholder="Unteraufgabe hinzufügen … (Enter speichert)" className="h-8" />
      </form>
    </section>
  );
}
