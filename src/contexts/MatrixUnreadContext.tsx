import { createContext, useContext, useState, useEffect, useCallback, useRef, ReactNode } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useTenant } from '@/hooks/useTenant';
import { supabase } from '@/integrations/supabase/client';
import { safeGetItem, safeSetItem } from '@/utils/storage';

interface ChatRoomPreview {
  roomId: string;
  name: string;
  unreadCount: number;
  highlightCount: number;
  activity?: number;
}

interface MatrixUnreadContextType {
  totalUnreadCount: number;
  hasCredentials: boolean;
  unreadRooms: ChatRoomPreview[];
  recentRoom: Pick<ChatRoomPreview, "roomId" | "name"> | null;
  setLiveRooms: (rooms: ChatRoomPreview[] | null) => void;
  rememberRoom: (room: Pick<ChatRoomPreview, "roomId" | "name">) => void;
}

const MatrixUnreadContext = createContext<MatrixUnreadContextType>({
  totalUnreadCount: 0,
  hasCredentials: false,
  unreadRooms: [],
  recentRoom: null,
  setLiveRooms: () => {},
  rememberRoom: () => {},
});

const POLL_INTERVAL_MS = 120_000;
const STORAGE_KEY = 'matrix_unread_count';

export function MatrixUnreadProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const { currentTenant } = useTenant();

  const [totalUnreadCount, setTotalUnreadCount] = useState(() => {
    const cached = safeGetItem(STORAGE_KEY);
    return cached ? parseInt(cached, 10) || 0 : 0;
  });
  const scope = user && currentTenant ? `${user.id}:${currentTenant.id}` : null;
  const [roomSnapshot, setRoomSnapshot] = useState<{ scope: string | null; rooms: ChatRoomPreview[] }>();
  const [recent, setRecent] = useState<{ scope: string | null; room: MatrixUnreadContextType["recentRoom"] }>();
  const rememberRoom = useCallback((room: Pick<ChatRoomPreview, "roomId" | "name">) => {
    setRecent({ scope, room });
  }, [scope]);
  const [credentials, setCredentials] = useState<{ scope: string | null; accessToken: string; homeserverUrl: string } | null>(null);
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
      setCredentials(null);
      return;
    }

    let cancelled = false;
    const load = async () => {
      const { data: profile } = await supabase
        .from('profiles')
        .select('matrix_access_token, matrix_homeserver_url')
        .eq('user_id', user.id)
        .eq('tenant_id', currentTenant.id)
        .maybeSingle();

      if (cancelled) return;
      if (profile?.matrix_access_token) {
        setCredentials({
          scope,
          accessToken: profile.matrix_access_token,
          homeserverUrl: profile.matrix_homeserver_url || 'https://matrix.org',
        });
      } else {
        setCredentials(null);
      }
    };

    void load();
    return () => { cancelled = true; };
  }, [appSettled, user, currentTenant?.id, scope]);

  // Lightweight unread count polling via Matrix /sync with minimal filter
  const fetchUnreadCount = useCallback(async (signal: AbortSignal) => {
    if (!credentials || credentials.scope !== scope || liveOverrideRef.current) return;

    try {
      const filter = JSON.stringify({
        room: {
          timeline: { limit: 1 },
          state: { lazy_load_members: true, types: ["m.room.name", "m.room.canonical_alias"] },
          ephemeral: { types: [] },
        },
        presence: { types: [] },
        account_data: { types: [] },
      });

      const res = await fetch(
        `${credentials.homeserverUrl}/_matrix/client/v3/sync?filter=${encodeURIComponent(filter)}&timeout=0&set_presence=offline`,
        { signal, headers: { Authorization: `Bearer ${credentials.accessToken}` } }
      );

      if (!res.ok) return;

      const data = await res.json();
      if (signal.aborted || liveOverrideRef.current) return;
      const rooms: Record<string, {
        unread_notifications?: { notification_count?: number; highlight_count?: number };
        state?: { events?: Array<{ type: string; content?: { name?: string; alias?: string } }> };
        timeline?: { events?: Array<{ origin_server_ts?: number }> };
      }> = data?.rooms?.join ?? {};
      const unreadRooms = Object.entries(rooms).flatMap(([roomId, room]) => {
        const unreadCount = room.unread_notifications?.notification_count ?? 0;
        const highlightCount = room.unread_notifications?.highlight_count ?? 0;
        if (!unreadCount && !highlightCount) return [];
        const state = room.state?.events ?? [];
        const name = state.find((event) => event.type === "m.room.name")?.content?.name
          || state.find((event) => event.type === "m.room.canonical_alias")?.content?.alias
          || "Chatraum";
        return [{ roomId, name, unreadCount, highlightCount, activity: room.timeline?.events?.at(-1)?.origin_server_ts }];
      });
      const total = unreadRooms.reduce((sum, room) => sum + room.unreadCount, 0);
      setRoomSnapshot({ scope, rooms: unreadRooms });
      setTotalUnreadCount(total);
      safeSetItem(STORAGE_KEY, String(total));
    } catch {
      // Silently fail - polling is best-effort
    }
  }, [credentials, scope]);

  // Start/stop polling
  useEffect(() => {
    if (!credentials) return;

    const controller = new AbortController();
    const poll = () => { void fetchUnreadCount(controller.signal); };
    poll();
    pollTimerRef.current = setInterval(poll, POLL_INTERVAL_MS);

    return () => {
      controller.abort();
      clearInterval(pollTimerRef.current);
    };
  }, [credentials, fetchUnreadCount]);

  const setLiveRooms = useCallback((rooms: ChatRoomPreview[] | null) => {
    liveOverrideRef.current = rooms !== null;
    if (rooms === null) return;
    const total = rooms.reduce((sum, room) => sum + room.unreadCount, 0);
    setRoomSnapshot({ scope, rooms });
    setTotalUnreadCount(total);
    safeSetItem(STORAGE_KEY, String(total));
  }, [scope]);

  const unreadRooms = roomSnapshot && roomSnapshot.scope === scope
    ? roomSnapshot.rooms.filter((room) => room.unreadCount > 0 || room.highlightCount > 0)
    : [];
  const recentRoom = recent && recent.scope === scope ? recent.room : null;
  const hasCredentials = !!credentials && credentials.scope === scope;

  return (
    <MatrixUnreadContext.Provider value={{ totalUnreadCount, hasCredentials, unreadRooms, recentRoom, setLiveRooms, rememberRoom }}>
      {children}
    </MatrixUnreadContext.Provider>
  );
}

export function useMatrixUnread() {
  return useContext(MatrixUnreadContext);
}
