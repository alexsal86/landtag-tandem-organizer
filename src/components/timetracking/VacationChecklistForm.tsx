import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useTenant } from "@/hooks/useTenant";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { ClipboardCheck } from "lucide-react";

export interface ChecklistItem {
  id: string;
  label: string;
  description: string | null;
  completed: boolean;
}

interface VacationChecklistFormProps {
  items: ChecklistItem[];
  onItemsChange: (items: ChecklistItem[]) => void;
}

export function useVacationChecklistItems() {
  const { currentTenant } = useTenant();
  const [items, setItems] = useState<ChecklistItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!currentTenant?.id) return;

    const load = async () => {
      setLoading(true);
      const { data } = await supabase
        .from("vacation_checklist_templates")
        .select("id, label, description")
        .eq("tenant_id", currentTenant.id)
        .eq("is_active", true)
        .order("sort_order");

      setItems(
        (data || []).map(d: Record<string, any> => ({
          id: d.id,
          label: d.label,
          description: d.description,
          completed: false,
        }))
      );
      setLoading(false);
    };

    load();
  }, [currentTenant?.id]);

  return { items, setItems, loading };
}

export function VacationChecklistForm({ items, onItemsChange }: VacationChecklistFormProps) {
  if (items.length === 0) return null;

  const toggleItem = (id: string) => {
    onItemsChange(
      items.map(item =>
        item.id === id ? { ...item, completed: !item.completed } : item
      )
    );
  };

  return (
    <div className="space-y-3 rounded-lg border p-3 bg-muted/30">
      <div className="flex items-center gap-2 text-sm font-medium">
        <ClipboardCheck className="h-4 w-4 text-primary" />
        Urlaubs-Checkliste
      </div>
      <div className="space-y-2">
        {items.map(item => (
          <div key={item.id} className="flex items-start gap-2">
            <Checkbox
              id={`checklist-${item.id}`}
              checked={item.completed}
              onCheckedChange={() => toggleItem(item.id)}
              className="mt-0.5"
            />
            <div>
              <Label htmlFor={`checklist-${item.id}`} className="cursor-pointer text-sm font-normal">
                {item.label}
              </Label>
              {item.description && (
                <p className="text-xs text-muted-foreground">{item.description}</p>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
