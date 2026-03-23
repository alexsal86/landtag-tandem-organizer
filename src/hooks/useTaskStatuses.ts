import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface TaskStatusOption {
  name: string;
  label: string;
}

export const DEFAULT_TASK_STATUSES: TaskStatusOption[] = [
  { name: "todo", label: "Offen" },
  { name: "in-progress", label: "In Bearbeitung" },
  { name: "completed", label: "Erledigt" },
];

export function useTaskStatuses() {
  const query = useQuery({
    queryKey: ["task-statuses"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("task_statuses")
        .select("name, label")
        .eq("is_active", true)
        .order("order_index");

      if (error) throw error;
      return (data ?? []) as TaskStatusOption[];
    },
  });

  return {
    data: query.data && query.data.length > 0 ? query.data : DEFAULT_TASK_STATUSES,
    isLoading: query.isLoading,
    error: query.error,
  };
}
