import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { UserSelector } from '@/components/UserSelector';
import { RecurrenceSelector } from '@/components/ui/recurrence-selector';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Users, X, CalendarRange, Repeat, Eye, EyeOff } from 'lucide-react';
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

interface ParticipantWithRole {
  user_id: string;
  role: 'organizer' | 'participant' | 'optional';
}

interface MeetingTemplateParticipantsEditorProps {
  templateId: string;
  defaultParticipants: string[] | ParticipantWithRole[];
  defaultRecurrence: RecurrenceData | null;
  defaultVisibility?: 'private' | 'public';
  autoCreateCount?: number;
  compact?: boolean;
  onSave: (
    participants: ParticipantWithRole[], 
    recurrence: RecurrenceData | null, 
    autoCreateCount?: number,
    visibility?: 'private' | 'public'
  ) => void;
}

interface User {
  id: string;
  display_name: string;
  avatar_url?: string;
}

// Helper to normalize participants to ParticipantWithRole format
const normalizeParticipants = (participants: string[] | ParticipantWithRole[]): ParticipantWithRole[] => {
  if (!participants || participants.length === 0) return [];
  
  // Check if first element is a string (old format)
  if (typeof participants[0] === 'string') {
    return (participants as string[]).map(userId => ({
      user_id: userId,
      role: 'participant' as const
    }));
  }
  
  return participants as ParticipantWithRole[];
};

export function MeetingTemplateParticipantsEditor({
  templateId,
  defaultParticipants,
  defaultRecurrence,
  defaultVisibility = 'private',
  autoCreateCount: initialAutoCreateCount = 3,
  compact = false,
  onSave
}: MeetingTemplateParticipantsEditorProps) {
  const { currentTenant } = useTenant();
  const [participants, setParticipants] = useState<ParticipantWithRole[]>(
    normalizeParticipants(defaultParticipants || [])
  );
  const [participantUsers, setParticipantUsers] = useState<User[]>([]);
  const [autoCreateCount, setAutoCreateCount] = useState<number>(initialAutoCreateCount);
  const [visibility, setVisibility] = useState<'private' | 'public'>(defaultVisibility);
  const [recurrence, setRecurrence] = useState<RecurrenceData>(
    defaultRecurrence || {
      enabled: false,
      frequency: 'weekly',
      interval: 1,
      weekdays: []
    }
  );

  useEffect(() => {
    const userIds = participants.map(p => p.user_id);
    if (userIds.length > 0) {
      loadUserDetails(userIds);
    } else {
      setParticipantUsers([]);
    }
  }, [participants]);

  const loadUserDetails = async (userIds: string[]) => {
    if (!currentTenant || userIds.length === 0) return;

    try {
      // Get user details from profiles for the participant user IDs
      const { data, error } = await supabase
        .from('profiles')
        .select('user_id, display_name, avatar_url')
        .in('user_id', userIds);

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
    if (participants.some(p => p.user_id === user.id)) return;
    
    const newParticipant: ParticipantWithRole = { user_id: user.id, role: 'participant' };
    const newParticipants = [...participants, newParticipant];
    setParticipants(newParticipants);
    setParticipantUsers(prev => [...prev, user]);
    onSave(newParticipants, recurrence.enabled ? recurrence : null, autoCreateCount, visibility);
  };

  const handleRemoveParticipant = (userId: string) => {
    const newParticipants = participants.filter(p => p.user_id !== userId);
    setParticipants(newParticipants);
    setParticipantUsers(prev => prev.filter(u => u.id !== userId));
    onSave(newParticipants, recurrence.enabled ? recurrence : null, autoCreateCount, visibility);
  };

  const handleRoleChange = (userId: string, role: 'organizer' | 'participant' | 'optional') => {
    const newParticipants = participants.map(p => 
      p.user_id === userId ? { ...p, role } : p
    );
    setParticipants(newParticipants);
    onSave(newParticipants, recurrence.enabled ? recurrence : null, autoCreateCount, visibility);
  };

  const handleRecurrenceChange = (newRecurrence: RecurrenceData) => {
    setRecurrence(newRecurrence);
    onSave(participants, newRecurrence.enabled ? newRecurrence : null, autoCreateCount, visibility);
  };

  const handleAutoCreateCountChange = (value: number[]) => {
    const count = value[0];
    setAutoCreateCount(count);
    onSave(participants, recurrence.enabled ? recurrence : null, count, visibility);
  };

  const handleVisibilityChange = (isPublic: boolean) => {
    const newVisibility = isPublic ? 'public' : 'private';
    setVisibility(newVisibility);
    onSave(participants, recurrence.enabled ? recurrence : null, autoCreateCount, newVisibility);
  };

  const getParticipantRole = (userId: string): 'organizer' | 'participant' | 'optional' => {
    const participant = participants.find(p => p.user_id === userId);
    return participant?.role || 'participant';
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

  // Compact mode for sidebar display
  if (compact) {
    return (
      <div className="space-y-4">
        {/* Standard-Teilnehmer - Compact */}
        <div>
          <label className="text-xs text-muted-foreground mb-2 flex items-center gap-1.5">
            <Users className="h-3 w-3" />
            Standard-Teilnehmer
          </label>
          <UserSelector
            onSelect={handleAddUser}
            placeholder="Teilnehmer hinzufügen..."
            clearAfterSelect
            excludeUserIds={participants.map(p => p.user_id)}
          />
          {participantUsers.length > 0 && (
            <div className="mt-2 space-y-1">
              {participantUsers.map((user) => (
                <div
                  key={user.id}
                  className="flex items-center gap-2 p-1.5 rounded-md border bg-muted/50 text-sm"
                >
                  <Avatar className="h-6 w-6">
                    <AvatarImage src={user.avatar_url} />
                    <AvatarFallback className="text-[10px]">
                      {getInitials(user.display_name)}
                    </AvatarFallback>
                  </Avatar>
                  <span className="flex-1 truncate text-xs">{user.display_name}</span>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-5 w-5"
                    onClick={() => handleRemoveParticipant(user.id)}
                  >
                    <X className="h-3 w-3" />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Standard-Wiederholung - Compact */}
        <div className="border-t pt-4">
          <RecurrenceSelector
            value={recurrence}
            onChange={handleRecurrenceChange}
            startDate={today}
          />
        </div>

        {/* Anzahl offener Meetings - Compact */}
        {recurrence.enabled && (
          <div className="border-t pt-4">
            <label className="text-xs text-muted-foreground mb-2 flex items-center gap-1.5">
              <CalendarRange className="h-3 w-3" />
              Offene Meetings
            </label>
            <div className="flex items-center gap-2">
              <Slider
                value={[autoCreateCount]}
                onValueChange={handleAutoCreateCountChange}
                min={1}
                max={10}
                step={1}
                className="flex-1"
              />
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
                className="w-12 h-7 text-center text-xs"
              />
            </div>
            <p className="text-[10px] text-muted-foreground mt-1">
              {autoCreateCount} Meetings im Voraus
            </p>
          </div>
        )}
      </div>
    );
  }

  // Full mode (default)
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
              excludeUserIds={participants.map(p => p.user_id)}
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
