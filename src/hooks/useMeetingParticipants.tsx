import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { debugConsole } from '@/utils/debugConsole';
import type { MeetingParticipantProfileRow, ParticipantRole } from '@/components/meetings/types';

export interface MeetingParticipant {
  id: string;
  meeting_id: string;
  user_id: string;
  role: ParticipantRole;
  status: 'pending' | 'confirmed' | 'declined';
  created_at: string | null;
  user?: {
    id: string;
    display_name: string;
    avatar_url?: string | null;
  };
}

interface MeetingParticipantRow {
  id: string;
  meeting_id: string;
  user_id: string;
  role: string;
  status: string;
  created_at: string | null;
  user: MeetingParticipantProfileRow | MeetingParticipantProfileRow[] | null;
}

const getSingleProfile = (
  profile: MeetingParticipantRow['user'],
): MeetingParticipantProfileRow | null => {
  if (!profile) return null;
  return Array.isArray(profile) ? profile[0] ?? null : profile;
};

const mapParticipant = (item: MeetingParticipantRow): MeetingParticipant => {
  const profile = getSingleProfile(item.user);

  return {
    id: item.id,
    meeting_id: item.meeting_id,
    user_id: item.user_id,
    role: item.role as MeetingParticipant['role'],
    status: item.status as MeetingParticipant['status'],
    created_at: item.created_at,
    user: profile
      ? {
          id: profile.user_id,
          display_name: profile.display_name || 'Unbekannt',
          avatar_url: profile.avatar_url,
        }
      : undefined,
  };
};

export function useMeetingParticipants(meetingId?: string) {
  const [participants, setParticipants] = useState<MeetingParticipant[]>([]);
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const loadParticipants = useCallback(async () => {
    if (!meetingId) {
      setParticipants([]);
      return;
    }
    
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('meeting_participants')
        .select(`
          *,
          user:profiles(user_id, display_name, avatar_url)
        `)
        .eq('meeting_id', meetingId);

      if (error) throw error;
      
      const transformedData: MeetingParticipant[] = (data || []).map((item) =>
        mapParticipant(item as MeetingParticipantRow),
      );
      
      setParticipants(transformedData);
    } catch (error) {
      debugConsole.error('Error loading participants:', error);
    } finally {
      setLoading(false);
    }
  }, [meetingId]);

  useEffect(() => {
    loadParticipants();
  }, [loadParticipants]);

  const addParticipant = async (userId: string, role: ParticipantRole = 'participant') => {
    if (!meetingId) return null;

    try {
      const { data, error } = await supabase
        .from('meeting_participants')
        .insert([{
          meeting_id: meetingId,
          user_id: userId,
          role,
          status: 'pending'
        }])
        .select(`
          *,
          user:profiles(user_id, display_name, avatar_url)
        `)
        .single();

      if (error) {
        if (error.code === '23505') {
          toast({
            title: "Teilnehmer existiert bereits",
            description: "Dieses Teammitglied ist bereits als Teilnehmer hinzugefügt.",
            variant: "destructive"
          });
          return null;
        }
        throw error;
      }

      const newParticipant = mapParticipant(data as MeetingParticipantRow);

      setParticipants(prev => [...prev, newParticipant]);
      return newParticipant;
    } catch (error) {
      debugConsole.error('Error adding participant:', error);
      toast({
        title: "Fehler",
        description: "Teilnehmer konnte nicht hinzugefügt werden.",
        variant: "destructive"
      });
      return null;
    }
  };

  const updateParticipant = async (participantId: string, updates: Partial<Pick<MeetingParticipant, 'role' | 'status'>>) => {
    try {
      const { error } = await supabase
        .from('meeting_participants')
        .update(updates)
        .eq('id', participantId);

      if (error) throw error;

      setParticipants(prev => 
        prev.map(p => p.id === participantId ? { ...p, ...updates } : p)
      );
    } catch (error) {
      debugConsole.error('Error updating participant:', error);
      toast({
        title: "Fehler",
        description: "Teilnehmer konnte nicht aktualisiert werden.",
        variant: "destructive"
      });
    }
  };

  const removeParticipant = async (participantId: string) => {
    try {
      const { error } = await supabase
        .from('meeting_participants')
        .delete()
        .eq('id', participantId);

      if (error) throw error;

      setParticipants(prev => prev.filter(p => p.id !== participantId));
    } catch (error) {
      debugConsole.error('Error removing participant:', error);
      toast({
        title: "Fehler",
        description: "Teilnehmer konnte nicht entfernt werden.",
        variant: "destructive"
      });
    }
  };

  const addMultipleParticipants = async (userIds: string[], role: ParticipantRole = 'participant') => {
    if (!meetingId || userIds.length === 0) return [];

    const results: MeetingParticipant[] = [];
    
    for (const userId of userIds) {
      const result = await addParticipant(userId, role);
      if (result) {
        results.push(result);
      }
    }
    
    return results;
  };

  return {
    participants,
    loading,
    addParticipant,
    updateParticipant,
    removeParticipant,
    addMultipleParticipants,
    reload: loadParticipants
  };
}
