import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
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

serve(async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);

    const { article, recipientUserIds, senderName, personalMessage }: SendNewsMatrixRequest = await req.json();

    if (!article || !recipientUserIds || recipientUserIds.length === 0) {
      throw new Error("Missing required fields");
    }

    console.log(`📨 Sending news via Matrix to ${recipientUserIds.length} users`);

    let successCount = 0;
    let errorCount = 0;

    // Send to each recipient
    for (const userId of recipientUserIds) {
      try {
        // Get user's Matrix room
        const { data: profile } = await supabase
          .from("profiles")
          .select("matrix_room_id")
          .eq("user_id", userId)
          .single();

        if (!profile?.matrix_room_id) {
          console.log(`⚠️ User ${userId} has no Matrix room configured`);
          errorCount++;
          continue;
        }

        // Build formatted message
        const htmlMessage = `
          <h3>📰 News-Empfehlung von ${senderName}</h3>
          ${personalMessage ? `<blockquote><strong>💬 Persönliche Nachricht:</strong><br>${personalMessage.replace(/\n/g, '<br>')}</blockquote>` : ''}
          <div style="border-left: 3px solid #667eea; padding-left: 15px; margin: 15px 0;">
            <h4>${article.title}</h4>
            <p>${article.description}</p>
            <p style="font-size: 12px; color: #666;">Quelle: ${article.source}</p>
            <a href="${article.link}" target="_blank">→ Artikel lesen</a>
          </div>
        `;

        const plainMessage = `
📰 News-Empfehlung von ${senderName}

${personalMessage ? `💬 ${personalMessage}\n\n` : ''}
${article.title}

${article.description}

Quelle: ${article.source}
→ ${article.link}
        `.trim();

        // Get Matrix credentials
        const matrixBaseUrl = Deno.env.get("MATRIX_BASE_URL");
        const matrixAccessToken = Deno.env.get("MATRIX_ACCESS_TOKEN");

        if (!matrixBaseUrl || !matrixAccessToken) {
          console.error("❌ Matrix credentials not configured");
          errorCount++;
          continue;
        }

        // Send message via Matrix API
        const response = await fetch(
          `${matrixBaseUrl}/_matrix/client/r0/rooms/${profile.matrix_room_id}/send/m.room.message`,
          {
            method: "POST",
            headers: {
              "Authorization": `Bearer ${matrixAccessToken}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              msgtype: "m.text",
              body: plainMessage,
              format: "org.matrix.custom.html",
              formatted_body: htmlMessage,
            }),
          }
        );

        if (!response.ok) {
          const error = await response.text();
          console.error(`❌ Matrix API error for user ${userId}:`, response.status, error);
          errorCount++;
        } else {
          successCount++;
          console.log(`✅ Sent Matrix message to user ${userId}`);
        }
      } catch (error) {
        console.error(`❌ Error sending to user ${userId}:`, error);
        errorCount++;
      }
    }

    console.log(`📊 Matrix news results: ${successCount} sent, ${errorCount} failed`);

    return new Response(
      JSON.stringify({ success: true, sent: successCount, failed: errorCount }),
      {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  } catch (error: any) {
    console.error("❌ Error in send-news-matrix function:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  }
});
