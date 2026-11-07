import { useState } from "react";
import { LayoutTemplate } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { notify } from "@/lib/notify";
import { TASK_TEMPLATES, buildTemplateRows, type TaskTemplate } from "@/features/tasks/templates";

interface Props { userId?: string; tenantId?: string; onCreated: () => void }

export function TaskTemplateButton({ userId, tenantId, onCreated }: Props) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  const apply = async (t: TaskTemplate) => {
    if (!userId || !tenantId) return;
    setBusy(true);
    const { parent, children } = buildTemplateRows(t, { userId, tenantId });
    const { error } = await supabase.from("tasks").insert(parent);
    const childErr = error ? null : (await supabase.from("tasks").insert(children)).error;
    setBusy(false);
    if (error || childErr) { notify.error("Vorlage konnte nicht angelegt werden"); return; }
    notify.success(`„${t.title}“ mit ${children.length} Unteraufgaben angelegt`);
    setOpen(false);
    onCreated();
  };

  return (
    <>
      <Button size="sm" variant="outline" onClick={() => setOpen(true)} disabled={!tenantId}>
        <LayoutTemplate className="h-4 w-4 mr-1" />Aus Vorlage
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Aufgabe aus Vorlage</DialogTitle>
            <DialogDescription>Legt die Aufgabe samt Unteraufgaben und Fristen an.</DialogDescription>
          </DialogHeader>
          <div className="space-y-sm">
            {TASK_TEMPLATES.map((t) => (
              <button key={t.key} type="button" disabled={busy} onClick={() => apply(t)}
                className="w-full text-left rounded-lg border p-md hover:bg-muted transition-colors duration-fast">
                <div className="text-body font-medium">{t.title}</div>
                <div className="text-caption text-muted-foreground">{t.subtasks.map((s) => s.title).join(" · ")}</div>
              </button>
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
