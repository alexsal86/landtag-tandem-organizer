import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useTenant } from "@/hooks/useTenant";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { ClipboardCheck, GripVertical, Plus, Trash2 } from "lucide-react";

interface ChecklistTemplate {
  id: string;
  label: string;
  description: string | null;
  sort_order: number;
  is_active: boolean;
  reminder_after: boolean;
}

export function VacationChecklistAdmin() {
  const { currentTenant } = useTenant();
  const { toast } = useToast();
  const [items, setItems] = useState<ChecklistTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [newLabel, setNewLabel] = useState("");
  const [newDescription, setNewDescription] = useState("");
  const [newReminderAfter, setNewReminderAfter] = useState(false);

  const loadItems = async () => {
    if (!currentTenant?.id) return;
    setLoading(true);
    const { data } = await supabase
      .from("vacation_checklist_templates")
      .select("*")
      .eq("tenant_id", currentTenant.id)
      .order("sort_order");
    setItems((data as ChecklistTemplate[]) || []);
    setLoading(false);
  };

  useEffect(() => {
    loadItems();
  }, [currentTenant?.id]);

  const handleAdd = async () => {
    if (!currentTenant?.id || !newLabel.trim()) return;
    const maxOrder = items.reduce((max, i) => Math.max(max, i.sort_order), 0);
    const { error } = await supabase.from("vacation_checklist_templates").insert({
      tenant_id: currentTenant.id,
      label: newLabel.trim(),
      description: newDescription.trim() || null,
      sort_order: maxOrder + 1,
      reminder_after: newReminderAfter,
    });
    if (error) {
      toast({ title: "Fehler", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Gespeichert", description: "Checklisten-Punkt wurde hinzugefügt." });
      setNewLabel("");
      setNewDescription("");
      setNewReminderAfter(false);
      loadItems();
    }
  };

  const handleToggleActive = async (item: ChecklistTemplate) => {
    const { error } = await supabase
      .from("vacation_checklist_templates")
      .update({ is_active: !item.is_active })
      .eq("id", item.id);
    if (!error) loadItems();
  };

  const handleToggleReminder = async (item: ChecklistTemplate) => {
    const { error } = await supabase
      .from("vacation_checklist_templates")
      .update({ reminder_after: !item.reminder_after })
      .eq("id", item.id);
    if (!error) loadItems();
  };

  const handleDelete = async (id: string) => {
    const { error } = await supabase.from("vacation_checklist_templates").delete().eq("id", id);
    if (error) {
      toast({ title: "Fehler", description: error.message, variant: "destructive" });
    } else {
      loadItems();
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <ClipboardCheck className="h-5 w-5" />
          Urlaubs-Checkliste
        </CardTitle>
        <CardDescription>
          Definieren Sie Checklisten-Punkte, die Mitarbeiter beim Urlaubsantrag abhaken müssen.
          Punkte mit "Nach Urlaub erinnern" werden nach Urlaubsende als Erinnerung angezeigt.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Add new item */}
        <div className="space-y-3 rounded-lg border border-dashed p-4">
          <div className="text-sm font-medium">Neuen Punkt hinzufügen</div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <Label>Bezeichnung</Label>
              <Input
                value={newLabel}
                onChange={e => setNewLabel(e.target.value)}
                placeholder="z.B. E-Mail-Abwesenheit eingestellt"
              />
            </div>
            <div>
              <Label>Beschreibung (optional)</Label>
              <Textarea
                value={newDescription}
                onChange={e => setNewDescription(e.target.value)}
                placeholder="Zusätzliche Hinweise..."
                className="h-9 min-h-[36px] resize-none"
              />
            </div>
          </div>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Switch checked={newReminderAfter} onCheckedChange={setNewReminderAfter} />
              <Label className="text-sm font-normal">Nach Urlaub erinnern (z.B. "Abwesenheit deaktivieren")</Label>
            </div>
            <Button onClick={handleAdd} disabled={!newLabel.trim()} size="sm">
              <Plus className="mr-1 h-4 w-4" />
              Hinzufügen
            </Button>
          </div>
        </div>

        {/* Existing items */}
        {loading ? (
          <p className="text-sm text-muted-foreground">Lade…</p>
        ) : items.length === 0 ? (
          <p className="text-sm text-muted-foreground">Noch keine Checklisten-Punkte vorhanden.</p>
        ) : (
          <div className="space-y-2">
            {items.map(item => (
              <div
                key={item.id}
                className={`flex items-center gap-3 rounded-lg border p-3 ${!item.is_active ? "opacity-50" : ""}`}
              >
                <GripVertical className="h-4 w-4 shrink-0 text-muted-foreground" />
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium">{item.label}</div>
                  {item.description && (
                    <div className="text-xs text-muted-foreground">{item.description}</div>
                  )}
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  <div className="flex items-center gap-1.5">
                    <Switch
                      checked={item.reminder_after}
                      onCheckedChange={() => handleToggleReminder(item)}
                      className="scale-75"
                    />
                    <span className="text-[10px] text-muted-foreground whitespace-nowrap">Erinnern</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Switch
                      checked={item.is_active}
                      onCheckedChange={() => handleToggleActive(item)}
                      className="scale-75"
                    />
                    <span className="text-[10px] text-muted-foreground">Aktiv</span>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 w-8 p-0 text-muted-foreground hover:text-destructive"
                    onClick={() => handleDelete(item.id)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
