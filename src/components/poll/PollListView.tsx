import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Calendar, Users, Clock, ExternalLink, BarChart3, Trash2, Plus, Archive, CheckCircle, XCircle, RotateCcw, AlertCircle } from 'lucide-react';
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
  const [activeTab, setActiveTab] = useState<'active' | 'archive'>('active');

  // Filter polls by status
  const activePolls = polls.filter(p => p.status === 'active');
  const archivedPolls = polls.filter(p => p.status === 'completed' || p.status === 'cancelled');

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
        return (
          <Badge variant="default" className="flex items-center gap-1">
            <Clock className="h-3 w-3" />
            Aktiv
          </Badge>
        );
      case 'completed':
        return (
          <Badge variant="secondary" className="flex items-center gap-1">
            <CheckCircle className="h-3 w-3" />
            Abgeschlossen
          </Badge>
        );
      case 'cancelled':
        return (
          <Badge variant="destructive" className="flex items-center gap-1">
            <XCircle className="h-3 w-3" />
            Abgebrochen
          </Badge>
        );
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const restorePoll = async (pollId: string) => {
    try {
      const { error } = await supabase
        .from('appointment_polls')
        .update({ status: 'active' })
        .eq('id', pollId);

      if (error) throw error;

      // Send notification about restoration
      await supabase.rpc('create_notification', {
        user_id_param: user!.id,
        type_name: 'poll_restored',
        title_param: 'Abstimmung wiederhergestellt',
        message_param: 'Die Terminabstimmung wurde wiederhergestellt und ist wieder aktiv.',
        data_param: { poll_id: pollId },
        priority_param: 'medium'
      });

      toast({
        title: "Abstimmung wiederhergestellt",
        description: "Die Terminabstimmung ist jetzt wieder aktiv.",
      });

      loadPolls();
    } catch (error) {
      console.error('Error restoring poll:', error);
      toast({
        title: "Fehler",
        description: "Die Abstimmung konnte nicht wiederhergestellt werden.",
        variant: "destructive",
      });
    }
  };

  const permanentlyDeletePoll = async (pollId: string) => {
    if (!window.confirm('Diese Aktion löscht die Abstimmung unwiderruflich. Alle Daten gehen verloren. Fortfahren?')) {
      return;
    }

    try {
      const { error } = await supabase
        .from('appointment_polls')
        .delete()
        .eq('id', pollId);

      if (error) throw error;

      toast({
        title: "Abstimmung endgültig gelöscht",
        description: "Die Terminabstimmung wurde unwiderruflich gelöscht.",
      });

      loadPolls();
    } catch (error) {
      console.error('Error permanently deleting poll:', error);
      toast({
        title: "Fehler",
        description: "Die Abstimmung konnte nicht gelöscht werden.",
        variant: "destructive",
      });
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

  const renderPollsTable = (pollsList: Poll[], isArchive: boolean = false) => {
    if (pollsList.length === 0) {
      return (
        <div className="text-center py-8 text-muted-foreground">
          {isArchive ? (
            <>
              <Archive className="h-12 w-12 mx-auto mb-4 opacity-20" />
              <p>Keine archivierten Abstimmungen vorhanden.</p>
            </>
          ) : (
            <>
              <Calendar className="h-12 w-12 mx-auto mb-4 opacity-20" />
              <p>Keine aktiven Abstimmungen vorhanden.</p>
            </>
          )}
        </div>
      );
    }

    return (
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
          {pollsList.map((poll) => (
            <TableRow 
              key={poll.id} 
              className={isArchive ? 'opacity-75 hover:opacity-100 transition-opacity' : ''}
            >
              <TableCell>
                <div>
                  <div className={`font-medium ${isArchive ? 'text-muted-foreground' : ''}`}>
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
                  {isArchive ? (
                    <>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => restorePoll(poll.id)}
                        title="Wiederherstellen"
                      >
                        <RotateCcw className="h-4 w-4" />
                      </Button>
                      <Button
                        size="sm"
                        variant="destructive"
                        onClick={() => permanentlyDeletePoll(poll.id)}
                        title="Endgültig löschen"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </>
                  ) : (
                    <>
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
                    </>
                  )}
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    );
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex justify-between items-start">
          <CardDescription>
            Übersicht über alle erstellten Terminabstimmungen
          </CardDescription>
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
          <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as 'active' | 'archive')}>
            <TabsList className="mb-4">
              <TabsTrigger value="active" className="flex items-center gap-2">
                <Clock className="h-4 w-4" />
                Aktive Abstimmungen ({activePolls.length})
              </TabsTrigger>
              <TabsTrigger value="archive" className="flex items-center gap-2">
                <Archive className="h-4 w-4" />
                Archiv ({archivedPolls.length})
              </TabsTrigger>
            </TabsList>

            <TabsContent value="active" className="mt-0">
              {renderPollsTable(activePolls, false)}
            </TabsContent>

            <TabsContent value="archive" className="mt-0">
              {archivedPolls.length > 0 && (
                <Alert className="mb-4 border-blue-200 bg-blue-50 dark:bg-blue-950 dark:border-blue-800">
                  <Archive className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                  <AlertTitle className="text-blue-900 dark:text-blue-100 mb-2">
                    Archivierte Terminabstimmungen
                  </AlertTitle>
                  <AlertDescription className="text-blue-800 dark:text-blue-200 space-y-3 text-sm">
                    <p>
                      Diese Abstimmungen wurden automatisch oder manuell archiviert und sind 
                      nicht mehr für Teilnehmer sichtbar.
                    </p>

                    <div className="space-y-1">
                      <p className="font-medium">Automatische Archivierung erfolgt bei:</p>
                      <ul className="list-none space-y-1.5 ml-2">
                        <li className="flex items-start gap-2">
                          <CheckCircle className="h-4 w-4 mt-0.5 text-green-600 dark:text-green-500 flex-shrink-0" />
                          <span>
                            <strong>Abgeschlossen:</strong> Alle Teilnehmer haben geantwortet
                          </span>
                        </li>
                        <li className="flex items-start gap-2">
                          <XCircle className="h-4 w-4 mt-0.5 text-red-600 dark:text-red-500 flex-shrink-0" />
                          <span>
                            <strong>Abgebrochen:</strong> Frist abgelaufen und weniger als 50% Beteiligung
                          </span>
                        </li>
                      </ul>
                    </div>

                    <div className="space-y-1">
                      <p className="font-medium">Verfügbare Aktionen:</p>
                      <ul className="list-none space-y-1.5 ml-2">
                        <li className="flex items-start gap-2">
                          <RotateCcw className="h-4 w-4 mt-0.5 text-blue-600 dark:text-blue-400 flex-shrink-0" />
                          <span>
                            <strong>Wiederherstellen:</strong> Setzt die Abstimmung zurück auf "Aktiv"
                          </span>
                        </li>
                        <li className="flex items-start gap-2">
                          <Trash2 className="h-4 w-4 mt-0.5 text-destructive flex-shrink-0" />
                          <span>
                            <strong>Endgültig löschen:</strong> Unwiderrufliche Löschung aller Daten
                          </span>
                        </li>
                      </ul>
                    </div>

                    <div className="pt-2 border-t border-blue-300 dark:border-blue-700">
                      <p className="text-xs text-blue-700 dark:text-blue-300 flex items-start gap-2">
                        <AlertCircle className="h-3.5 w-3.5 mt-0.5 flex-shrink-0" />
                        <span>
                          Das System prüft täglich um 6:00 Uhr automatisch alle aktiven Abstimmungen 
                          und verschiebt sie bei Bedarf ins Archiv. Sie werden per Benachrichtigung informiert.
                        </span>
                      </p>
                    </div>
                  </AlertDescription>
                </Alert>
              )}
              {renderPollsTable(archivedPolls, true)}
            </TabsContent>
          </Tabs>
        )}
      </CardContent>
    </Card>
  );
};