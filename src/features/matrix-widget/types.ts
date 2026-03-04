export interface WidgetMessage {
  id: string;
  role: "bot" | "visitor";
  text: string;
}

export interface WebsiteWidgetTestResponse {
  success: boolean;
  event_id: string | null;
  room_id: string | null;
  fallback_message: string;
}
