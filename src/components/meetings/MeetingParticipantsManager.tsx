import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { UserSelector } from '@/components/UserSelector';
import { Users, Trash2, Crown, User, UserMinus } from 'lucide-react';
import { MeetingParticipant } from '@/hooks/useMeetingParticipants';

interface MeetingParticipantsManagerProps {
  participants: MeetingParticipant[];
  onAddParticipant: (userId: string, role: 'organizer' | 'participant' | 'optional') => void;
  onUpdateParticipant: (participantId: string, updates: { role?: string; status?: string }) => void;
  onRemoveParticipant: (participantId: string) => void;
  readOnly?: boolean;
}

const roleLabels = {
  organizer: 'Organisator',
  participant: 'Teilnehmer',
  optional: 'Optional'
};

const roleIcons = {
  organizer: Crown,
  participant: User,
  optional: UserMinus
};

const statusLabels = {
  pending: 'Ausstehend',
  confirmed: 'Zugesagt',
  declined: 'Abgesagt'
};

const statusColors = {
  pending: 'bg-amber-500/10 text-amber-600 border-amber-500/20',
  confirmed: 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20',
  declined: 'bg-red-500/10 text-red-600 border-red-500/20'
};

export function MeetingParticipantsManager({
  participants,
  onAddParticipant,
  onUpdateParticipant,
  onRemoveParticipant,
  readOnly = false
}: MeetingParticipantsManagerProps) {
  const [selectedRole, setSelectedRole] = useState<'organizer' | 'participant' | 'optional'>('participant');

  const handleAddUser = (user: { id: string; display_name: string; avatar_url?: string }) => {
    // Check if already added
    if (participants.some(p => p.user_id === user.id)) {
      return;
    }
    onAddParticipant(user.id, selectedRole);
  };

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map(n => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  const excludedUserIds = participants.map(p => p.user_id);

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Users className="h-4 w-4 text-muted-foreground" />
        <span className="font-medium text-sm">Teilnehmer ({participants.length})</span>
      </div>

      {!readOnly && (
        <div className="flex gap-2">
          <div className="flex-1">
            <UserSelector
              onSelect={handleAddUser}
              placeholder="Teammitglied hinzufügen..."
              clearAfterSelect
              excludeUserIds={excludedUserIds}
            />
          </div>
          <Select value={selectedRole} onValueChange={(v) => setSelectedRole(v as any)}>
            <SelectTrigger className="w-36">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="organizer">Organisator</SelectItem>
              <SelectItem value="participant">Teilnehmer</SelectItem>
              <SelectItem value="optional">Optional</SelectItem>
            </SelectContent>
          </Select>
        </div>
      )}

      {participants.length === 0 ? (
        <p className="text-sm text-muted-foreground py-2">
          Keine Teilnehmer hinzugefügt
        </p>
      ) : (
        <div className="space-y-2">
          {participants.map((participant) => {
            const RoleIcon = roleIcons[participant.role];
            return (
              <div
                key={participant.id}
                className="flex items-center gap-3 p-2 rounded-md border bg-card"
              >
                <Avatar className="h-8 w-8">
                  <AvatarImage src={participant.user?.avatar_url} />
                  <AvatarFallback className="text-xs">
                    {getInitials(participant.user?.display_name || '?')}
                  </AvatarFallback>
                </Avatar>
                
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-sm truncate">
                      {participant.user?.display_name || 'Unbekannt'}
                    </span>
                    <RoleIcon className="h-3 w-3 text-muted-foreground" />
                  </div>
                </div>

                <Badge 
                  variant="outline" 
                  className={`text-xs ${statusColors[participant.status]}`}
                >
                  {statusLabels[participant.status]}
                </Badge>

                {!readOnly && (
                  <div className="flex items-center gap-1">
                    <Select 
                      value={participant.role} 
                      onValueChange={(v) => onUpdateParticipant(participant.id, { role: v })}
                    >
                      <SelectTrigger className="w-28 h-7 text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="organizer">Organisator</SelectItem>
                        <SelectItem value="participant">Teilnehmer</SelectItem>
                        <SelectItem value="optional">Optional</SelectItem>
                      </SelectContent>
                    </Select>
                    
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-7 w-7"
                      onClick={() => onRemoveParticipant(participant.id)}
                    >
                      <Trash2 className="h-3 w-3 text-destructive" />
                    </Button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
