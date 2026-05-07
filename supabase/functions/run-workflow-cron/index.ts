// Workflow Cron Worker
// Findet aktive workflow_definitions mit trigger_type='schedule_cron',
// prüft cron_expression gegen "jetzt" und delegiert an workflow-dispatcher.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Minimaler 5-Feld Cron-Matcher (m h dom mon dow). Stützt: *, */n, n, n,m, n-m
function matchField(expr: string, value: number, min: number, max: number): boolean {
  return expr.split(",").some((part) => {
    let step = 1;
    let range = part;
    if (part.includes("/")) {
      const [r, s] = part.split("/");
      range = r || "*";
      step = parseInt(s, 10) || 1;
    }
    let from = min, to = max;
    if (range !== "*") {
      if (range.includes("-")) {
        const [a, b] = range.split("-").map((n) => parseInt(n, 10));
        from = a; to = b;
      } else {
        from = to = parseInt(range, 10);
      }
    }
    if (Number.isNaN(from) || Number.isNaN(to)) return false;
    if (value < from || value > to) return false;
    return ((value - from) % step) === 0;
  });
}

function cronMatches(expr: string, d: Date): boolean {
  const parts = expr.trim().split(/\s+/);
  if (parts.length !== 5) return false;
  const [m, h, dom, mon, dow] = parts;
  return (
    matchField(m, d.getUTCMinutes(), 0, 59) &&
    matchField(h, d.getUTCHours(), 0, 23) &&
    matchField(dom, d.getUTCDate(), 1, 31) &&
    matchField(mon, d.getUTCMonth() + 1, 1, 12) &&
    matchField(dow, d.getUTCDay(), 0, 6)
  );
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  const now = new Date();
  // Auf volle Minute runden
  now.setUTCSeconds(0, 0);

  const { data: defs, error } = await supabase
    .from("workflow_definitions")
    .select("id, tenant_id, name, cron_expression, last_triggered_at")
    .eq("is_active", true)
    .eq("trigger_type", "schedule_cron")
    .not("cron_expression", "is", null);

  if (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const dispatched: Array<{ id: string; status: number }> = [];
  const dispatcherUrl = `${Deno.env.get("SUPABASE_URL")}/functions/v1/workflow-dispatcher`;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

  for (const def of defs ?? []) {
    if (!def.cron_expression || !cronMatches(def.cron_expression, now)) continue;

    // Doppelausführung in derselben Minute vermeiden
    if (def.last_triggered_at) {
      const last = new Date(def.last_triggered_at);
      last.setUTCSeconds(0, 0);
      if (last.getTime() === now.getTime()) continue;
    }

    const res = await fetch(dispatcherUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${serviceKey}`,
        apikey: serviceKey,
      },
      body: JSON.stringify({
        trigger_type: "schedule_cron",
        tenant_id: def.tenant_id,
        entity_id: def.id,
        payload: { triggered_at: now.toISOString(), workflow_name: def.name },
        workflow_id: def.id,
      }),
    });

    await supabase.from("workflow_definitions")
      .update({ last_triggered_at: now.toISOString() })
      .eq("id", def.id);

    dispatched.push({ id: def.id, status: res.status });
  }

  return new Response(JSON.stringify({ checked: defs?.length ?? 0, dispatched }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
