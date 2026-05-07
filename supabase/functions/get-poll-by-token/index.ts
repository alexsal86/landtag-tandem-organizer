// Public endpoint: load a poll for a guest using a per-participant token.
// Replaces the previous anon RLS read on poll_participants/poll_responses.
// No JWT required — token check authorizes the caller.

import { createServiceRoleClient } from "../_shared/supabase.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    let pollId: string | null = null;
    let token: string | null = null;

    if (req.method === "GET") {
      const url = new URL(req.url);
      pollId = url.searchParams.get("poll_id");
      token = url.searchParams.get("token");
    } else if (req.method === "POST") {
      const body = await req.json().catch(() => ({}));
      pollId = typeof body.poll_id === "string" ? body.poll_id : null;
      token = typeof body.token === "string" ? body.token : null;
    } else {
      return json({ error: "Method not allowed" }, 405);
    }

    if (!pollId || !token || token.length < 8) {
      return json({ error: "poll_id and token required" }, 400);
    }

    const supabase = createServiceRoleClient();

    const { data: participant, error: pErr } = await supabase
      .from("poll_participants")
      .select("id, name, email, is_external, poll_id")
      .eq("poll_id", pollId)
      .eq("token", token)
      .maybeSingle();

    if (pErr) throw pErr;
    if (!participant) return json({ error: "invalid_token" }, 404);

    const [{ data: poll, error: pollErr }, { data: slots, error: slotErr }, { data: responses, error: respErr }] =
      await Promise.all([
        supabase
          .from("appointment_polls")
          .select("id, title, description, deadline, status")
          .eq("id", pollId)
          .maybeSingle(),
        supabase
          .from("poll_time_slots")
          .select("id, start_time, end_time, order_index")
          .eq("poll_id", pollId)
          .order("order_index"),
        supabase
          .from("poll_responses")
          .select("id, time_slot_id, status, comment")
          .eq("poll_id", pollId)
          .eq("participant_id", participant.id),
      ]);

    if (pollErr) throw pollErr;
    if (slotErr) throw slotErr;
    if (respErr) throw respErr;
    if (!poll) return json({ error: "poll_not_found" }, 404);

    return json({
      poll,
      participant: {
        id: participant.id,
        name: participant.name,
        email: participant.email,
        is_external: participant.is_external,
      },
      time_slots: slots ?? [],
      responses: responses ?? [],
    });
  } catch (err) {
    console.error("get-poll-by-token error", err);
    return json({ error: "server_error" }, 500);
  }
});
