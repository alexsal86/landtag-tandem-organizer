import { supabase } from "@/integrations/supabase/client";
import { debugConsole } from "@/utils/debugConsole";

type ShareNotificationParams = {
  recipientUserId: string;
  senderName?: string | null;
  itemTitle?: string | null;
  itemId?: string;
};

const getSenderLabel = (senderName?: string | null) => senderName?.trim() || "Ein Teammitglied";
const getItemLabel = (itemTitle?: string | null, fallback = "Ohne Titel") => itemTitle?.trim() || fallback;

export const notifyQuickNoteShared = async ({
  recipientUserId,
  senderName,
  itemTitle,
  itemId,
}: ShareNotificationParams) => {
  const { error } = await supabase.rpc("create_notification", {
    user_id_param: recipientUserId,
    type_name: "quick_note_shared",
    title_param: "Quick Note mit dir geteilt",
    message_param: `${getSenderLabel(senderName)} hat die Notiz "${getItemLabel(itemTitle)}" mit dir geteilt.`,
    data_param: { noteId: itemId },
    priority_param: "medium",
  });

  if (error) {
    debugConsole.error("Error creating quick-note-share notification:", error);
  }
};

export const notifyTaskShared = async ({
  recipientUserId,
  senderName,
  itemTitle,
  itemId,
}: ShareNotificationParams) => {
  const { error } = await supabase.rpc("create_notification", {
    user_id_param: recipientUserId,
    type_name: "task_shared",
    title_param: "Aufgabe mit dir geteilt",
    message_param: `${getSenderLabel(senderName)} hat dir die Aufgabe "${getItemLabel(itemTitle)}" zugewiesen.`,
    data_param: { taskId: itemId },
    priority_param: "medium",
  });

  if (error) {
    debugConsole.error("Error creating task-share notification:", error);
  }
};

