import { supabase } from '@/integrations/supabase/client';
import { asJson } from '@/lib/json';
import { debugConsole } from '@/utils/debugConsole';
import type { NotificationData } from '@/hooks/useNotifications';

type ShareNotificationParams = {
  recipientUserId: string;
  senderName?: string | null;
  itemTitle?: string | null;
  itemId?: string | null;
};

const getSenderLabel = (senderName?: string | null): string => senderName?.trim() || 'Ein Teammitglied';
const getItemLabel = (itemTitle?: string | null, fallback = 'Ohne Titel'): string => itemTitle?.trim() || fallback;

const createShareNotification = async (
  recipientUserId: string,
  typeName: string,
  title: string,
  message: string,
  data: NotificationData,
): Promise<void> => {
  const { error } = await supabase.rpc('create_notification', {
    user_id_param: recipientUserId,
    type_name: typeName,
    title_param: title,
    message_param: message,
    data_param: asJson(data),
    priority_param: 'medium',
  });

  if (error) {
    debugConsole.error(`Error creating ${typeName} notification:`, error);
  }
};

/**
 * Notizfreigaben und Vorgangs-Erwähnungen meldet die Datenbank (Trigger auf
 * quick_note_shares bzw. case_item_interactions), weil nur sie den Mandanten des
 * Datensatzes sicher kennt. Hier bleibt nur der Aufgaben-Hinweis ohne Freigabezeile.
 */
export const notifyTaskShared = async ({
  recipientUserId,
  senderName,
  itemTitle,
  itemId,
}: ShareNotificationParams): Promise<void> => {
  await createShareNotification(
    recipientUserId,
    'task_shared',
    'Aufgabe mit dir geteilt',
    `${getSenderLabel(senderName)} hat dir die Aufgabe "${getItemLabel(itemTitle)}" zugewiesen.`,
    { taskId: itemId ?? null, task_id: itemId ?? null },
  );
};
