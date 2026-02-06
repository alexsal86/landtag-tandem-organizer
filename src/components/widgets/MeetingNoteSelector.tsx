import React, { useState, useEffect } from 'react';
import { Calendar, Check, Clock } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { format } from 'date-fns';
import { de } from 'date-fns/locale';

interface Meeting {
  id: string;
  title: string;
  meeting_date: string;
  status: string;
}

interface MeetingNoteSelectorProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelect: (meetingId: string, meetingTitle: string, meetingDate: string) => void;
  onMarkForNextJourFixe?: () => void;
  currentMeetingId?: string | null;
}

export const MeetingNoteSelector: React.FC<MeetingNoteSelectorProps> = ({
  open,
  onOpenChange,
  onSelect,
  onMarkForNextJourFixe,
  currentMeetingId
}) => {
  const { user } = useAuth();
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (open && user) {
      loadMeetings();
    }
  }, [open, user]);

  const loadMeetings = async () => {
    if (!user) return;
    
    setLoading(true);
    try {
      const todayStr = new Date().toISOString().split('T')[0];

      // 1. Own meetings
      const { data: ownMeetings, error: ownError } = await supabase
        .from('meetings')
        .select('id, title, meeting_date, status')
        .eq('user_id', user.id)
        .neq('status', 'archived')
        .gte('meeting_date', todayStr)
        .order('meeting_date', { ascending: true })
        .limit(20);

      if (ownError) throw ownError;

      // 2. Meetings where user is participant
      const { data: participantEntries } = await supabase
        .from('meeting_participants')
        .select('meeting_id')
        .eq('user_id', user.id);

      let participantMeetings: Meeting[] = [];
      if (participantEntries && participantEntries.length > 0) {
        const meetingIds = participantEntries.map(p => p.meeting_id);
        const { data: partMeetings } = await supabase
          .from('meetings')
          .select('id, title, meeting_date, status')
          .in('id', meetingIds)
          .neq('status', 'archived')
          .neq('user_id', user.id)
          .gte('meeting_date', todayStr)
          .order('meeting_date', { ascending: true });

        participantMeetings = (partMeetings || []) as Meeting[];
      }

      // 3. Public meetings
      const { data: publicMeetings } = await supabase
        .from('meetings')
        .select('id, title, meeting_date, status')
        .eq('is_public', true)
        .neq('status', 'archived')
        .neq('user_id', user.id)
        .gte('meeting_date', todayStr)
        .order('meeting_date', { ascending: true })
        .limit(20);

      // Merge and deduplicate
      const allMeetings: Meeting[] = [...(ownMeetings || [])];
      const existingIds = new Set(allMeetings.map(m => m.id));

      for (const m of [...participantMeetings, ...((publicMeetings || []) as Meeting[])]) {
        if (!existingIds.has(m.id)) {
          allMeetings.push(m);
          existingIds.add(m.id);
        }
      }

      // Sort by date
      allMeetings.sort((a, b) => new Date(a.meeting_date).getTime() - new Date(b.meeting_date).getTime());

      setMeetings(allMeetings);
    } catch (error) {
      console.error('Error loading meetings:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSelect = (meeting: Meeting) => {
    onSelect(meeting.id, meeting.title, meeting.meeting_date);
    onOpenChange(false);
  };

  const formatMeetingDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return format(date, 'EEEE, d. MMMM yyyy', { locale: de });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            Jour Fixe auswählen
          </DialogTitle>
          <DialogDescription>
            Wähle einen kommenden Jour Fixe aus, um diese Notiz dort zu besprechen.
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="max-h-80 mt-4">
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary" />
            </div>
          ) : meetings.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Calendar className="h-8 w-8 mx-auto mb-2 opacity-50" />
              <p className="text-sm mb-3">Keine kommenden Jour Fixes gefunden</p>
              {onMarkForNextJourFixe && (
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={() => {
                    onMarkForNextJourFixe();
                    onOpenChange(false);
                  }}
                >
                  <Clock className="h-4 w-4 mr-2" />
                  Für nächsten Jour Fixe vormerken
                </Button>
              )}
            </div>
          ) : (
            <div className="space-y-2">
              {meetings.map((meeting) => (
                <Button
                  key={meeting.id}
                  variant={currentMeetingId === meeting.id ? "secondary" : "ghost"}
                  className="w-full justify-start h-auto py-3 px-4"
                  onClick={() => handleSelect(meeting)}
                >
                  <div className="flex items-start gap-3 w-full">
                    <Calendar className="h-4 w-4 mt-0.5 text-muted-foreground" />
                    <div className="flex-1 text-left">
                      <div className="font-medium">{meeting.title}</div>
                      <div className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                        <Clock className="h-3 w-3" />
                        {formatMeetingDate(meeting.meeting_date)}
                      </div>
                    </div>
                    {currentMeetingId === meeting.id && (
                      <Check className="h-4 w-4 text-primary" />
                    )}
                  </div>
                </Button>
              ))}
            </div>
          )}
        </ScrollArea>

        <div className="flex justify-end mt-4">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Abbrechen
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
