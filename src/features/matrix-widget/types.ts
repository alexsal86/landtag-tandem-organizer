export type FeedbackResponseRole = "bot" | "team";

export interface WidgetMessage {
  id: string;
  role: FeedbackResponseRole | "visitor";
  text: string;
  deliveryStatus?: "pending" | "sent" | "failed";
  matrixEventId?: string | null;
  feedbackGiven?: boolean;
}

export interface WebsiteWidgetCallbackRequest {
  name: string;
  phone: string;
  preferredTime: string;
  concern: string;
}

export interface WebsiteWidgetTestResponse {
  success: boolean;
  message_id: string;
  status: string;
  message: string;
}

export interface WidgetFeedbackStats {
  totalFeedback: number;
  helpfulCount: number;
  notHelpfulCount: number;
  helpfulRatio: number;
  notHelpfulRatio: number;
  openImprovementTriggers: number;
  lastFeedbackAt: string | null;
}

export interface ImprovementTriggerItem {
  id: string;
  conversationId: string;
  widgetMessageId: string;
  suggestedChannel: "faq" | "routing";
  status: "open" | "in_progress" | "done";
  createdAt: string;
}
