import { createContext, useContext, useState, useEffect, useRef, type PropsWithChildren } from 'react';
import { useQuery } from '@tanstack/react-query';
import type { RealtimePostgresChangesPayload } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { useTenant } from './useTenant';
import { debugConsole } from '@/utils/debugConsole';
import { notify } from "@/lib/notify";
import { shouldPersistUserStatusActivity } from './userStatusActivity';

export interface StatusOption {
  id: string;
  name: string;
  emoji?: string | null;
  color: string;
  sort_order: number;
}

export interface UserStatus {
  id: string;
  user_id: string;
  status_type: 'online' | 'meeting' | 'break' | 'away' | 'offline' | 'custom';
  custom_message?: string | null;
  emoji?: string | null;
  color?: string | null;
  notifications_enabled: boolean;
  auto_away_enabled: boolean;
  last_activity: string;
  status_until?: string | null;
}

export interface UserWithStatus {
  user_id: string;
  display_name: string;
  avatar_url?: string;
  status?: UserStatus;
  is_online?: boolean;
  last_seen?: string;
}

export interface OnlineUser {
  user_id: string;
  display_name: string;
  avatar_url?: string;
  presence_ref: string;
  online_at: string;
  status?: UserStatus;
}

const useUserStatusRuntime = () => {
  const { user } = useAuth();
  const { currentTenant } = useTenant();
  const [currentStatus, setCurrentStatus] = useState<UserStatus | null>(null);
  const [statusOptions, setStatusOptions] = useState<StatusOption[]>([]);
  const [onlineUsers, setOnlineUsers] = useState<OnlineUser[]>([]);
  const [usersWithStatus, setUsersWithStatus] = useState<UserWithStatus[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAwayTimerActive, setIsAwayTimerActive] = useState(false);
  const statusChannelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const presenceChannelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

  const automaticStatusWriter = useRef<(next: 'online' | 'away') => Promise<void>>(async () => {});
  const lastActivityWrite = useRef(0);
  const activityWritePending = useRef(false);
  const statusRef = useRef(currentStatus);
  statusRef.current = currentStatus;
  const { data: profile } = useQuery({
    queryKey: ['user-status-profile', currentTenant?.id, user?.id],
    enabled: Boolean(user?.id && currentTenant?.id),
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      const { data, error } = await supabase.from('profiles')
        .select('display_name, avatar_url').eq('user_id', user!.id).single();
      if (error) throw error;
      return data;
    },
  });
  const profileRef = useRef(profile);
  profileRef.current = profile;

  // Activity is measured locally; persistence is limited to once per five minutes.
  useEffect(() => {
    lastActivityWrite.current = Date.now();
  }, [user?.id, currentTenant?.id]);

  useEffect(() => {
    if (!user || !currentStatus?.auto_away_enabled) return;
    let lastActivity = Date.now();
    let transitionPending = false;
    const changeAutomaticStatus = async (next: 'online' | 'away') => {
      if (transitionPending) return;
      transitionPending = true;
      try { await automaticStatusWriter.current(next); } finally { transitionPending = false; }
    };
    const handleActivity = () => {
      lastActivity = Date.now();
      if (statusRef.current?.status_type === 'away') {
        void changeAutomaticStatus('online');
      } else {
        void updateLastActivity();
      }
    };
    const timer = setInterval(() => {
      if (Date.now() - lastActivity >= 10 * 60 * 1000 && statusRef.current?.status_type === 'online') {
        void changeAutomaticStatus('away');
      }
    }, 1000);
    const events = ['mousedown', 'mousemove', 'keypress', 'scroll', 'touchstart'];
    events.forEach(event => document.addEventListener(event, handleActivity, true));
    setIsAwayTimerActive(true);
    return () => {
      clearInterval(timer);
      events.forEach(event => document.removeEventListener(event, handleActivity, true));
      setIsAwayTimerActive(false);
    };
  }, [user?.id, currentTenant?.id, currentStatus?.auto_away_enabled]);

  // Load status options
  useEffect(() => {
    const loadStatusOptions = async () => {
      const { data, error } = await supabase
        .from('admin_status_options')
        .select('id, name, emoji, color, sort_order')
        .eq('is_active', true)
        .order('sort_order');

      if (error) {
        debugConsole.error('Error loading status options:', error);
        return;
      }

      setStatusOptions(data || []);
    };

    loadStatusOptions();
  }, []);

  // Load current user status
  useEffect(() => {
    setCurrentStatus(null);
    setOnlineUsers([]);
    setUsersWithStatus([]);
    if (!user?.id || !currentTenant?.id) { setLoading(false); return; }

    if (statusChannelRef.current) {
      supabase.removeChannel(statusChannelRef.current);
      statusChannelRef.current = null;
    }

    let isMounted = true;

    const loadCurrentStatus = async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from('user_status')
        .select('id, user_id, status_type, custom_message, emoji, color, notifications_enabled, auto_away_enabled, last_activity, status_until')
        .eq('user_id', user.id)
        .eq('tenant_id', currentTenant.id)
        .maybeSingle();

      if (error && error.code !== 'PGRST116') {
        debugConsole.error('Error loading user status:', error);
      } else if (data && isMounted) {
        setCurrentStatus(data);
      }
      if (isMounted) {
        setLoading(false);
      }
    };

    void loadCurrentStatus();

    // Set up realtime subscription for status changes
    const statusSubscription = supabase
      .channel(`user_status:${user.id}:${crypto.randomUUID()}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'user_status',
          filter: `user_id=eq.${user.id}`
        },
        (payload: RealtimePostgresChangesPayload<UserStatus & { tenant_id?: string }>) => {
          debugConsole.log('Status changed:', payload);
          if (!isMounted) return;

          if (payload.eventType === 'UPDATE' || payload.eventType === 'INSERT') {
            const next = payload.new as UserStatus & { tenant_id?: string };
            if (next.tenant_id === currentTenant.id) setCurrentStatus(next);
          } else if (payload.eventType === 'DELETE') {
            setCurrentStatus(null);
          }
        }
      );

    statusChannelRef.current = statusSubscription;
    statusSubscription.subscribe();

    return () => {
      isMounted = false;
      if (statusChannelRef.current) {
        supabase.removeChannel(statusChannelRef.current);
        statusChannelRef.current = null;
      }
    };
  }, [user?.id, currentTenant?.id]);

  // Set up presence tracking for online users - TENANT SPECIFIC
  useEffect(() => {
    if (!user || !currentTenant?.id) return;

    // Cleanup previous channel if tenant changed
    if (presenceChannelRef.current) {
      void supabase.removeChannel(presenceChannelRef.current);
      presenceChannelRef.current = null;
    }

    const setupPresence = async () => {
      // All clients in this tenant must join the same presence channel.
      const channelName = `user_presence_${currentTenant.id}`;
      debugConsole.log('🏢 Setting up presence channel:', channelName);
      
      const channel = supabase.channel(channelName, {
        config: {
          presence: {
            key: user.id,
          },
        },
      });

      channel
        .on('presence', { event: 'sync' }, () => {
          const presenceState = channel.presenceState();
          const onlineUsersList: OnlineUser[] = [];
          
          Object.entries(presenceState).forEach(([userId, rawPresences]) => {
            const presences = rawPresences as Array<{ online_at?: string; display_name?: string; avatar_url?: string; presence_ref?: string; status?: UserStatus }>;
            if (presences && presences.length > 0) {
              const presence = [...presences].sort((a, b) => {
                const aTime = new Date(a.online_at || 0).getTime();
                const bTime = new Date(b.online_at || 0).getTime();
                return bTime - aTime;
              })[0];

              onlineUsersList.push({
                user_id: userId,
                display_name: presence.display_name || 'Unbekannt',
                avatar_url: presence.avatar_url ?? '',
                presence_ref: presence.presence_ref ?? '',
                online_at: presence.online_at ?? '',
                status: presence.status
              });
            }
          });
          
          setOnlineUsers(onlineUsersList);
          updateUsersWithStatus(onlineUsersList);
        })
        .on('presence', { event: 'join' }, ({ newPresences }) => {
          debugConsole.log('User joined tenant presence:', newPresences);
        })
        .on('presence', { event: 'leave' }, ({ leftPresences }) => {
          debugConsole.log('User left tenant presence:', leftPresences);
        });

      channel.subscribe(async (status: string) => {
        if (status === 'SUBSCRIBED') {
          if (presenceChannelRef.current !== channel) return;
          const profile = profileRef.current;
          await channel.track({
            user_id: user.id,
            display_name: profile?.display_name || user.email,
            avatar_url: profile?.avatar_url,
            online_at: new Date().toISOString(),
            status: statusRef.current
          });
        }
      });

      presenceChannelRef.current = channel;
    };

    setupPresence();

    return () => {
      channelCleanup();
    };

    function channelCleanup() {
      if (presenceChannelRef.current) {
        void supabase.removeChannel(presenceChannelRef.current);
        presenceChannelRef.current = null;
      }
    }
  }, [user?.id, currentTenant?.id]);

  const presenceStatus = currentStatus ? JSON.stringify({
    ...currentStatus, last_activity: undefined,
  }) : null;

  // Heartbeat timestamps do not change the visible presence status.
  useEffect(() => {
    const channel = presenceChannelRef.current;
    if (channel && currentStatus && user) {
      const updatePresence = async () => {
        await channel.track({
          user_id: user.id,
          display_name: profile?.display_name || user.email,
          avatar_url: profile?.avatar_url,
          online_at: new Date().toISOString(),
          status: currentStatus
        });
      };

      updatePresence();
    }
  }, [presenceStatus, user?.id, profile]);

  // Function to update usersWithStatus based on online users and their statuses - TENANT FILTERED
  const updateUsersWithStatus = async (onlineUsersList: OnlineUser[]) => {
    try {
      const onlineUserIds = onlineUsersList.map(u => u.user_id);
      
      if (onlineUserIds.length === 0) {
        setUsersWithStatus([]);
        return;
      }

      const usersWithStatusData = onlineUsersList.map(onlineUser => ({
        user_id: onlineUser.user_id,
        display_name: onlineUser.display_name,
        avatar_url: onlineUser.avatar_url,
        is_online: true,
        last_seen: onlineUser.online_at,
        status: onlineUser.status
      }));

      setUsersWithStatus(usersWithStatusData);
    } catch (error) {
      debugConsole.error('Error updating users with status:', error);
    }
  };

  const updateStatus = async (
    statusType: UserStatus['status_type'],
    customMessage?: string,
    emoji?: string,
    statusUntil?: Date,
    notificationsEnabled?: boolean
  ) => {
    if (!user || !currentTenant?.id) return;

    try {
      const statusOption = statusOptions.find(opt => 
        opt.name.toLowerCase().includes(statusType.toLowerCase())
      );

      const statusData = {
        user_id: user.id,
        tenant_id: currentTenant.id,
        status_type: statusType,
        custom_message: customMessage || null,
        emoji: emoji || statusOption?.emoji || null,
        color: statusOption?.color || null,
        status_until: statusUntil?.toISOString() || null,
        notifications_enabled: notificationsEnabled ?? statusRef.current?.notifications_enabled ?? true,
        last_activity: new Date().toISOString()
      };

      const { data, error } = await supabase
        .from('user_status')
        .upsert(statusData, { onConflict: 'user_id' })
        .select()
        .single();

      if (error) throw error;

      lastActivityWrite.current = Date.now();
      statusRef.current = data;
      setCurrentStatus(data);
      notify.success('Status aktualisiert');
    } catch (error) {
      debugConsole.error('Error updating status:', error);
      notify.error('Fehler beim Aktualisieren des Status');
    }
  };

  automaticStatusWriter.current = updateStatus;

  const updateLastActivity = async () => {
    const now = Date.now();
    const userId = user?.id;
    const tenantId = currentTenant?.id;
    if (!shouldPersistUserStatusActivity({
      now,
      lastWrite: lastActivityWrite.current,
      writePending: activityWritePending.current,
      hasStatusContext: Boolean(userId && tenantId && statusRef.current),
    })) return;
    if (!userId || !tenantId) return;
    lastActivityWrite.current = now;
    activityWritePending.current = true;
    try {
      const { error } = await supabase.from('user_status')
        .update({ last_activity: new Date(now).toISOString() })
        .eq('user_id', userId).eq('tenant_id', tenantId);
      if (error) throw error;
    } catch (error) {
      debugConsole.error('Error updating last activity:', error);
    } finally {
      activityWritePending.current = false;
    }
  };

  const statusNameMapping: Record<string, UserStatus['status_type']> = {
    'online': 'online',
    'abwesend': 'away',
    'in besprechung': 'meeting',
    'besprechung': 'meeting',
    'pause': 'break',
    'offline': 'offline',
    'nicht stören': 'offline',
  };

  const quickSetStatus = async (statusName: string) => {
    if (!user) return;

    try {
      const normalizedName = statusName.toLowerCase();
      const mappedStatusType = statusNameMapping[normalizedName];
      const statusOption = statusOptions.find(opt => 
        opt.name.toLowerCase() === normalizedName
      );

      if (mappedStatusType) {
        await updateStatus(
          mappedStatusType,
          undefined,
          statusOption?.emoji ?? undefined,
          undefined,
          mappedStatusType !== 'meeting' && mappedStatusType !== 'break'
        );
      } else {
        await updateStatus(
          'custom',
          statusName,
          statusOption?.emoji || undefined,
          undefined,
          true
        );
      }
    } catch (error) {
      debugConsole.error('Error setting quick status:', error);
    }
  };

  const getStatusDisplay = (status?: UserStatus) => {
    if (!status) return { emoji: '⚫', color: 'hsl(0, 0%, 50%)', label: 'Offline' };

    if (status.status_type === 'custom' && status.custom_message) {
      return {
        emoji: status.emoji || '💬',
        color: status.color || 'hsl(220, 14%, 96%)',
        label: status.custom_message
      };
    }

    const statusOption = statusOptions.find(opt => 
      opt.name.toLowerCase().includes(status.status_type.toLowerCase())
    );

    if (statusOption) {
      return {
        emoji: status.emoji || statusOption.emoji || '🟢',
        color: status.color || statusOption.color,
        label: statusOption.name
      };
    }

    const fallbacks: Record<string, { emoji: string; color: string; label: string }> = {
      online: { emoji: '🟢', color: 'hsl(142, 76%, 36%)', label: 'Online' },
      meeting: { emoji: '🔴', color: 'hsl(0, 84%, 60%)', label: 'In Besprechung' },
      break: { emoji: '🟡', color: 'hsl(48, 96%, 53%)', label: 'Pause' },
      away: { emoji: '🟠', color: 'hsl(25, 95%, 53%)', label: 'Abwesend' },
      offline: { emoji: '⚫', color: 'hsl(0, 0%, 20%)', label: 'Offline' }
    };

    return fallbacks[status.status_type] || fallbacks.offline;
  };

  return {
    currentStatus,
    profile,
    statusOptions,
    onlineUsers,
    usersWithStatus,
    loading,
    isAwayTimerActive,
    updateStatus,
    quickSetStatus,
    getStatusDisplay,
    updateLastActivity
  };
};

const UserStatusContext = createContext<ReturnType<typeof useUserStatusRuntime> | null>(null);

export const UserStatusProvider = ({ children }: PropsWithChildren) => {
  const value = useUserStatusRuntime();
  return <UserStatusContext.Provider value={value}>{children}</UserStatusContext.Provider>;
};

export const useUserStatus = () => {
  const value = useContext(UserStatusContext);
  if (!value) throw new Error('useUserStatus requires UserStatusProvider');
  return value;
};
