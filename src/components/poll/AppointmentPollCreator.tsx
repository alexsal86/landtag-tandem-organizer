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
import { CalendarIcon, Clock, Loader2, Plus, Sparkles, X, Users, Mail } from 'lucide-react';
import { format } from 'date-fns';
import { de } from 'date-fns/locale';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useTenant } from '@/hooks/useTenant';
import { suggestPollSlots, type PollBusyInterval, type PollSlotSuggestion } from '@/features/polls/pollRules';
import { isValidEmail } from '@/lib/utils';
import { ContactSelector, type ContactSelectorContact } from '@/features/contacts/components/ContactSelector';
import { notify } from "@/lib/notify";

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

/** Zeilen aus get_poll_availability (Frei/Gebucht je Teilnehmer). */
interface PollAvailabilityRow {
  email: string;
  busy_start: string | null;
  busy_end: string | null;
  source: string;
}

export const AppointmentPollCreator = ({ onClose }: { onClose: () => void }) => {
  const { user } = useAuth();
  const { currentTenant } = useTenant();
  const [loading, setLoading] = useState(false);
  
  // Form state
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  // Vorbelegte Frist, damit eine Abstimmung nicht dauerhaft offen bleibt.
  const [deadline, setDeadline] = useState<Date | undefined>(() => {
    const inTwoWeeks = new Date();
    inTwoWeeks.setDate(inTwoWeeks.getDate() + 14);
    return inTwoWeeks;
  });
  const [timeSlots, setTimeSlots] = useState<TimeSlot[]>([]);
  const [participants, setParticipants] = useState<Participant[]>([]);
  
  // UI state
  const [selectedDate, setSelectedDate] = useState<Date | undefined>();
  const [startTime, setStartTime] = useState('09:00');
  const [endTime, setEndTime] = useState('10:00');
  const [newParticipantEmail, setNewParticipantEmail] = useState('');
  const [suggestionDuration, setSuggestionDuration] = useState(60);
  const [suggestionBuffer, setSuggestionBuffer] = useState(15);
  const [suggestions, setSuggestions] = useState<PollSlotSuggestion[]>([]);
  const [suggestionsLoading, setSuggestionsLoading] = useState(false);

  const normalizeEmail = (email: string) => email.trim().toLowerCase();

  const addTimeSlot = () => {
    if (!selectedDate) {
      notify.error("Datum erforderlich", {
        description: "Bitte wählen Sie ein Datum für den Zeitslot aus."
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
      notify.error("Duplikat", {
        description: "Dieser Zeitslot wurde bereits hinzugefügt."
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

  const slotToRange = (slot: TimeSlot) => ({
    start: new Date(`${format(slot.date, 'yyyy-MM-dd')}T${slot.startTime}:00`).toISOString(),
    end: new Date(`${format(slot.date, 'yyyy-MM-dd')}T${slot.endTime}:00`).toISOString()
  });

  const loadSuggestions = async () => {
    if (!currentTenant?.id) {
      notify.error("Kein Mandant", {
        description: "Bitte wählen Sie zuerst einen Mandanten aus."
      });
      return;
    }

    if (participants.length === 0) {
      notify.error("Teilnehmer fehlen", {
        description: "Bitte fügen Sie zuerst die Teilnehmer hinzu. Erst dann lässt sich Frei/Gebucht auswerten."
      });
      return;
    }

    setSuggestionsLoading(true);

    try {
      const from = new Date();
      const to = new Date(from.getTime() + 14 * 24 * 60 * 60 * 1000);

      const { data, error } = await supabase.rpc('get_poll_availability', {
        _tenant_id: currentTenant.id,
        _emails: participants.map(participant => participant.email),
        _from: from.toISOString(),
        _to: to.toISOString()
      });

      if (error) throw error;

      const rows: PollAvailabilityRow[] = data ?? [];
      // Jeder Teilnehmer mit Konto liefert mindestens eine Zeile (ggf. ohne Belegung).
      // Alle übrigen haben keine Frei/Gebucht-Daten und dürfen nicht als frei gelten.
      const knownParticipants = Array.from(new Set(rows.map((row) => row.email.trim().toLowerCase())));
      const busy: PollBusyInterval[] = rows
        .filter((row) => Boolean(row.busy_start) && Boolean(row.busy_end))
        .map((row) => ({
          email: row.email,
          start: row.busy_start as string,
          end: row.busy_end as string,
          source: row.source
        }));

      const nextSuggestions = suggestPollSlots({
        participants: participants.map(participant => participant.email),
        knownParticipants,
        busy,
        windowStart: from.toISOString(),
        windowEnd: to.toISOString(),
        durationMinutes: suggestionDuration,
        bufferMinutes: suggestionBuffer,
        existingSlots: timeSlots.map(slotToRange)
      });

      setSuggestions(nextSuggestions);

      if (nextSuggestions.length === 0) {
        notify.error("Keine Vorschläge", {
          description: "Im gewählten Zeitraum passt kein Slot. Bitte Dauer oder Puffer anpassen."
        });
      }
    } catch (error) {
      debugConsole.error('Error loading slot suggestions:', error);
      notify.error("Fehler", {
        description: "Die Vorschläge aus Frei/Gebucht konnten nicht geladen werden."
      });
    } finally {
      setSuggestionsLoading(false);
    }
  };

  const participantLabel = (email: string) => {
    const normalized = normalizeEmail(email);
    return participants.find(participant => normalizeEmail(participant.email) === normalized)?.name || email;
  };

  const suggestionBadgeLabel = (suggestion: PollSlotSuggestion) => {
    if (suggestion.fullyFree) return 'Alle frei';
    const parts: string[] = [];
    if (suggestion.busyEmails.length > 0) parts.push(`${suggestion.busyEmails.length} belegt`);
    if (suggestion.unknownEmails.length > 0) parts.push(`${suggestion.unknownEmails.length} ohne Kalender`);
    return parts.join(' · ') || 'Unbekannt';
  };

  const applySuggestion = (suggestion: PollSlotSuggestion) => {
    const start = new Date(suggestion.start);
    const end = new Date(suggestion.end);
    const candidate: TimeSlot = {
      id: `${suggestion.start}-${suggestion.end}`,
      date: start,
      startTime: format(start, 'HH:mm'),
      endTime: format(end, 'HH:mm')
    };

    const isDuplicate = timeSlots.some(slot =>
      format(slot.date, 'yyyy-MM-dd') === format(candidate.date, 'yyyy-MM-dd') &&
      slot.startTime === candidate.startTime &&
      slot.endTime === candidate.endTime
    );

    if (isDuplicate) {
      notify.error("Bereits vorhanden", {
        description: "Dieser Zeitslot ist schon in der Abstimmung."
      });
      return;
    }

    setTimeSlots(prev => [...prev, candidate]);
    setSuggestions(prev => prev.filter(entry => entry.start !== suggestion.start));
  };

  const addParticipantFromContact = (contact: ContactSelectorContact) => {
    if (!contact.email) {
      notify.error("Keine E-Mail-Adresse", {
        description: "Dieser Kontakt hat keine E-Mail-Adresse."
});
      return;
    }

    // Check if participant already exists
    const normalizedContactEmail = normalizeEmail(contact.email);

    if (participants.find(p => normalizeEmail(p.email) === normalizedContactEmail)) {
      notify.error("Bereits hinzugefügt", {
        description: "Dieser Kontakt wurde bereits hinzugefügt."
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
      notify.error("Ungültige E-Mail-Adresse", {
        description: "Bitte geben Sie eine gültige E-Mail-Adresse ein."
});
      return;
    }

    if (participants.find(p => normalizeEmail(p.email) === normalizedEmail)) {
      notify.error("Bereits hinzugefügt", {
        description: "Dieser Teilnehmer wurde bereits hinzugefügt."
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
      notify.error("Fehlende Angaben", {
        description: "Bitte füllen Sie alle erforderlichen Felder aus."
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
          notify.error("E-Mail-Versendung fehlgeschlagen", {
            description: `Die Abstimmung wurde erstellt, aber E-Mails konnten nicht versendet werden: ${emailError.message}`
});
        } else {
          
          notify.success("Abstimmung erstellt", {
            description: "Die Terminabstimmung wurde erfolgreich erstellt und Einladungen versendet."
});
        }
      } else {
        notify.success("Abstimmung erstellt", {
          description: "Die Terminabstimmung wurde erfolgreich erstellt."
});
      }

      onClose();
    } catch (error) {
      debugConsole.error('Error creating poll:', error);
      const errorMessage = error instanceof Error ? error.message : 'Die Abstimmung konnte nicht erstellt werden.';
      notify.error("Fehler", {
        description: errorMessage
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

          <div className="space-y-3 p-4 border border-dashed rounded-lg">
            <div className="flex flex-wrap items-end gap-3">
              <div>
                <Label className="text-sm">Dauer</Label>
                <Select value={String(suggestionDuration)} onValueChange={(value) => setSuggestionDuration(Number(value))}>
                  <SelectTrigger className="w-28">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {[30, 45, 60, 90, 120].map((minutes) => (
                      <SelectItem key={minutes} value={String(minutes)}>
                        {minutes} Min.
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label className="text-sm">Puffer</Label>
                <Select value={String(suggestionBuffer)} onValueChange={(value) => setSuggestionBuffer(Number(value))}>
                  <SelectTrigger className="w-28">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {[0, 5, 10, 15, 30].map((minutes) => (
                      <SelectItem key={minutes} value={String(minutes)}>
                        {minutes} Min.
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <Button type="button" variant="outline" onClick={loadSuggestions} disabled={suggestionsLoading}>
                {suggestionsLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                Vorschläge aus Frei/Gebucht
              </Button>
            </div>

            <p className="text-xs text-muted-foreground">
              Berücksichtigt Termine, externe Kalender und Abwesenheiten der Teilnehmer sowie den Puffer um belegte Zeiten
              (werktags 9–17 Uhr, nächste 14 Tage). Teilnehmer ohne Frei/Gebucht-Daten werden als solche gekennzeichnet.
            </p>

            {suggestions.length > 0 && (
              <div className="space-y-2">
                {suggestions.map((suggestion) => (
                  <div key={`${suggestion.start}-${suggestion.end}`} className="flex items-center justify-between gap-2 p-2 border rounded-lg bg-background">
                    <div className="flex flex-wrap items-center gap-2 text-sm">
                      <CalendarIcon className="h-4 w-4 text-muted-foreground" />
                      <span>{format(new Date(suggestion.start), 'dd. MMMM yyyy', { locale: de })}</span>
                      <Clock className="h-4 w-4 text-muted-foreground" />
                      <span>{format(new Date(suggestion.start), 'HH:mm')} - {format(new Date(suggestion.end), 'HH:mm')}</span>
                      <Badge variant={suggestion.fullyFree ? 'secondary' : 'outline'}>
                        {suggestionBadgeLabel(suggestion)}
                      </Badge>
                      {suggestion.unknownEmails.length > 0 && (
                        <div className="w-full text-xs text-muted-foreground">
                          Ohne Frei/Gebucht-Daten: {suggestion.unknownEmails.map(participantLabel).join(', ')}
                        </div>
                      )}
                    </div>
                    <Button type="button" size="sm" variant="outline" onClick={() => applySuggestion(suggestion)}>
                      <Plus className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
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
