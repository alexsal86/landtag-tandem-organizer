import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, Trash2, Pencil, PackageCheck } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useTenant } from "@/hooks/useTenant";
import { notify } from "@/lib/notify";
import { taskTemplateFromRecord, validateTaskTemplate, type TaskTemplate } from "@/features/tasks/templates";
import { useAutomationMembershipRole } from "./hooks/useAutomationAdminData";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { EmptyState, LoadingState, SectionHeader } from "@/components/ui-patterns";

const newPackage = (): TaskTemplate => ({
  key: crypto.randomUUID(), id: crypto.randomUUID(), title: "", description: "", firstStep: "",
  dueInDays: 7, isActive: true, subtasks: [{ title: "", offsetDays: 1 }],
});

export function TaskPackageManager() {
  const { user } = useAuth();
  const { currentTenant } = useTenant();
  const tenantId = currentTenant?.id;
  const queryClient = useQueryClient();
  const { data: role } = useAutomationMembershipRole(tenantId, user?.id);
  const canEdit = role === "abgeordneter" || role === "bueroleitung";
  const [form, setForm] = useState<TaskTemplate | null>(null);
  const [saving, setSaving] = useState(false);

  const { data, isLoading, error } = useQuery({
    queryKey: ["task-templates", tenantId],
    enabled: Boolean(tenantId),
    queryFn: async () => {
      const { data, error } = await supabase.from("task_templates")
        .select("id,title,description,first_step,due_in_days,subtasks,is_active")
        .eq("tenant_id", tenantId!).order("title");
      if (error) throw error;
      return data.map(taskTemplateFromRecord);
    },
  });

  const refresh = () => queryClient.invalidateQueries({ queryKey: ["task-templates", tenantId] });

  const save = async () => {
    if (!form || !tenantId || !form.id) return;
    const validationError = validateTaskTemplate(form);
    if (validationError) { notify.error(validationError); return; }
    setSaving(true);
    const { error } = await supabase.rpc("save_task_template", {
      _id: form.id, _tenant_id: tenantId, _title: form.title, _description: form.description,
      _first_step: form.firstStep, _due_in_days: form.dueInDays,
      _subtasks: form.subtasks, _is_active: form.isActive ?? true,
    });
    setSaving(false);
    if (error) { notify.error("Paket konnte nicht gespeichert werden", { description: error.message }); return; }
    notify.success("Aufgabenpaket gespeichert");
    setForm(null);
    await refresh();
  };

  const remove = async (template: TaskTemplate) => {
    if (!template.id || !window.confirm(`„${template.title}“ wirklich löschen? Bereits angelegte Aufgaben bleiben erhalten.`)) return;
    const { error } = await supabase.rpc("delete_task_template", { _id: template.id });
    if (error) { notify.error("Paket konnte nicht gelöscht werden", { description: error.message }); return; }
    notify.success("Aufgabenpaket gelöscht");
    await refresh();
  };

  const updateStep = (index: number, patch: Partial<TaskTemplate["subtasks"][number]>) => {
    setForm((current) => current ? { ...current, subtasks: current.subtasks.map((step, i) => i === index ? { ...step, ...patch } : step) } : current);
  };

  return (
    <Card>
      <CardHeader>
        <SectionHeader
          title="Aufgabenpakete"
          description="Manuell abrufbare Stafetten mit Hauptaufgabe, Unteraufgaben und relativen Fristen."
          actions={<Button size="sm" onClick={() => setForm(newPackage())} disabled={!canEdit}><Plus className="h-4 w-4" />Neues Paket</Button>}
        />
        <CardDescription>Die Pakete stehen allen Büromitgliedern unter „Meine Arbeit → Vorlagen“ zur Verfügung. Änderungen betreffen nur neu erzeugte Aufgaben.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-sm">
        {isLoading && <LoadingState variant="list" rows={3} />}
        {error && <p role="alert" className="text-body text-destructive">Aufgabenpakete konnten nicht geladen werden.</p>}
        {!isLoading && !error && data?.length === 0 && <EmptyState title="Noch keine Aufgabenpakete" description="Lege das erste Paket mit Unteraufgaben und relativen Fristen an." />}
        {data?.map((template) => (
          <div key={template.id} className="flex items-start justify-between gap-md rounded-lg border p-md">
            <div className="min-w-0 space-y-2xs">
              <div className="flex flex-wrap items-center gap-xs">
                <PackageCheck className="h-4 w-4 text-muted-foreground" />
                <h3 className="text-body font-medium">{template.title}</h3>
                {!template.isActive && <Badge variant="secondary">Pausiert</Badge>}
              </div>
              <p className="text-caption text-muted-foreground">{template.description || "Ohne Beschreibung"}</p>
              <p className="text-caption text-muted-foreground">{template.subtasks.length} Unteraufgaben · Gesamtfrist {template.dueInDays} Tage · Erster Schritt: {template.firstStep}</p>
            </div>
            {canEdit && <div className="flex shrink-0 gap-2xs">
              <Button size="icon" variant="ghost" onClick={() => setForm(template)} aria-label={`${template.title} bearbeiten`}><Pencil className="h-4 w-4" /></Button>
              <Button size="icon" variant="ghost" onClick={() => void remove(template)} aria-label={`${template.title} löschen`}><Trash2 className="h-4 w-4" /></Button>
            </div>}
          </div>
        ))}
      </CardContent>

      <Dialog open={Boolean(form)} onOpenChange={(open) => !open && setForm(null)}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader><DialogTitle>Aufgabenpaket bearbeiten</DialogTitle><DialogDescription>Fristen werden ab dem gewählten Starttag berechnet.</DialogDescription></DialogHeader>
          {form && <div className="space-y-md">
            <div className="grid gap-sm sm:grid-cols-2">
              <div className="space-y-xs sm:col-span-2"><Label htmlFor="package-title">Titel</Label><Input id="package-title" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} /></div>
              <div className="space-y-xs sm:col-span-2"><Label htmlFor="package-description">Beschreibung</Label><Textarea id="package-description" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></div>
              <div className="space-y-xs"><Label htmlFor="package-first-step">Erster Schritt</Label><Input id="package-first-step" value={form.firstStep} onChange={(e) => setForm({ ...form, firstStep: e.target.value })} /></div>
              <div className="space-y-xs"><Label htmlFor="package-due">Gesamtfrist in Tagen</Label><Input id="package-due" type="number" min={0} max={365} value={form.dueInDays} onChange={(e) => setForm({ ...form, dueInDays: Number(e.target.value) })} /></div>
            </div>
            <div className="flex items-center justify-between"><Label htmlFor="package-active">Im Vorlagendialog anbieten</Label><Switch id="package-active" checked={form.isActive ?? true} onCheckedChange={(checked) => setForm({ ...form, isActive: checked })} /></div>
            <div className="space-y-sm">
              <div className="flex items-center justify-between"><Label>Unteraufgaben</Label><Button size="sm" variant="outline" onClick={() => setForm({ ...form, subtasks: [...form.subtasks, { title: "", offsetDays: form.dueInDays }] })}><Plus className="h-4 w-4" />Schritt</Button></div>
              {form.subtasks.map((step, index) => <div key={index} className="grid grid-cols-[1fr_110px_40px] items-end gap-xs">
                <div className="space-y-xs"><Label htmlFor={`step-title-${index}`}>Schritt {index + 1}</Label><Input id={`step-title-${index}`} value={step.title} onChange={(e) => updateStep(index, { title: e.target.value })} /></div>
                <div className="space-y-xs"><Label htmlFor={`step-days-${index}`}>Nach Tagen</Label><Input id={`step-days-${index}`} type="number" min={0} max={365} value={step.offsetDays} onChange={(e) => updateStep(index, { offsetDays: Number(e.target.value) })} /></div>
                <Button size="icon" variant="ghost" onClick={() => setForm({ ...form, subtasks: form.subtasks.filter((_, i) => i !== index) })} aria-label={`Schritt ${index + 1} entfernen`}><Trash2 className="h-4 w-4" /></Button>
              </div>)}
            </div>
          </div>}
          <DialogFooter><Button variant="outline" onClick={() => setForm(null)}>Abbrechen</Button><Button onClick={() => void save()} disabled={saving}>{saving ? "Speichert …" : "Paket speichern"}</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
