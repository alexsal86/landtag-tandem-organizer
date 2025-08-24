import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { toast } from 'sonner';

export interface StatusOption {
  id: string;
  name: string;
  emoji?: string;
  color: string;
  sort_order: number;
}

export interface UserStatus {
  id: string;
  user_id: string;
  status_type: 'online' | 'meeting' | 'break' | 'away' | 'offline' | 'custom';
  custom_message?: string;
  emoji?: string;
  color?: string;
  notifications_enabled: boolean;
  auto_away_enabled: boolean;
  last_activity: string;
  status_until?: string;
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
  const [currentStatus, setCurrentStatus] = useState<UserStatus | null>(null);
  const [statusOptions, setStatusOptions] = useState<StatusOption[]>([]);
  const [onlineUsers, setOnlineUsers] = useState<OnlineUser[]>([]);
  const [usersWithStatus, setUsersWithStatus] = useState<UserWithStatus[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAwayTimerActive, setIsAwayTimerActive] = useState(false);
  const [presenceChannel, setPresenceChannel] = useState<any>(null);

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
      if (Date.now() - lastActivity > 1000) { // Throttle to 1 second
        resetAwayTimer();
        updateLastActivity();
      }
    };

    // Listen for user activity
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
        .select('*')
        .eq('is_active', true)
        .order('sort_order');

      if (error) {
        console.error('Error loading status options:', error);
        return;
      }

      setStatusOptions(data || []);
    };

    loadStatusOptions();
  }, []);

  // Load current user status
  useEffect(() => {
    if (!user) return;

    const loadCurrentStatus = async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from('user_status')
        .select('*')
        .eq('user_id', user.id)
        .single();

      if (error && error.code !== 'PGRST116') {
        console.error('Error loading user status:', error);
      } else if (data) {
        setCurrentStatus(data);
      }
      setLoading(false);
    };

    loadCurrentStatus();
  }, [user]);

  // Set up presence tracking for online users
  useEffect(() => {
    if (!user) return;

    const setupPresence = async () => {
      // Create a unique channel for user presence
      const channel = supabase.channel('user_presence', {
        config: {
          presence: {
            key: user.id,
          },
        },
      });

      // Track presence events
      channel
        .on('presence', { event: 'sync' }, () => {
          const presenceState = channel.presenceState();
          const onlineUsersList: OnlineUser[] = [];
          
          Object.entries(presenceState).forEach(([userId, presences]: [string, any[]]) => {
            if (presences && presences.length > 0) {
              const presence = presences[0];
              onlineUsersList.push({
                user_id: userId,
                display_name: presence.display_name || 'Unbekannt',
                avatar_url: presence.avatar_url,
                presence_ref: presence.presence_ref,
                online_at: presence.online_at,
                status: presence.status
              });
            }
          });
          
          setOnlineUsers(onlineUsersList);
          updateUsersWithStatus(onlineUsersList);
        })
        .on('presence', { event: 'join' }, ({ newPresences }) => {
          console.log('User joined:', newPresences);
        })
        .on('presence', { event: 'leave' }, ({ leftPresences }) => {
          console.log('User left:', leftPresences);
        });

      // Subscribe and track own presence
      channel.subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          // Get user profile for presence data
          const { data: profile } = await supabase
            .from('profiles')
            .select('display_name, avatar_url')
            .eq('user_id', user.id)
            .single();

          // Track current user's presence
          await channel.track({
            user_id: user.id,
            display_name: profile?.display_name || user.email,
            avatar_url: profile?.avatar_url,
            online_at: new Date().toISOString(),
            status: currentStatus
          });
        }
      });

      setPresenceChannel(channel);
    };

    setupPresence();

    // Cleanup function
    return () => {
      if (presenceChannel) {
        presenceChannel.unsubscribe();
      }
    };
  }, [user?.id]);

  // Update presence when status changes
  useEffect(() => {
    if (presenceChannel && currentStatus && user) {
      const updatePresence = async () => {
        const { data: profile } = await supabase
          .from('profiles')
          .select('display_name, avatar_url')
          .eq('user_id', user.id)
          .single();

        await presenceChannel.track({
          user_id: user.id,
          display_name: profile?.display_name || user.email,
          avatar_url: profile?.avatar_url,
          online_at: new Date().toISOString(),
          status: currentStatus
        });
      };

      updatePresence();
    }
  }, [currentStatus, presenceChannel, user]);

  // Function to update usersWithStatus based on online users and their statuses
  const updateUsersWithStatus = async (onlineUsersList: OnlineUser[]) => {
    try {
      // Get all statuses for online users
      const onlineUserIds = onlineUsersList.map(u => u.user_id);
      
      if (onlineUserIds.length === 0) {
        setUsersWithStatus([]);
        return;
      }

      const { data: statuses } = await supabase
        .from('user_status')
        .select('*')
        .in('user_id', onlineUserIds);

      // Combine online users with their statuses
      const usersWithStatusData = onlineUsersList.map(onlineUser => ({
        user_id: onlineUser.user_id,
        display_name: onlineUser.display_name,
        avatar_url: onlineUser.avatar_url,
        is_online: true,
        last_seen: onlineUser.online_at,
        status: statuses?.find(status => status.user_id === onlineUser.user_id)
      }));

      setUsersWithStatus(usersWithStatusData);
    } catch (error) {
      console.error('Error updating users with status:', error);
    }
  };

  const updateStatus = async (
    statusType: UserStatus['status_type'],
    customMessage?: string,
    emoji?: string,
    statusUntil?: Date,
    notificationsEnabled?: boolean
  ) => {
    if (!user) return;

    try {
      const statusOption = statusOptions.find(opt => 
        opt.name.toLowerCase().includes(statusType.toLowerCase())
      );

      const statusData = {
        user_id: user.id,
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
      console.error('Error updating status:', error);
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
      console.error('Error updating last activity:', error);
    }
  };

  const quickSetStatus = async (statusType: UserStatus['status_type']) => {
    const statusOption = statusOptions.find(opt => 
      opt.name.toLowerCase().includes(statusType.toLowerCase())
    );

    await updateStatus(
      statusType,
      undefined,
      statusOption?.emoji,
      undefined,
      statusType !== 'meeting' && statusType !== 'break' // Disable notifications for meetings and breaks
    );
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

    // Fallback
    const fallbacks = {
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
    usersWithStatus, // Now only contains online users
    loading,
    isAwayTimerActive,
    updateStatus,
    quickSetStatus,
    getStatusDisplay,
    updateLastActivity
  };
};