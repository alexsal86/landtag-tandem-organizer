import { createContext, useContext, useState, useEffect, useCallback, useRef, ReactNode } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useTenant } from '@/hooks/useTenant';
import { supabase } from '@/integrations/supabase/client';
import { safeGetItem, safeSetItem } from '@/utils/storage';

interface MatrixUnreadContextType {
  totalUnreadCount: number;
  hasCredentials: boolean;
  /** Called by the full MatrixClientProvider to push live counts */
  setLiveUnreadCount: (count: number) => void;
}

const MatrixUnreadContext = createContext<MatrixUnreadContextType>({
  totalUnreadCount: 0,
  hasCredentials: false,
  setLiveUnreadCount: () => {},
});

const POLL_INTERVAL_MS = 30_000;
const STORAGE_KEY = 'matrix_unread_count';

export function MatrixUnreadProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const { currentTenant } = useTenant();

  const [totalUnreadCount, setTotalUnreadCount] = useState(() => {
    const cached = safeGetItem(STORAGE_KEY);
    return cached ? parseInt(cached, 10) || 0 : 0;
  });
  const [hasCredentials, setHasCredentials] = useState(false);
  const [credentials, setCredentials] = useState<{ accessToken: string; homeserverUrl: string } | null>(null);
  const liveOverrideRef = useRef(false);
  const pollTimerRef = useRef<ReturnType<typeof setInterval>>(undefined);

  // Defer all Matrix network activity until the browser is idle / app has settled
  const [appSettled, setAppSettled] = useState(false);

  useEffect(() => {
    if ('requestIdleCallback' in window) {
      const id = requestIdleCallback(() => setAppSettled(true), { timeout: 3000 });
      return () => cancelIdleCallback(id);
    } else {
      const id = setTimeout(() => setAppSettled(true), 2000);
      return () => clearTimeout(id);
    }
  }, []);

  // Load credentials from profile (deferred until app has settled)
  useEffect(() => {
    if (!appSettled || !user || !currentTenant?.id) {
      setHasCredentials(false);
      setCredentials(null);
      return;
    }

    const load = async () => {
      const { data: profile } = await supabase
        .from('profiles')
        .select('matrix_access_token, matrix_homeserver_url')
        .eq('user_id', user.id)
        .eq('tenant_id', currentTenant.id)
        .maybeSingle();

      if (profile?.matrix_access_token) {
        setHasCredentials(true);
        setCredentials({
          accessToken: profile.matrix_access_token,
          homeserverUrl: profile.matrix_homeserver_url || 'https://matrix.org',
        });
      } else {
        setHasCredentials(false);
        setCredentials(null);
      }
    };

    load();
  }, [appSettled, user, currentTenant?.id]);

  // Lightweight unread count polling via Matrix /sync with minimal filter
  const fetchUnreadCount = useCallback(async () => {
    if (!credentials || liveOverrideRef.current) return;

    try {
      const filter = JSON.stringify({
        room: {
          timeline: { limit: 0 },
          state: { lazy_load_members: true, types: [] },
          ephemeral: { types: [] },
        },
        presence: { types: [] },
        account_data: { types: [] },
      });

      const res = await fetch(
        `${credentials.homeserverUrl}/_matrix/client/v3/sync?filter=${encodeURIComponent(filter)}&timeout=0&set_presence=offline`,
        { headers: { Authorization: `Bearer ${credentials.accessToken}` } }
      );

      if (!res.ok) return;

      const data = await res.json();
      const rooms = data?.rooms?.join || {};
      let total = 0;

      for (const roomId in rooms) {
        const notifCount = rooms[roomId]?.unread_notifications?.notification_count || 0;
        total += notifCount;
      }

      setTotalUnreadCount(total);
      safeSetItem(STORAGE_KEY, String(total));
    } catch {
      // Silently fail - polling is best-effort
    }
  }, [credentials]);

  // Start/stop polling
  useEffect(() => {
    if (!credentials) return;

    // Initial fetch
    fetchUnreadCount();

    pollTimerRef.current = setInterval(fetchUnreadCount, POLL_INTERVAL_MS);

    return () => {
      if (pollTimerRef.current) clearInterval(pollTimerRef.current);
    };
  }, [credentials, fetchUnreadCount]);

  // Called by the full MatrixClientProvider when it's active (live WebSocket data)
  const setLiveUnreadCount = useCallback((count: number) => {
    liveOverrideRef.current = true;
    setTotalUnreadCount(count);
    localStorage.setItem(STORAGE_KEY, String(count));
  }, []);

  // When this component unmounts or credentials change, reset live override
  useEffect(() => {
    return () => { liveOverrideRef.current = false; };
  }, [credentials]);

  return (
    <MatrixUnreadContext.Provider value={{ totalUnreadCount, hasCredentials, setLiveUnreadCount }}>
      {children}
    </MatrixUnreadContext.Provider>
  );
}

export function useMatrixUnread() {
  return useContext(MatrixUnreadContext);
}
