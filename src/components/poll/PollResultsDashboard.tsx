import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { CalendarIcon, Clock, Users, Check, AlertCircle, X, Trophy } from 'lucide-react';
import { format } from 'date-fns';
import { de } from 'date-fns/locale';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface TimeSlot {
  id: string;
  start_time: string;
  end_time: string;
  order_index: number;
}

interface Poll {
  id: string;
  title: string;
  description?: string;
  deadline?: string;
  status: string;
  user_id: string;
}

interface Participant {
  id: string;
  name: string;
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
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [poll, setPoll] = useState<Poll | null>(null);
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [slotResults, setSlotResults] = useState<SlotResults[]>([]);

  useEffect(() => {
    const loadPollResults = async () => {
      try {
        // Load poll information
        const { data: pollData, error: pollError } = await supabase
          .from('appointment_polls')
          .select('*')
          .eq('id', pollId)
          .single();

        if (pollError) throw pollError;
        setPoll(pollData);

        // Load time slots
        const { data: slotsData, error: slotsError } = await supabase
          .from('poll_time_slots')
          .select('*')
          .eq('poll_id', pollId)
          .order('order_index');

        if (slotsError) throw slotsError;

        // Load participants
        const { data: participantsData, error: participantsError } = await supabase
          .from('poll_participants')
          .select('*')
          .eq('poll_id', pollId);

        if (participantsError) throw participantsError;
        setParticipants(participantsData || []);

        // Load responses with participant data
        const { data: responsesData, error: responsesError } = await supabase
          .from('poll_responses')
          .select(`
            *,
            participant:poll_participants(*)
          `)
          .eq('poll_id', pollId);

        if (responsesError) throw responsesError;

        // Calculate results for each time slot
        const results: SlotResults[] = (slotsData || []).map(slot => {
          const slotResponses = (responsesData || []).filter(r => r.time_slot_id === slot.id);
          
          const available = slotResponses.filter(r => r.status === 'available').length;
          const tentative = slotResponses.filter(r => r.status === 'tentative').length;
          const unavailable = slotResponses.filter(r => r.status === 'unavailable').length;
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

      } catch (error) {
        console.error('Error loading poll results:', error);
        toast({
          title: "Fehler",
          description: "Die Umfrageergebnisse konnten nicht geladen werden.",
          variant: "destructive",
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
        return <Check className="h-4 w-4 text-green-600" />;
      case 'tentative':
        return <AlertCircle className="h-4 w-4 text-yellow-600" />;
      case 'unavailable':
        return <X className="h-4 w-4 text-red-600" />;
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
      // Create appointment from poll
      const slot = slotResults.find(r => r.timeSlot.id === slotId)?.timeSlot;
      if (!slot) return;

      const { data: appointment, error: appointmentError } = await supabase
        .from('appointments')
        .insert({
          user_id: poll?.user_id,
          poll_id: pollId,
          start_time: slot.start_time,
          end_time: slot.end_time,
          title: poll?.title || 'Bestätigter Termin',
          description: poll?.description,
          tenant_id: 'default-tenant-id', // TODO: Add proper tenant context
          category: 'meeting',
          status: 'confirmed',
          priority: 'high'
        })
        .select()
        .single();

      if (appointmentError) throw appointmentError;

      // Update poll status to completed
      const { error: pollUpdateError } = await supabase
        .from('appointment_polls')
        .update({ status: 'completed' })
        .eq('id', pollId);

      if (pollUpdateError) throw pollUpdateError;

      toast({
        title: "Termin bestätigt",
        description: "Der Termin wurde erfolgreich bestätigt und in den Kalender eingetragen.",
      });

      if (onConfirmSlot) {
        onConfirmSlot(slotId);
      }

    } catch (error) {
      console.error('Error confirming slot:', error);
      toast({
        title: "Fehler",
        description: "Der Termin konnte nicht bestätigt werden.",
        variant: "destructive",
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
          <div className="text-red-500">Abstimmung nicht gefunden.</div>
        </CardContent>
      </Card>
    );
  }

  const responseRate = participants.length > 0 
    ? Math.round((slotResults[0]?.responses.length || 0) / participants.length * 100)
    : 0;

  return (
    <div className="space-y-6">
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
            <div className="flex gap-4 text-sm">
              <span>
                <Users className="inline h-4 w-4 mr-1" />
                {participants.length} Teilnehmer eingeladen
              </span>
              <span>Antwortrate: {responseRate}%</span>
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
              <Card key={result.timeSlot.id} className={index === 0 ? 'border-green-200 bg-green-50' : ''}>
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      {index === 0 && (
                        <Trophy className="h-5 w-5 text-yellow-500" />
                      )}
                      <div>
                        <div className="flex items-center gap-2 font-medium">
                          <CalendarIcon className="h-4 w-4" />
                          {format(new Date(result.timeSlot.start_time), 'dd. MMMM yyyy', { locale: de })}
                          <Clock className="h-4 w-4 ml-2" />
                          {format(new Date(result.timeSlot.start_time), 'HH:mm')} - 
                          {format(new Date(result.timeSlot.end_time), 'HH:mm')}
                        </div>
                        <div className="flex gap-3 mt-2">
                          <Badge variant="outline" className="text-green-600">
                            <Check className="h-3 w-3 mr-1" />
                            {result.available} verfügbar
                          </Badge>
                          <Badge variant="outline" className="text-yellow-600">
                            <AlertCircle className="h-3 w-3 mr-1" />
                            {result.tentative} vorbehalt
                          </Badge>
                          <Badge variant="outline" className="text-red-600">
                            <X className="h-3 w-3 mr-1" />
                            {result.unavailable} nicht verfügbar
                          </Badge>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="text-right">
                        <div className="font-bold text-lg">Score: {result.score}</div>
                        <div className="text-sm text-muted-foreground">
                          {result.responses.length}/{result.total} Antworten
                        </div>
                      </div>
                      {poll.status === 'active' && (
                        <Button
                          onClick={() => handleConfirmSlot(result.timeSlot.id)}
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
                            <span className="h-2 w-2 bg-blue-500 rounded-full"></span>
                            Extern
                          </>
                        ) : (
                          <>
                            <span className="h-2 w-2 bg-green-500 rounded-full"></span>
                            Intern
                          </>
                        )}
                      </div>
                    </div>
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
    </div>
  );
};