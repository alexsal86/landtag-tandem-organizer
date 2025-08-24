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
}

export const useUserStatus = () => {
  const { user } = useAuth();
  const [currentStatus, setCurrentStatus] = useState<UserStatus | null>(null);
  const [statusOptions, setStatusOptions] = useState<StatusOption[]>([]);
  const [usersWithStatus, setUsersWithStatus] = useState<UserWithStatus[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAwayTimerActive, setIsAwayTimerActive] = useState(false);

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

  // Load all users with their status
  useEffect(() => {
    const loadUsersWithStatus = async () => {
      const { data: profiles, error: profilesError } = await supabase
        .from('profiles')
        .select('user_id, display_name, avatar_url');

      if (profilesError) {
        console.error('Error loading profiles:', profilesError);
        return;
      }

      const { data: statuses, error: statusesError } = await supabase
        .from('user_status')
        .select('*');

      if (statusesError) {
        console.error('Error loading statuses:', statusesError);
        return;
      }

      const usersWithStatus = profiles?.map(profile => ({
        ...profile,
        status: statuses?.find(status => status.user_id === profile.user_id)
      })) || [];

      setUsersWithStatus(usersWithStatus);
    };

    loadUsersWithStatus();

    // Set up real-time listener
    const channel = supabase
      .channel('user_status_changes')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'user_status'
      }, () => {
        loadUsersWithStatus();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

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
    usersWithStatus,
    loading,
    isAwayTimerActive,
    updateStatus,
    quickSetStatus,
    getStatusDisplay,
    updateLastActivity
  };
};