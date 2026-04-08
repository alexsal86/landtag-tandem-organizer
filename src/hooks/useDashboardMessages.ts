import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useTenant } from '@/hooks/useTenant';
import { debugConsole } from '@/utils/debugConsole';
import {
  DASHBOARD_MESSAGES_SETTING_KEY,
  messages as defaultMessages,
  parseDashboardMessagesSetting,
  type DashboardMessage,
} from '@/utils/dashboard/messageGenerator';

export const useDashboardMessages = () => {
  const { currentTenant } = useTenant();
  const [messages, setMessages] = useState<DashboardMessage[]>(defaultMessages);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const loadMessages = async () => {
      try {
        const query = supabase
          .from('app_settings')
          .select('setting_value')
          .eq('setting_key', DASHBOARD_MESSAGES_SETTING_KEY)
          .limit(1);

        const { data, error } = currentTenant?.id
          ? await query.eq('tenant_id', currentTenant.id).maybeSingle()
          : await query.is('tenant_id', null).maybeSingle();

        if (error) throw error;

        const parsed = parseDashboardMessagesSetting(data?.setting_value);
        setMessages(parsed ?? defaultMessages);
      } catch (error) {
        debugConsole.error('Error loading dashboard messages:', error);
        setMessages(defaultMessages);
      } finally {
        setIsLoading(false);
      }
    };

    loadMessages();
  }, [currentTenant?.id]);

  return { messages, isLoading };
};
