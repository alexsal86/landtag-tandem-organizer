import { useState, useEffect } from 'react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Users } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';

interface Participant {
  user_id: string;
  user?: {
    display_name: string | null;
    avatar_url: string | null;
  };
}

interface MeetingParticipantAvatarsProps {
  meetingId?: string;
}

export function MeetingParticipantAvatars({ meetingId }: MeetingParticipantAvatarsProps) {
  const [participants, setParticipants] = useState<Participant[]>([]);

  useEffect(() => {
    if (!meetingId) return;
    
    const loadParticipants = async () => {
      const { data: participantsData, error: participantsError } = await supabase
        .from('meeting_participants')
        .select('user_id')
        .eq('meeting_id', meetingId);

      if (participantsError || !participantsData || participantsData.length === 0) {
        setParticipants([]);
        return;
      }

      const userIds = participantsData.map(p => p.user_id);
      const { data: profiles } = await supabase
        .from('profiles')
        .select('user_id, display_name, avatar_url')
        .in('user_id', userIds);

      const enrichedParticipants = participantsData.map(p => ({
        ...p,
        user: profiles?.find(prof => prof.user_id === p.user_id) || null
      }));

      setParticipants(enrichedParticipants);
    };

    loadParticipants();
  }, [meetingId]);

  const getInitials = (name: string | null | undefined) => {
    if (!name) return '?';
    return name
      .split(' ')
      .map(n => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  if (participants.length === 0) return null;

  return (
    <div className="flex items-center gap-1 mt-2">
      <Users className="h-3.5 w-3.5 text-muted-foreground" />
      <div className="flex -space-x-2">
        {participants.slice(0, 5).map(p => (
          <Avatar key={p.user_id} className="h-6 w-6 border-2 border-background">
            <AvatarImage src={p.user?.avatar_url || undefined} />
            <AvatarFallback className="text-xs">
              {getInitials(p.user?.display_name)}
            </AvatarFallback>
          </Avatar>
        ))}
        {participants.length > 5 && (
          <span className="text-xs text-muted-foreground ml-2">
            +{participants.length - 5}
          </span>
        )}
      </div>
    </div>
  );
}
