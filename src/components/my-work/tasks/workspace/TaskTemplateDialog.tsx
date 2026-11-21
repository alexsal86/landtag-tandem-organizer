import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { notify } from "@/lib/notify";
import { taskTemplateFromAutomationRule, type TaskTemplate } from "@/features/tasks/templates";
import { EmptyState, LoadingState } from "@/components/ui-patterns";

interface Props { userId?: string; tenantId?: string; onCreated: () => void }
const today = () => new Date().toISOString().slice(0, 10);

export function TaskTemplateButton({ userId, tenantId, onCreated }: Props) {
  const [open, setOpen] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [startDate, setStartDate] = useState(today);
  const { data: templates = [], isLoading, error } = useQuery({
    queryKey: ["automation-task-packages", tenantId, "active"],
    enabled: Boolean(open && tenantId),
    queryFn: async () => {
      const { data, error } = await supabase.from("automation_rules")
        .select("id,name,description,module,trigger_type,enabled,actions")
        .eq("tenant_id", tenantId!).eq("module", "tasks").eq("trigger_type", "manual").eq("enabled", true)
        .order("name");
      if (error) throw error;
      return data.flatMap(rule => {
        const template = taskTemplateFromAutomationRule(rule);
        return template ? [template] : [];
      });
    },
  });

  const apply = async (template: TaskTemplate) => {
    if (!userId || !tenantId || !template.id || !startDate) return;
    setBusyId(template.id);
    const { error } = await supabase.functions.invoke("run-automation-rule", {
      body: {
        ruleId: template.id,
        tenant_id: tenantId,
        dryRun: false,
        idempotencyKey: crypto.randomUUID(),
        sourcePayload: { trigger_event: "manual", start_date: startDate },
      },
    });
    setBusyId(null);
    if (error) { notify.error("Aufgabenpaket konnte nicht gestartet werden", { description: error.message }); return; }
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
            <DialogTitle>Aufgabenpaket starten</DialogTitle>
            <DialogDescription>Diese manuellen Regeln legen Haupt- und Unteraufgaben gemeinsam an und erscheinen in der Automatisierungshistorie.</DialogDescription>
          </DialogHeader>
          <div className="space-y-xs"><Label htmlFor="template-start">Starttag</Label><Input id="template-start" type="date" value={startDate} onChange={(event) => setStartDate(event.target.value)} /></div>
          {isLoading && <LoadingState variant="list" rows={3} />}
          {error && <p role="alert" className="text-body text-destructive">Aufgabenpakete konnten nicht geladen werden.</p>}
          {!isLoading && !error && templates.length === 0 && <EmptyState title="Keine aktiven Aufgabenpakete" description="Abgeordnete oder Büroleitung verwalten sie als manuelle Regeln unter Administration → Automatisierung." />}
          <div className="space-y-sm">
            {templates.map((template) => (
              <button key={template.id} type="button" disabled={Boolean(busyId) || !startDate} onClick={() => void apply(template)}
                className="w-full rounded-lg border p-md text-left transition-colors duration-fast hover:bg-muted disabled:opacity-60">
                <div className="flex items-center justify-between gap-sm"><span className="text-body font-medium">{template.title}</span><span className="text-caption text-muted-foreground">{template.dueInDays} Tage</span></div>
                <div className="text-caption text-muted-foreground">{template.description}</div>
                <div className="mt-2xs text-caption text-muted-foreground">{template.subtasks.map((step) => step.title).join(" · ")}</div>
                {busyId === template.id && <div className="mt-2xs text-caption">Regel wird ausgeführt …</div>}
              </button>
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
