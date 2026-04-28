import { supabase } from "@/integrations/supabase/client";
import type {
  FeedbackResponseRole,
  WebsiteWidgetCallbackRequest,
  ImprovementTriggerItem,
  WebsiteWidgetTestResponse,
  WidgetFeedbackStats,
} from "./types";

export async function sendWebsiteWidgetMessage(message: string, conversationId: string) {
  return supabase.functions.invoke("matrix-bot-handler", {
    body: {
      type: "website_widget_test",
      message,
      conversation_id: conversationId,
      source: "data_view_widget",
    },
  });
}

export async function submitWebsiteWidgetCallbackRequest(
  callbackRequest: WebsiteWidgetCallbackRequest,
  conversationId: string,
) {
  return supabase.functions.invoke("matrix-bot-handler", {
    body: {
      type: "website_widget_callback_request",
      source: "data_view_widget",
      callback_request: callbackRequest,
      conversation_id: conversationId,
    },
  });
}
export async function saveWidgetMessageFeedback(params: {
  tenantId: string;
  conversationId: string;
  widgetMessageId: string;
  matrixEventId?: string | null;
  responseRole: FeedbackResponseRole;
  isHelpful: boolean;
  visitorMessage?: string;
  botReply: string;
}) {
  return supabase.from("matrix_widget_message_feedback").insert([{
    tenant_id: params.tenantId,
    conversation_id: params.conversationId,
    widget_message_id: params.widgetMessageId,
    matrix_event_id: params.matrixEventId ?? null,
    response_role: params.responseRole,
    is_helpful: params.isHelpful,
    feedback_context: {
      visitor_message: params.visitorMessage ?? null,
      bot_reply: params.botReply,
      source: "matrix_widget_prototype",
    },
  }]);
}

export async function fetchWidgetFeedbackStats(tenantId: string): Promise<WidgetFeedbackStats> {
  const { data, error } = await supabase
    .from("matrix_widget_feedback_admin_stats")
    .select("*")
    .eq("tenant_id", tenantId)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return {
    totalFeedback: data?.total_feedback ?? 0,
    helpfulCount: data?.helpful_count ?? 0,
    notHelpfulCount: data?.not_helpful_count ?? 0,
    helpfulRatio: data?.helpful_ratio ?? 0,
    notHelpfulRatio: data?.not_helpful_ratio ?? 0,
    openImprovementTriggers: data?.open_improvement_triggers ?? 0,
    lastFeedbackAt: data?.last_feedback_at ?? null,
  };
}

export async function fetchOpenImprovementTriggers(tenantId: string): Promise<ImprovementTriggerItem[]> {
  const { data, error } = await supabase
    .from("matrix_widget_improvement_triggers")
    .select("id, conversation_id, widget_message_id, suggested_channel, status, created_at")
    .eq("tenant_id", tenantId)
    .eq("status", "open")
    .order("created_at", { ascending: false })
    .limit(5);

  if (error) {
    throw error;
  }

  return (data ?? []).map((item: Record<string, any>) => ({
    id: item.id,
    conversationId: item.conversation_id,
    widgetMessageId: item.widget_message_id,
    suggestedChannel: item.suggested_channel as "faq" | "routing",
    status: item.status as "open" | "in_progress" | "done",
    createdAt: item.created_at,
  }));
}
