// deno-lint-ignore-file
import { createClient, type SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

import { withSafeHandler } from "../_shared/security.ts";
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

console.log("Matrix bot handler initialized");

interface MatrixMessage {
  msgtype: string;
  body: string;
  format?: string;
  formatted_body?: string;
  decision_metadata?: {
    decision_id: string;
    participant_token: string;
    expires_at: string;
  };
}

interface DecisionMatrixMessage extends MatrixMessage {
  decision_metadata: {
    decision_id: string;
    participant_token: string;
    expires_at: string;
  };
}

interface WebsiteWidgetCallbackPayload {
  name: string;
  phone: string;
  preferredTime: string;
  concern: string;
}

interface WebsiteWidgetTestRequest {
  type: "website_widget_test" | "website_widget_callback_request";
  message?: string;
  conversation_id?: string;
  source?: string;
  captcha_token?: string;
  captcha_provider?: "turnstile" | "hcaptcha";
  callback_request?: WebsiteWidgetCallbackPayload;
}

interface MatrixSendRequestBody {
  test?: boolean;
  type?: string;
  title?: string;
  message?: string;
  data?: Record<string, unknown>;
  priority?: string;
  user_id?: string;
  room_id?: string;
  allow_broadcast?: boolean;
}

interface WidgetRateLimitResult {
  allowed: boolean;
  retryAfterSeconds: number;
}

interface MatrixLogPayload {
  event_type: string;
  user_id?: string | null;
  room_id?: string | null;
  message_content?: string | null;
  response_content?: string | null;
  status?: string;
  error_message?: string | null;
  message_type?: string | null;
  sent_date?: string | null;
  metadata?: Record<string, unknown>;
}

const WIDGET_RATE_LIMIT_WINDOW_SECONDS = Number(
  Deno.env.get("WIDGET_RATE_LIMIT_WINDOW_SECONDS") ?? 300,
);
const WIDGET_RATE_LIMIT_MAX_REQUESTS = Number(
  Deno.env.get("WIDGET_RATE_LIMIT_MAX_REQUESTS") ?? 5,
);

// deno-lint-ignore no-explicit-any
async function logMatrixEvent(
  supabaseAdmin: any,
  payload: MatrixLogPayload,
) {
  const { error } = await supabaseAdmin.from("matrix_bot_logs").insert({
    event_type: payload.event_type,
    user_id: payload.user_id ?? null,
    room_id: payload.room_id ?? null,
    message_content: payload.message_content ?? null,
    response_content: payload.response_content ?? null,
    status: payload.status ?? "success",
    error_message: payload.error_message ?? null,
    message_type: payload.message_type ?? null,
    sent_date: payload.sent_date ?? null,
    metadata: payload.metadata ?? {},
  });

  if (error) {
    console.error("❌ Failed to write matrix_bot_logs entry:", error);
  }
}

// deno-lint-ignore no-explicit-any
async function isMatrixEnabledForUser(
  supabaseAdmin: any,
  userId: string,
  cache: Map<string, boolean>,
) {
  if (cache.has(userId)) {
    return cache.get(userId) ?? false;
  }

  const { data, error } = await supabaseAdmin
    .from("user_notification_settings")
    .select("matrix_enabled, is_enabled")
    .eq("user_id", userId);

  if (error) {
    console.error(
      `❌ Failed to read matrix settings for user ${userId}:`,
      error,
    );
    cache.set(userId, false);
    return false;
  }

  const enabled = (data ?? []).some(
    (row: any) => row.matrix_enabled === true && row.is_enabled !== false,
  );
  cache.set(userId, enabled);
  return enabled;
}

// deno-lint-ignore no-explicit-any
async function resolveTargetedSubscriptions(
  supabaseAdmin: any,
  body: MatrixSendRequestBody,
) {
  if (!body.user_id && !body.allow_broadcast) {
    return {
      subscriptions: null,
      errorResponse: new Response(
        JSON.stringify({
          success: false,
          error:
            "user_id ist erforderlich, um unbeabsichtigten Broadcast zu verhindern",
        }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      ),
    };
  }

  let query = supabaseAdmin
    .from("matrix_subscriptions")
    .select("*")
    .eq("is_active", true);

  if (body.user_id) {
    query = query.eq("user_id", body.user_id);
  }

  if (body.room_id) {
    query = query.eq("room_id", body.room_id);
  }

  const { data: subscriptions, error } = await query;

  if (error) {
    return {
      subscriptions: null,
      errorResponse: new Response(
        JSON.stringify({
          success: false,
          error: "Database error: " + error.message,
        }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      ),
    };
  }

  return {
    subscriptions,
    errorResponse: null,
  };
}

Deno.serve(withSafeHandler("matrix-bot-handler", async (req) => {
  console.log("🤖 Matrix function called with method:", req.method);

  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Parse request body
    const body = (await req.json()) as MatrixSendRequestBody;
    console.log("📨 Matrix request body:", JSON.stringify(body, null, 2));

    // Get Matrix configuration from secrets
    const matrixToken = Deno.env.get("MATRIX_BOT_TOKEN");
    const matrixHomeserver =
      Deno.env.get("MATRIX_HOMESERVER_URL") || "https://matrix.org";

    // Initialize Supabase
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    );
    const matrixEnabledCache = new Map<string, boolean>();

    // Handle website widget test request
    if (
      body.type === "website_widget_test" ||
      body.type === "website_widget_callback_request"
    ) {
      return await handleWebsiteWidgetTest(
        body as WebsiteWidgetTestRequest,
        supabaseAdmin,
        matrixToken ?? "",
        matrixHomeserver,
        req,
      );
    }

    if (!matrixToken) {
      console.error("❌ Matrix bot token not configured");
      return new Response(
        JSON.stringify({
          success: false,
          error: "Matrix bot token not configured",
        }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    // Handle test requests - now sends REAL Matrix messages for testing
    if (body.test || body.type === "test") {
      console.log("🧪 Processing Matrix test request - sending REAL messages");

      try {
        const { subscriptions, errorResponse } =
          await resolveTargetedSubscriptions(supabaseAdmin, body);

        if (errorResponse) {
          return errorResponse;
        }

        console.log(
          `📋 Found ${subscriptions?.length || 0} Matrix subscriptions`,
        );

        if (!subscriptions || subscriptions.length === 0) {
          return new Response(
            JSON.stringify({
              success: false,
              sent: 0,
              failed: 0,
              total_subscriptions: 0,
              message: "Keine aktiven Matrix-Abonnements gefunden",
            }),
            {
              status: 200,
              headers: { ...corsHeaders, "Content-Type": "application/json" },
            },
          );
        }

        let sentCount = 0;
        let failedCount = 0;

        // Send REAL Matrix test messages
        for (const subscription of subscriptions) {
          try {
            const matrixEnabled = await isMatrixEnabledForUser(
              supabaseAdmin,
              subscription.user_id,
              matrixEnabledCache,
            );
            if (!matrixEnabled) {
              console.log(
                `⏭️ Skipping Matrix test for user ${subscription.user_id} (matrix_enabled=false)`,
              );
              await logMatrixEvent(supabaseAdmin, {
                event_type: "test_message_skipped",
                user_id: subscription.user_id,
                room_id: subscription.room_id,
                message_content: body.message || "Test message",
                status: "skipped",
                error_message:
                  "Skipped: matrix notifications disabled by user setting",
                message_type: "test",
                sent_date: new Date().toISOString().split("T")[0],
                metadata: { reason: "matrix_enabled_false" },
              });
              continue;
            }

            console.log(
              `🧪 Sending TEST Matrix message to room ${subscription.room_id}`,
            );

            const testMessage: MatrixMessage = {
              msgtype: "m.text",
              body:
                body.message ||
                "Dies ist eine Test-Nachricht aus der Matrix-Integration! 🤖",
              format: "org.matrix.custom.html",
              formatted_body: `<strong>🧪 ${body.title || "Matrix-Test"}</strong><br/>${body.message || "Dies ist eine Test-Nachricht aus der Matrix-Integration!"}`,
            };

            // Generate transaction ID
            const txnId = `test_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

            // Send message to Matrix room via API
            const matrixUrl = `${matrixHomeserver}/_matrix/client/r0/rooms/${subscription.room_id}/send/m.room.message/${txnId}`;

            console.log(`🔗 Matrix API URL: ${matrixUrl}`);
            console.log(`🔑 Using homeserver: ${matrixHomeserver}`);

            const response = await fetch(matrixUrl, {
              method: "PUT",
              headers: {
                Authorization: `Bearer ${matrixToken}`,
                "Content-Type": "application/json",
              },
              body: JSON.stringify(testMessage),
            });

            if (!response.ok) {
              const errorText = await response.text();
              console.error(
                `❌ Matrix API error for room ${subscription.room_id}:`,
                response.status,
                errorText,
              );
              failedCount++;

              await logMatrixEvent(supabaseAdmin, {
                event_type: "test_message_sent",
                user_id: subscription.user_id,
                room_id: subscription.room_id,
                message_content: testMessage.body,
                status: "failed",
                error_message: `HTTP ${response.status}: ${errorText}`,
              });
            } else {
              const result = await response.json();
              console.log(
                `✅ TEST Matrix message sent successfully to room ${subscription.room_id}:`,
                result,
              );
              sentCount++;

              await logMatrixEvent(supabaseAdmin, {
                event_type: "test_message_sent",
                user_id: subscription.user_id,
                room_id: subscription.room_id,
                message_content: testMessage.body,
                response_content: JSON.stringify({
                  event_id: result.event_id ?? null,
                }),
                status: "success",
                metadata: {
                  event_id: result.event_id ?? null,
                },
              });

              // Also create a database notification
              if (subscription.user_id) {
                await supabaseAdmin.from("notifications").insert({
                  user_id: subscription.user_id,
                  notification_type_id: "380fab61-2f1a-40d1-bed8-d34925544397",
                  title: "🧪 Matrix-Test erfolgreich!",
                  message:
                    "Test-Nachricht wurde erfolgreich an Matrix gesendet.",
                  data: {
                    test: true,
                    matrix_sent: true,
                    room_id: subscription.room_id,
                    event_id: result.event_id,
                    timestamp: new Date().toISOString(),
                  },
                  priority: "high",
                });
              }
            }
          } catch (sendError) {
            console.error(
              `❌ Failed to send TEST Matrix message to room ${subscription.room_id}:`,
              sendError,
            );
            failedCount++;

            await logMatrixEvent(supabaseAdmin, {
              event_type: "test_message_sent",
              user_id: subscription.user_id,
              room_id: subscription.room_id,
              message_content: body.message || "Test message",
              status: "failed",
              error_message:
                sendError instanceof Error
                  ? sendError.message
                  : String(sendError),
            });
          }
        }

        return new Response(
          JSON.stringify({
            success: sentCount > 0,
            sent: sentCount,
            failed: failedCount,
            total_subscriptions: subscriptions.length,
            message:
              sentCount > 0
                ? `✅ Matrix-Test erfolgreich! An ${sentCount} meiner Räume gesendet, ${failedCount} fehlgeschlagen.`
                : `❌ Matrix-Test fehlgeschlagen. ${failedCount} Nachrichten konnten nicht gesendet werden.`,
          }),
          {
            status: 200,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          },
        );
      } catch (dbError) {
        console.error("❌ Database connection error:", dbError);
        return new Response(
          JSON.stringify({
            success: false,
            error:
              "Database connection failed: " +
              (dbError instanceof Error ? dbError.message : String(dbError)),
          }),
          {
            status: 500,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          },
        );
      }
    }

    // Handle decision message sending
    if (body.type === "decision") {
      console.log("🗳️ Processing Matrix decision message request");
      return await sendDecisionMessages(
        body,
        supabaseAdmin,
        matrixToken,
        matrixHomeserver,
        matrixEnabledCache,
      );
    }

    // Handle real Matrix message sending
    console.log("📤 Processing real Matrix message request");

    const { subscriptions, errorResponse } = await resolveTargetedSubscriptions(
      supabaseAdmin,
      body,
    );

    if (errorResponse) {
      return errorResponse;
    }

    if (!subscriptions || subscriptions.length === 0) {
      return new Response(
        JSON.stringify({
          success: false,
          sent: 0,
          failed: 0,
          total_subscriptions: 0,
          message: "Keine aktiven Matrix-Abonnements gefunden",
        }),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    let sentCount = 0;
    let failedCount = 0;

    // Send messages to all subscribed Matrix rooms
    for (const subscription of subscriptions) {
      try {
        const matrixEnabled = await isMatrixEnabledForUser(
          supabaseAdmin,
          subscription.user_id,
          matrixEnabledCache,
        );
        if (!matrixEnabled) {
          console.log(
            `⏭️ Skipping Matrix send for user ${subscription.user_id} room ${subscription.room_id} (matrix_enabled=false)`,
          );
          await logMatrixEvent(supabaseAdmin, {
            event_type: "broadcast_message_skipped",
            user_id: subscription.user_id,
            room_id: subscription.room_id,
            message_content: body.message || null,
            status: "skipped",
            error_message:
              "Skipped: matrix notifications disabled by user setting",
            message_type: body.type ?? "notification",
            sent_date: new Date().toISOString().split("T")[0],
            metadata: { reason: "matrix_enabled_false" },
          });
          continue;
        }

        console.log(
          `📤 Sending Matrix message to room ${subscription.room_id} for user ${subscription.user_id}`,
        );

        const message: MatrixMessage = {
          msgtype: "m.text",
          body: body.message || "Test-Nachricht von Ihrem Bot",
          format: "org.matrix.custom.html",
          formatted_body: `<strong>${body.title || "Benachrichtigung"}</strong><br/>${body.message || "Test-Nachricht von Ihrem Bot"}`,
        };

        // Generate transaction ID
        const txnId = `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

        // Send message to Matrix room via API
        const matrixUrl = `${matrixHomeserver}/_matrix/client/r0/rooms/${subscription.room_id}/send/m.room.message/${txnId}`;

        console.log(`🔗 Matrix API URL: ${matrixUrl}`);

        const response = await fetch(matrixUrl, {
          method: "PUT",
          headers: {
            Authorization: `Bearer ${matrixToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(message),
        });

        if (!response.ok) {
          const errorText = await response.text();
          console.error(
            `❌ Matrix API error for room ${subscription.room_id}:`,
            response.status,
            errorText,
          );
          failedCount++;

          await logMatrixEvent(supabaseAdmin, {
            event_type: "broadcast_message_sent",
            user_id: subscription.user_id,
            room_id: subscription.room_id,
            message_content: message.body,
            status: "failed",
            error_message: `HTTP ${response.status}: ${errorText}`,
          });
        } else {
          const result = await response.json();
          console.log(
            `✅ Matrix message sent successfully to room ${subscription.room_id}:`,
            result,
          );
          sentCount++;

          await logMatrixEvent(supabaseAdmin, {
            event_type: "broadcast_message_sent",
            user_id: subscription.user_id,
            room_id: subscription.room_id,
            message_content: message.body,
            response_content: JSON.stringify({
              event_id: result.event_id ?? null,
            }),
            status: "success",
            metadata: {
              event_id: result.event_id ?? null,
            },
          });

          // Also create a database notification for consistency
          if (subscription.user_id) {
            await supabaseAdmin.from("notifications").insert({
              user_id: subscription.user_id,
              notification_type_id: "380fab61-2f1a-40d1-bed8-d34925544397",
              title: body.title || "Matrix-Nachricht gesendet 🤖",
              message: body.message || "Eine Matrix-Nachricht wurde gesendet.",
              data: {
                ...body.data,
                matrix_sent: true,
                room_id: subscription.room_id,
                event_id: result.event_id,
                timestamp: new Date().toISOString(),
              },
              priority: body.priority || "medium",
            });
          }
        }
      } catch (sendError) {
        console.error(
          `❌ Failed to send Matrix message to room ${subscription.room_id}:`,
          sendError,
        );
        failedCount++;

        await logMatrixEvent(supabaseAdmin, {
          event_type: "broadcast_message_sent",
          user_id: subscription.user_id,
          room_id: subscription.room_id,
          message_content: body.message || "Test message",
          status: "failed",
          error_message:
            sendError instanceof Error ? sendError.message : String(sendError),
        });
      }
    }

    const totalSubscriptions = subscriptions.length;
    console.log(
      `📊 Matrix results: ${sentCount} sent, ${failedCount} failed out of ${totalSubscriptions} total`,
    );

    return new Response(
      JSON.stringify({
        success: true,
        sent: sentCount,
        failed: failedCount,
        total_subscriptions: totalSubscriptions,
        message: `Matrix-Nachrichten versendet! An ${sentCount} meiner Räume gesendet, ${failedCount} fehlgeschlagen.`,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  } catch (error) {
    console.error("❌ Matrix function error:", error);
    return new Response(
      JSON.stringify({
        success: false,
        error:
          "Function error: " +
          (error instanceof Error ? error.message : String(error)),
        sent: 0,
        failed: 1,
        total_subscriptions: 0,
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }
}));

async function sendDecisionMessages(
  body: any,
  supabaseAdmin: any,
  matrixToken: string,
  matrixHomeserver: string,
  matrixEnabledCache: Map<string, boolean>,
) {
  try {
    console.log("🗳️ Sending decision messages via Matrix");

    const { decisionId, participantIds, decisionTitle, decisionDescription } =
      body;

    if (!decisionId || !participantIds || !Array.isArray(participantIds)) {
      return new Response(
        JSON.stringify({
          success: false,
          error: "Missing required fields: decisionId, participantIds",
        }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    let sentCount = 0;
    let failedCount = 0;
    const results = [];

    // Process each participant
    for (const participantId of participantIds) {
      try {
        console.log(
          `📤 Processing Matrix decision for participant: ${participantId}`,
        );

        const matrixEnabled = await isMatrixEnabledForUser(
          supabaseAdmin,
          participantId,
          matrixEnabledCache,
        );
        if (!matrixEnabled) {
          console.log(
            `⏭️ Skipping Matrix decision for user ${participantId} (matrix_enabled=false)`,
          );
          await logMatrixEvent(supabaseAdmin, {
            event_type: "decision_skipped",
            user_id: participantId,
            message_content: decisionTitle,
            status: "skipped",
            error_message:
              "Skipped: matrix notifications disabled by user setting",
            message_type: "decision",
            sent_date: new Date().toISOString().split("T")[0],
            metadata: {
              reason: "matrix_enabled_false",
              decision_id: decisionId,
            },
          });
          results.push({
            participantId,
            success: false,
            error: "Matrix disabled in user settings",
          });
          failedCount++;
          continue;
        }

        // Get participant token
        const { data: participant, error: participantError } =
          await supabaseAdmin
            .from("task_decision_participants")
            .select("id, token, user_id")
            .eq("decision_id", decisionId)
            .eq("user_id", participantId)
            .maybeSingle();

        if (participantError || !participant) {
          console.error("❌ Participant not found:", participantId);
          failedCount++;
          results.push({
            participantId,
            success: false,
            error: "Participant not found",
          });
          continue;
        }

        // Get user's Matrix subscriptions (all active rooms)
        const { data: matrixSubs, error: matrixError } = await supabaseAdmin
          .from("matrix_subscriptions")
          .select("room_id, user_id")
          .eq("user_id", participantId)
          .eq("is_active", true);

        if (matrixError || !matrixSubs || matrixSubs.length === 0) {
          console.log(
            `ℹ️ No Matrix subscription for user ${participantId}, skipping Matrix send`,
          );
          results.push({
            participantId,
            success: false,
            error: "No Matrix subscription",
          });
          failedCount++;
          continue;
        }

        // Create decision message with commands
        const token = participant.token;
        const expireDate = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

        const decisionMessage: DecisionMatrixMessage = {
          msgtype: "m.text",
          body:
            `🗳️ ENTSCHEIDUNGSANFRAGE: ${decisionTitle}\n\n` +
            `${decisionDescription || ""}\n\n` +
            `📋 Antwortmöglichkeiten:\n` +
            `✅ /decision-yes ${token}\n` +
            `❌ /decision-no ${token}\n` +
            `❓ /decision-question ${token} [Ihre Frage]\n` +
            `📊 /decision-status ${token}\n\n` +
            `⏰ Antworten bis: ${expireDate.toLocaleDateString("de-DE")}`,
          format: "org.matrix.custom.html",
          formatted_body:
            `<h3>🗳️ ENTSCHEIDUNGSANFRAGE: ${decisionTitle}</h3>` +
            `${decisionDescription ? `<p><em>${decisionDescription}</em></p>` : ""}` +
            `<h4>📋 Antwortmöglichkeiten:</h4>` +
            `<ul>` +
            `<li>✅ <code>/decision-yes ${token}</code></li>` +
            `<li>❌ <code>/decision-no ${token}</code></li>` +
            `<li>❓ <code>/decision-question ${token} [Ihre Frage]</code></li>` +
            `<li>📊 <code>/decision-status ${token}</code></li>` +
            `</ul>` +
            `<p><small>⏰ Antworten bis: ${expireDate.toLocaleDateString("de-DE")}</small></p>`,
          decision_metadata: {
            decision_id: decisionId,
            participant_token: token,
            expires_at: expireDate.toISOString(),
          },
        };

        // Send Matrix message to all rooms
        let sentToAnyRoom = false;
        const roomResults = [];

        for (const matrixSub of matrixSubs) {
          try {
            const txnId = `decision_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
            const matrixUrl = `${matrixHomeserver}/_matrix/client/r0/rooms/${matrixSub.room_id}/send/m.room.message/${txnId}`;

            console.log(
              `🔗 Sending decision to Matrix room: ${matrixSub.room_id}`,
            );

            const response = await fetch(matrixUrl, {
              method: "PUT",
              headers: {
                Authorization: `Bearer ${matrixToken}`,
                "Content-Type": "application/json",
              },
              body: JSON.stringify(decisionMessage),
            });

            if (!response.ok) {
              const errorText = await response.text();
              console.error(
                `❌ Matrix API error for room ${matrixSub.room_id}:`,
                response.status,
                errorText,
              );
              await logMatrixEvent(supabaseAdmin, {
                event_type: "decision_sent",
                room_id: matrixSub.room_id,
                user_id: participantId,
                message_content: decisionMessage.body,
                status: "failed",
                error_message: `HTTP ${response.status}: ${errorText}`,
                metadata: { status_code: response.status },
              });
              roomResults.push({
                roomId: matrixSub.room_id,
                success: false,
                error: `API error: ${response.status}`,
              });
              continue;
            }

            const result = await response.json();
            console.log(
              `✅ Decision message sent to room ${matrixSub.room_id}:`,
              result,
            );
            sentToAnyRoom = true;

            await logMatrixEvent(supabaseAdmin, {
              event_type: "decision_sent",
              room_id: matrixSub.room_id,
              user_id: participantId,
              message_content: decisionMessage.body,
              response_content: JSON.stringify({
                event_id: result.event_id ?? null,
              }),
              status: "success",
              metadata: { event_id: result.event_id ?? null },
            });

            // Track the Matrix message
            await supabaseAdmin.from("decision_matrix_messages").insert({
              decision_id: decisionId,
              participant_id: participant.id,
              matrix_room_id: matrixSub.room_id,
              matrix_event_id: result.event_id,
              sent_at: new Date().toISOString(),
            });

            roomResults.push({
              roomId: matrixSub.room_id,
              success: true,
              eventId: result.event_id,
            });
          } catch (roomError) {
            console.error(
              `❌ Error sending to room ${matrixSub.room_id}:`,
              roomError,
            );
            await logMatrixEvent(supabaseAdmin, {
              event_type: "decision_sent",
              room_id: matrixSub.room_id,
              user_id: participantId,
              message_content: decisionMessage.body,
              status: "failed",
              error_message:
                roomError instanceof Error
                  ? roomError.message
                  : "Unknown error",
            });
            roomResults.push({
              roomId: matrixSub.room_id,
              success: false,
              error:
                roomError instanceof Error
                  ? roomError.message
                  : "Unknown error",
            });
          }
        }

        if (sentToAnyRoom) {
          sentCount++;
          results.push({
            participantId,
            success: true,
            rooms_sent: roomResults.filter((r) => r.success).length,
            room_details: roomResults,
          });
        } else {
          failedCount++;
          results.push({
            participantId,
            success: false,
            error: "Failed to send to any Matrix room",
            room_details: roomResults,
          });
        }
      } catch (error) {
        console.error(
          `❌ Error sending Matrix decision to ${participantId}:`,
          error,
        );
        failedCount++;
        results.push({
          participantId,
          success: false,
          error: error instanceof Error ? error.message : "Unknown error",
        });
      }
    }

    console.log(
      `📊 Matrix decision results: ${sentCount} sent, ${failedCount} failed`,
    );

    return new Response(
      JSON.stringify({
        success: sentCount > 0,
        sent: sentCount,
        failed: failedCount,
        total_participants: participantIds.length,
        message: `Matrix-Entscheidungen versendet! ${sentCount} erfolgreich, ${failedCount} fehlgeschlagen.`,
        results: results,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  } catch (error) {
    console.error("❌ Error in sendDecisionMessages:", error);
    return new Response(
      JSON.stringify({
        success: false,
        error:
          "Error sending Matrix decisions: " +
          (error instanceof Error ? error.message : String(error)),
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }
}

async function resolveWidgetTaskContext(
  supabaseAdmin: any,
  configuredRoomId: string | null,
) {
  const configuredTenantId = Deno.env.get("MATRIX_WIDGET_TASK_TENANT_ID");
  const configuredUserId = Deno.env.get("MATRIX_WIDGET_TASK_USER_ID");

  if (configuredTenantId && configuredUserId) {
    return { tenant_id: configuredTenantId, user_id: configuredUserId };
  }

  let subscriptionQuery = supabaseAdmin
    .from("matrix_subscriptions")
    .select("tenant_id, user_id, room_id")
    .eq("is_active", true)
    .not("tenant_id", "is", null)
    .limit(1);

  if (configuredRoomId) {
    subscriptionQuery = subscriptionQuery.eq("room_id", configuredRoomId);
  }

  const { data: roomSubscription } = await subscriptionQuery.maybeSingle();

  if (roomSubscription?.tenant_id && roomSubscription?.user_id) {
    return {
      tenant_id: roomSubscription.tenant_id,
      user_id: roomSubscription.user_id,
    };
  }

  const { data: fallbackSubscription } = await supabaseAdmin
    .from("matrix_subscriptions")
    .select("tenant_id, user_id")
    .eq("is_active", true)
    .not("tenant_id", "is", null)
    .limit(1)
    .maybeSingle();

  if (fallbackSubscription?.tenant_id && fallbackSubscription?.user_id) {
    return {
      tenant_id: fallbackSubscription.tenant_id,
      user_id: fallbackSubscription.user_id,
    };
  }

  return null;
}

async function handleWebsiteWidgetTest(
  body: WebsiteWidgetTestRequest,
  supabaseAdmin: any,
  matrixToken: string,
  matrixHomeserver: string,
  req: Request,
) {
  const responseMessageId = crypto.randomUUID();
  const configuredRoomId = Deno.env.get("MATRIX_WIDGET_TEST_ROOM_ID");
  const isCallbackRequest = body.type === "website_widget_callback_request";
  const callbackRequest = body.callback_request;

  const fallbackMessage = isCallbackRequest
    ? "Die Rückrufanfrage konnte nicht vollständig verarbeitet werden."
    : "Die Nachricht wurde gespeichert, konnte aber nicht in den Matrix-Test-Raum gesendet werden.";

  const maskedCallbackMetadata =
    isCallbackRequest && callbackRequest
      ? {
          requester_name_masked: maskPersonName(callbackRequest.name),
          requester_phone_masked: maskPhoneNumber(callbackRequest.phone),
        }
      : {};

  const logAttempt = async (
    status: "success" | "failed",
    extra: {
      error_message?: string;
      room_id?: string | null;
      response_content?: string | null;
      metadata?: Record<string, unknown>;
      status_code?: number;
    },
  ) => {
    await logMatrixEvent(supabaseAdmin, {
      event_type: isCallbackRequest
        ? "website_widget_callback_request"
        : "website_widget_test",
      room_id: extra.room_id ?? configuredRoomId ?? null,
      message_content: isCallbackRequest
        ? "Callback request submitted via website widget"
        : (body.message ?? ""),
      response_content: extra.response_content ?? null,
      status,
      error_message: extra.error_message ?? null,
      metadata: {
        source: body.source ?? "unknown",
        conversation_id: body.conversation_id ?? null,
        status_code: extra.status_code ?? null,
        ...maskedCallbackMetadata,
        ...(extra.metadata ?? {}),
      },
    });
  };

  const requesterIp = getRequesterIp(req);
  const sessionId = getRequesterSession(body, req);

  const rateLimit = await enforceWidgetRateLimit(
    supabaseAdmin,
    body.type,
    requesterIp,
    sessionId,
  );

  if (!rateLimit.allowed) {
    await logAttempt("failed", {
      error_message: "Rate limit exceeded",
      status_code: 429,
      metadata: {
        requester_ip_masked: maskIpAddress(requesterIp),
        requester_session: maskRequesterSession(sessionId),
        retry_after_seconds: rateLimit.retryAfterSeconds,
      },
    });

    return new Response(
      JSON.stringify({
        success: false,
        event_id: null,
        room_id: configuredRoomId ?? null,
        task_id: null,
        fallback_message:
          "Anfrage konnte aktuell nicht verarbeitet werden. Bitte später erneut versuchen.",
      }),
      {
        status: 429,
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
          "Retry-After": String(rateLimit.retryAfterSeconds),
        },
      },
    );
  }

  const captchaResult = await verifyWidgetCaptcha(body, req);
  if (!captchaResult.verified) {
    await logAttempt("failed", {
      error_message: captchaResult.error,
      status_code: 400,
      metadata: {
        requester_ip_masked: maskIpAddress(requesterIp),
        requester_session: maskRequesterSession(sessionId),
        captcha_provider: body.captcha_provider ?? null,
      },
    });

    return new Response(
      JSON.stringify({
        success: false,
        event_id: null,
        room_id: configuredRoomId ?? null,
        task_id: null,
        fallback_message:
          "Anfrage konnte nicht bestätigt werden. Bitte erneut versuchen.",
      }),
      {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }

  if (isCallbackRequest) {
    const hasMissingFields =
      !callbackRequest?.name?.trim() ||
      !callbackRequest?.phone?.trim() ||
      !callbackRequest?.preferredTime?.trim() ||
      !callbackRequest?.concern?.trim();

    if (hasMissingFields) {
      await logAttempt("failed", {
        error_message: "Missing callback request fields",
        status_code: 400,
      });

      return new Response(
        JSON.stringify({
          success: false,
          message_id: responseMessageId,
          status: "invalid_request",
          message:
            "Bitte Name, Telefonnummer, Wunschzeit und Anliegen vollständig ausfüllen.",
        }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }
  }

  if (!matrixToken) {
    const errorText = "Matrix bot token not configured";
    await logAttempt("failed", { error_message: errorText, status_code: 500 });
    return new Response(
      JSON.stringify({
        success: false,
        message_id: responseMessageId,
        status: "not_configured",
        message: "Matrix-Zugang ist aktuell nicht konfiguriert.",
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }

  if (!configuredRoomId) {
    const errorText = "MATRIX_WIDGET_TEST_ROOM_ID not configured";
    await logAttempt("failed", { error_message: errorText, status_code: 500 });
    return new Response(
      JSON.stringify({
        success: false,
        message_id: responseMessageId,
        status: "not_configured",
        message: "Kein Matrix-Test-Raum konfiguriert.",
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }

  const callbackHeader = isCallbackRequest
    ? "📞 Rückruf-Anfrage aus Website-Widget"
    : "Website-Widget Test";
  const callbackBody = callbackRequest
    ? `Name: ${callbackRequest.name}
Telefon: ${callbackRequest.phone}
Wunschzeit: ${callbackRequest.preferredTime}
Anliegen: ${callbackRequest.concern}`
    : body.message || "Website-Widget Testnachricht";

  const payload: MatrixMessage = {
    msgtype: "m.text",
    body: `${callbackHeader}
${callbackBody}`,
    format: "org.matrix.custom.html",
    formatted_body: `<strong>${callbackHeader}</strong><br/>${callbackBody.replace(/\n/g, "<br/>")}`,
  };

  const txnId = `widget_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`;
  const matrixUrl = `${matrixHomeserver}/_matrix/client/r0/rooms/${configuredRoomId}/send/m.room.message/${txnId}`;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort("timeout"), 10000);

  try {
    const response = await fetch(matrixUrl, {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${matrixToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });

    if (!response.ok) {
      const errorText = await response.text();
      await logAttempt("failed", {
        error_message: `HTTP ${response.status}: ${errorText}`,
        room_id: configuredRoomId,
        status_code: response.status,
      });

      return new Response(
        JSON.stringify({
          success: false,
          message_id: responseMessageId,
          status: "delivery_failed",
          message: fallbackMessage,
        }),
        {
          status: 502,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    const result = await response.json();

    let createdTaskId: string | null = null;

    if (isCallbackRequest && callbackRequest) {
      const taskContext = await resolveWidgetTaskContext(
        supabaseAdmin,
        configuredRoomId,
      );

      if (!taskContext) {
        await logAttempt("failed", {
          error_message: "No tenant/user context found for callback request",
          room_id: configuredRoomId,
          status_code: 500,
          metadata: { event_id: result.event_id ?? null },
        });

        return new Response(
          JSON.stringify({
            success: false,
            message_id: responseMessageId,
            status: "processing_failed",
            message:
              "Rückrufwunsch wurde an Matrix gesendet, konnte aber keinem Organizer-Mandanten zugeordnet werden.",
          }),
          {
            status: 500,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          },
        );
      }

      const taskPayload = {
        title: `Rückruf anfordern: ${callbackRequest.name}`,
        description: [
          "Automatisch aus Matrix-Website-Widget erstellt.",
          `Name: ${callbackRequest.name}`,
          `Telefon: ${callbackRequest.phone}`,
          `Wunschzeit: ${callbackRequest.preferredTime}`,
          `Anliegen: ${callbackRequest.concern}`,
          `Matrix-Raum: ${configuredRoomId}`,
          `Matrix-Event: ${result.event_id ?? "unbekannt"}`,
        ].join("\n"),
        status: "todo",
        priority: "medium",
        category: "personal",
        tenant_id: taskContext.tenant_id,
        user_id: taskContext.user_id,
        due_date: null,
      };

      const { data: createdTask, error: taskError } = await supabaseAdmin
        .from("tasks")
        .insert(taskPayload)
        .select("id")
        .single();

      if (taskError) {
        await logAttempt("failed", {
          error_message: `Task creation failed: ${taskError.message}`,
          room_id: configuredRoomId,
          status_code: 500,
          metadata: { event_id: result.event_id ?? null },
        });

        return new Response(
          JSON.stringify({
            success: false,
            message_id: responseMessageId,
            status: "processing_failed",
            message:
              "Rückrufwunsch wurde gesendet, konnte aber nicht als Task gespeichert werden.",
          }),
          {
            status: 500,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          },
        );
      }

      createdTaskId = createdTask?.id ?? null;

      if (createdTaskId) {
        await supabaseAdmin.from("matrix_widget_callback_requests").insert({
          task_id: createdTaskId,
          matrix_room_id: configuredRoomId,
          matrix_event_id: result.event_id ?? null,
          source: body.source ?? "website_widget",
          requester_name: callbackRequest.name,
          requester_phone: callbackRequest.phone,
          preferred_time: callbackRequest.preferredTime,
          concern: callbackRequest.concern,
        });
      }
    }

    await logAttempt("success", {
      room_id: configuredRoomId,
      response_content: isCallbackRequest
        ? "Callback request sent to Matrix and stored as Organizer task"
        : "Website widget test message sent to Matrix",
      metadata: {
        status_code: 200,
        event_id: result.event_id ?? null,
        task_id: createdTaskId,
      },
    });

    return new Response(
      JSON.stringify({
        success: true,
        message_id: responseMessageId,
        status: "accepted",
        message: isCallbackRequest
          ? "Rückrufwunsch erfolgreich erfasst und bestätigt."
          : "Nachricht erfolgreich an Matrix gesendet.",
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  } catch (error) {
    const isTimeout =
      error instanceof DOMException && error.name === "AbortError";
    await logAttempt("failed", {
      error_message: isTimeout
        ? "Matrix API timeout after 10s"
        : error instanceof Error
          ? error.message
          : String(error),
      room_id: configuredRoomId,
      status_code: isTimeout ? 504 : 500,
    });

    return new Response(
      JSON.stringify({
        success: false,
        message_id: responseMessageId,
        status: isTimeout ? "timeout" : "delivery_failed",
        message: isTimeout
          ? "Zeitüberschreitung bei der Matrix-Übertragung."
          : fallbackMessage,
      }),
      {
        status: isTimeout ? 504 : 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  } finally {
    clearTimeout(timeout);
  }
}

function getRequesterIp(req: Request): string {
  const forwarded = req.headers.get("x-forwarded-for");
  if (forwarded) {
    return forwarded.split(",")[0].trim();
  }

  const realIp =
    req.headers.get("x-real-ip") ?? req.headers.get("cf-connecting-ip");
  return realIp?.trim() || "unknown";
}

function getRequesterSession(
  body: WebsiteWidgetTestRequest,
  req: Request,
): string {
  return (
    body.conversation_id?.trim() ||
    req.headers.get("x-session-id")?.trim() ||
    "anonymous"
  );
}

function maskPersonName(name: string): string {
  const trimmed = name.trim();
  if (!trimmed) return "unknown";
  if (trimmed.length <= 2) return `${trimmed[0]}*`;
  return `${trimmed[0]}${"*".repeat(trimmed.length - 2)}${trimmed[trimmed.length - 1]}`;
}

function maskPhoneNumber(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  if (!digits) return "unknown";
  const tail = digits.slice(-2);
  const maskedLength = Math.max(digits.length - tail.length, 2);
  return `${"*".repeat(maskedLength)}${tail}`;
}

function maskIpAddress(ip: string): string {
  if (ip === "unknown") return ip;
  if (ip.includes(":")) {
    const segments = ip.split(":");
    return `${segments.slice(0, 2).join(":")}:****`;
  }
  const octets = ip.split(".");
  if (octets.length !== 4) return "masked";
  return `${octets[0]}.${octets[1]}.x.x`;
}

function maskRequesterSession(sessionId: string): string {
  if (sessionId.length <= 4) return "anon";
  return `${sessionId.slice(0, 2)}***${sessionId.slice(-2)}`;
}

async function enforceWidgetRateLimit(
  supabaseAdmin: any,
  eventType: WebsiteWidgetTestRequest["type"],
  ip: string,
  sessionId: string,
): Promise<WidgetRateLimitResult> {
  const now = new Date();
  const nowIso = now.toISOString();
  const windowSizeSeconds = Math.max(1, WIDGET_RATE_LIMIT_WINDOW_SECONDS);
  const maxRequests = Math.max(1, WIDGET_RATE_LIMIT_MAX_REQUESTS);
  const limitKey = `${eventType}:${ip}:${sessionId}`;

  await supabaseAdmin
    .from("widget_rate_limits")
    .delete()
    .lt("window_expires_at", nowIso);

  const { data: existing, error: selectError } = await supabaseAdmin
    .from("widget_rate_limits")
    .select("id, request_count, window_started_at, window_expires_at")
    .eq("limit_key", limitKey)
    .maybeSingle();

  if (selectError) {
    console.error("❌ Failed to read widget rate limit state:", selectError);
    return { allowed: true, retryAfterSeconds: 0 };
  }

  if (!existing) {
    const windowExpiresAt = new Date(
      now.getTime() + windowSizeSeconds * 1000,
    ).toISOString();
    const { error: insertError } = await supabaseAdmin
      .from("widget_rate_limits")
      .insert({
        limit_key: limitKey,
        request_count: 1,
        window_started_at: nowIso,
        window_expires_at: windowExpiresAt,
        ip_address: ip,
        session_id: sessionId,
        event_type: eventType,
      });

    if (insertError) {
      console.error(
        "❌ Failed to create widget rate limit state:",
        insertError,
      );
    }

    return { allowed: true, retryAfterSeconds: 0 };
  }

  const expiresAt = new Date(existing.window_expires_at);
  if (expiresAt <= now) {
    const nextExpiration = new Date(
      now.getTime() + windowSizeSeconds * 1000,
    ).toISOString();
    const { error: resetError } = await supabaseAdmin
      .from("widget_rate_limits")
      .update({
        request_count: 1,
        window_started_at: nowIso,
        window_expires_at: nextExpiration,
        ip_address: ip,
        session_id: sessionId,
        event_type: eventType,
      })
      .eq("id", existing.id);

    if (resetError) {
      console.error("❌ Failed to reset widget rate limit state:", resetError);
    }

    return { allowed: true, retryAfterSeconds: 0 };
  }

  if (existing.request_count >= maxRequests) {
    const retryAfterSeconds = Math.max(
      1,
      Math.ceil((expiresAt.getTime() - now.getTime()) / 1000),
    );
    return { allowed: false, retryAfterSeconds };
  }

  const { error: updateError } = await supabaseAdmin
    .from("widget_rate_limits")
    .update({
      request_count: existing.request_count + 1,
      ip_address: ip,
      session_id: sessionId,
      event_type: eventType,
    })
    .eq("id", existing.id);

  if (updateError) {
    console.error("❌ Failed to update widget rate limit state:", updateError);
  }

  return { allowed: true, retryAfterSeconds: 0 };
}

async function verifyWidgetCaptcha(
  body: WebsiteWidgetTestRequest,
  req: Request,
): Promise<{ verified: boolean; error?: string }> {
  const token = body.captcha_token?.trim();
  const provider = body.captcha_provider ?? "turnstile";

  if (!token) {
    return { verified: false, error: "Captcha token missing" };
  }

  const ip = getRequesterIp(req);

  if (provider === "hcaptcha") {
    const secret = Deno.env.get("HCAPTCHA_SECRET_KEY");
    if (!secret) {
      return { verified: false, error: "hCaptcha secret not configured" };
    }

    const response = await fetch("https://hcaptcha.com/siteverify", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        secret,
        response: token,
        remoteip: ip,
      }),
    });

    if (!response.ok) {
      return {
        verified: false,
        error: `hCaptcha verification failed with HTTP ${response.status}`,
      };
    }

    const result = await response.json();
    return result.success
      ? { verified: true }
      : { verified: false, error: "hCaptcha verification failed" };
  }

  const secret = Deno.env.get("TURNSTILE_SECRET_KEY");
  if (!secret) {
    return { verified: false, error: "Turnstile secret not configured" };
  }

  const response = await fetch(
    "https://challenges.cloudflare.com/turnstile/v0/siteverify",
    {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        secret,
        response: token,
        remoteip: ip,
      }),
    },
  );

  if (!response.ok) {
    return {
      verified: false,
      error: `Turnstile verification failed with HTTP ${response.status}`,
    };
  }

  const result = await response.json();
  return result.success
    ? { verified: true }
    : { verified: false, error: "Turnstile verification failed" };
}
