import { supabase } from "@/integrations/supabase/client";
import type { WebsiteWidgetTestResponse } from "./types";

export async function sendWebsiteWidgetMessage(message: string) {
  return supabase.functions.invoke<WebsiteWidgetTestResponse>("matrix-bot-handler", {
    body: {
      type: "website_widget_test",
      message,
      source: "data_view_widget",
    },
  });
}
