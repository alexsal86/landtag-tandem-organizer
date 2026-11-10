import { unconfirmedOfficeRoutine } from '../_shared/officeRoutinePlan.ts';
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.56.1";
import { requireServiceRole, corsHeaders as sharedCorsHeaders, forbiddenResponse } from "../_shared/security.ts";

import { withSafeHandler } from "../_shared/security.ts";
import { calendarOccurrence, isCalendarSchedule, scheduleRunKey, type ScheduleConfig } from "../_shared/calendarSchedule.ts";
import { validSchedulerSignature } from "./schedulerAuth.ts";
const corsHeaders = {
  ...sharedCorsHeaders,
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-automation-secret",
};

type Rule = {
  id: string;
  tenant_id: string;
  name: string;
  trigger_config: ScheduleConfig | null;
  module: string;
  actions: Array<{type:string;payload?:Record<string,string>}>;
};

Deno.serve(withSafeHandler("run-scheduled-automation-rules", async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    if (!requireServiceRole(req) && !await validSchedulerSignature(req, serviceRoleKey)) {
      return forbiddenResponse();
    }
    if (req.method !== "POST") return new Response("Method not allowed", { status: 405 });
    const options: { ruleId?: string; dryRun?: boolean } = await req.json().catch(() => ({}));

    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const automationSecret = Deno.env.get("AUTOMATION_CRON_SECRET") ?? "";

    const supabase = createClient(supabaseUrl, serviceRoleKey);

    let query = supabase
      .from("automation_rules")
      .select("id, tenant_id, name, module, trigger_config, actions")
      .eq("enabled", true)
      .eq("trigger_type", "schedule");
    if (options.ruleId) query = query.eq("id", options.ruleId);
    const { data: rules, error: rulesError } = await query;

    if (rulesError) {
      throw rulesError;
    }

    const now = Date.now();
    let executed = 0;
    const skipped: string[] = [];

    // Collect paused tenants to skip
    const tenantIds = [...new Set((rules || []).map((r: Rule) => r.tenant_id))];
    const pausedTenants = new Set<string>();
    for (const tid of tenantIds) {
      const { data: t } = await supabase
        .from("tenants")
        .select("automations_paused")
        .eq("id", tid)
        .maybeSingle();
      if (t?.automations_paused) pausedTenants.add(tid);
    }

    for (const rule of (rules || []) as Rule[]) {
      if (pausedTenants.has(rule.tenant_id)) {
        skipped.push(`${rule.name}: tenant paused`);
        continue;
      }

      if (unconfirmedOfficeRoutine(rule.actions ?? [], new Date(now))) { skipped.push(`${rule.name}: annual dates not confirmed`); continue; }

      const minutesInterval = Math.max(1, Number(rule.trigger_config?.minutes_interval ?? 60));
      const config = rule.trigger_config ?? {};
      const calendar = isCalendarSchedule(config);
      const occurrence = calendar ? calendarOccurrence(config, new Date(now)) : null;
      if (calendar && !occurrence) { skipped.push(`${rule.name}: calendar date not due`); continue; }

      const { data: lastRun } = await supabase
        .from("automation_rule_runs")
        .select("started_at")
        .eq("rule_id", rule.id)
        .eq("tenant_id", rule.tenant_id)
        .eq("dry_run", false)
        .order("started_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (!calendar && lastRun?.started_at) {
        const elapsedMinutes = (now - new Date(lastRun.started_at).getTime()) / 60000;
        if (elapsedMinutes < minutesInterval) {
          skipped.push(`${rule.name}: not due (${elapsedMinutes.toFixed(1)}m < ${minutesInterval}m)`);
          continue;
        }
      }

      // Deterministic idempotency key: rule ID + 5-min time window
      // Prevents duplicate execution if the cron fires twice in the same window
      const timeSlot = Math.floor(now / (5 * 60 * 1000));
      const deterministicKey = occurrence ? scheduleRunKey(rule.id, occurrence) : `${rule.id}-sched-${timeSlot}`;

      const response = await fetch(`${supabaseUrl}/functions/v1/run-automation-rule`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          apikey: Deno.env.get("SUPABASE_ANON_KEY") ?? "",
          Authorization: `Bearer ${serviceRoleKey}`,
          "x-automation-secret": automationSecret,
        },
        body: JSON.stringify({
          ruleId: rule.id,
          dryRun: options.dryRun === true,
          idempotencyKey: options.dryRun ? undefined : deterministicKey,
          sourcePayload: {
            source: "scheduled",
            tenant_id: rule.tenant_id,
            rule_name: rule.name,
            module: rule.module,
            scheduled_date: occurrence,
            trigger_event: "schedule",
          },
        }),
      });

      if (!response.ok) {
        const txt = await response.text();
        skipped.push(`${rule.name}: failed invoke (${response.status}) ${txt}`);
        continue;
      }

      const result = await response.json();
      if (result.reused || result.status === "failed") { skipped.push(`${rule.name}: ${result.reused ? "already claimed" : "execution failed"}`); continue; }
      executed += 1;
    }

    return new Response(
      JSON.stringify({ checked: (rules || []).length, executed, skipped }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("run-scheduled-automation-rules error:", error);
    return new Response(JSON.stringify({ error: { code: "internal_error", message: "Internal server error" } }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
}));
