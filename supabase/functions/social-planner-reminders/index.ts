import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceKey);

    const now = new Date();
    const in24h = new Date(now.getTime() + 24 * 60 * 60 * 1000);

    // Find scheduled posts going live within next 24h, with responsible user, no reminder yet, not yet published
    const { data: items, error } = await supabase
      .from("social_content_items")
      .select(`
        id,
        tenant_id,
        responsible_user_id,
        scheduled_for,
        published_at,
        reminder_sent_at,
        topic_backlog:topic_backlog_id(topic)
      `)
      .gte("scheduled_for", now.toISOString())
      .lte("scheduled_for", in24h.toISOString())
      .is("reminder_sent_at", null)
      .is("published_at", null)
      .not("responsible_user_id", "is", null);

    if (error) {
      console.error("Failed to query social_content_items:", error);
      throw error;
    }

    let sent = 0;
    let failed = 0;

    for (const row of items || []) {
      const item = row as {
        id: string;
        tenant_id: string;
        responsible_user_id: string;
        scheduled_for: string;
        topic_backlog: { topic: string } | null;
      };

      const topic = item.topic_backlog?.topic || "Beitrag";
      const dt = new Date(item.scheduled_for);
      const timeStr = dt.toLocaleString("de-DE", { dateStyle: "short", timeStyle: "short" });

      const { error: notifyErr } = await supabase.rpc("create_notification", {
        user_id_param: item.responsible_user_id,
        type_name: "social_post_reminder",
        title_param: "Social-Post geht bald live",
        message_param: `„${topic}" ist für ${timeStr} geplant. Letzter Check?`,
        data_param: { content_item_id: item.id, scheduled_for: item.scheduled_for },
        priority_param: "medium",
      });

      if (notifyErr) {
        console.error(`Notification failed for item ${item.id}:`, notifyErr);
        failed++;
        continue;
      }

      const { error: updErr } = await supabase
        .from("social_content_items")
        .update({ reminder_sent_at: now.toISOString() })
        .eq("id", item.id);

      if (updErr) {
        console.error(`Failed to mark reminder sent for ${item.id}:`, updErr);
        failed++;
      } else {
        sent++;
      }
    }

    console.log(`social-planner-reminders run: sent=${sent} failed=${failed} total=${items?.length || 0}`);

    return new Response(
      JSON.stringify({ success: true, sent, failed, total: items?.length || 0 }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (error) {
    console.error("social-planner-reminders error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "internal" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
