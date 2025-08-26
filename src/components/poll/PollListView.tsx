import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Calendar, Users, Clock, ExternalLink, BarChart3, Trash2, Edit, Plus } from 'lucide-react';
import { format } from 'date-fns';
import { de } from 'date-fns/locale';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { PollResultsDashboard } from './PollResultsDashboard';
import { PollEditDialog } from './PollEditDialog';
import { AppointmentPollCreator } from './AppointmentPollCreator';

interface Poll {
  id: string;
  title: string;
  description?: string;
  deadline?: string;
  status: string;
  created_at: string;
  participant_count: number;
  response_count: number;
  time_slots_count: number;
}

export const PollListView = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [polls, setPolls] = useState<Poll[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedPoll, setSelectedPoll] = useState<string | null>(null);
  const [showCreatePoll, setShowCreatePoll] = useState(false);

  useEffect(() => {
    if (user) {
      loadPolls();
    }
  }, [user]);

  const loadPolls = async () => {
    if (!user) return;

    try {
      const { data: pollsData, error } = await supabase
        .from('appointment_polls')
        .select(`
          id,
          title,
          description,
          deadline,
          status,
          created_at,
          poll_participants!inner(count),
          poll_responses!inner(count),
          poll_time_slots!inner(count)
        `)
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (error) throw error;

      // Transform the data to get counts
      const transformedPolls = await Promise.all(
        (pollsData || []).map(async (poll) => {
          // Get participant count
          const { count: participantCount } = await supabase
            .from('poll_participants')
            .select('*', { count: 'exact', head: true })
            .eq('poll_id', poll.id);

          // Get response count (unique participants who responded)
          const { data: responseData } = await supabase
            .from('poll_responses')
            .select('participant_id')
            .eq('poll_id', poll.id);

          const uniqueParticipants = new Set(responseData?.map(r => r.participant_id));
          const responseCount = uniqueParticipants.size;

          // Get time slots count
          const { count: timeSlotsCount } = await supabase
            .from('poll_time_slots')
            .select('*', { count: 'exact', head: true })
            .eq('poll_id', poll.id);

          return {
            id: poll.id,
            title: poll.title,
            description: poll.description,
            deadline: poll.deadline,
            status: poll.status,
            created_at: poll.created_at,
            participant_count: participantCount || 0,
            response_count: responseCount,
            time_slots_count: timeSlotsCount || 0
          };
        })
      );

      // Sort polls: active polls first, then completed/cancelled at the bottom
      const sortedPolls = transformedPolls.sort((a, b) => {
        // First, sort by status priority (active first, then others)
        const getStatusPriority = (status: string) => {
          switch (status) {
            case 'active': return 1;
            case 'completed': return 3;
            case 'cancelled': return 4;
            default: return 2;
          }
        };
        
        const statusDiff = getStatusPriority(a.status) - getStatusPriority(b.status);
        if (statusDiff !== 0) return statusDiff;
        
        // Within same status, sort by created_at (newest first)
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      });

      setPolls(sortedPolls);
    } catch (error) {
      console.error('Error loading polls:', error);
      toast({
        title: "Fehler",
        description: "Die Abstimmungen konnten nicht geladen werden.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'active':
        return <Badge variant="default">Aktiv</Badge>;
      case 'completed':
        return <Badge variant="secondary">Abgeschlossen</Badge>;
      case 'cancelled':
        return <Badge variant="destructive">Abgebrochen</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const openPollLink = async (pollId: string) => {
    try {
      // Create a preview URL for the poll creator
      const pollUrl = `${window.location.origin}/poll-guest/${pollId}?preview=true`;
      window.open(pollUrl, '_blank');
    } catch (error) {
      console.error('Error opening poll link:', error);
      toast({
        title: "Fehler",
        description: "Der Link konnte nicht geöffnet werden.",
        variant: "destructive",
      });
    }
  };

  const deletePoll = async (pollId: string) => {
    if (!window.confirm('Möchten Sie diese Terminabstimmung wirklich löschen? Diese Aktion kann nicht rückgängig gemacht werden.')) {
      return;
    }

    try {
      // Send deletion notifications first
      await supabase.functions.invoke('send-poll-notifications', {
        body: {
          pollId,
          notificationType: 'poll_deleted'
        }
      });

      // Delete the poll (cascade will handle related data)
      const { error } = await supabase
        .from('appointment_polls')
        .delete()
        .eq('id', pollId);

      if (error) throw error;

      toast({
        title: "Abstimmung gelöscht",
        description: "Die Terminabstimmung wurde erfolgreich gelöscht und alle Teilnehmer benachrichtigt.",
      });

      // Reload polls
      loadPolls();
    } catch (error) {
      console.error('Error deleting poll:', error);
      toast({
        title: "Fehler",
        description: "Die Abstimmung konnte nicht gelöscht werden.",
        variant: "destructive",
      });
    }
  };

  if (showCreatePoll) {
    return (
      <div className="space-y-4">
        <Button
          variant="outline"
          onClick={() => setShowCreatePoll(false)}
          className="mb-4"
        >
          ← Zurück zur Übersicht
        </Button>
        <AppointmentPollCreator onClose={() => {
          setShowCreatePoll(false);
          loadPolls(); // Refresh the polls list
        }} />
      </div>
    );
  }

  if (selectedPoll) {
    return (
      <div className="space-y-4">
        <Button
          variant="outline"
          onClick={() => setSelectedPoll(null)}
          className="mb-4"
        >
          ← Zurück zur Übersicht
        </Button>
        <PollResultsDashboard pollId={selectedPoll} />
      </div>
    );
  }

  if (loading) {
    return (
      <Card>
        <CardContent className="p-6 text-center">
          <div className="animate-pulse">Lädt Abstimmungen...</div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex justify-between items-start">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Calendar className="h-5 w-5" />
              Terminabstimmungen
            </CardTitle>
            <CardDescription>
              Übersicht über alle erstellten Terminabstimmungen
            </CardDescription>
          </div>
          <Button
            onClick={() => setShowCreatePoll(true)}
            className="flex items-center gap-2"
          >
            <Plus className="h-4 w-4" />
            Neue Terminabstimmung
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {polls.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <Calendar className="h-12 w-12 mx-auto mb-4 opacity-20" />
            <p>Noch keine Terminabstimmungen erstellt.</p>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Titel</TableHead>
                <TableHead className="text-center">Status</TableHead>
                <TableHead className="text-center">Teilnehmer</TableHead>
                <TableHead className="text-center">Antworten</TableHead>
                <TableHead className="text-center">Zeitslots</TableHead>
                <TableHead className="text-center">Frist</TableHead>
                <TableHead className="text-center">Erstellt</TableHead>
                <TableHead className="text-center">Aktionen</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {polls.map((poll) => {
                const isInactive = poll.status === 'completed' || poll.status === 'cancelled';
                return (
                <TableRow 
                  key={poll.id} 
                  className={isInactive ? 'opacity-60 bg-muted/30' : ''}
                >
                  <TableCell>
                    <div>
                      <div className={`font-medium ${isInactive ? 'text-muted-foreground' : ''}`}>
                        {poll.title}
                      </div>
                      {poll.description && (
                        <div className="text-sm text-muted-foreground truncate max-w-xs">
                          {poll.description}
                        </div>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="text-center">
                    {getStatusBadge(poll.status)}
                  </TableCell>
                  <TableCell className="text-center">
                    <div className="flex items-center justify-center gap-1">
                      <Users className="h-4 w-4" />
                      {poll.participant_count}
                    </div>
                  </TableCell>
                  <TableCell className="text-center">
                    <div className="flex items-center justify-center gap-1">
                      <BarChart3 className="h-4 w-4" />
                      {poll.response_count} / {poll.participant_count}
                    </div>
                  </TableCell>
                  <TableCell className="text-center">
                    <div className="flex items-center justify-center gap-1">
                      <Clock className="h-4 w-4" />
                      {poll.time_slots_count}
                    </div>
                  </TableCell>
                  <TableCell className="text-center">
                    {poll.deadline ? (
                      <div className="text-sm">
                        {format(new Date(poll.deadline), 'dd.MM.yyyy', { locale: de })}
                      </div>
                    ) : (
                      <span className="text-muted-foreground">-</span>
                    )}
                  </TableCell>
                  <TableCell className="text-center">
                    <div className="text-sm">
                      {format(new Date(poll.created_at), 'dd.MM.yyyy', { locale: de })}
                    </div>
                  </TableCell>
                   <TableCell className="text-center">
                     <div className="flex items-center justify-center gap-1">
                       <Button
                         size="sm"
                         variant="outline"
                         onClick={() => setSelectedPoll(poll.id)}
                         title="Ergebnisse anzeigen"
                       >
                         <BarChart3 className="h-4 w-4" />
                       </Button>
                       <Button
                         size="sm"
                         variant="outline"
                         onClick={() => openPollLink(poll.id)}
                         title="Link öffnen"
                       >
                         <ExternalLink className="h-4 w-4" />
                       </Button>
                       <PollEditDialog
                         pollId={poll.id}
                         currentTitle={poll.title}
                         currentDescription={poll.description}
                         currentDeadline={poll.deadline}
                         onUpdate={loadPolls}
                       />
                       <Button
                         size="sm"
                         variant="destructive"
                         onClick={() => deletePoll(poll.id)}
                         title="Abstimmung löschen"
                       >
                         <Trash2 className="h-4 w-4" />
                       </Button>
                      </div>
                    </TableCell>
                </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
};