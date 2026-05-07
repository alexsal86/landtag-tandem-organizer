// Workflow Dispatcher – deterministische Workflow-Engine
// Liest aktive workflow_definitions zu einem Trigger, prüft Bedingungen
// und führt Aktionen aus. Erzeugt workflow_runs + workflow_action_log.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface DispatchBody {
  trigger_type: string;
  tenant_id: string;
  entity_id: string;
  payload: Record<string, unknown>;
  dry_run?: boolean;
  workflow_id?: string; // für manuelle Tests
}

interface Condition { field: string; op: string; value: unknown }
interface ActionDef { type: string; config: Record<string, unknown> }

function getField(obj: Record<string, unknown>, path: string): unknown {
  return path.split(".").reduce<unknown>((acc, key) => {
    if (acc && typeof acc === "object") return (acc as Record<string, unknown>)[key];
    return undefined;
  }, obj);
}

function evalCondition(c: Condition, payload: Record<string, unknown>): boolean {
  const v = getField(payload, c.field);
  switch (c.op) {
    case "eq": return v === c.value;
    case "neq": return v !== c.value;
    case "in": return Array.isArray(c.value) && (c.value as unknown[]).includes(v);
    case "contains": return typeof v === "string" && typeof c.value === "string" && v.toLowerCase().includes(c.value.toLowerCase());
    case "exists": return v !== null && v !== undefined && v !== "";
    case "missing": return v === null || v === undefined || v === "";
    case "gt": return typeof v === "number" && typeof c.value === "number" && v > c.value;
    case "lt": return typeof v === "number" && typeof c.value === "number" && v < c.value;
    default: return false;
  }
}

function renderTemplate(tpl: string, payload: Record<string, unknown>): string {
  return tpl.replace(/\{\{\s*([\w.]+)\s*\}\}/g, (_, k) => {
    const v = getField(payload, k);
    return v == null ? "" : String(v);
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const body = (await req.json()) as DispatchBody;
    if (!body.trigger_type || !body.tenant_id) {
      return new Response(JSON.stringify({ error: "missing trigger_type/tenant_id" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // 1) Passende Workflows holen
    let q = supabase.from("workflow_definitions")
      .select("id, name, conditions, actions, trigger_config")
      .eq("tenant_id", body.tenant_id)
      .eq("is_active", true)
      .eq("trigger_type", body.trigger_type);
    if (body.workflow_id) q = q.eq("id", body.workflow_id);

    const { data: defs, error: defErr } = await q;
    if (defErr) throw defErr;

    const results: Array<{ workflow_id: string; status: string; actions: number }> = [];

    for (const def of defs ?? []) {
      const conditions: Condition[] = Array.isArray(def.conditions) ? def.conditions as Condition[] : [];
      const allMatch = conditions.every((c) => evalCondition(c, body.payload ?? {}));

      // Run anlegen
      const { data: run, error: runErr } = await supabase
        .from("workflow_runs")
        .insert({
          workflow_id: def.id,
          tenant_id: body.tenant_id,
          trigger_type: body.trigger_type,
          trigger_payload: body.payload,
          status: allMatch ? "running" : "skipped",
          is_dry_run: !!body.dry_run,
        })
        .select("id").single();
      if (runErr) { console.error(runErr); continue; }

      if (!allMatch) {
        results.push({ workflow_id: def.id, status: "skipped", actions: 0 });
        await supabase.from("workflow_runs").update({
          status: "skipped", finished_at: new Date().toISOString(),
        }).eq("id", run.id);
        continue;
      }

      const actions: ActionDef[] = Array.isArray(def.actions) ? def.actions as ActionDef[] : [];
      let runFailed = false;

      for (let i = 0; i < actions.length; i++) {
        const a = actions[i];
        const logRow = {
          run_id: run.id,
          step_index: i,
          action_type: a.type,
          action_config: a.config ?? {},
          status: "pending" as string,
          result: null as unknown,
          error: null as string | null,
        };

        try {
          if (body.dry_run) {
            logRow.status = "dry_run";
            logRow.result = { note: "dry-run, no side effects" };
          } else {
            switch (a.type) {
              case "create_notification": {
                const cfg = a.config as { user_id?: string; title?: string; body?: string };
                const userId = cfg.user_id && cfg.user_id !== "trigger.owner_user_id"
                  ? cfg.user_id
                  : (body.payload?.owner_user_id as string | undefined);
                if (userId) {
                  await supabase.from("notifications").insert({
                    user_id: userId,
                    tenant_id: body.tenant_id,
                    title: renderTemplate(cfg.title ?? "Workflow", body.payload ?? {}),
                    body: renderTemplate(cfg.body ?? "", body.payload ?? {}),
                    type: "workflow",
                  });
                }
                logRow.status = "success";
                break;
              }
              case "set_case_priority": {
                const cfg = a.config as { priority?: string };
                if (body.entity_id && cfg.priority) {
                  await supabase.from("case_items")
                    .update({ priority: cfg.priority })
                    .eq("id", body.entity_id)
                    .eq("tenant_id", body.tenant_id);
                }
                logRow.status = "success";
                break;
              }
              case "assign_case_owner": {
                const cfg = a.config as { user_id?: string };
                if (body.entity_id && cfg.user_id) {
                  await supabase.from("case_items")
                    .update({ owner_user_id: cfg.user_id })
                    .eq("id", body.entity_id)
                    .eq("tenant_id", body.tenant_id);
                }
                logRow.status = "success";
                break;
              }
              case "create_task": {
                const cfg = a.config as { title?: string; assigned_to?: string; description?: string };
                await supabase.from("tasks").insert({
                  tenant_id: body.tenant_id,
                  title: renderTemplate(cfg.title ?? "Workflow-Task", body.payload ?? {}),
                  description: renderTemplate(cfg.description ?? "", body.payload ?? {}),
                  assigned_to: cfg.assigned_to ?? null,
                  status: "open",
                });
                logRow.status = "success";
                break;
              }
              case "webhook": {
                const cfg = a.config as { url?: string; payload_template?: string };
                if (cfg.url) {
                  const res = await fetch(cfg.url, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: cfg.payload_template
                      ? renderTemplate(cfg.payload_template, body.payload ?? {})
                      : JSON.stringify(body.payload ?? {}),
                  });
                  logRow.result = { status: res.status };
                  logRow.status = res.ok ? "success" : "failed";
                  if (!res.ok) runFailed = true;
                }
                break;
              }
              default:
                logRow.status = "skipped";
                logRow.error = `Unbekannter Aktionstyp: ${a.type}`;
            }
          }
        } catch (e) {
          logRow.status = "failed";
          logRow.error = (e as Error).message;
          runFailed = true;
        }

        await supabase.from("workflow_action_log").insert(logRow);
        if (runFailed && !body.dry_run) break;
      }

      await supabase.from("workflow_runs").update({
        status: runFailed ? "failed" : "success",
        finished_at: new Date().toISOString(),
      }).eq("id", run.id);

      results.push({
        workflow_id: def.id,
        status: runFailed ? "failed" : "success",
        actions: actions.length,
      });
    }

    return new Response(JSON.stringify({ ok: true, results }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("workflow-dispatcher error", e);
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
