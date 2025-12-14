import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

export interface MeetingParticipant {
  id: string;
  meeting_id: string;
  user_id: string;
  role: 'organizer' | 'participant' | 'optional';
  status: 'pending' | 'confirmed' | 'declined';
  created_at: string;
  user?: {
    id: string;
    display_name: string;
    avatar_url?: string;
  };
}

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
      
      const transformedData: MeetingParticipant[] = (data || []).map(item => ({
        id: item.id,
        meeting_id: item.meeting_id,
        user_id: item.user_id,
        role: item.role as MeetingParticipant['role'],
        status: item.status as MeetingParticipant['status'],
        created_at: item.created_at,
        user: item.user ? {
          id: (item.user as any).user_id,
          display_name: (item.user as any).display_name || 'Unbekannt',
          avatar_url: (item.user as any).avatar_url
        } : undefined
      }));
      
      setParticipants(transformedData);
    } catch (error) {
      console.error('Error loading participants:', error);
    } finally {
      setLoading(false);
    }
  }, [meetingId]);

  useEffect(() => {
    loadParticipants();
  }, [loadParticipants]);

  const addParticipant = async (userId: string, role: 'organizer' | 'participant' | 'optional' = 'participant') => {
    if (!meetingId) return null;

    try {
      const { data, error } = await supabase
        .from('meeting_participants')
        .insert({
          meeting_id: meetingId,
          user_id: userId,
          role,
          status: 'pending'
        })
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

      const newParticipant: MeetingParticipant = {
        id: data.id,
        meeting_id: data.meeting_id,
        user_id: data.user_id,
        role: data.role as MeetingParticipant['role'],
        status: data.status as MeetingParticipant['status'],
        created_at: data.created_at,
        user: data.user ? {
          id: (data.user as any).user_id,
          display_name: (data.user as any).display_name || 'Unbekannt',
          avatar_url: (data.user as any).avatar_url
        } : undefined
      };

      setParticipants(prev => [...prev, newParticipant]);
      return newParticipant;
    } catch (error) {
      console.error('Error adding participant:', error);
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
      console.error('Error updating participant:', error);
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
      console.error('Error removing participant:', error);
      toast({
        title: "Fehler",
        description: "Teilnehmer konnte nicht entfernt werden.",
        variant: "destructive"
      });
    }
  };

  const addMultipleParticipants = async (userIds: string[], role: 'organizer' | 'participant' | 'optional' = 'participant') => {
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
