import { Button } from '@/components/ui/button';
import type { ParticipantRole } from '@/components/meetings/types';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Checkbox } from '@/components/ui/checkbox';
import { CalendarIcon, Plus, Users, X } from 'lucide-react';
import { TimePickerCombobox } from '@/components/ui/time-picker-combobox';
import { UserSelector } from '@/components/UserSelector';
import { RecurrenceSelector } from '@/components/ui/recurrence-selector';
import { format } from 'date-fns';
import { de } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import type { Meeting, MeetingTemplate, NewMeetingParticipant, RecurrenceData } from './types';

interface MeetingCreateDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  meeting: Meeting;
  onMeetingChange: (meeting: Meeting) => void;
  meetingTime: string;
  onMeetingTimeChange: (time: string) => void;
  participants: NewMeetingParticipant[];
  onParticipantsChange: (participants: NewMeetingParticipant[]) => void;
  recurrence: RecurrenceData;
  onRecurrenceChange: (recurrence: RecurrenceData) => void;
  templates: MeetingTemplate[];
  onCreateMeeting: () => void;
}

export function MeetingCreateDialog({
  open,
  onOpenChange,
  meeting,
  onMeetingChange,
  meetingTime,
  onMeetingTimeChange,
  participants,
  onParticipantsChange,
  recurrence,
  onRecurrenceChange,
  templates,
  onCreateMeeting,
}: MeetingCreateDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger asChild>
        <Button className="flex-1" size="sm">
          <Plus className="h-4 w-4 mr-2" />
          Neues Meeting
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Neues Meeting erstellen</DialogTitle>
          <DialogDescription>
            Erstellen Sie ein neues Meeting mit Agenda
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <label className="text-sm font-medium">Titel</label>
            <Input
              value={meeting.title}
              onChange={(e) => onMeetingChange({ ...meeting, title: e.target.value })}
              placeholder="Meeting Titel"
            />
          </div>
          <div>
            <label className="text-sm font-medium">Beschreibung</label>
            <Textarea
              value={meeting.description || ''}
              onChange={(e) => onMeetingChange({ ...meeting, description: e.target.value })}
              placeholder="Meeting Beschreibung"
            />
          </div>
          <div>
            <label className="text-sm font-medium">Ort</label>
            <Input
              value={meeting.location || ''}
              onChange={(e) => onMeetingChange({ ...meeting, location: e.target.value })}
              placeholder="Meeting Ort"
            />
          </div>
          <div>
            <label className="text-sm font-medium">Template</label>
            <Select
              value={meeting.template_id || 'none'}
              onValueChange={(value) => {
                const templateId = value === 'none' ? undefined : value;
                onMeetingChange({ ...meeting, template_id: templateId });
                
                if (templateId) {
                  const template = templates.find(t => t.id === templateId);
                  if (template) {
                    if (template.default_participants && template.default_participants.length > 0) {
                      supabase
                        .from('profiles')
                        .select('user_id, display_name, avatar_url')
                        .in('user_id', template.default_participants)
                        .then(({ data }) => {
                          if (data) {
                            onParticipantsChange(data.map(u => ({
                              userId: u.user_id,
                              role: 'participant' as const,
                              user: {
                                id: u.user_id,
                                display_name: u.display_name || 'Unbekannt',
                                avatar_url: u.avatar_url
                              }
                            })));
                          }
                        });
                    }
                    if (template.default_recurrence) {
                      onRecurrenceChange(template.default_recurrence as RecurrenceData);
                    }
                  }
                }
              }}
            >
              <SelectTrigger>
                <SelectValue placeholder="Template auswählen (optional)" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Kein Template</SelectItem>
                {templates.map((template) => (
                  <SelectItem key={template.id} value={template.id}>
                    {template.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium">Datum</label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button type="button" variant="outline" className="w-full justify-start text-left font-normal">
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {format(meeting.meeting_date, "PPP", { locale: de })}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={meeting.meeting_date instanceof Date ? meeting.meeting_date : new Date(meeting.meeting_date)}
                    onSelect={(date) => date && onMeetingChange({ ...meeting, meeting_date: date })}
                    initialFocus
                    className={cn("p-3 pointer-events-auto")}
                  />
                </PopoverContent>
              </Popover>
            </div>
            <div>
              <label className="text-sm font-medium">Startzeit</label>
              <TimePickerCombobox
                value={meetingTime}
                onChange={onMeetingTimeChange}
              />
            </div>
          </div>

          {/* Participants Section */}
          <div className="border rounded-lg p-4 space-y-3">
            <div className="flex items-center gap-2 group">
              <Users className="h-4 w-4 text-muted-foreground" />
              <label className="text-sm font-medium">Teilnehmer</label>
            </div>
            <UserSelector
              onSelect={(user) => {
                if (!participants.some(p => p.userId === user.id)) {
                  onParticipantsChange([...participants, {
                    userId: user.id,
                    role: 'participant',
                    user: {
                      id: user.id,
                      display_name: user.display_name,
                      avatar_url: user.avatar_url
                    }
                  }]);
                }
              }}
              placeholder="Teammitglied hinzufügen..."
              clearAfterSelect
              excludeUserIds={participants.map(p => p.userId)}
            />
            {participants.length > 0 && (
              <div className="space-y-2">
                {participants.map((p, idx) => (
                  <div key={p.userId} className="flex items-center gap-2 p-2 bg-muted/50 rounded-md">
                    <span className="flex-1 text-sm">{p.user?.display_name}</span>
                    <Select 
                      value={p.role} 
                      onValueChange={(v) => {
                        const updated = [...participants];
                        updated[idx] = { ...p, role: v as ParticipantRole };
                        onParticipantsChange(updated);
                      }}
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
                      onClick={() => onParticipantsChange(participants.filter((_, i) => i !== idx))}
                    >
                      <X className="h-3 w-3" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Public Meeting Option */}
          <div className="flex items-center space-x-2 p-3 border rounded-lg bg-muted/30">
            <Checkbox 
              id="is_public" 
              checked={meeting.is_public || false}
              onCheckedChange={(checked) => onMeetingChange({ ...meeting, is_public: !!checked })}
            />
            <div className="flex-1">
              <label htmlFor="is_public" className="text-sm font-medium cursor-pointer">
                Öffentliches Meeting
              </label>
              <p className="text-xs text-muted-foreground">
                Alle Teammitglieder können dieses Meeting sehen
              </p>
            </div>
          </div>

          {/* Recurrence Section */}
          <RecurrenceSelector
            value={recurrence}
            onChange={onRecurrenceChange}
            startDate={format(meeting.meeting_date instanceof Date ? meeting.meeting_date : new Date(meeting.meeting_date), 'yyyy-MM-dd')}
          />

          <div className="flex justify-end space-x-2 pt-4">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Abbrechen
            </Button>
            <Button onClick={onCreateMeeting}>
              Meeting erstellen
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
