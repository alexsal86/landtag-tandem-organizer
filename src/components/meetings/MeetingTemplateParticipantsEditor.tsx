import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { ContactSelector } from '@/components/ContactSelector';
import { RecurrenceSelector } from '@/components/ui/recurrence-selector';
import { Users, Trash2, Repeat, X } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useTenant } from '@/hooks/useTenant';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';

interface RecurrenceData {
  enabled: boolean;
  frequency: "daily" | "weekly" | "monthly" | "yearly";
  interval: number;
  weekdays: number[];
  endDate?: string;
}

interface MeetingTemplateParticipantsEditorProps {
  templateId: string;
  defaultParticipants: string[];
  defaultRecurrence: RecurrenceData | null;
  onSave: (participants: string[], recurrence: RecurrenceData | null) => void;
}

interface Contact {
  id: string;
  name: string;
  email?: string;
  avatar_url?: string;
  organization?: string;
}

export function MeetingTemplateParticipantsEditor({
  templateId,
  defaultParticipants,
  defaultRecurrence,
  onSave
}: MeetingTemplateParticipantsEditorProps) {
  const { currentTenant } = useTenant();
  const [participants, setParticipants] = useState<string[]>(defaultParticipants || []);
  const [participantContacts, setParticipantContacts] = useState<Contact[]>([]);
  const [recurrence, setRecurrence] = useState<RecurrenceData>(
    defaultRecurrence || {
      enabled: false,
      frequency: 'weekly',
      interval: 1,
      weekdays: []
    }
  );

  useEffect(() => {
    if (participants.length > 0) {
      loadContactDetails();
    } else {
      setParticipantContacts([]);
    }
  }, [participants]);

  const loadContactDetails = async () => {
    if (!currentTenant || participants.length === 0) return;

    try {
      const { data, error } = await supabase
        .from('contacts')
        .select('id, name, email, avatar_url, organization')
        .in('id', participants)
        .eq('tenant_id', currentTenant.id);

      if (error) throw error;
      setParticipantContacts(data || []);
    } catch (error) {
      console.error('Error loading contact details:', error);
    }
  };

  const handleAddContact = (contact: Contact) => {
    if (participants.includes(contact.id)) return;
    
    const newParticipants = [...participants, contact.id];
    setParticipants(newParticipants);
    setParticipantContacts(prev => [...prev, contact]);
    onSave(newParticipants, recurrence.enabled ? recurrence : null);
  };

  const handleRemoveParticipant = (contactId: string) => {
    const newParticipants = participants.filter(id => id !== contactId);
    setParticipants(newParticipants);
    setParticipantContacts(prev => prev.filter(c => c.id !== contactId));
    onSave(newParticipants, recurrence.enabled ? recurrence : null);
  };

  const handleRecurrenceChange = (newRecurrence: RecurrenceData) => {
    setRecurrence(newRecurrence);
    onSave(participants, newRecurrence.enabled ? newRecurrence : null);
  };

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map(n => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  // Use current date as base for recurrence selector
  const today = new Date().toISOString().split('T')[0];

  return (
    <div className="space-y-6">
      {/* Standard-Teilnehmer */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Users className="h-4 w-4" />
            Standard-Teilnehmer
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label className="text-sm text-muted-foreground mb-2 block">
              Diese Kontakte werden automatisch als Teilnehmer hinzugefügt, wenn ein Meeting mit dieser Vorlage erstellt wird.
            </Label>
            <ContactSelector
              onSelect={handleAddContact}
              placeholder="Kontakt hinzufügen..."
              clearAfterSelect
            />
          </div>

          {participantContacts.length > 0 && (
            <div className="space-y-2">
              {participantContacts.map((contact) => (
                <div
                  key={contact.id}
                  className="flex items-center gap-3 p-2 rounded-md border bg-muted/50"
                >
                  <Avatar className="h-8 w-8">
                    <AvatarImage src={contact.avatar_url} />
                    <AvatarFallback className="text-xs">
                      {getInitials(contact.name)}
                    </AvatarFallback>
                  </Avatar>
                  
                  <div className="flex-1 min-w-0">
                    <span className="font-medium text-sm truncate block">
                      {contact.name}
                    </span>
                    {contact.organization && (
                      <span className="text-xs text-muted-foreground truncate block">
                        {contact.organization}
                      </span>
                    )}
                  </div>

                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-7 w-7"
                    onClick={() => handleRemoveParticipant(contact.id)}
                  >
                    <X className="h-3 w-3" />
                  </Button>
                </div>
              ))}
            </div>
          )}

          {participantContacts.length === 0 && (
            <p className="text-sm text-muted-foreground py-2">
              Keine Standard-Teilnehmer festgelegt
            </p>
          )}
        </CardContent>
      </Card>

      {/* Standard-Wiederholung */}
      <RecurrenceSelector
        value={recurrence}
        onChange={handleRecurrenceChange}
        startDate={today}
      />
    </div>
  );
}
