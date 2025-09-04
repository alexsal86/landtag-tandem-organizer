import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { CheckSquareIcon, PlusIcon, TrashIcon, SaveIcon } from "lucide-react";
import { AppointmentPreparation } from "@/hooks/useAppointmentPreparation";

interface AppointmentPreparationChecklistTabProps {
  preparation: AppointmentPreparation;
  onUpdate: (updates: Partial<AppointmentPreparation>) => Promise<void>;
}

export function AppointmentPreparationChecklistTab({ 
  preparation, 
  onUpdate 
}: AppointmentPreparationChecklistTabProps) {
  const [checklistItems, setChecklistItems] = useState(preparation.checklist_items || []);
  const [newItemLabel, setNewItemLabel] = useState("");
  const [saving, setSaving] = useState(false);

  const handleToggleItem = async (itemId: string) => {
    const updatedItems = checklistItems.map(item =>
      item.id === itemId ? { ...item, completed: !item.completed } : item
    );
    setChecklistItems(updatedItems);
    
    try {
      setSaving(true);
      await onUpdate({ checklist_items: updatedItems });
    } catch (error) {
      console.error("Error updating checklist item:", error);
      // Revert on error
      setChecklistItems(preparation.checklist_items || []);
    } finally {
      setSaving(false);
    }
  };

  const handleAddItem = async () => {
    if (!newItemLabel.trim()) return;

    const newItem = {
      id: `item_${Date.now()}`,
      label: newItemLabel.trim(),
      completed: false
    };

    const updatedItems = [...checklistItems, newItem];
    setChecklistItems(updatedItems);
    setNewItemLabel("");

    try {
      setSaving(true);
      await onUpdate({ checklist_items: updatedItems });
    } catch (error) {
      console.error("Error adding checklist item:", error);
      // Revert on error
      setChecklistItems(preparation.checklist_items || []);
      setNewItemLabel(newItem.label);
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteItem = async (itemId: string) => {
    const updatedItems = checklistItems.filter(item => item.id !== itemId);
    setChecklistItems(updatedItems);

    try {
      setSaving(true);
      await onUpdate({ checklist_items: updatedItems });
    } catch (error) {
      console.error("Error deleting checklist item:", error);
      // Revert on error
      setChecklistItems(preparation.checklist_items || []);
    } finally {
      setSaving(false);
    }
  };

  const getCompletionStats = () => {
    const total = checklistItems.length;
    const completed = checklistItems.filter(item => item.completed).length;
    const percentage = total > 0 ? Math.round((completed / total) * 100) : 0;
    return { total, completed, percentage };
  };

  const stats = getCompletionStats();

  return (
    <div className="space-y-6">
      {/* Progress Overview */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CheckSquareIcon className="h-5 w-5" />
            Checkliste Fortschritt
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex gap-4">
                <Badge variant="outline">
                  {stats.completed} von {stats.total} erledigt
                </Badge>
                <Badge variant={stats.percentage === 100 ? "default" : "secondary"}>
                  {stats.percentage}% abgeschlossen
                </Badge>
              </div>
            </div>
            <div className="w-full bg-muted rounded-full h-3">
              <div
                className="bg-primary h-3 rounded-full transition-all duration-300"
                style={{ width: `${stats.percentage}%` }}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Add New Item */}
      <Card>
        <CardHeader>
          <CardTitle>Neue Aufgabe hinzufügen</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex gap-2">
            <Input
              value={newItemLabel}
              onChange={(e) => setNewItemLabel(e.target.value)}
              placeholder="Neue Aufgabe eingeben..."
              onKeyDown={(e) => e.key === "Enter" && handleAddItem()}
            />
            <Button onClick={handleAddItem} disabled={!newItemLabel.trim() || saving}>
              <PlusIcon className="h-4 w-4 mr-2" />
              Hinzufügen
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Checklist Items */}
      <Card>
        <CardHeader>
          <CardTitle>Aufgaben</CardTitle>
        </CardHeader>
        <CardContent>
          {checklistItems.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <CheckSquareIcon className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>Keine Aufgaben vorhanden.</p>
              <p className="text-sm">Fügen Sie oben eine neue Aufgabe hinzu.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {checklistItems.map((item) => (
                <div
                  key={item.id}
                  className="flex items-center gap-3 p-3 rounded-lg border bg-muted/20 hover:bg-muted/40 transition-colors"
                >
                  <Checkbox
                    id={item.id}
                    checked={item.completed}
                    onCheckedChange={() => handleToggleItem(item.id)}
                    disabled={saving}
                  />
                  <label
                    htmlFor={item.id}
                    className={`flex-1 text-sm cursor-pointer ${
                      item.completed
                        ? "line-through text-muted-foreground"
                        : "text-foreground"
                    }`}
                  >
                    {item.label}
                  </label>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleDeleteItem(item.id)}
                    disabled={saving}
                    className="text-destructive hover:text-destructive"
                  >
                    <TrashIcon className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
          )}
          
          {saving && (
            <div className="flex items-center justify-center mt-4 text-sm text-muted-foreground">
              <SaveIcon className="h-4 w-4 mr-2 animate-spin" />
              Speichern...
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}