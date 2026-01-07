import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { RefreshCcw } from "lucide-react";

interface AnnualTasksTabTriggerProps {
  tenantId: string | undefined;
}

export function AnnualTasksTabTrigger({ tenantId }: AnnualTasksTabTriggerProps) {
  const [count, setCount] = useState(0);
  
  useEffect(() => {
    if (tenantId) {
      loadCount();
    }
  }, [tenantId]);

  const loadCount = async () => {
    if (!tenantId) return;
    
    const currentMonth = new Date().getMonth() + 1;
    const currentYear = new Date().getFullYear();

    try {
      // Load annual tasks for tenant
      const { data: tasks } = await supabase
        .from("annual_tasks" as any)
        .select("id, due_month")
        .eq("tenant_id", tenantId) as { data: { id: string; due_month: number }[] | null; error: any };

      if (!tasks || tasks.length === 0) {
        setCount(0);
        return;
      }

      // Load completions for current year
      const { data: completions } = await supabase
        .from("annual_task_completions" as any)
        .select("annual_task_id")
        .in("annual_task_id", tasks.map(t => t.id))
        .eq("year", currentYear) as { data: { annual_task_id: string }[] | null; error: any };

      const completedIds = new Set((completions || []).map(c => c.annual_task_id));

      // Count overdue and due tasks that are not completed
      const pendingCount = tasks.filter(task => {
        if (completedIds.has(task.id)) return false;
        return task.due_month <= currentMonth;
      }).length;

      setCount(pendingCount);
    } catch (error) {
      console.error("Error loading annual tasks count:", error);
    }
  };

  return (
    <TabsTrigger value="annual" className="flex items-center gap-2 relative">
      <RefreshCcw className="h-4 w-4" />
      Jährliche Aufgaben
      {count > 0 && (
        <Badge variant="destructive" className="ml-1 h-5 min-w-5 px-1.5 text-xs">
          {count}
        </Badge>
      )}
    </TabsTrigger>
  );
}
