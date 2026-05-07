import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.52.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface PushPayload {
  user_id: string;
  title: string;
  message: string;
  data?: Record<string, unknown>;
  priority?: "high" | "normal" | "low";
}

interface ExpoTicket {
  status: "ok" | "error";
  id?: string;
  message?: string;
  details?: { error?: string };
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const url = Deno.env.get("SUPABASE_URL")!;
    const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const sb = createClient(url, key);

    const body = (await req.json()) as PushPayload;
    if (!body.user_id || !body.title || !body.message) {
      return new Response(JSON.stringify({ error: "user_id, title, message required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: tokens, error: tErr } = await sb
      .from("mobile_push_tokens")
      .select("token, platform, id")
      .eq("user_id", body.user_id)
      .eq("is_active", true);

    if (tErr) throw tErr;
    if (!tokens || tokens.length === 0) {
      return new Response(JSON.stringify({ sent: 0, reason: "no_tokens" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    type TokenRow = { token: string; platform: string; id: string };
    const messages = (tokens as TokenRow[]).map((t) => ({
      to: t.token,
      sound: "default",
      title: body.title,
      body: body.message,
      data: body.data ?? {},
      priority: body.priority ?? "high",
    }));

    const resp = await fetch("https://exp.host/--/api/v2/push/send", {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Accept-Encoding": "gzip, deflate",
        "Content-Type": "application/json",
      },
      body: JSON.stringify(messages),
    });

    const json = (await resp.json()) as { data?: ExpoTicket[]; errors?: unknown };
    const tickets = json.data ?? [];

    // Deactivate tokens that Expo reports as invalid
    const tokenList = tokens as TokenRow[];
    const toDeactivate: string[] = [];
    tickets.forEach((tk, idx) => {
      if (tk.status === "error" && (tk.details?.error === "DeviceNotRegistered" || tk.message?.includes("not a registered"))) {
        const tok = tokenList[idx];
        if (tok) toDeactivate.push(tok.id);
      }
    });
    if (toDeactivate.length > 0) {
      await sb.from("mobile_push_tokens").update({ is_active: false }).in("id", toDeactivate);
    }

    return new Response(JSON.stringify({ sent: tickets.length, tickets, deactivated: toDeactivate.length }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("dispatch-mobile-push error", e);
    const msg = e instanceof Error ? e.message : String(e);
    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
