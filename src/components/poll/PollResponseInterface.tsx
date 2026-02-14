import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { CalendarIcon, Clock, Check, AlertCircle, X } from 'lucide-react';
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
}

interface Participant {
  id: string;
  name: string;
  email: string;
  is_external?: boolean;
}

interface Response {
  time_slot_id: string;
  status: 'available' | 'tentative' | 'unavailable';
  comment?: string;
}

interface PollResponseInterfaceProps {
  pollId: string;
  token?: string;
  participantId?: string;
  isPreview?: boolean;
}

export const PollResponseInterface = ({ pollId, token, participantId, isPreview = false }: PollResponseInterfaceProps) => {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [poll, setPoll] = useState<Poll | null>(null);
  const [timeSlots, setTimeSlots] = useState<TimeSlot[]>([]);
  const [participant, setParticipant] = useState<Participant | null>(null);
  const [responses, setResponses] = useState<Record<string, Response>>({});
  const [generalComment, setGeneralComment] = useState('');

  useEffect(() => {
    const loadPollData = async () => {
      try {
        // Load poll information
        const { data: pollData, error: pollError } = await supabase
          .from('appointment_polls')
          .select('*')
          .eq('id', pollId)
          .maybeSingle();

        if (pollError) {
          console.error('Poll loading error:', pollError);
          throw new Error('Abstimmung nicht gefunden oder ungültiger Link.');
        }
        if (!pollData) {
          throw new Error('Abstimmung nicht gefunden oder ungültiger Link.');
        }
        setPoll(pollData);

        // Load time slots
        const { data: slotsData, error: slotsError } = await supabase
          .from('poll_time_slots')
          .select('*')
          .eq('poll_id', pollId)
          .order('order_index');

        if (slotsError) {
          console.error('Time slots loading error:', slotsError);
          throw slotsError;
        }
        setTimeSlots(slotsData || []);

        // Load or create participant
        let currentParticipant = null;
        
        if (participantId) {
          // Internal participant
          const { data: participantData, error: participantError } = await supabase
            .from('poll_participants')
            .select('*')
            .eq('id', participantId)
            .single();

          if (participantError) throw participantError;
          currentParticipant = participantData;
        } else if (token) {
          // External participant with token
          const { data: participantData, error: participantError } = await supabase
            .from('poll_participants')
            .select('*')
            .eq('poll_id', pollId)
            .eq('token', token)
            .maybeSingle();

          if (participantError) throw participantError;
          currentParticipant = participantData;
        } else {
          // Try to find participant without token (fallback for old links)
          const { data: participantData, error: participantError } = await supabase
            .from('poll_participants')
            .select('*')
            .eq('poll_id', pollId)
            .eq('is_external', true)
            .maybeSingle();

          if (!participantError && participantData) {
            currentParticipant = participantData;
          }
        }

        setParticipant(currentParticipant);

        // Load existing responses
        if (currentParticipant) {
          const { data: responsesData, error: responsesError } = await supabase
            .from('poll_responses')
            .select('*')
            .eq('poll_id', pollId)
            .eq('participant_id', currentParticipant.id);

          if (!responsesError && responsesData) {
            const responsesMap: Record<string, Response> = {};
            responsesData.forEach(response => {
              responsesMap[response.time_slot_id] = {
                time_slot_id: response.time_slot_id,
                status: response.status as 'available' | 'tentative' | 'unavailable',
                comment: response.comment || ''
              };
            });
            setResponses(responsesMap);
          }
        }

      } catch (error) {
        console.error('Error loading poll data:', error);
        toast({
          title: "Fehler",
          description: "Die Abstimmung konnte nicht geladen werden.",
          variant: "destructive",
        });
      } finally {
        setLoading(false);
      }
    };

    loadPollData();
  }, [pollId, token, participantId, toast]);

  const updateResponse = (timeSlotId: string, status: 'available' | 'tentative' | 'unavailable') => {
    setResponses(prev => ({
      ...prev,
      [timeSlotId]: {
        time_slot_id: timeSlotId,
        status,
        comment: prev[timeSlotId]?.comment || ''
      }
    }));
  };

  const updateComment = (timeSlotId: string, comment: string) => {
    setResponses(prev => ({
      ...prev,
      [timeSlotId]: {
        ...prev[timeSlotId],
        time_slot_id: timeSlotId,
        status: prev[timeSlotId]?.status || 'unavailable',
        comment
      }
    }));
  };

  const saveResponses = async () => {
    if (!participant) return;

    setSaving(true);
    try {
      // Delete existing responses
      await supabase
        .from('poll_responses')
        .delete()
        .eq('poll_id', pollId)
        .eq('participant_id', participant.id);

      // Insert new responses
      const responsesToInsert = Object.values(responses).map(response => ({
        poll_id: pollId,
        time_slot_id: response.time_slot_id,
        participant_id: participant.id,
        status: response.status,
        comment: response.comment || null
      }));

      const { error } = await supabase
        .from('poll_responses')
        .insert(responsesToInsert);

      if (error) throw error;

      toast({
        title: "Antworten gespeichert",
        description: "Ihre Verfügbarkeiten wurden erfolgreich übermittelt.",
      });

    } catch (error) {
      console.error('Error saving responses:', error);
      toast({
        title: "Fehler",
        description: "Die Antworten konnten nicht gespeichert werden.",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'available':
        return <Check className="h-4 w-4" />;
      case 'tentative':
        return <AlertCircle className="h-4 w-4" />;
      case 'unavailable':
        return <X className="h-4 w-4" />;
      default:
        return null;
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
        return 'Nicht beantwortet';
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'available':
        return 'bg-green-500 hover:bg-green-600 text-white';
      case 'tentative':
        return 'bg-yellow-500 hover:bg-yellow-600 text-white';
      case 'unavailable':
        return 'bg-red-500 hover:bg-red-600 text-white';
      default:
        return 'bg-gray-200 hover:bg-gray-300 text-gray-700';
    }
  };

  if (loading) {
    return (
      <Card className="w-full max-w-2xl mx-auto">
        <CardContent className="p-6 text-center">
          <div className="animate-pulse">Lädt...</div>
        </CardContent>
      </Card>
    );
  }

  if (!poll) {
    return (
      <Card className="w-full max-w-2xl mx-auto">
        <CardContent className="p-6 text-center">
          <div className="text-red-500">Abstimmung nicht gefunden oder ungültiger Link.</div>
        </CardContent>
      </Card>
    );
  }

  if (!participant && !isPreview) {
    return (
      <Card className="w-full max-w-2xl mx-auto">
        <CardContent className="p-6 text-center">
          <div className="text-red-500">Kein gültiger Teilnehmer-Token gefunden.</div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="w-full max-w-2xl mx-auto">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <CalendarIcon className="h-5 w-5" />
          {poll.title}
        </CardTitle>
        <CardDescription>
          {poll.description && (
            <div className="mb-2">{poll.description}</div>
          )}
          {isPreview ? (
            <div className="text-sm">
              <Badge variant="outline" className="mr-2">Vorschau-Modus</Badge>
              Dies ist eine Vorschau der Terminabstimmung.
            </div>
          ) : participant ? (
            <div className="text-sm">
              Teilnehmer: <strong>{participant.name}</strong> ({participant.email})
              {participant.is_external && (
                <Badge variant="outline" className="ml-2">Extern</Badge>
              )}
            </div>
          ) : null}
          {poll.deadline && (
            <div className="text-sm">
              Antwortfrist: {format(new Date(poll.deadline), 'dd. MMMM yyyy', { locale: de })}
            </div>
          )}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div>
          <Label className="text-base font-medium">Ihre Verfügbarkeit für die vorgeschlagenen Termine:</Label>
          <div className="space-y-4 mt-4">
            {timeSlots.map((slot) => {
              const response = responses[slot.id];
              return (
                <Card key={slot.id} className="p-4">
                  <div className="space-y-3">
                    <div className="flex items-center gap-2">
                      <CalendarIcon className="h-4 w-4 text-muted-foreground" />
                      <span className="font-medium">
                        {format(new Date(slot.start_time), 'dd. MMMM yyyy', { locale: de })}
                      </span>
                      <Clock className="h-4 w-4 text-muted-foreground ml-2" />
                      <span>
                        {format(new Date(slot.start_time), 'HH:mm')} - {format(new Date(slot.end_time), 'HH:mm')}
                      </span>
                    </div>

                    <div className="flex gap-2">
                      {['available', 'tentative', 'unavailable'].map((status) => (
                        <Button
                          key={status}
                          size="sm"
                          variant={response?.status === status ? "default" : "outline"}
                          className={response?.status === status ? getStatusColor(status) : ''}
                          onClick={() => updateResponse(slot.id, status as 'available' | 'tentative' | 'unavailable')}
                        >
                          {getStatusIcon(status)}
                          <span className="ml-1">{getStatusLabel(status)}</span>
                        </Button>
                      ))}
                    </div>

                    {response?.status && (
                      <div className="space-y-2">
                        <Badge variant="secondary" className="flex items-center gap-1 w-fit">
                          {getStatusIcon(response.status)}
                          {getStatusLabel(response.status)}
                        </Badge>
                        
                        <div>
                          <Label htmlFor={`comment-${slot.id}`} className="text-sm">
                            Kommentar (optional)
                          </Label>
                          <Textarea
                            id={`comment-${slot.id}`}
                            value={response.comment || ''}
                            onChange={(e) => updateComment(slot.id, e.target.value)}
                            placeholder="Zusätzliche Anmerkungen zu diesem Termin..."
                            rows={2}
                            className="mt-1"
                          />
                        </div>
                      </div>
                    )}
                  </div>
                </Card>
              );
            })}
          </div>
        </div>

        {!isPreview && (
          <div className="flex justify-end gap-2 pt-4 border-t">
            <Button onClick={saveResponses} disabled={saving} className="bg-primary hover:bg-primary/90">
              {saving ? 'Speichert...' : 'Antworten speichern'}
            </Button>
          </div>
        )}
        {isPreview && (
          <div className="flex justify-center gap-2 pt-4 border-t">
            <Badge variant="secondary">Vorschau-Modus - Antworten können nicht gespeichert werden</Badge>
          </div>
        )}
      </CardContent>
    </Card>
  );
};