import React, { useState, useEffect } from 'react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { CalendarIcon, Clock, Users, Check, AlertCircle, X, Trophy, Mail, CheckCircle2 } from 'lucide-react';
import { format } from 'date-fns';
import { de } from 'date-fns/locale';
import { supabase } from '@/integrations/supabase/client';
import { debugConsole } from '@/utils/debugConsole';
import { notify } from "@/lib/notify";
import { toast } from "@/hooks/use-toast";

interface TimeSlot {
  id: string;
  start_time: string;
  end_time: string;
  order_index: number;
}

interface Poll {
  id: string;
  title: string;
  description?: string | null;
  deadline?: string | null;
  status: string;
  user_id: string;
  confirmed_slot_id?: string | null;
  confirmed_appointment_id?: string | null;
}

interface Participant {
  id: string;
  name: string | null;
  email: string;
  is_external: boolean;
}

interface PollResponse {
  id: string;
  time_slot_id: string;
  participant_id: string;
  status: 'available' | 'tentative' | 'unavailable';
  comment?: string;
  participant: Participant;
}

interface SlotResults {
  timeSlot: TimeSlot;
  available: number;
  tentative: number;
  unavailable: number;
  total: number;
  responses: PollResponse[];
  score: number;
}

interface PollResultsDashboardProps {
  pollId: string;
  onConfirmSlot?: (slotId: string) => void;
}

export const PollResultsDashboard = ({ pollId, onConfirmSlot }: PollResultsDashboardProps) => {
  const [loading, setLoading] = useState(true);
  const [poll, setPoll] = useState<Poll | null>(null);
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [slotResults, setSlotResults] = useState<SlotResults[]>([]);
  const [creatorName, setCreatorName] = useState<string>('');
  const [confirmedSlot, setConfirmedSlot] = useState<TimeSlot | null>(null);
  const [confirmedAppointmentId, setConfirmedAppointmentId] = useState<string | null>(null);
  const [pendingSlotId, setPendingSlotId] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);

  useEffect(() => {
    const loadPollResults = async () => {
      try {
        const { data: pollData, error: pollError } = await supabase
          .from('appointment_polls')
          .select('id, title, description, deadline, status, user_id, confirmed_slot_id, confirmed_appointment_id')
          .eq('id', pollId)
          .single();

        if (pollError) throw pollError;
        setPoll(pollData);

        const { data: profile } = await supabase
          .from('profiles')
          .select('display_name')
          .eq('user_id', pollData.user_id)
          .maybeSingle();
        setCreatorName(profile?.display_name || 'Unbekannt');

        const { data: slotsData, error: slotsError } = await supabase
          .from('poll_time_slots')
          .select('id, start_time, end_time, order_index')
          .eq('poll_id', pollId)
          .order('order_index');

        if (slotsError) throw slotsError;

        const { data: participantsData, error: participantsError } = await supabase
          .from('poll_participants')
          .select('id, name, email, is_external')
          .eq('poll_id', pollId);

        if (participantsError) throw participantsError;
        setParticipants(participantsData || []);

        const { data: responsesData, error: responsesError } = await supabase
          .from('poll_responses')
          .select(`
            *,
            participant:poll_participants(*)
          `)
          .eq('poll_id', pollId);

        if (responsesError) throw responsesError;

        // Calculate results for each time slot
        const results: SlotResults[] = (slotsData || []).map((slot: Record<string, any>) => {
          const slotResponses = (responsesData || []).filter((r: Record<string, any>) => r.time_slot_id === slot.id);
          
          const available = slotResponses.filter((r: Record<string, any>) => r.status === 'available').length;
          const tentative = slotResponses.filter((r: Record<string, any>) => r.status === 'tentative').length;
          const unavailable = slotResponses.filter((r: Record<string, any>) => r.status === 'unavailable').length;
          const total = participantsData?.length || 0;
          
          // Calculate score: available = 2 points, tentative = 1 point, unavailable = 0 points
          const score = (available * 2) + (tentative * 1);
          
          return {
            timeSlot: slot,
            available,
            tentative,
            unavailable,
            total,
            responses: slotResponses as PollResponse[],
            score
          };
        });

        // Sort by score (highest first)
        results.sort((a, b) => b.score - a.score);
        setSlotResults(results);

        // Ergebnis einer früheren Sitzung wieder anzeigen.
        if (pollData.confirmed_slot_id) {
          const confirmed = (slotsData || []).find((slot: Record<string, any>) => slot.id === pollData.confirmed_slot_id);
          if (confirmed) setConfirmedSlot(confirmed as TimeSlot);
        }
        if (pollData.confirmed_appointment_id) {
          setConfirmedAppointmentId(pollData.confirmed_appointment_id);
        }

      } catch (error) {
        debugConsole.error('Error loading poll results:', error);
        notify.error("Fehler", {
          description: "Die Umfrageergebnisse konnten nicht geladen werden."
});
      } finally {
        setLoading(false);
      }
    };

    loadPollResults();
  }, [pollId, toast]);

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'available':
        return <Check className="h-4 w-4 text-palette-green" />;
      case 'tentative':
        return <AlertCircle className="h-4 w-4 text-palette-yellow" />;
      case 'unavailable':
        return <X className="h-4 w-4 text-palette-red" />;
      default:
        return <span className="h-4 w-4" />;
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'available':
        return 'Verfügbar';
      case 'tentative':
        return 'Vorbehalt';
      case 'unavailable':
        return 'Nicht verfügbar';
      default:
        return 'Keine Antwort';
    }
  };

  const handleConfirmSlot = async (slotId: string) => {
    try {
      const slot = slotResults.find(r => r.timeSlot.id === slotId)?.timeSlot;
      if (!slot) return;

      // Datenbank-RPC: tenant-/owner-geprüft, idempotent über confirmed_appointment_id.
      const { data: appointmentId, error } = await supabase.rpc('confirm_poll_winner', {
        _poll_id: pollId,
        _slot_id: slotId
      });

      if (error) throw error;

      setPoll(prev => prev ? {
        ...prev,
        status: 'completed',
        confirmed_slot_id: slotId,
        confirmed_appointment_id: (appointmentId as string | null) ?? null
      } : null);
      setConfirmedSlot(slot);
      setConfirmedAppointmentId((appointmentId as string | null) ?? null);

      notify.success("Termin bestätigt", {
        description: "Der Gewinner-Slot wurde als Termin in den Kalender übernommen."
});

      // Externe Teilnehmer sind jetzt Gäste des Termins – Einladungen direkt senden.
      if (typeof appointmentId === 'string' && appointmentId) {
        const { data: invitation, error: invitationError } = await supabase.functions.invoke('send-appointment-invitation', {
          body: { appointmentId, reason: 'manual' }
        });
        const sentCount = Number((invitation as { sent?: number } | null)?.sent ?? 0);

        if (invitationError) {
          notify.error("Einladungen nicht versendet", {
            description: "Der Termin wurde angelegt, die Einladungen an die übernommenen Gäste konnten aber nicht versendet werden."
          });
        } else if (sentCount > 0) {
          notify.success("Einladungen versendet", {
            description: `${sentCount} Einladung(en) gingen an die übernommenen Gäste.`
          });
        }
      }

      if (onConfirmSlot) {
        onConfirmSlot(slotId);
      }

    } catch (error) {
      debugConsole.error('Error confirming slot:', error);
      notify.error("Fehler", {
        description: "Der Termin konnte nicht bestätigt werden."
});
    }
  };

  const resendInvitation = async (participantEmail: string) => {
    try {
      debugConsole.log('Resending invitation to:', participantEmail);
      
      const { data, error } = await supabase.functions.invoke('resend-poll-invitation', {
        body: {
          pollId,
          participantEmail
        }
      });

      if (error) {
        debugConsole.error('Function invocation error:', error);
        throw error;
      }

      debugConsole.log('Resend invitation response:', data);

      notify.success("Einladung gesendet", {
        description: `Eine Erinnerung wurde erfolgreich an ${participantEmail} gesendet.`
});

    } catch (error: unknown) {
      debugConsole.error('Error resending invitation:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unbekannter Fehler';
      notify.error("Fehler", {
        description: `Die Einladung konnte nicht erneut gesendet werden: ${errorMessage}`
});
    }
  };

  if (loading) {
    return (
      <Card className="w-full">
        <CardContent className="p-6 text-center">
          <div className="animate-pulse">Lädt Ergebnisse...</div>
        </CardContent>
      </Card>
    );
  }

  if (!poll) {
    return (
      <Card className="w-full">
        <CardContent className="p-6 text-center">
          <div className="text-palette-red">Abstimmung nicht gefunden.</div>
        </CardContent>
      </Card>
    );
  }

  const responseRate = participants.length > 0 
    ? Math.round((slotResults[0]?.responses.length || 0) / participants.length * 100)
    : 0;

  const pendingResult = pendingSlotId
    ? slotResults.find(result => result.timeSlot.id === pendingSlotId)
    : undefined;
  const pendingIsTop = Boolean(pendingResult && slotResults[0]?.timeSlot.id === pendingResult.timeSlot.id);

  return (
    <div className="space-y-6">
      {/* Confirmation Success Banner */}
      {confirmedSlot && (
        <Alert className="border-palette-green/40 bg-palette-green/10">
          <CheckCircle2 className="h-5 w-5 text-palette-green" />
          <AlertDescription className="text-palette-green">
            <strong>Termin bestätigt!</strong> Der Termin am{' '}
            {format(new Date(confirmedSlot.start_time), 'dd. MMMM yyyy', { locale: de })} von{' '}
            {format(new Date(confirmedSlot.start_time), 'HH:mm')} bis{' '}
            {format(new Date(confirmedSlot.end_time), 'HH:mm')} Uhr wurde in den Kalender eingetragen.
            {confirmedAppointmentId && (
              <Button asChild size="sm" variant="outline" className="ml-2">
                <a href={`/calendar?highlight=${confirmedAppointmentId}`}>Im Kalender öffnen</a>
              </Button>
            )}
          </AlertDescription>
        </Alert>
      )}

      {/* Header */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CalendarIcon className="h-5 w-5" />
            Ergebnisse: {poll.title}
          </CardTitle>
          <CardDescription>
            {poll.description && (
              <div className="mb-2">{poll.description}</div>
            )}
            <div className="flex gap-4 text-sm flex-wrap">
              <span>
                <Users className="inline h-4 w-4 mr-1" />
                {participants.length} Teilnehmer eingeladen
              </span>
              <span>Antwortrate: {responseRate}%</span>
              {creatorName && (
                <span>Erstellt von: <strong>{creatorName}</strong></span>
              )}
              {poll.deadline && (
                <span>
                  Frist: {format(new Date(poll.deadline), 'dd. MMMM yyyy', { locale: de })}
                </span>
              )}
            </div>
          </CardDescription>
        </CardHeader>
      </Card>

      {/* Results Overview */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Trophy className="h-5 w-5" />
            Terminoptionen nach Beliebtheit
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {slotResults.map((result, index) => (
              <Card key={result.timeSlot.id} className={index === 0 ? 'border-success bg-success/5 dark:border-success dark:bg-success/10' : ''}>
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      {index === 0 && (
                        <Trophy className="h-5 w-5 text-warning" />
                      )}
                      <div>
                        <div className="flex items-center gap-2 font-medium text-foreground">
                          <CalendarIcon className="h-4 w-4" />
                          {format(new Date(result.timeSlot.start_time), 'dd. MMMM yyyy', { locale: de })}
                          <Clock className="h-4 w-4 ml-2" />
                          {format(new Date(result.timeSlot.start_time), 'HH:mm')} - 
                          {format(new Date(result.timeSlot.end_time), 'HH:mm')}
                        </div>
                        <div className="flex gap-3 mt-2">
                          <Badge variant="outline" className="text-success border-success/30">
                            <Check className="h-3 w-3 mr-1" />
                            {result.available} verfügbar
                          </Badge>
                          <Badge variant="outline" className="text-warning border-warning/30">
                            <AlertCircle className="h-3 w-3 mr-1" />
                            {result.tentative} vorbehalt
                          </Badge>
                          <Badge variant="outline" className="text-destructive border-destructive/30">
                            <X className="h-3 w-3 mr-1" />
                            {result.unavailable} nicht verfügbar
                          </Badge>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="text-right">
                        <div className="font-bold text-lg text-foreground">Score: {result.score}</div>
                        <div className="text-sm text-muted-foreground">
                          {result.responses.length}/{result.total} Antworten
                        </div>
                      </div>
                      {poll.status === 'active' && (
                        <Button
                          onClick={() => setPendingSlotId(result.timeSlot.id)}
                          variant={index === 0 ? "default" : "outline"}
                        >
                          Termin bestätigen
                        </Button>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Detailed Responses */}
      <Card>
        <CardHeader>
          <CardTitle>Detaillierte Antworten</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Teilnehmer</TableHead>
                <TableHead className="text-center">Aktionen</TableHead>
                {slotResults.map((result) => (
                  <TableHead key={result.timeSlot.id} className="text-center min-w-32">
                    <div className="text-xs">
                      {format(new Date(result.timeSlot.start_time), 'dd.MM.', { locale: de })}
                    </div>
                    <div className="text-xs">
                      {format(new Date(result.timeSlot.start_time), 'HH:mm', { locale: de })}
                    </div>
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {participants.map((participant) => (
                <TableRow key={participant.id}>
                  <TableCell>
                    <div>
                      <div className="font-medium">{participant.name}</div>
                      <div className="text-sm text-muted-foreground flex items-center gap-1">
                        {participant.is_external ? (
                          <>
                            <span className="h-2 w-2 bg-palette-blue rounded-full"></span>
                            <span className="truncate max-w-32">{participant.email}</span>
                          </>
                        ) : (
                          <>
                            <span className="h-2 w-2 bg-palette-green rounded-full"></span>
                            <span className="truncate max-w-32">{participant.email}</span>
                          </>
                        )}
                      </div>
                    </div>
                  </TableCell>
                  <TableCell className="text-center">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => resendInvitation(participant.email)}
                      title="Erneute Einladung senden"
                    >
                      <Mail className="h-4 w-4" />
                    </Button>
                  </TableCell>
                  {slotResults.map((result) => {
                    const response = result.responses.find(r => r.participant_id === participant.id);
                    return (
                      <TableCell key={result.timeSlot.id} className="text-center">
                        {response ? (
                          <div className="flex flex-col items-center gap-1">
                            <div className="flex items-center gap-1">
                              {getStatusIcon(response.status)}
                              <span className="text-sm">{getStatusLabel(response.status)}</span>
                            </div>
                            {response.comment && (
                              <div className="text-xs text-muted-foreground italic">
                                "{response.comment}"
                              </div>
                            )}
                          </div>
                        ) : (
                          <span className="text-muted-foreground text-sm">Keine Antwort</span>
                        )}
                      </TableCell>
                    );
                  })}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <AlertDialog open={Boolean(pendingSlotId)} onOpenChange={(open) => !open && setPendingSlotId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Termin verbindlich übernehmen?</AlertDialogTitle>
            <AlertDialogDescription>
              {pendingResult && (
                <>
                  {format(new Date(pendingResult.timeSlot.start_time), 'dd. MMMM yyyy', { locale: de })} von{' '}
                  {format(new Date(pendingResult.timeSlot.start_time), 'HH:mm')} bis{' '}
                  {format(new Date(pendingResult.timeSlot.end_time), 'HH:mm')} Uhr. {pendingResult.responses.length} von{' '}
                  {pendingResult.total} Teilnehmern haben geantwortet.
                </>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>

          {(pendingResult?.responses.length ?? 0) === 0 ? (
            <p className="text-sm text-destructive">
              Achtung: Für diesen Slot liegt noch keine Rückmeldung vor.
            </p>
          ) : !pendingIsTop ? (
            <p className="text-sm text-destructive">
              Achtung: Dieser Slot ist nicht die bestbewertete Option. Die Abstimmung wird mit dieser Auswahl abgeschlossen.
            </p>
          ) : (
            <p className="text-sm text-muted-foreground">
              Der Slot ist die bestbewertete Option. Die Abstimmung wird abgeschlossen und der Termin im Kalender angelegt.
            </p>
          )}

          <p className="text-sm text-muted-foreground">
            Externe Teilnehmer werden als Gäste übernommen und direkt eingeladen.
          </p>

          <AlertDialogFooter>
            <AlertDialogCancel>Abbrechen</AlertDialogCancel>
            <AlertDialogAction
              disabled={confirming}
              onClick={async () => {
                if (!pendingSlotId) return;
                setConfirming(true);
                await handleConfirmSlot(pendingSlotId);
                setConfirming(false);
                setPendingSlotId(null);
              }}
            >
              {confirming ? 'Übernehme…' : 'Termin anlegen'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};
