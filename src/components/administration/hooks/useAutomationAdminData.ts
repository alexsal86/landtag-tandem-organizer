import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/components/ui/use-toast";
import {
  toAutomationRuleInsert,
  toAutomationRuleRecordView,
  toAutomationRuleUpdate,
  toAutomationRunRecordView,
  toAutomationRunStepRecordView,
  type AutomationRuleMutationPayload,
} from "../automationShared";

const automationKeys = {
  membership: (tenantId: string, userId: string) => ["automation-admin", tenantId, "membership", userId] as const,
  pauseState: (tenantId: string) => ["automation-admin", tenantId, "pause-state"] as const,
  rules: (tenantId: string) => ["automation-admin", tenantId, "rules"] as const,
  runs: (tenantId: string) => ["automation-admin", tenantId, "runs"] as const,
  runSteps: (runId: string) => ["automation-admin", "run-steps", runId] as const,
};

export function useAutomationMembershipRole(tenantId?: string, userId?: string) {
  return useQuery({
    queryKey: tenantId && userId ? automationKeys.membership(tenantId, userId) : ["automation-admin", "membership", "disabled"],
    enabled: Boolean(tenantId && userId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("user_tenant_memberships")
        .select("role")
        .eq("user_id", userId!)
        .eq("tenant_id", tenantId!)
        .eq("is_active", true)
        .maybeSingle();

      if (error) throw error;
      return data?.role ?? null;
    },
  });
}

export function useAutomationPauseState(tenantId?: string) {
  return useQuery({
    queryKey: tenantId ? automationKeys.pauseState(tenantId) : ["automation-admin", "pause-state", "disabled"],
    enabled: Boolean(tenantId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tenants")
        .select("automations_paused")
        .eq("id", tenantId!)
        .maybeSingle();

      if (error) throw error;
      return Boolean(data?.automations_paused);
    },
  });
}

export function useAutomationRules(tenantId?: string) {
  return useQuery({
    queryKey: tenantId ? automationKeys.rules(tenantId) : ["automation-admin", "rules", "disabled"],
    enabled: Boolean(tenantId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("automation_rules")
        .select("id, name, description, module, trigger_type, trigger_config, conditions, actions, enabled, updated_at")
        .eq("tenant_id", tenantId!)
        .order("updated_at", { ascending: false });

      if (error) throw error;
      return (data ?? []).map(toAutomationRuleRecordView);
    },
  });
}

export function useAutomationRuns(tenantId?: string) {
  return useQuery({
    queryKey: tenantId ? automationKeys.runs(tenantId) : ["automation-admin", "runs", "disabled"],
    enabled: Boolean(tenantId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("automation_rule_runs")
        .select("id, rule_id, status, dry_run, trigger_source, started_at, finished_at, error_message, input_payload, result_payload")
        .eq("tenant_id", tenantId!)
        .order("started_at", { ascending: false })
        .limit(30);

      if (error) throw error;
      return (data ?? []).map(toAutomationRunRecordView);
    },
  });
}

export function useAutomationRunSteps(runId?: string) {
  return useQuery({
    queryKey: runId ? automationKeys.runSteps(runId) : ["automation-admin", "run-steps", "disabled"],
    enabled: Boolean(runId),
    retry: 1,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("automation_rule_run_steps")
        .select("id, run_id, step_order, step_type, status, result_payload, error_message")
        .eq("run_id", runId!)
        .order("step_order", { ascending: true });

      if (error) throw error;
      return (data ?? []).map(toAutomationRunStepRecordView);
    },
  });
}

export function useAutomationAdminMutations(tenantId?: string, userId?: string) {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const invalidateAll = async () => {
    if (!tenantId) return;
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: automationKeys.rules(tenantId) }),
      queryClient.invalidateQueries({ queryKey: automationKeys.runs(tenantId) }),
      queryClient.invalidateQueries({ queryKey: automationKeys.pauseState(tenantId) }),
    ]);
  };

  const togglePause = useMutation({
    mutationFn: async (paused: boolean) => {
      if (!tenantId) throw new Error("Kein aktiver Tenant ausgewählt.");
      const { error } = await supabase.from("tenants").update({ automations_paused: paused }).eq("id", tenantId);
      if (error) throw error;
      return paused;
    },
    onSuccess: async () => {
      await invalidateAll();
    },
  });

  const upsertRule = useMutation({
    mutationFn: async ({ editingRuleId, payload }: { editingRuleId: string | null; payload: AutomationRuleMutationPayload }) => {
      if (!tenantId || !userId) throw new Error("Tenant oder Benutzer fehlt.");
      const query = editingRuleId
        ? supabase.from("automation_rules").update(toAutomationRuleUpdate(payload)).eq("id", editingRuleId)
        : supabase.from("automation_rules").insert([toAutomationRuleInsert(payload, userId)]);
      const { error } = await query;
      if (error) throw error;
    },
    onSuccess: async () => {
      await invalidateAll();
    },
  });

  const deleteRule = useMutation({
    mutationFn: async (ruleId: string) => {
      const { error } = await supabase.from("automation_rules").delete().eq("id", ruleId);
      if (error) throw error;
    },
    onSuccess: async () => {
      await invalidateAll();
    },
  });

  const toggleRuleEnabled = useMutation({
    mutationFn: async ({ ruleId, enabled }: { ruleId: string; enabled: boolean }) => {
      const { error } = await supabase.from("automation_rules").update({ enabled }).eq("id", ruleId);
      if (error) throw error;
    },
    onSuccess: async () => {
      await invalidateAll();
    },
  });

  const runRule = useMutation({
    mutationFn: async ({ ruleId, dryRun, sourcePayload }: { ruleId: string; dryRun: boolean; sourcePayload: Record<string, string> }) => {
      const { error } = await supabase.functions.invoke("run-automation-rule", {
        body: {
          ruleId,
          dryRun,
          idempotencyKey: crypto.randomUUID(),
          sourcePayload,
        },
      });

      if (error) throw error;
    },
    onSuccess: async (_, variables) => {
      toast({
        title: variables.dryRun ? "Dry-Run erstellt" : "Regel ausgeführt",
        description: variables.dryRun ? "Ausführung wurde in der Historie protokolliert." : "Die Ausführung wurde protokolliert.",
      });
      await invalidateAll();
    },
  });

  return {
    togglePause,
    upsertRule,
    deleteRule,
    toggleRuleEnabled,
    runRule,
    refreshAll: invalidateAll,
    refreshRunSteps: async (runId: string) => {
      await queryClient.invalidateQueries({ queryKey: automationKeys.runSteps(runId) });
    },
  };
}
