export interface WidgetMessage {
  id: string;
  role: "bot" | "visitor";
  text: string;
}

export interface WebsiteWidgetCallbackRequest {
  name: string;
  phone: string;
  preferredTime: string;
  concern: string;
}

export interface WebsiteWidgetTestResponse {
  success: boolean;
  event_id: string | null;
  room_id: string | null;
  fallback_message: string;
  task_id?: string | null;
}
