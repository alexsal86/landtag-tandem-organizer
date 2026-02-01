import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { UserSelector } from '@/components/UserSelector';
import { Trash2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';

interface Participant {
  id: string;
  user_id: string;
  role: string;
  user?: {
    display_name: string | null;
    avatar_url: string | null;
  };
}

interface InlineMeetingParticipantsEditorProps {
  meetingId: string;
}

export function InlineMeetingParticipantsEditor({ meetingId }: InlineMeetingParticipantsEditorProps) {
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadParticipants();
  }, [meetingId]);

  const loadParticipants = async () => {
    setLoading(true);
    const { data: participantsData, error: participantsError } = await supabase
      .from('meeting_participants')
      .select('id, user_id, role')
      .eq('meeting_id', meetingId);

    if (participantsError || !participantsData) {
      setParticipants([]);
      setLoading(false);
      return;
    }

    if (participantsData.length === 0) {
      setParticipants([]);
      setLoading(false);
      return;
    }

    const userIds = participantsData.map(p => p.user_id);
    const { data: profiles } = await supabase
      .from('profiles')
      .select('user_id, display_name, avatar_url')
      .in('user_id', userIds);

    const enrichedParticipants: Participant[] = participantsData.map(p => ({
      ...p,
      user: profiles?.find(prof => prof.user_id === p.user_id) || undefined
    }));

    setParticipants(enrichedParticipants);
    setLoading(false);
  };

  const handleAddParticipant = async (user: { id: string; display_name: string }) => {
    if (participants.some(p => p.user_id === user.id)) return;

    const { data, error } = await supabase
      .from('meeting_participants')
      .insert({
        meeting_id: meetingId,
        user_id: user.id,
        role: 'participant',
        status: 'pending'
      })
      .select()
      .single();

    if (!error && data) {
      setParticipants(prev => [...prev, {
        ...data,
        user: { display_name: user.display_name, avatar_url: null }
      }]);
    }
  };

  const handleRemoveParticipant = async (participantId: string) => {
    const { error } = await supabase
      .from('meeting_participants')
      .delete()
      .eq('id', participantId);

    if (!error) {
      setParticipants(prev => prev.filter(p => p.id !== participantId));
    }
  };

  const getInitials = (name: string | null | undefined) => {
    if (!name) return '?';
    return name
      .split(' ')
      .map(n => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  if (loading) {
    return <p className="text-xs text-muted-foreground">Lade Teilnehmer...</p>;
  }

  return (
    <div className="space-y-2">
      <UserSelector
        onSelect={handleAddParticipant}
        placeholder="Teilnehmer hinzufügen..."
        clearAfterSelect
        excludeUserIds={participants.map(p => p.user_id)}
      />
      
      {participants.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {participants.map(p => (
            <div 
              key={p.id} 
              className="flex items-center gap-1 bg-muted/50 rounded-full pl-1 pr-2 py-0.5"
            >
              <Avatar className="h-5 w-5">
                <AvatarImage src={p.user?.avatar_url || undefined} />
                <AvatarFallback className="text-xs">
                  {getInitials(p.user?.display_name)}
                </AvatarFallback>
              </Avatar>
              <span className="text-xs">{p.user?.display_name || 'Unbekannt'}</span>
              <Button
                variant="ghost"
                size="icon"
                className="h-4 w-4 ml-0.5 hover:bg-destructive/20"
                onClick={() => handleRemoveParticipant(p.id)}
              >
                <Trash2 className="h-3 w-3" />
              </Button>
            </div>
          ))}
        </div>
      )}
      
      {participants.length === 0 && (
        <p className="text-xs text-muted-foreground">Keine Teilnehmer hinzugefügt</p>
      )}
    </div>
  );
}
