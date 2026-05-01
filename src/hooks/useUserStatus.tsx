import { useState, useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { useTenant } from './useTenant';
import { toast } from 'sonner';
import { debugConsole } from '@/utils/debugConsole';

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

export const useUserStatus = () => {
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

  // Auto-away timer
  useEffect(() => {
    if (!user || !currentStatus?.auto_away_enabled) return;

    let awayTimer: NodeJS.Timeout;
    let lastActivity = Date.now();

    const resetAwayTimer = () => {
      lastActivity = Date.now();
      if (awayTimer) clearTimeout(awayTimer);
      
      if (currentStatus.status_type === 'away') {
        updateStatus('online');
      }
      
      awayTimer = setTimeout(() => {
        if (currentStatus.status_type === 'online') {
          updateStatus('away');
        }
      }, 10 * 60 * 1000); // 10 minutes
    };

    const handleActivity = () => {
      if (Date.now() - lastActivity > 1000) {
        resetAwayTimer();
        updateLastActivity();
      }
    };

    const events = ['mousedown', 'mousemove', 'keypress', 'scroll', 'touchstart'];
    events.forEach(event => {
      document.addEventListener(event, handleActivity, true);
    });

    resetAwayTimer();
    setIsAwayTimerActive(true);

    return () => {
      if (awayTimer) clearTimeout(awayTimer);
      events.forEach(event => {
        document.removeEventListener(event, handleActivity, true);
      });
      setIsAwayTimerActive(false);
    };
  }, [user, currentStatus?.auto_away_enabled, currentStatus?.status_type]);

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
    if (!user?.id) return;

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
        .single();

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
        (payload: Record<string, any>) => {
          debugConsole.log('Status changed:', payload);
          if (!isMounted) return;

          if (payload.eventType === 'UPDATE' || payload.eventType === 'INSERT') {
            setCurrentStatus(payload.new as UserStatus);
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
  }, [user?.id]);

  // Set up presence tracking for online users - TENANT SPECIFIC
  useEffect(() => {
    if (!user || !currentTenant?.id) return;

    // Cleanup previous channel if tenant changed
    if (presenceChannelRef.current) {
      presenceChannelRef.current.unsubscribe();
      presenceChannelRef.current = null;
    }

    const setupPresence = async () => {
      // TENANT-SPECIFIC channel name for isolation — unique per mount
      const channelName = `user_presence_${currentTenant.id}_${crypto.randomUUID()}`;
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
            const presences = rawPresences as Array<{ online_at?: string; display_name?: string; avatar_url?: string; presence_ref?: string; status?: string }>;
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
          const { data: profile } = await supabase
            .from('profiles')
            .select('display_name, avatar_url')
            .eq('user_id', user.id)
            .single();

          await channel.track({
            user_id: user.id,
            display_name: profile?.display_name || user.email,
            avatar_url: profile?.avatar_url,
            online_at: new Date().toISOString(),
            status: currentStatus
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
        presenceChannelRef.current.unsubscribe();
        presenceChannelRef.current = null;
      }
    }
  }, [user?.id, currentTenant?.id]);

  // Update presence when status changes
  useEffect(() => {
    if (presenceChannelRef.current && currentStatus && user) {
      const updatePresence = async () => {
        const { data: profile } = await supabase
          .from('profiles')
          .select('display_name, avatar_url')
          .eq('user_id', user.id)
          .single();

        await presenceChannelRef.current.track({
          user_id: user.id,
          display_name: profile?.display_name || user.email,
          avatar_url: profile?.avatar_url,
          online_at: new Date().toISOString(),
          status: currentStatus
        });
      };

      updatePresence();
    }
  }, [currentStatus, user]);

  // Function to update usersWithStatus based on online users and their statuses - TENANT FILTERED
  const updateUsersWithStatus = async (onlineUsersList: OnlineUser[]) => {
    try {
      const onlineUserIds = onlineUsersList.map(u => u.user_id);
      
      if (onlineUserIds.length === 0) {
        setUsersWithStatus([]);
        return;
      }

      // Only fetch statuses for users in the same tenant
      const { data: statuses } = await supabase
        .from('user_status')
        .select('id, user_id, status_type, custom_message, emoji, color, notifications_enabled, auto_away_enabled, last_activity, status_until')
        .eq('tenant_id', currentTenant?.id ?? '')
        .in('user_id', onlineUserIds);

      const usersWithStatusData = onlineUsersList.map(onlineUser => ({
        user_id: onlineUser.user_id,
        display_name: onlineUser.display_name,
        avatar_url: onlineUser.avatar_url,
        is_online: true,
        last_seen: onlineUser.online_at,
        status: statuses?.find((status: { user_id: string }) => status.user_id === onlineUser.user_id)
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
        notifications_enabled: notificationsEnabled ?? currentStatus?.notifications_enabled ?? true,
        last_activity: new Date().toISOString()
      };

      const { data, error } = await supabase
        .from('user_status')
        .upsert(statusData, { onConflict: 'user_id' })
        .select()
        .single();

      if (error) throw error;

      setCurrentStatus(data);
      toast.success('Status aktualisiert');
    } catch (error) {
      debugConsole.error('Error updating status:', error);
      toast.error('Fehler beim Aktualisieren des Status');
    }
  };

  const updateLastActivity = async () => {
    if (!user) return;

    try {
      await supabase
        .from('user_status')
        .upsert({
          user_id: user.id,
          last_activity: new Date().toISOString()
        }, { onConflict: 'user_id' });
    } catch (error) {
      debugConsole.error('Error updating last activity:', error);
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
