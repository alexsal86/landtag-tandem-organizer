import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.56.1";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-webhook-secret",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: CORS_HEADERS });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  const automationSecret = Deno.env.get("AUTOMATION_CRON_SECRET") ?? "";
  const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);

  try {
    const url = new URL(req.url);
    const ruleId = url.searchParams.get("ruleId");

    if (!ruleId) {
      return new Response(JSON.stringify({ error: "ruleId query parameter is required" }), {
        status: 400,
        headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
      });
    }

    // Load the rule
    const { data: rule, error: ruleError } = await supabaseAdmin
      .from("automation_rules")
      .select("id, tenant_id, name, trigger_type, trigger_config, enabled")
      .eq("id", ruleId)
      .maybeSingle();

    if (ruleError || !rule) {
      return new Response(JSON.stringify({ error: "Rule not found" }), {
        status: 404,
        headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
      });
    }

    if (rule.trigger_type !== "webhook") {
      return new Response(JSON.stringify({ error: "Rule is not a webhook trigger" }), {
        status: 400,
        headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
      });
    }

    if (!rule.enabled) {
      return new Response(JSON.stringify({ error: "Rule is disabled" }), {
        status: 400,
        headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
      });
    }

    // Verify webhook secret if configured on the rule
    const expectedSecret = rule.trigger_config?.webhook_secret;
    if (expectedSecret) {
      const providedSecret = req.headers.get("x-webhook-secret") ?? url.searchParams.get("secret");
      if (providedSecret !== expectedSecret) {
        return new Response(JSON.stringify({ error: "Invalid webhook secret" }), {
          status: 403,
          headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
        });
      }
    }

    // Kill-Switch check
    const { data: tenantRow } = await supabaseAdmin
      .from("tenants")
      .select("automations_paused")
      .eq("id", rule.tenant_id)
      .maybeSingle();

    if (tenantRow?.automations_paused) {
      return new Response(JSON.stringify({ error: "Automations are paused for this tenant" }), {
        status: 400,
        headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
      });
    }

    // Parse webhook body as sourcePayload
    let sourcePayload: Record<string, unknown> = {};
    try {
      if (req.method === "POST") {
        sourcePayload = await req.json();
      }
    } catch {
      // No body or invalid JSON — continue with empty payload
    }

    // Forward to run-automation-rule via internal call
    const idempotencyKey = crypto.randomUUID();
    const runResponse = await fetch(`${supabaseUrl}/functions/v1/run-automation-rule`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-automation-secret": automationSecret,
      },
      body: JSON.stringify({
        ruleId: rule.id,
        dryRun: false,
        idempotencyKey,
        sourcePayload: {
          ...sourcePayload,
          trigger_source: "webhook",
          rule_name: rule.name,
          module: rule.trigger_config?.module ?? "",
        },
      }),
    });

    const result = await runResponse.json();

    return new Response(JSON.stringify(result), {
      status: runResponse.status,
      headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown webhook error";
    console.error("automation-webhook error:", message);
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
    });
  }
});
