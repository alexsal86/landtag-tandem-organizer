import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { CalendarIcon, Clock, Plus, Edit, Check, X, Trash, Repeat, Archive, Globe, CheckCircle, ChevronRight, MapPin } from "lucide-react";
import { TimePickerCombobox } from "@/components/ui/time-picker-combobox";
import { InlineMeetingParticipantsEditor } from "@/components/meetings/InlineMeetingParticipantsEditor";
import { MeetingParticipantAvatars } from "@/components/meetings/MeetingParticipantAvatars";
import { MeetingCreateDialog } from "@/components/meetings/MeetingCreateDialog";
import { CarryoverBufferDialog } from "@/components/meetings/CarryoverBufferDialog";
import { format } from "date-fns";
import { de } from "date-fns/locale";
import { cn } from "@/lib/utils";
import type { Meeting, MeetingTemplate, NewMeetingParticipant, RecurrenceData, AgendaItem } from "@/components/meetings/types";

interface MeetingSidebarProps {
  meetings: Meeting[];
  upcomingMeetings: Meeting[];
  selectedMeeting: Meeting | null;
  activeMeetingId: string | null;
  editingMeeting: Meeting | null;
  isNewMeetingOpen: boolean;
  newMeeting: Meeting;
  newMeetingTime: string;
  newMeetingParticipants: NewMeetingParticipant[];
  newMeetingRecurrence: RecurrenceData;
  meetingTemplates: MeetingTemplate[];
  showCarryoverBuffer: boolean;
  carryoverBufferItems: AgendaItem[];
  isHighlighted: (id: string) => boolean;
  highlightRef: (id: string) => React.RefCallback<HTMLElement>;
  onSelectMeeting: (meeting: Meeting) => void;
  onSetEditingMeeting: (meeting: Meeting | null) => void;
  onSetIsNewMeetingOpen: (open: boolean) => void;
  onSetNewMeeting: React.Dispatch<React.SetStateAction<Meeting>>;
  onSetNewMeetingTime: (time: string) => void;
  onSetNewMeetingParticipants: React.Dispatch<React.SetStateAction<NewMeetingParticipant[]>>;
  onSetNewMeetingRecurrence: React.Dispatch<React.SetStateAction<RecurrenceData>>;
  onSetShowCarryoverBuffer: (show: boolean) => void;
  onCreateMeeting: () => void;
  onUpdateMeeting: (meetingId: string, updates: Partial<Meeting>) => void;
  onDeleteMeeting: (meetingId: string) => void;
  onStartMeeting: (meeting: Meeting) => void;
  onStopMeeting: () => void;
  onShowArchive: () => void;
  onLoadCarryoverBufferItems: () => Promise<void>;
  loadAgendaItems: (meetingId: string) => Promise<void>;
}

export function MeetingSidebar({
  meetings, upcomingMeetings, selectedMeeting, activeMeetingId, editingMeeting,
  isNewMeetingOpen, newMeeting, newMeetingTime, newMeetingParticipants, newMeetingRecurrence,
  meetingTemplates, showCarryoverBuffer, carryoverBufferItems,
  isHighlighted, highlightRef,
  onSelectMeeting, onSetEditingMeeting, onSetIsNewMeetingOpen, onSetNewMeeting,
  onSetNewMeetingTime, onSetNewMeetingParticipants, onSetNewMeetingRecurrence,
  onSetShowCarryoverBuffer, onCreateMeeting, onUpdateMeeting, onDeleteMeeting,
  onStartMeeting, onStopMeeting, onShowArchive, onLoadCarryoverBufferItems, loadAgendaItems,
}: MeetingSidebarProps) {
  return (
    <div className="flex flex-col pr-4 space-y-4">
      {/* Header & Buttons */}
      <div>
        <h1 className="text-2xl font-bold mb-1">Meeting Agenda</h1>
        <p className="text-sm text-muted-foreground mb-4">Ihre wöchentlichen Besprechungen</p>
        <div className="flex gap-2">
          <MeetingCreateDialog
            open={isNewMeetingOpen}
            onOpenChange={onSetIsNewMeetingOpen}
            meeting={newMeeting}
            onMeetingChange={onSetNewMeeting}
            meetingTime={newMeetingTime}
            onMeetingTimeChange={onSetNewMeetingTime}
            participants={newMeetingParticipants}
            onParticipantsChange={onSetNewMeetingParticipants}
            recurrence={newMeetingRecurrence}
            onRecurrenceChange={onSetNewMeetingRecurrence}
            templates={meetingTemplates}
            onCreateMeeting={onCreateMeeting}
          />
          <Button variant="outline" size="sm" onClick={async () => { await onLoadCarryoverBufferItems(); onSetShowCarryoverBuffer(true); }} title="Übertragene Punkte anzeigen">
            <Repeat className="h-4 w-4" />
          </Button>
          <Button variant="outline" size="sm" onClick={onShowArchive}>
            <Archive className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Meeting List */}
      <div className="flex-1 space-y-2 mt-3">
        <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Nächste Besprechungen</h3>
        <div className="space-y-3">
          {upcomingMeetings.map((meeting) => (
            <Card
              key={meeting.id}
              ref={highlightRef(meeting.id!)}
              className={cn(
                "cursor-pointer hover:shadow-sm transition-all",
                selectedMeeting?.id === meeting.id && "border-primary ring-1 ring-primary bg-primary/5",
                isHighlighted(meeting.id!) && "notification-highlight"
              )}
              onClick={() => { onSelectMeeting(meeting); if (meeting.id) { loadAgendaItems(meeting.id); } }}
            >
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <h4 className="font-semibold text-base truncate">{meeting.title}</h4>
                      {meeting.is_public && <Globe className="h-4 w-4 text-muted-foreground flex-shrink-0" />}
                    </div>
                    <div className="flex items-center gap-2 text-sm text-muted-foreground mt-1.5">
                      <CalendarIcon className="h-3.5 w-3.5" />
                      <span>{format(new Date(meeting.meeting_date), 'dd.MM.', { locale: de })}</span>
                      {meeting.meeting_time && (
                        <>
                          <Clock className="h-3.5 w-3.5 ml-1" />
                          <span>{meeting.meeting_time.substring(0, 5)}</span>
                        </>
                      )}
                    </div>
                    {meeting.location && (
                      <div className="flex items-center gap-1 text-sm text-muted-foreground mt-0.5">
                        <MapPin className="h-3.5 w-3.5" />
                        <span className="truncate">{meeting.location}</span>
                      </div>
                    )}
                    <MeetingParticipantAvatars meetingId={meeting.id} size="xs" />
                  </div>
                  <div className="flex items-center gap-1">
                    {editingMeeting?.id === meeting.id ? (
                      <>
                        <Button size="icon" variant="ghost" className="h-7 w-7" onClick={(e) => { e.stopPropagation(); onUpdateMeeting(meeting.id!, editingMeeting as Meeting); onSetEditingMeeting(null); }}>
                          <Check className="h-3.5 w-3.5" />
                        </Button>
                        <Button size="icon" variant="ghost" className="h-7 w-7" onClick={(e) => { e.stopPropagation(); onSetEditingMeeting(null); }}>
                          <X className="h-3.5 w-3.5" />
                        </Button>
                      </>
                    ) : (
                      <>
                        <Button size="icon" variant="ghost" className="h-7 w-7" onClick={(e) => { e.stopPropagation(); onSetEditingMeeting(meeting); }}>
                          <Edit className="h-3.5 w-3.5" />
                        </Button>
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive hover:text-destructive" onClick={(e) => e.stopPropagation()}>
                              <Trash className="h-3.5 w-3.5" />
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Meeting löschen</AlertDialogTitle>
                              <AlertDialogDescription>Sind Sie sicher, dass Sie das Meeting "{meeting.title}" löschen möchten?</AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Abbrechen</AlertDialogCancel>
                              <AlertDialogAction onClick={() => onDeleteMeeting(meeting.id!)}>Löschen</AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </>
                    )}
                    <ChevronRight className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                  </div>
                </div>

                {/* Start/Stop Button */}
                <div className="mt-3 pt-2 border-t">
                  {activeMeetingId === meeting.id ? (
                    <Button size="sm" variant="default" onClick={(e) => { e.stopPropagation(); onStopMeeting(); }} className="w-full h-7 text-xs bg-green-600 hover:bg-green-700">
                      <CheckCircle className="h-3 w-3 mr-1" /> Laufend
                    </Button>
                  ) : (
                    <Button size="sm" variant="outline" onClick={(e) => { e.stopPropagation(); onStartMeeting(meeting); }} className="w-full h-7 text-xs" disabled={activeMeetingId !== null}>
                      <CheckCircle className="h-3 w-3 mr-1" /> Starten
                    </Button>
                  )}
                </div>

                {editingMeeting?.id === meeting.id && (
                  <div className="mt-3 pt-3 border-t space-y-3" onClick={(e) => e.stopPropagation()}>
                    <div>
                      <label className="text-xs font-medium text-muted-foreground">Titel</label>
                      <Input value={editingMeeting?.title ?? ''} onChange={(e) => onSetEditingMeeting({ ...editingMeeting!, title: e.target.value } as Meeting)} className="h-8 text-sm" />
                    </div>
                    <div>
                      <label className="text-xs font-medium text-muted-foreground">Beschreibung</label>
                      <Textarea value={editingMeeting?.description || ''} onChange={(e) => onSetEditingMeeting({ ...editingMeeting!, description: e.target.value } as Meeting)} className="text-sm min-h-[60px]" />
                    </div>
                    <div>
                      <label className="text-xs font-medium text-muted-foreground">Ort</label>
                      <Input value={editingMeeting?.location || ''} onChange={(e) => onSetEditingMeeting({ ...editingMeeting!, location: e.target.value } as Meeting)} className="h-8 text-sm" />
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="text-xs font-medium text-muted-foreground">Datum</label>
                        <Popover>
                          <PopoverTrigger asChild>
                            <Button type="button" variant="outline" size="sm" className="w-full justify-start text-left font-normal text-xs">
                              {format(new Date(editingMeeting!.meeting_date), "dd.MM.yy", { locale: de })}
                            </Button>
                          </PopoverTrigger>
                          <PopoverContent className="w-auto p-0" align="start">
                            <Calendar mode="single" selected={new Date(editingMeeting!.meeting_date)} onSelect={(date) => date && onSetEditingMeeting({ ...editingMeeting!, meeting_date: date } as Meeting)} initialFocus />
                          </PopoverContent>
                        </Popover>
                      </div>
                      <div>
                        <label className="text-xs font-medium text-muted-foreground">Uhrzeit</label>
                        <TimePickerCombobox value={(editingMeeting!.meeting_time || '10:00').substring(0, 5)} onChange={(time) => onSetEditingMeeting({ ...editingMeeting!, meeting_time: time } as Meeting)} />
                      </div>
                    </div>
                    <div>
                      <label className="text-xs font-medium text-muted-foreground">Teilnehmer</label>
                      {meeting.id && <InlineMeetingParticipantsEditor meetingId={meeting.id} />}
                    </div>
                    <div className="flex items-center space-x-2 p-2 bg-muted/50 rounded-md">
                      <Checkbox id={`edit_public_${meeting.id}`} checked={editingMeeting?.is_public || false} onCheckedChange={(checked) => onSetEditingMeeting({ ...editingMeeting!, is_public: !!checked } as Meeting)} />
                      <label htmlFor={`edit_public_${meeting.id}`} className="text-xs cursor-pointer">Öffentlich</label>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
          {upcomingMeetings.length === 0 && (
            <p className="text-xs text-muted-foreground text-center py-4">Keine anstehenden Besprechungen</p>
          )}
        </div>
      </div>

      <CarryoverBufferDialog open={showCarryoverBuffer} onOpenChange={onSetShowCarryoverBuffer} items={carryoverBufferItems} />
    </div>
  );
}
