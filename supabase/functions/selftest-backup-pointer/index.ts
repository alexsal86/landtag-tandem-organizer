// Edge Function: selftest-backup-pointer
// Schreibt täglich einen Statusbericht in public.system_health.
// Kann Supabase Management API aufrufen, falls SUPABASE_MGMT_TOKEN gesetzt ist;
// sonst macht der Selftest einen DB-Lebendcheck und markiert das Backup als "unverified".
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const url = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const projectRef = Deno.env.get("SUPABASE_PROJECT_REF") ?? "wawofclbehbkebjivdte";
  const mgmtToken = Deno.env.get("SUPABASE_MGMT_TOKEN");
  const admin = createClient(url, serviceKey);

  let status: "ok" | "warning" | "critical" = "ok";
  let details: Record<string, unknown> = {};

  try {
    if (mgmtToken) {
      const resp = await fetch(`https://api.supabase.com/v1/projects/${projectRef}/database/backups`, {
        headers: { Authorization: `Bearer ${mgmtToken}` },
      });
      if (!resp.ok) {
        status = "warning";
        details = { source: "mgmt_api", http: resp.status };
      } else {
        const json = await resp.json();
        const backups: Array<{ inserted_at?: string; status?: string }> = json?.backups ?? [];
        const latest = backups
          .filter((b) => b.status === "COMPLETED")
          .sort((a, b) => (b.inserted_at ?? "").localeCompare(a.inserted_at ?? ""))[0];
        if (!latest?.inserted_at) {
          status = "critical";
          details = { source: "mgmt_api", reason: "no completed backup" };
        } else {
          const ageMs = Date.now() - new Date(latest.inserted_at).getTime();
          const ageH = ageMs / 36e5;
          details = { source: "mgmt_api", latest: latest.inserted_at, age_hours: Number(ageH.toFixed(1)) };
          status = ageH <= 26 ? "ok" : ageH <= 48 ? "warning" : "critical";
        }
      }
    } else {
      // Fallback: nur DB-Lebendcheck
      const { error } = await admin.from("tenants").select("id", { head: true, count: "exact" }).limit(1);
      status = error ? "critical" : "warning";
      details = { source: "fallback", note: "SUPABASE_MGMT_TOKEN nicht gesetzt — Backup-Status nicht geprüft." };
    }
  } catch (e) {
    status = "critical";
    details = { error: e instanceof Error ? e.message : String(e) };
  }

  await admin.from("system_health").insert({
    check_name: "backup_pointer",
    status,
    details,
  });

  // Bei critical: Superadmins benachrichtigen
  if (status === "critical") {
    const { data: admins } = await admin.from("user_roles").select("user_id").eq("role", "abgeordneter");
    for (const a of admins ?? []) {
      await admin.rpc("create_notification", {
        user_id_param: a.user_id,
        type_name: "system_alert",
        title_param: "Backup-Selbsttest fehlgeschlagen",
        message_param: "Es wurde kein aktuelles Backup (≤ 24 h) gefunden.",
        priority_param: "high",
      });
    }
  }

  return new Response(JSON.stringify({ status, details }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
