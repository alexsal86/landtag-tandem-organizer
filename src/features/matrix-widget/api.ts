import { supabase } from "@/integrations/supabase/client";
import type {
  WebsiteWidgetCallbackRequest,
  WebsiteWidgetTestResponse,
} from "./types";

export async function sendWebsiteWidgetMessage(message: string) {
  return supabase.functions.invoke<WebsiteWidgetTestResponse>("matrix-bot-handler", {
    body: {
      type: "website_widget_test",
      message,
      source: "data_view_widget",
    },
  });
}

export async function submitWebsiteWidgetCallbackRequest(
  callbackRequest: WebsiteWidgetCallbackRequest,
) {
  return supabase.functions.invoke<WebsiteWidgetTestResponse>("matrix-bot-handler", {
    body: {
      type: "website_widget_callback_request",
      source: "data_view_widget",
      callback_request: callbackRequest,
    },
  });
}
