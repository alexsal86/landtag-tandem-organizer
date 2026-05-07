// Public endpoint: submit/update a guest's poll responses using their token.
// Replaces the previous anon RLS write on poll_responses.

import { z } from "https://esm.sh/zod@3.23.8";
import { createServiceRoleClient } from "../_shared/supabase.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

const ResponseSchema = z.object({
  time_slot_id: z.string().uuid(),
  status: z.enum(["available", "tentative", "unavailable"]),
  comment: z.string().max(1000).optional().nullable(),
});

const BodySchema = z.object({
  poll_id: z.string().uuid(),
  token: z.string().min(8).max(256),
  responses: z.array(ResponseSchema).max(100),
  general_comment: z.string().max(2000).optional().nullable(),
});

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  try {
    const parsed = BodySchema.safeParse(await req.json().catch(() => ({})));
    if (!parsed.success) {
      return json({ error: "invalid_input", details: parsed.error.flatten() }, 400);
    }
    const { poll_id, token, responses, general_comment } = parsed.data;

    const supabase = createServiceRoleClient();

    const { data: participant, error: pErr } = await supabase
      .from("poll_participants")
      .select("id, poll_id")
      .eq("poll_id", poll_id)
      .eq("token", token)
      .maybeSingle();

    if (pErr) throw pErr;
    if (!participant) return json({ error: "invalid_token" }, 404);

    // Validate poll is open.
    const { data: poll, error: pollErr } = await supabase
      .from("appointment_polls")
      .select("id, status, deadline")
      .eq("id", poll_id)
      .maybeSingle();
    if (pollErr) throw pollErr;
    if (!poll) return json({ error: "poll_not_found" }, 404);
    if (poll.status === "closed" || poll.status === "archived") {
      return json({ error: "poll_closed" }, 409);
    }
    if (poll.deadline && new Date(poll.deadline).getTime() < Date.now()) {
      return json({ error: "poll_expired" }, 409);
    }

    // Validate slot ids belong to poll (defense in depth).
    if (responses.length > 0) {
      const slotIds = [...new Set(responses.map((r) => r.time_slot_id))];
      const { data: slots, error: sErr } = await supabase
        .from("poll_time_slots")
        .select("id")
        .eq("poll_id", poll_id)
        .in("id", slotIds);
      if (sErr) throw sErr;
      if ((slots?.length ?? 0) !== slotIds.length) {
        return json({ error: "invalid_slot" }, 400);
      }
    }

    // Replace existing responses for this participant.
    const { error: delErr } = await supabase
      .from("poll_responses")
      .delete()
      .eq("poll_id", poll_id)
      .eq("participant_id", participant.id);
    if (delErr) throw delErr;

    if (responses.length > 0) {
      const rows = responses.map((r) => ({
        poll_id,
        participant_id: participant.id,
        time_slot_id: r.time_slot_id,
        status: r.status,
        comment: r.comment ?? null,
      }));
      const { error: insErr } = await supabase.from("poll_responses").insert(rows);
      if (insErr) throw insErr;
    }

    if (general_comment !== undefined) {
      // best effort — column may not exist on all schemas
      await supabase
        .from("poll_participants")
        .update({ general_comment })
        .eq("id", participant.id)
        .then(() => {}, () => {});
    }

    return json({ ok: true, saved: responses.length });
  } catch (err) {
    console.error("submit-poll-response-by-token error", err);
    return json({ error: "server_error" }, 500);
  }
});
