import { createClient } from "https://esm.sh/@supabase/supabase-js@2.56.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-automation-secret",
};

type Rule = {
  id: string;
  tenant_id: string;
  name: string;
  trigger_config: { minutes_interval?: number } | null;
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    const automationSecret = Deno.env.get("AUTOMATION_CRON_SECRET") ?? "";

    const internalSecret = req.headers.get("x-automation-secret") ?? "";
    if (!automationSecret || internalSecret !== automationSecret) {
      return new Response(JSON.stringify({ error: "Forbidden" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey);

    const { data: rules, error: rulesError } = await supabase
      .from("automation_rules")
      .select("id, tenant_id, name, trigger_config")
      .eq("enabled", true)
      .eq("trigger_type", "schedule");

    if (rulesError) {
      throw rulesError;
    }

    const now = Date.now();
    let executed = 0;
    const skipped: string[] = [];

    for (const rule of (rules || []) as Rule[]) {
      const minutesInterval = Math.max(1, Number(rule.trigger_config?.minutes_interval ?? 60));

      const { data: lastRun } = await supabase
        .from("automation_rule_runs")
        .select("started_at")
        .eq("rule_id", rule.id)
        .order("started_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (lastRun?.started_at) {
        const elapsedMinutes = (now - new Date(lastRun.started_at).getTime()) / 60000;
        if (elapsedMinutes < minutesInterval) {
          skipped.push(`${rule.name}: not due (${elapsedMinutes.toFixed(1)}m < ${minutesInterval}m)`);
          continue;
        }
      }

      const response = await fetch(`${supabaseUrl}/functions/v1/run-automation-rule`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          apikey: serviceRoleKey,
          Authorization: `Bearer ${serviceRoleKey}`,
          "x-automation-secret": automationSecret,
        },
        body: JSON.stringify({
          ruleId: rule.id,
          dryRun: false,
          idempotencyKey: crypto.randomUUID(),
          sourcePayload: {
            source: "scheduled",
            tenant_id: rule.tenant_id,
            rule_name: rule.name,
          },
        }),
      });

      if (!response.ok) {
        const txt = await response.text();
        skipped.push(`${rule.name}: failed invoke (${response.status}) ${txt}`);
        continue;
      }

      executed += 1;
    }

    return new Response(
      JSON.stringify({ checked: (rules || []).length, executed, skipped }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown scheduler error";
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
