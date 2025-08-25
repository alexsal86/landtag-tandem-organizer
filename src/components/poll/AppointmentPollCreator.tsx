import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { CalendarIcon, Clock, Plus, X, Users, Mail } from 'lucide-react';
import { format } from 'date-fns';
import { de } from 'date-fns/locale';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';

interface TimeSlot {
  id: string;
  date: Date;
  startTime: string;
  endTime: string;
}

interface Participant {
  id: string;
  type: 'internal' | 'external';
  userId?: string;
  email: string;
  name: string;
}

export const AppointmentPollCreator = ({ onClose }: { onClose: () => void }) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  
  // Form state
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [deadline, setDeadline] = useState<Date | undefined>();
  const [timeSlots, setTimeSlots] = useState<TimeSlot[]>([]);
  const [participants, setParticipants] = useState<Participant[]>([]);
  
  // UI state
  const [selectedDate, setSelectedDate] = useState<Date | undefined>();
  const [startTime, setStartTime] = useState('09:00');
  const [endTime, setEndTime] = useState('10:00');
  const [newParticipantEmail, setNewParticipantEmail] = useState('');
  const [contacts, setContacts] = useState<any[]>([]);

  // Load contacts on component mount
  useEffect(() => {
    const loadContacts = async () => {
      if (!user) return;
      
      const { data, error } = await supabase
        .from('contacts')
        .select('*')
        .eq('user_id', user.id)
        .order('name');
        
      if (error) {
        console.error('Error loading contacts:', error);
        return;
      }
      
      setContacts(data || []);
    };
    
    loadContacts();
  }, [user]);

  const addTimeSlot = () => {
    if (!selectedDate) {
      toast({
        title: "Datum erforderlich",
        description: "Bitte wählen Sie ein Datum für den Zeitslot aus.",
        variant: "destructive",
      });
      return;
    }

    const newSlot: TimeSlot = {
      id: Date.now().toString(),
      date: selectedDate,
      startTime,
      endTime
    };

    setTimeSlots([...timeSlots, newSlot]);
    setSelectedDate(undefined);
    setStartTime('09:00');
    setEndTime('10:00');
  };

  const removeTimeSlot = (id: string) => {
    setTimeSlots(timeSlots.filter(slot => slot.id !== id));
  };

  const addParticipantFromContact = (contact: any) => {
    if (!contact.email) {
      toast({
        title: "Keine E-Mail-Adresse",
        description: "Dieser Kontakt hat keine E-Mail-Adresse.",
        variant: "destructive",
      });
      return;
    }

    const participant: Participant = {
      id: Date.now().toString(),
      type: 'internal',
      email: contact.email,
      name: contact.name
    };

    setParticipants([...participants, participant]);
  };

  const addExternalParticipant = () => {
    if (!newParticipantEmail) return;

    const participant: Participant = {
      id: Date.now().toString(),
      type: 'external',
      email: newParticipantEmail,
      name: newParticipantEmail.split('@')[0]
    };

    setParticipants([...participants, participant]);
    setNewParticipantEmail('');
  };

  const removeParticipant = (id: string) => {
    setParticipants(participants.filter(p => p.id !== id));
  };

  const createPoll = async () => {
    if (!user || !title || timeSlots.length === 0 || participants.length === 0) {
      toast({
        title: "Fehlende Angaben",
        description: "Bitte füllen Sie alle erforderlichen Felder aus.",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);

    try {
      // Create poll
      const { data: poll, error: pollError } = await supabase
        .from('appointment_polls')
        .insert({
          user_id: user.id,
          title,
          description,
          deadline: deadline?.toISOString(),
          status: 'active'
        })
        .select()
        .single();

      if (pollError) throw pollError;

      // Create time slots
      const timeSlotData = timeSlots.map((slot, index) => ({
        poll_id: poll.id,
        start_time: new Date(`${format(slot.date, 'yyyy-MM-dd')}T${slot.startTime}:00`).toISOString(),
        end_time: new Date(`${format(slot.date, 'yyyy-MM-dd')}T${slot.endTime}:00`).toISOString(),
        order_index: index
      }));

      const { error: slotsError } = await supabase
        .from('poll_time_slots')
        .insert(timeSlotData);

      if (slotsError) throw slotsError;

      // Get current user profile for creator name
      const { data: profile } = await supabase
        .from('profiles')
        .select('display_name')
        .eq('user_id', user.id)
        .single();

      const creatorName = profile?.display_name || user.email || 'Unbekannt';

      // Create participants with improved error handling
      console.log('Creating participants for poll:', poll.id);
      const participantData = [];
      
      // Process each participant individually to avoid conflicts
      for (const p of participants) {
        try {
          if (p.type === 'external') {
            // Generate token for external participants
            const { data: tokenData, error: tokenError } = await supabase.rpc('generate_participant_token');
            if (tokenError) {
              console.error('Error generating token for', p.email, ':', tokenError);
              throw new Error(`Token-Generierung fehlgeschlagen für ${p.email}`);
            }

            participantData.push({
              poll_id: poll.id,
              email: p.email,
              name: p.name,
              is_external: true,
              token: tokenData
            });
          } else {
            participantData.push({
              poll_id: poll.id,
              email: p.email,
              name: p.name,
              is_external: false,
              token: null
            });
          }
        } catch (error) {
          console.error('Error processing participant', p.email, ':', error);
          throw new Error(`Fehler beim Verarbeiten von Teilnehmer ${p.email}`);
        }
      }
      
      console.log('Inserting participant data:', participantData);
      const { error: participantsError } = await supabase
        .from('poll_participants')
        .insert(participantData);

      if (participantsError) {
        console.error('Error creating participants:', participantsError);
        throw new Error(`Teilnehmer konnten nicht erstellt werden: ${participantsError.message}`);
      }
      
      console.log('Successfully created', participantData.length, 'participants');

      // Send invitations to external participants
      const externalEmails = participants
        .filter(p => p.type === 'external')
        .map(p => p.email);

      if (externalEmails.length > 0) {
        
        const { data: emailData, error: emailError } = await supabase.functions.invoke('send-poll-invitation', {
          body: {
            pollId: poll.id,
            participantEmails: externalEmails,
            pollTitle: title,
            pollDescription: description,
            creatorName
          }
        });

        if (emailError) {
          console.error('Error sending emails:', emailError);
          toast({
            title: "E-Mail-Versendung fehlgeschlagen",
            description: `Die Abstimmung wurde erstellt, aber E-Mails konnten nicht versendet werden: ${emailError.message}`,
            variant: "destructive",
          });
        } else {
          console.log('Email response:', emailData);
          toast({
            title: "Abstimmung erstellt",
            description: "Die Terminabstimmung wurde erfolgreich erstellt und Einladungen versendet.",
          });
        }
      } else {
        toast({
          title: "Abstimmung erstellt",
          description: "Die Terminabstimmung wurde erfolgreich erstellt.",
        });
      }

      onClose();
    } catch (error) {
      console.error('Error creating poll:', error);
      toast({
        title: "Fehler",
        description: "Die Abstimmung konnte nicht erstellt werden.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className="w-full max-w-4xl mx-auto">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Users className="h-5 w-5" />
          Neue Terminabstimmung erstellen
        </CardTitle>
        <CardDescription>
          Erstellen Sie eine Umfrage, um den besten Termin für alle Beteiligten zu finden.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Basic Information */}
        <div className="space-y-4">
          <div>
            <Label htmlFor="title">Titel *</Label>
            <Input
              id="title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Besprechung Projekt XY"
            />
          </div>
          
          <div>
            <Label htmlFor="description">Beschreibung</Label>
            <Textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Zusätzliche Informationen zum Termin..."
              rows={3}
            />
          </div>

          <div>
            <Label>Antwortfrist</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" className="w-full justify-start text-left font-normal">
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {deadline ? format(deadline, 'dd. MMMM yyyy', { locale: de }) : 'Antwortfrist wählen'}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0">
                <Calendar
                  mode="single"
                  selected={deadline}
                  onSelect={setDeadline}
                  initialFocus
                />
              </PopoverContent>
            </Popover>
          </div>
        </div>

        {/* Time Slots */}
        <div className="space-y-4">
          <Label className="text-base font-medium">Zeitslots vorschlagen *</Label>
          
          <div className="flex gap-4 p-4 border rounded-lg bg-muted/50">
            <div className="flex-1">
              <Label className="text-sm">Datum</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className="w-full justify-start text-left font-normal">
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {selectedDate ? format(selectedDate, 'dd. MMMM yyyy', { locale: de }) : 'Datum wählen'}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0">
                  <Calendar
                    mode="single"
                    selected={selectedDate}
                    onSelect={setSelectedDate}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
            </div>
            
            <div>
              <Label className="text-sm">Startzeit</Label>
              <Select value={startTime} onValueChange={setStartTime}>
                <SelectTrigger className="w-24">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Array.from({ length: 24 }, (_, i) => (
                    <SelectItem key={i} value={`${i.toString().padStart(2, '0')}:00`}>
                      {i.toString().padStart(2, '0')}:00
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            <div>
              <Label className="text-sm">Endzeit</Label>
              <Select value={endTime} onValueChange={setEndTime}>
                <SelectTrigger className="w-24">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Array.from({ length: 24 }, (_, i) => (
                    <SelectItem key={i} value={`${i.toString().padStart(2, '0')}:00`}>
                      {i.toString().padStart(2, '0')}:00
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            <div className="flex items-end">
              <Button onClick={addTimeSlot} size="sm">
                <Plus className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {timeSlots.length > 0 && (
            <div className="space-y-2">
              <Label className="text-sm font-medium">Vorgeschlagene Zeitslots:</Label>
              {timeSlots.map((slot) => (
                <div key={slot.id} className="flex items-center justify-between p-3 border rounded-lg">
                  <div className="flex items-center gap-2">
                    <CalendarIcon className="h-4 w-4 text-muted-foreground" />
                    <span>{format(slot.date, 'dd. MMMM yyyy', { locale: de })}</span>
                    <Clock className="h-4 w-4 text-muted-foreground ml-2" />
                    <span>{slot.startTime} - {slot.endTime}</span>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => removeTimeSlot(slot.id)}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Participants */}
        <div className="space-y-4">
          <Label className="text-base font-medium">Teilnehmer einladen *</Label>
          
          {/* Add from contacts */}
          <div>
            <Label className="text-sm">Aus Kontakten hinzufügen</Label>
            <Select onValueChange={(contactId) => {
              const contact = contacts.find(c => c.id === contactId);
              if (contact) addParticipantFromContact(contact);
            }}>
              <SelectTrigger>
                <SelectValue placeholder="Kontakt auswählen..." />
              </SelectTrigger>
              <SelectContent>
                {contacts.map((contact) => (
                  <SelectItem key={contact.id} value={contact.id}>
                    {contact.name} {contact.email && `(${contact.email})`}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Add external participant */}
          <div>
            <Label className="text-sm">Externe E-Mail-Adresse hinzufügen</Label>
            <div className="flex gap-2">
              <Input
                type="email"
                value={newParticipantEmail}
                onChange={(e) => setNewParticipantEmail(e.target.value)}
                placeholder="externe@email.de"
                onKeyPress={(e) => e.key === 'Enter' && addExternalParticipant()}
              />
              <Button onClick={addExternalParticipant} size="sm" variant="outline">
                <Plus className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {participants.length > 0 && (
            <div className="space-y-2">
              <Label className="text-sm font-medium">Eingeladene Teilnehmer:</Label>
              <div className="flex flex-wrap gap-2">
                {participants.map((participant) => (
                  <Badge key={participant.id} variant="secondary" className="flex items-center gap-1">
                    {participant.type === 'external' ? (
                      <Mail className="h-3 w-3" />
                    ) : (
                      <Users className="h-3 w-3" />
                    )}
                    {participant.name}
                    <button
                      onClick={() => removeParticipant(participant.id)}
                      className="ml-1 hover:text-destructive"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </Badge>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="flex justify-end gap-2 pt-4 border-t">
          <Button variant="outline" onClick={onClose}>
            Abbrechen
          </Button>
          <Button onClick={createPoll} disabled={loading}>
            {loading ? 'Erstelle...' : 'Abstimmung erstellen'}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};