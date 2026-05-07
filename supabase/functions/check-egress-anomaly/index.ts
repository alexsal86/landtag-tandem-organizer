// Erkennt Anomalien (>50% Wachstum gegenüber 7-Tage-Mittelwert) und legt Einträge in egress_anomalies an.
// Bei "critical" wird zusätzlich eine Notification an alle Superadmins gesendet.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const WARN_PCT = 50;
const CRIT_PCT = 150;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // Letzte 8 Tage laden (heute + 7 Vergleichstage)
    const { data: history, error } = await supabase
      .from("egress_metrics")
      .select("metric_date, table_sizes, db_size_bytes")
      .order("metric_date", { ascending: false })
      .limit(8);
    if (error) throw error;
    if (!history || history.length < 2) {
      return new Response(JSON.stringify({ success: true, anomalies: 0, reason: "Not enough history" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const today = history[0];
    const baseline = history.slice(1);

    // Map: table -> avg bytes (Baseline)
    const baselineMap = new Map<string, number[]>();
    for (const day of baseline) {
      if (!Array.isArray(day.table_sizes)) continue;
      for (const t of day.table_sizes as Array<{ table_name: string; total_bytes: number }>) {
        if (!baselineMap.has(t.table_name)) baselineMap.set(t.table_name, []);
        baselineMap.get(t.table_name)!.push(Number(t.total_bytes ?? 0));
      }
    }

    const anomalies: Array<{
      anomaly_type: string;
      table_name: string;
      baseline_value: number;
      current_value: number;
      delta_pct: number;
      severity: "warning" | "critical";
      message: string;
    }> = [];

    for (const t of (today.table_sizes ?? []) as Array<{ table_name: string; total_bytes: number }>) {
      const samples = baselineMap.get(t.table_name) ?? [];
      if (samples.length === 0) continue;
      const avg = samples.reduce((a, b) => a + b, 0) / samples.length;
      if (avg <= 0) continue;
      const current = Number(t.total_bytes ?? 0);
      const pct = ((current - avg) / avg) * 100;
      if (pct >= WARN_PCT) {
        const severity = pct >= CRIT_PCT ? "critical" : "warning";
        anomalies.push({
          anomaly_type: "table_growth_spike",
          table_name: t.table_name,
          baseline_value: avg,
          current_value: current,
          delta_pct: pct,
          severity,
          message: `Tabelle ${t.table_name} ist gegenüber 7-Tage-Schnitt um ${pct.toFixed(1)}% gewachsen.`,
        });
      }
    }

    let inserted = 0;
    if (anomalies.length > 0) {
      const { error: insErr } = await supabase
        .from("egress_anomalies")
        .insert(anomalies.map((a) => ({ ...a, metric_date: today.metric_date })));
      if (!insErr) inserted = anomalies.length;
      else console.error("anomaly insert", insErr);

      // Notifications an alle Superadmins für critical
      const critical = anomalies.filter((a) => a.severity === "critical");
      if (critical.length > 0) {
        const { data: admins } = await supabase
          .from("user_roles")
          .select("user_id")
          .eq("role", "superadmin");
        for (const admin of admins ?? []) {
          for (const a of critical) {
            await supabase.rpc("create_notification", {
              user_id_param: admin.user_id,
              type_name: "system",
              title_param: "Egress-Anomalie erkannt",
              message_param: a.message,
              data_param: { table: a.table_name, delta_pct: a.delta_pct, link: "/administration?adminSection=security&adminSubSection=performance" },
              priority_param: "high",
            }).catch((e: unknown) => console.error("notif", e));
          }
        }
      }
    }

    return new Response(
      JSON.stringify({ success: true, anomalies: inserted, checked_tables: today.table_sizes?.length ?? 0 }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    console.error("check-egress-anomaly error:", message);
    return new Response(JSON.stringify({ success: false, error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
