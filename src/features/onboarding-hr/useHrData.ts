import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useTenant } from "@/hooks/useTenant";
import { useAuth } from "@/hooks/useAuth";
import { useResolvedUserRole } from "@/hooks/useResolvedUserRole";
import type { Database, Tables } from "@/integrations/supabase/types";
export type HrStep = Tables<"routine_package_steps">;
type HrRun = Pick<
  Tables<"routine_package_runs">,
  | "id"
  | "employee_lifecycle_id"
  | "hr_direction"
  | "task_id"
  | "start_day"
  | "finish_day"
  | "hr_template_revision"
>;
interface HrData {
  employment: Tables<"employee_lifecycle">[];
  runs: HrRun[];
  steps: HrStep[];
  evidence: Tables<"employee_hr_evidence">[];
  templates: Tables<"employee_hr_templates">[];
}

export function useHrData() {
  const { currentTenant } = useTenant();
  const { user } = useAuth();
  const { isAdmin, role, loading: roleLoading } = useResolvedUserRole();
  const tenantId = currentTenant?.id;
  const query = useQuery<HrData>({
    queryKey: ["employee-hr", tenantId, user?.id, isAdmin],
    enabled: !!tenantId && !!user && !roleLoading,
    staleTime: 60_000,
    queryFn: async () => {
      if (!tenantId) throw new Error("Kein Büro ausgewählt.");
      const employment = await supabase
        .from("employee_lifecycle")
        .select(
          "id,tenant_id,user_id,employment_type,start_date,end_date,mentor_user_id,created_at",
        )
        .eq("tenant_id", tenantId)
        .order("start_date", { ascending: false });
      if (employment.error) throw employment.error;
      const ids = employment.data.map((e) => e.id);
      const runs = ids.length
        ? await supabase
            .from("routine_package_runs")
            .select(
              "id,employee_lifecycle_id,hr_direction,task_id,start_day,finish_day,hr_template_revision",
            )
            .eq("tenant_id", tenantId)
            .in("employee_lifecycle_id", ids)
        : { data: [], error: null };
      if (runs.error) throw runs.error;
      const runIds = (runs.data ?? []).map((r) => r.id);
      const steps = runIds.length
        ? await supabase
            .from("routine_package_steps")
            .select(
              "id,run_id,position,title,kind,release,assignee_id,approver_id,due_day,status,entity_id,approval_id,error_message,attempts,completed_at,nominal_assignee_id,nominal_approver_id,use_deputy,deadline_basis,deadline_offset,hr_phase,is_mandatory,hr_anchor_day,hr_evidence_kind",
            )
            .in("run_id", runIds)
            .order("position")
        : { data: [], error: null };
      if (steps.error) throw steps.error;
      const stepIds = (steps.data ?? []).map((s) => s.id);
      const evidence = stepIds.length
        ? await supabase
            .from("employee_hr_evidence")
            .select(
              "id,tenant_id,step_id,user_id,confirmed_on,confirmed_by,document_id,created_at",
            )
            .eq("tenant_id", tenantId)
            .in("step_id", stepIds)
        : { data: [], error: null };
      if (evidence.error) throw evidence.error;
      const templates = isAdmin
        ? await supabase
            .from("employee_hr_templates")
            .select(
              "id,tenant_id,name,employment_type,direction,steps,revision,created_at",
            )
            .eq("tenant_id", tenantId)
            .order("name")
        : { data: [], error: null };
      if (templates.error) throw templates.error;
      return {
        employment: employment.data,
        runs: runs.data ?? [],
        steps: steps.data ?? [],
        evidence: evidence.data ?? [],
        templates: templates.data ?? [],
      };
    },
  });
  const client = useQueryClient();
  type RpcName =
    | "save_employee_lifecycle"
    | "save_employee_hr_template"
    | "seed_employee_hr_templates"
    | "start_employee_hr"
    | "complete_employee_hr_step"
    | "remind_employee_hr"
    | "refresh_routine_package";
  type Mutation = {
    [K in RpcName]: {
      name: K;
      args: Database["public"]["Functions"][K]["Args"];
    };
  }[RpcName];
  const mutation = useMutation({
    mutationFn: async (input: Mutation) => {
      // The discriminated union keeps callers checked; PostgREST dispatches the selected RPC.
      const result = await supabase.rpc(input.name, input.args);
      if (result.error) throw new Error(result.error.message);
      return result.data;
    },
    onSuccess: async () => {
      await Promise.all([
        client.invalidateQueries({ queryKey: ["employee-hr"] }),
        client.invalidateQueries({ queryKey: ["employee-admin-overview"] }),
      ]);
    },
  });
  return {
    ...query,
    mutation,
    tenantId,
    isAdmin,
    role,
    userId: user?.id,
    refresh: () => client.invalidateQueries({ queryKey: ["employee-hr"] }),
  };
}
