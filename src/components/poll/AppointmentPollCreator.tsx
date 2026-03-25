import { useState, useEffect } from 'react';
import { debugConsole } from '@/utils/debugConsole';
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
import { isValidEmail } from '@/lib/utils';
import { ContactSelector, type ContactSelectorContact } from '@/components/ContactSelector';

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

  const normalizeEmail = (email: string) => email.trim().toLowerCase();

  const addTimeSlot = () => {
    if (!selectedDate) {
      toast({
        title: "Datum erforderlich",
        description: "Bitte wählen Sie ein Datum für den Zeitslot aus.",
        variant: "destructive",
      });
      return;
    }

    // Check for duplicate time slots
    const isDuplicate = timeSlots.some(slot => 
      format(slot.date, 'yyyy-MM-dd') === format(selectedDate, 'yyyy-MM-dd') &&
      slot.startTime === startTime &&
      slot.endTime === endTime
    );

    if (isDuplicate) {
      toast({
        title: "Duplikat",
        description: "Dieser Zeitslot wurde bereits hinzugefügt.",
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

  const addParticipantFromContact = (contact: ContactSelectorContact) => {
    if (!contact.email) {
      toast({
        title: "Keine E-Mail-Adresse",
        description: "Dieser Kontakt hat keine E-Mail-Adresse.",
        variant: "destructive",
      });
      return;
    }

    // Check if participant already exists
    const normalizedContactEmail = normalizeEmail(contact.email);

    if (participants.find(p => normalizeEmail(p.email) === normalizedContactEmail)) {
      toast({
        title: "Bereits hinzugefügt",
        description: "Dieser Kontakt wurde bereits hinzugefügt.",
        variant: "destructive",
      });
      return;
    }

    const participant: Participant = {
      id: Date.now().toString(),
      type: 'internal',
      email: normalizedContactEmail,
      name: contact.name
    };

    setParticipants([...participants, participant]);
  };

  const addExternalParticipant = () => {
    const normalizedEmail = normalizeEmail(newParticipantEmail);

    if (!normalizedEmail) return;

    if (!isValidEmail(normalizedEmail)) {
      toast({
        title: "Ungültige E-Mail-Adresse",
        description: "Bitte geben Sie eine gültige E-Mail-Adresse ein.",
        variant: "destructive",
      });
      return;
    }

    if (participants.find(p => normalizeEmail(p.email) === normalizedEmail)) {
      toast({
        title: "Bereits hinzugefügt",
        description: "Dieser Teilnehmer wurde bereits hinzugefügt.",
        variant: "destructive",
      });
      return;
    }

    const participant: Participant = {
      id: Date.now().toString(),
      type: 'external',
      email: normalizedEmail,
      name: normalizedEmail.split('@')[0]
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
      const timeSlotData = timeSlots.map((slot, index) => ({
        start_time: new Date(`${format(slot.date, 'yyyy-MM-dd')}T${slot.startTime}:00`).toISOString(),
        end_time: new Date(`${format(slot.date, 'yyyy-MM-dd')}T${slot.endTime}:00`).toISOString(),
        order_index: index
      }));

      const participantData = participants.map((participant) => ({
        email: participant.email,
        name: participant.name,
        is_external: participant.type === 'external'
      }));

      const { data: pollId, error: createPollError } = await supabase.rpc('create_appointment_poll_with_details', {
        p_title: title,
        p_description: description || undefined,
        p_deadline: deadline?.toISOString() ?? undefined,
        p_time_slots: timeSlotData,
        p_participants: participantData,
      });

      if (createPollError || !pollId) {
        throw new Error(createPollError?.message || 'Unbekannter Fehler beim Erstellen der Abstimmung');
      }

      // Get current user profile for creator name
      const { data: profile } = await supabase
        .from('profiles')
        .select('display_name')
        .eq('user_id', user.id)
        .single();

      const creatorName = profile?.display_name || user.email || 'Unbekannt';

      // Send invitations to external participants
      const externalEmails = participants
        .filter(p => p.type === 'external')
        .map(p => p.email);

      if (externalEmails.length > 0) {
        
        const { data: emailData, error: emailError } = await supabase.functions.invoke('send-poll-invitation', {
          body: {
            pollId,
            participantEmails: externalEmails,
            pollTitle: title,
            pollDescription: description,
            creatorName
          }
        });

        if (emailError) {
          debugConsole.error('Error sending emails:', emailError);
          toast({
            title: "E-Mail-Versendung fehlgeschlagen",
            description: `Die Abstimmung wurde erstellt, aber E-Mails konnten nicht versendet werden: ${emailError.message}`,
            variant: "destructive",
          });
        } else {
          
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
      debugConsole.error('Error creating poll:', error);
      const errorMessage = error instanceof Error ? error.message : 'Die Abstimmung konnte nicht erstellt werden.';
      toast({
        title: "Fehler",
        description: errorMessage,
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
                <Button type="button" variant="outline" className="w-full justify-start text-left font-normal">
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
                  <Button type="button" variant="outline" className="w-full justify-start text-left font-normal">
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
            <ContactSelector
              onSelect={addParticipantFromContact}
              placeholder="Kontakt aus Favoriten oder Liste auswählen..."
              clearAfterSelect={true}
            />
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
                onKeyDown={(e) => e.key === 'Enter' && addExternalParticipant()}
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
