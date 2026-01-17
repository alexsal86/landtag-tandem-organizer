import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { UserSelector } from '@/components/UserSelector';
import { RecurrenceSelector } from '@/components/ui/recurrence-selector';
import { Users, X, CalendarRange, Repeat } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useTenant } from '@/hooks/useTenant';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Slider } from '@/components/ui/slider';

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
  autoCreateCount?: number;
  onSave: (participants: string[], recurrence: RecurrenceData | null, autoCreateCount?: number) => void;
}

interface User {
  id: string;
  display_name: string;
  avatar_url?: string;
}

export function MeetingTemplateParticipantsEditor({
  templateId,
  defaultParticipants,
  defaultRecurrence,
  autoCreateCount: initialAutoCreateCount = 3,
  onSave
}: MeetingTemplateParticipantsEditorProps) {
  const { currentTenant } = useTenant();
  const [participants, setParticipants] = useState<string[]>(defaultParticipants || []);
  const [participantUsers, setParticipantUsers] = useState<User[]>([]);
  const [autoCreateCount, setAutoCreateCount] = useState<number>(initialAutoCreateCount);
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
      loadUserDetails();
    } else {
      setParticipantUsers([]);
    }
  }, [participants]);

  const loadUserDetails = async () => {
    if (!currentTenant || participants.length === 0) return;

    try {
      // Get user details from profiles for the participant user IDs
      const { data, error } = await supabase
        .from('profiles')
        .select('user_id, display_name, avatar_url')
        .in('user_id', participants);

      if (error) throw error;

      const users: User[] = (data || []).map(profile => ({
        id: profile.user_id,
        display_name: profile.display_name || 'Unbekannt',
        avatar_url: profile.avatar_url
      }));

      setParticipantUsers(users);
    } catch (error) {
      console.error('Error loading user details:', error);
    }
  };

  const handleAddUser = (user: User) => {
    if (participants.includes(user.id)) return;
    
    const newParticipants = [...participants, user.id];
    setParticipants(newParticipants);
    setParticipantUsers(prev => [...prev, user]);
    onSave(newParticipants, recurrence.enabled ? recurrence : null, autoCreateCount);
  };

  const handleRemoveParticipant = (userId: string) => {
    const newParticipants = participants.filter(id => id !== userId);
    setParticipants(newParticipants);
    setParticipantUsers(prev => prev.filter(u => u.id !== userId));
    onSave(newParticipants, recurrence.enabled ? recurrence : null, autoCreateCount);
  };

  const handleRecurrenceChange = (newRecurrence: RecurrenceData) => {
    setRecurrence(newRecurrence);
    onSave(participants, newRecurrence.enabled ? newRecurrence : null, autoCreateCount);
  };

  const handleAutoCreateCountChange = (value: number[]) => {
    const count = value[0];
    setAutoCreateCount(count);
    onSave(participants, recurrence.enabled ? recurrence : null, count);
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
              Diese Teammitglieder werden automatisch als Teilnehmer hinzugefügt, wenn ein Meeting mit dieser Vorlage erstellt wird.
            </Label>
            <UserSelector
              onSelect={handleAddUser}
              placeholder="Teammitglied hinzufügen..."
              clearAfterSelect
              excludeUserIds={participants}
            />
          </div>

          {participantUsers.length > 0 && (
            <div className="space-y-2">
              {participantUsers.map((user) => (
                <div
                  key={user.id}
                  className="flex items-center gap-3 p-2 rounded-md border bg-muted/50"
                >
                  <Avatar className="h-8 w-8">
                    <AvatarImage src={user.avatar_url} />
                    <AvatarFallback className="text-xs">
                      {getInitials(user.display_name)}
                    </AvatarFallback>
                  </Avatar>
                  
                  <div className="flex-1 min-w-0">
                    <span className="font-medium text-sm truncate block">
                      {user.display_name}
                    </span>
                  </div>

                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-7 w-7"
                    onClick={() => handleRemoveParticipant(user.id)}
                  >
                    <X className="h-3 w-3" />
                  </Button>
                </div>
              ))}
            </div>
          )}

          {participantUsers.length === 0 && (
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

      {/* Anzahl offener Meetings bei Wiederholung */}
      {recurrence.enabled && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <CalendarRange className="h-4 w-4" />
              Anzahl offener Meetings
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <Label className="text-sm text-muted-foreground block">
              Bei wiederkehrenden Meetings werden automatisch immer {autoCreateCount} zukünftige Termine offen gehalten. 
              Wenn ein Meeting archiviert wird, wird automatisch ein neuer Termin erstellt.
            </Label>
            
            <div className="flex items-center gap-4">
              <Slider
                value={[autoCreateCount]}
                onValueChange={handleAutoCreateCountChange}
                min={1}
                max={10}
                step={1}
                className="flex-1"
              />
              <div className="flex items-center gap-2 min-w-[80px]">
                <Input
                  type="number"
                  value={autoCreateCount}
                  onChange={(e) => {
                    const val = Math.min(10, Math.max(1, parseInt(e.target.value) || 1));
                    setAutoCreateCount(val);
                    onSave(participants, recurrence.enabled ? recurrence : null, val);
                  }}
                  min={1}
                  max={10}
                  className="w-16 text-center"
                />
                <span className="text-sm text-muted-foreground">Meetings</span>
              </div>
            </div>
            
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Repeat className="h-3 w-3" />
              <span>
                Aktuell werden {autoCreateCount} Meetings im Voraus geplant
              </span>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
