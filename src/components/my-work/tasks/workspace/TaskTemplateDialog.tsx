import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { notify } from "@/lib/notify";
import { taskTemplateFromRecord, type TaskTemplate } from "@/features/tasks/templates";
import { EmptyState, LoadingState } from "@/components/ui-patterns";

interface Props { userId?: string; tenantId?: string; onCreated: () => void }
const today = () => new Date().toISOString().slice(0, 10);

export function TaskTemplateButton({ userId, tenantId, onCreated }: Props) {
  const [open, setOpen] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [startDate, setStartDate] = useState(today);
  const { data: templates = [], isLoading, error } = useQuery({
    queryKey: ["task-templates", tenantId, "active"],
    enabled: Boolean(open && tenantId),
    queryFn: async () => {
      const { data, error } = await supabase.from("task_templates")
        .select("id,title,description,first_step,due_in_days,subtasks,is_active")
        .eq("tenant_id", tenantId!).eq("is_active", true).order("title");
      if (error) throw error;
      return data.map(taskTemplateFromRecord);
    },
  });

  const apply = async (template: TaskTemplate) => {
    if (!userId || !tenantId || !template.id || !startDate) return;
    setBusyId(template.id);
    const { error } = await supabase.rpc("apply_task_template", { _template_id: template.id, _start_date: startDate });
    setBusyId(null);
    if (error) { notify.error("Vorlage konnte nicht angelegt werden", { description: error.message }); return; }
    notify.success(`„${template.title}“ mit ${template.subtasks.length} Unteraufgaben angelegt`);
    setOpen(false);
    onCreated();
  };

  return (
    <>
      <Button size="sm" variant="ghost" className="text-muted-foreground" onClick={() => setOpen(true)} disabled={!tenantId}>Vorlagen</Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>Aufgabenpaket anwenden</DialogTitle>
            <DialogDescription>Legt Haupt- und Unteraufgaben gemeinsam an. Alle Fristen beziehen sich auf den Starttag.</DialogDescription>
          </DialogHeader>
          <div className="space-y-xs"><Label htmlFor="template-start">Starttag</Label><Input id="template-start" type="date" value={startDate} onChange={(event) => setStartDate(event.target.value)} /></div>
          {isLoading && <LoadingState variant="list" rows={3} />}
          {error && <p role="alert" className="text-body text-destructive">Vorlagen konnten nicht geladen werden.</p>}
          {!isLoading && !error && templates.length === 0 && <EmptyState title="Keine aktiven Aufgabenpakete" description="Abgeordnete oder Büroleitung können Pakete unter Administration → Automatisierung verwalten." />}
          <div className="space-y-sm">
            {templates.map((template) => (
              <button key={template.id} type="button" disabled={Boolean(busyId) || !startDate} onClick={() => void apply(template)}
                className="w-full rounded-lg border p-md text-left transition-colors duration-fast hover:bg-muted disabled:opacity-60">
                <div className="flex items-center justify-between gap-sm"><span className="text-body font-medium">{template.title}</span><span className="text-caption text-muted-foreground">{template.dueInDays} Tage</span></div>
                <div className="text-caption text-muted-foreground">{template.description}</div>
                <div className="mt-2xs text-caption text-muted-foreground">{template.subtasks.map((step) => step.title).join(" · ")}</div>
                {busyId === template.id && <div className="mt-2xs text-caption">Wird angelegt …</div>}
              </button>
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
