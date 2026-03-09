import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface NewsArticle {
  title: string;
  description: string;
  link: string;
  source: string;
}

interface SendNewsMatrixRequest {
  article: NewsArticle;
  recipientUserIds: string[];
  senderName: string;
  personalMessage?: string;
}

interface RoomSendResult {
  room_id: string;
  success: boolean;
  error?: string;
}

interface RecipientSendResult {
  user_id: string;
  rooms_sent: string[];
  rooms_failed: RoomSendResult[];
}

async function isMatrixEnabledForUser(
  supabase: ReturnType<typeof createClient>,
  userId: string,
): Promise<boolean> {
  const { data, error } = await supabase
    .from("user_notification_settings")
    .select("matrix_enabled, is_enabled")
    .eq("user_id", userId);

  if (error) {
    console.error(
      `❌ Could not load matrix_enabled for user ${userId}:`,
      error,
    );
    return false;
  }

  return (data ?? []).some(
    (row) => row.matrix_enabled === true && row.is_enabled !== false,
  );
}

async function logMatrixSkip(
  supabase: ReturnType<typeof createClient>,
  userId: string,
  roomId: string | null,
  message: string,
) {
  const { error } = await supabase.from("matrix_bot_logs").insert([{
    event_type: "news_message_skipped",
    user_id: userId,
    room_id: roomId,
    message_content: message,
    status: "skipped",
    error_message: "Skipped: matrix notifications disabled by user setting",
    message_type: "news",
    sent_date: new Date().toISOString().split("T")[0],
    metadata: { reason: "matrix_enabled_false" },
  }]);

  if (error) {
    console.error(`❌ Could not write skip log for user ${userId}:`, error);
  }
}

serve(async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);

    const {
      article,
      recipientUserIds,
      senderName,
      personalMessage,
    }: SendNewsMatrixRequest = await req.json();

    if (!article || !recipientUserIds || recipientUserIds.length === 0) {
      throw new Error("Missing required fields");
    }

    console.log(
      `📨 Sending news via Matrix to ${recipientUserIds.length} users`,
    );

    const matrixBaseUrl = Deno.env.get("MATRIX_BASE_URL");
    const matrixAccessToken = Deno.env.get("MATRIX_ACCESS_TOKEN");

    if (!matrixBaseUrl || !matrixAccessToken) {
      throw new Error("Matrix credentials not configured");
    }

    let successCount = 0;
    let errorCount = 0;
    const recipientResults: RecipientSendResult[] = [];

    // Send to each recipient
    for (const userId of recipientUserIds) {
      try {
        const matrixEnabled = await isMatrixEnabledForUser(supabase, userId);
        if (!matrixEnabled) {
          console.log(
            `⏭️ Skipping news Matrix send for user ${userId} (matrix_enabled=false)`,
          );
          await logMatrixSkip(
            supabase,
            userId,
            null,
            personalMessage || article.title || "News share",
          );
          recipientResults.push({
            user_id: userId,
            rooms_sent: [],
            rooms_failed: [
              {
                room_id: "none",
                success: false,
                error: "Matrix notifications disabled by user setting",
              },
            ],
          });
          continue;
        }

        // Get user's active Matrix subscriptions.
        // Fachliche Entscheidung: Versand an alle aktiven Räume eines Users,
        // damit der User die Nachricht in jedem bewusst aktivierten Kanal erhält.
        const { data: subscriptions, error: subscriptionsError } =
          await supabase
            .from("matrix_subscriptions")
            .select("room_id")
            .eq("user_id", userId)
            .eq("is_active", true);

        if (subscriptionsError) {
          console.error(
            `❌ Could not load Matrix subscriptions for user ${userId}:`,
            subscriptionsError,
          );
          errorCount++;
          recipientResults.push({
            user_id: userId,
            rooms_sent: [],
            rooms_failed: [
              {
                room_id: "unknown",
                success: false,
                error: subscriptionsError.message,
              },
            ],
          });
          continue;
        }

        const roomIds = (subscriptions ?? [])
          .map((subscription) => subscription.room_id)
          .filter((roomId): roomId is string => Boolean(roomId));

        if (roomIds.length === 0) {
          console.log(`⚠️ User ${userId} has no active Matrix subscriptions`);
          errorCount++;
          recipientResults.push({
            user_id: userId,
            rooms_sent: [],
            rooms_failed: [
              {
                room_id: "none",
                success: false,
                error: "No active Matrix rooms",
              },
            ],
          });
          continue;
        }

        // Build formatted message
        const htmlMessage = `
          <h3>📰 News-Empfehlung von ${senderName}</h3>
          ${personalMessage ? `<blockquote><strong>💬 Persönliche Nachricht:</strong><br>${personalMessage.replace(/\n/g, "<br>")}</blockquote>` : ""}
          <div style="border-left: 3px solid #667eea; padding-left: 15px; margin: 15px 0;">
            <h4>${article.title}</h4>
            <p>${article.description}</p>
            <p style="font-size: 12px; color: #666;">Quelle: ${article.source}</p>
            <a href="${article.link}" target="_blank">→ Artikel lesen</a>
          </div>
        `;

        const plainMessage = `
📰 News-Empfehlung von ${senderName}

${personalMessage ? `💬 ${personalMessage}\n\n` : ""}
${article.title}

${article.description}

Quelle: ${article.source}
→ ${article.link}
        `.trim();

        const userResult: RecipientSendResult = {
          user_id: userId,
          rooms_sent: [],
          rooms_failed: [],
        };

        for (const roomId of roomIds) {
          const response = await fetch(
            `${matrixBaseUrl}/_matrix/client/r0/rooms/${roomId}/send/m.room.message`,
            {
              method: "POST",
              headers: {
                Authorization: `Bearer ${matrixAccessToken}`,
                "Content-Type": "application/json",
              },
              body: JSON.stringify({
                msgtype: "m.text",
                body: plainMessage,
                format: "org.matrix.custom.html",
                formatted_body: htmlMessage,
              }),
            },
          );

          if (!response.ok) {
            const error = await response.text();
            const errorMessage = `HTTP ${response.status}: ${error}`;
            console.error(
              `❌ Matrix API error for user ${userId} room ${roomId}:`,
              errorMessage,
            );
            errorCount++;
            userResult.rooms_failed.push({
              room_id: roomId,
              success: false,
              error: errorMessage,
            });
            continue;
          }

          successCount++;
          userResult.rooms_sent.push(roomId);
          console.log(
            `✅ Sent Matrix message to user ${userId} room ${roomId}`,
          );
        }

        recipientResults.push(userResult);
      } catch (error) {
        console.error(`❌ Error sending to user ${userId}:`, error);
        errorCount++;
        recipientResults.push({
          user_id: userId,
          rooms_sent: [],
          rooms_failed: [
            {
              room_id: "unknown",
              success: false,
              error: error instanceof Error ? error.message : String(error),
            },
          ],
        });
      }
    }

    console.log(
      `📊 Matrix news results: ${successCount} sent, ${errorCount} failed`,
    );

    const roomsSent = recipientResults.flatMap((result) => result.rooms_sent);
    const roomsFailed = recipientResults.flatMap(
      (result) => result.rooms_failed,
    );

    return new Response(
      JSON.stringify({
        success: true,
        sent: successCount,
        failed: errorCount,
        rooms_sent: roomsSent,
        rooms_failed: roomsFailed,
        recipients: recipientResults,
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      },
    );
  } catch (error: any) {
    console.error("❌ Error in send-news-matrix function:", error);
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  }
});
