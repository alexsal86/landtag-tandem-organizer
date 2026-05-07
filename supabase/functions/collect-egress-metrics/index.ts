// Sammelt tägliche Egress- und Datenbankgrößen-Metriken.
// Wird via pg_cron einmal täglich um 02:00 aufgerufen.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { requireServiceRole, forbiddenResponse } from "../_shared/security.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  if (!requireServiceRole(req)) return forbiddenResponse("Service role required");

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const today = new Date().toISOString().slice(0, 10);

    // Tabellen-Metriken sammeln
    const { data: tableSizes, error: tsErr } = await supabase.rpc("get_table_size_metrics");
    if (tsErr) throw tsErr;

    const { data: dbSize, error: dbErr } = await supabase.rpc("get_database_size");
    if (dbErr) throw dbErr;

    // Vortag laden für Wachstums-Vergleich
    const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
    const { data: prev } = await supabase
      .from("egress_metrics")
      .select("table_sizes")
      .eq("metric_date", yesterday)
      .maybeSingle();

    const prevMap = new Map<string, number>();
    if (prev?.table_sizes && Array.isArray(prev.table_sizes)) {
      for (const row of prev.table_sizes as Array<{ table_name: string; total_bytes: number }>) {
        prevMap.set(row.table_name, Number(row.total_bytes ?? 0));
      }
    }

    const growth = (tableSizes ?? [])
      .map((r: { table_name: string; total_bytes: number; row_count: number }) => {
        const prevBytes = prevMap.get(r.table_name) ?? 0;
        const delta = Number(r.total_bytes) - prevBytes;
        const deltaPct = prevBytes > 0 ? (delta / prevBytes) * 100 : null;
        return {
          table_name: r.table_name,
          total_bytes: Number(r.total_bytes),
          row_count: Number(r.row_count),
          delta_bytes: delta,
          delta_pct: deltaPct,
        };
      })
      .sort((a, b) => b.delta_bytes - a.delta_bytes)
      .slice(0, 15);

    // Upsert (eindeutig pro Tag)
    const { error: upsertErr } = await supabase
      .from("egress_metrics")
      .upsert(
        {
          metric_date: today,
          db_size_bytes: Number(dbSize),
          table_sizes: tableSizes ?? [],
          top_tables_by_growth: growth,
          collected_at: new Date().toISOString(),
        },
        { onConflict: "metric_date" },
      );
    if (upsertErr) throw upsertErr;

    return new Response(
      JSON.stringify({ success: true, date: today, tables: tableSizes?.length ?? 0 }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    console.error("collect-egress-metrics error:", message);
    return new Response(JSON.stringify({ success: false, error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
