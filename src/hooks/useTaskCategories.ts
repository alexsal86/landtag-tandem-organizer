import { useQuery } from "@tanstack/react-query";
import { useTenant } from "@/hooks/useTenant";
import { supabase } from "@/integrations/supabase/client";

export interface TaskCategoryOption {
  name: string;
  label: string;
}

export const DEFAULT_TASK_CATEGORIES: TaskCategoryOption[] = [
  { name: "legislation", label: "Gesetzgebung" },
  { name: "committee", label: "Ausschuss" },
  { name: "constituency", label: "Wahlkreis" },
  { name: "personal", label: "Persönlich" },
];

export function useTaskCategories() {
  const { currentTenant } = useTenant();

  const query = useQuery({
    queryKey: ["task-categories", currentTenant?.id],
    enabled: Boolean(currentTenant?.id),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("task_categories")
        .select("name, label")
        .eq("tenant_id", currentTenant!.id)
        .eq("is_active", true)
        .order("order_index");

      if (error) throw error;
      return (data ?? []) as TaskCategoryOption[];
    },
  });

  return {
    data: query.data && query.data.length > 0 ? query.data : DEFAULT_TASK_CATEGORIES,
    isLoading: query.isLoading,
    error: query.error,
  };
}
