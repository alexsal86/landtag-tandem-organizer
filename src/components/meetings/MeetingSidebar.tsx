import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Edit,
  Check,
  X,
  Trash,
  RotateCcw,
  Archive,
  Globe,
  Play,
  MoreVertical,
  PanelLeftClose,
  PanelLeftOpen,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { QuickAccessMenuItem } from "@/components/shared/QuickAccessMenuItem";
import { TimePickerCombobox } from "@/components/ui/time-picker-combobox";
import { InlineMeetingParticipantsEditor } from "@/components/meetings/InlineMeetingParticipantsEditor";
import { MeetingParticipantAvatars } from "@/components/meetings/MeetingParticipantAvatars";
import { MeetingCreateDialog } from "@/components/meetings/MeetingCreateDialog";
import { CarryoverBufferDialog } from "@/components/meetings/CarryoverBufferDialog";
import { format } from "date-fns";
import { de } from "date-fns/locale";
import { cn } from "@/lib/utils";
import type {
  Meeting,
  MeetingTemplate,
  NewMeetingParticipant,
  RecurrenceData,
  AgendaItem,
} from "@/components/meetings/types";

interface MeetingSidebarProps {
  compact?: boolean;
  onToggleCompact?: () => void;
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
  onSetNewMeetingParticipants: React.Dispatch<
    React.SetStateAction<NewMeetingParticipant[]>
  >;
  onSetNewMeetingRecurrence: React.Dispatch<
    React.SetStateAction<RecurrenceData>
  >;
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
  compact = false,
  onToggleCompact,
  meetings: _meetings,
  upcomingMeetings,
  selectedMeeting,
  activeMeetingId,
  editingMeeting,
  isNewMeetingOpen,
  newMeeting,
  newMeetingTime,
  newMeetingParticipants,
  newMeetingRecurrence,
  meetingTemplates,
  showCarryoverBuffer,
  carryoverBufferItems,
  isHighlighted,
  highlightRef,
  onSelectMeeting,
  onSetEditingMeeting,
  onSetIsNewMeetingOpen,
  onSetNewMeeting,
  onSetNewMeetingTime,
  onSetNewMeetingParticipants,
  onSetNewMeetingRecurrence,
  onSetShowCarryoverBuffer,
  onCreateMeeting,
  onUpdateMeeting,
  onDeleteMeeting,
  onStartMeeting,
  onStopMeeting,
  onShowArchive,
  onLoadCarryoverBufferItems,
  loadAgendaItems,
}: MeetingSidebarProps) {
  const [meetingToDelete, setMeetingToDelete] = useState<Meeting | null>(null);

  return (
    <div
      className={cn(
        "flex min-w-0 flex-col pr-4 pt-2 transition-[gap] duration-300",
        compact ? "gap-4" : "gap-6",
      )}
    >
      {/* Header & Buttons */}
      <div>
        <div className="flex items-start justify-between gap-1">
          <h1
            className={cn(
              "font-bold tracking-tight mb-1.5",
              compact ? "text-base leading-6" : "text-2xl",
            )}
          >
            {compact ? "Meetings" : "Meeting Agenda"}
          </h1>
          {onToggleCompact && (
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 shrink-0"
              aria-label={
                compact
                  ? "Meeting-Liste verbreitern"
                  : "Meeting-Liste verkleinern"
              }
              onClick={onToggleCompact}
            >
              {compact ? (
                <PanelLeftOpen className="h-4 w-4" />
              ) : (
                <PanelLeftClose className="h-4 w-4" />
              )}
            </Button>
          )}
        </div>
        {!compact && (
          <p className="text-sm text-muted-foreground mb-5">
            Ihre wöchentlichen Besprechungen
          </p>
        )}
        <div className={cn("flex flex-wrap gap-2", compact && "mt-3")}>
          <MeetingCreateDialog
            triggerClassName={cn(
              "rounded-xl px-3 text-sm font-semibold shadow-none",
              compact ? "h-9 w-full flex-auto" : "h-11 min-w-32 flex-1",
            )}
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
          <Button
            variant="outline"
            size="icon"
            className={cn(
              "shrink-0 rounded-xl bg-card shadow-none",
              compact ? "h-8 flex-1" : "h-11 w-11",
            )}
            aria-label="Übertragene Punkte anzeigen"
            onClick={async () => {
              await onLoadCarryoverBufferItems();
              onSetShowCarryoverBuffer(true);
            }}
            title="Übertragene Punkte anzeigen"
          >
            <RotateCcw className="h-4 w-4" />
          </Button>
          <Button
            variant="outline"
            size="icon"
            className={cn(
              "shrink-0 rounded-xl bg-card shadow-none",
              compact ? "h-8 flex-1" : "h-11 w-11",
            )}
            aria-label="Meeting-Archiv öffnen"
            title="Meeting-Archiv"
            onClick={onShowArchive}
          >
            <Archive className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Meeting List */}
      <div className="flex-1 space-y-3">
        <h3
          className={cn(
            "px-1 font-semibold text-muted-foreground",
            compact ? "text-xs" : "text-sm",
          )}
        >
          Nächste Besprechungen
        </h3>
        <div className="space-y-3">
          {upcomingMeetings.map((meeting) => (
            <Card
              key={meeting.id}
              ref={highlightRef(meeting.id!)}
              className={cn(
                "relative cursor-pointer rounded-xl border-transparent bg-transparent shadow-none transition-colors hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                selectedMeeting?.id === meeting.id &&
                  "border-primary/45 bg-primary/10 hover:bg-primary/10 before:absolute before:left-0 before:top-3 before:bottom-3 before:w-1 before:rounded-full before:bg-primary",
                isHighlighted(meeting.id!) && "notification-highlight",
              )}
              tabIndex={0}
              aria-label={`Meeting auswählen: ${meeting.title}`}
              aria-current={
                selectedMeeting?.id === meeting.id ? "true" : undefined
              }
              onKeyDown={(event) => {
                if (event.target !== event.currentTarget) return;
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault();
                  onSelectMeeting(meeting);
                  if (meeting.id) loadAgendaItems(meeting.id);
                }
              }}
              onClick={() => {
                onSelectMeeting(meeting);
                if (meeting.id) {
                  loadAgendaItems(meeting.id);
                }
              }}
            >
              <CardContent className={compact ? "p-2.5" : "p-3"}>
                <div
                  className={cn(
                    "flex items-start gap-3",
                    compact && "flex-col gap-2",
                  )}
                >
                  <time
                    dateTime={format(
                      new Date(meeting.meeting_date),
                      "yyyy-MM-dd",
                    )}
                    aria-label={format(
                      new Date(meeting.meeting_date),
                      "EEEE, d. MMMM yyyy",
                      { locale: de },
                    )}
                    className={cn(
                      "flex shrink-0 items-center justify-center rounded-xl border bg-card text-muted-foreground",
                      compact
                        ? "flex-row gap-1.5 px-2 py-1"
                        : "h-[4.5rem] w-12 flex-col",
                    )}
                  >
                    <span className="text-xs leading-5">
                      {format(new Date(meeting.meeting_date), "EEEEEE", {
                        locale: de,
                      })}
                    </span>
                    <span className="text-xl font-bold leading-6 text-foreground">
                      {format(new Date(meeting.meeting_date), "dd")}
                    </span>
                    <span className="text-xs leading-5">
                      {format(new Date(meeting.meeting_date), "MMM", {
                        locale: de,
                      }).replace(/\.$/, "")}
                    </span>
                  </time>
                  <div className="min-w-0 w-full flex-1 pt-0.5">
                    <div className="flex items-start gap-1">
                      <h4
                        className={cn(
                          "min-w-0 flex-1 break-words font-semibold",
                          compact ? "text-sm leading-5" : "text-base leading-6",
                        )}
                      >
                        {meeting.title}
                      </h4>
                      {meeting.is_public && (
                        <Globe
                          aria-label="Öffentliches Meeting"
                          className="mt-1 h-3.5 w-3.5 shrink-0 text-muted-foreground"
                        />
                      )}
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            size="icon"
                            variant="ghost"
                            aria-label={`Aktionen für ${meeting.title}`}
                            className="-mr-1 -mt-0.5 h-7 w-7 shrink-0 text-muted-foreground"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <MoreVertical className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent
                          align="end"
                          sideOffset={8}
                          className="w-60 max-w-[calc(100vw-2rem)] rounded-2xl border-border/70 bg-popover p-2 shadow-xl [&_[role=menuitem]]:rounded-lg [&_[role=menuitem]]:px-3 [&_[role=menuitem]]:py-3"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <DropdownMenuItem
                            onSelect={() => onSetEditingMeeting(meeting)}
                          >
                            <Edit className="mr-2 h-4 w-4" /> Bearbeiten
                          </DropdownMenuItem>
                          <QuickAccessMenuItem
                            id={`meeting-${meeting.id}`}
                            label={meeting.title}
                            icon="Calendar"
                            route={`/meetings?highlight=${meeting.id}`}
                          />
                          <DropdownMenuItem
                            className="text-destructive focus:text-destructive"
                            onSelect={() => setMeetingToDelete(meeting)}
                          >
                            <X className="mr-2 h-4 w-4" /> Löschen
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                    <div
                      className={cn(
                        "mt-2 flex flex-wrap items-center gap-x-3 gap-y-1.5 text-muted-foreground",
                        compact ? "text-xs" : "text-sm",
                      )}
                    >
                      {meeting.meeting_time && (
                        <span className="whitespace-nowrap tabular-nums">
                          {meeting.meeting_time.substring(0, 5)} Uhr
                        </span>
                      )}
                      {meeting.location && (
                        <span
                          className="max-w-full truncate"
                          title={meeting.location}
                        >
                          {meeting.location}
                        </span>
                      )}
                      <MeetingParticipantAvatars
                        meetingId={meeting.id}
                        size="default"
                        compact
                      />
                    </div>
                    <div className="mt-3 flex flex-wrap items-center gap-2">
                      {activeMeetingId === meeting.id ? (
                        <Button
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            onStopMeeting();
                          }}
                          className="h-8 rounded-lg px-3 text-sm font-semibold shadow-none"
                        >
                          <span
                            aria-hidden="true"
                            className="mr-1.5 h-2 w-2 rounded-full bg-current"
                          />{" "}
                          Läuft – beenden
                        </Button>
                      ) : (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={(e) => {
                            e.stopPropagation();
                            onStartMeeting(meeting);
                          }}
                          className="h-8 rounded-lg bg-card px-3 text-sm shadow-none"
                          disabled={activeMeetingId !== null}
                        >
                          <Play className="mr-1 h-3.5 w-3.5 fill-current" />{" "}
                          Starten
                        </Button>
                      )}
                      {editingMeeting?.id === meeting.id && (
                        <>
                          <Button
                            size="icon"
                            variant="ghost"
                            aria-label="Meeting-Änderungen speichern"
                            className="h-8 w-8"
                            onClick={(e) => {
                              e.stopPropagation();
                              if (editingMeeting)
                                onUpdateMeeting(meeting.id!, editingMeeting);
                              onSetEditingMeeting(null);
                            }}
                          >
                            <Check className="h-4 w-4" />
                          </Button>
                          <Button
                            size="icon"
                            variant="ghost"
                            aria-label="Meeting-Bearbeitung abbrechen"
                            className="h-8 w-8"
                            onClick={(e) => {
                              e.stopPropagation();
                              onSetEditingMeeting(null);
                            }}
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        </>
                      )}
                    </div>
                  </div>
                </div>

                {editingMeeting?.id === meeting.id && (
                  <div
                    className="mt-3 pt-3 border-t space-y-3"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <div>
                      <label className="text-xs font-medium text-muted-foreground">
                        Titel
                      </label>
                      <Input
                        value={editingMeeting?.title ?? ""}
                        onChange={(e) =>
                          onSetEditingMeeting({
                            ...editingMeeting!,
                            title: e.target.value,
                          } as Meeting)
                        }
                        className="h-8 text-sm"
                      />
                    </div>
                    <div>
                      <label className="text-xs font-medium text-muted-foreground">
                        Beschreibung
                      </label>
                      <Textarea
                        value={editingMeeting?.description || ""}
                        onChange={(e) =>
                          onSetEditingMeeting({
                            ...editingMeeting!,
                            description: e.target.value,
                          } as Meeting)
                        }
                        className="text-sm min-h-[60px]"
                      />
                    </div>
                    <div>
                      <label className="text-xs font-medium text-muted-foreground">
                        Ort
                      </label>
                      <Input
                        value={editingMeeting?.location || ""}
                        onChange={(e) =>
                          onSetEditingMeeting({
                            ...editingMeeting!,
                            location: e.target.value,
                          } as Meeting)
                        }
                        className="h-8 text-sm"
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="text-xs font-medium text-muted-foreground">
                          Datum
                        </label>
                        <Popover>
                          <PopoverTrigger asChild>
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              className="w-full justify-start text-left font-normal text-xs"
                            >
                              {format(
                                new Date(editingMeeting!.meeting_date),
                                "dd.MM.yy",
                                { locale: de },
                              )}
                            </Button>
                          </PopoverTrigger>
                          <PopoverContent className="w-auto p-0" align="start">
                            <Calendar
                              mode="single"
                              selected={new Date(editingMeeting!.meeting_date)}
                              onSelect={(date) =>
                                date &&
                                onSetEditingMeeting({
                                  ...editingMeeting!,
                                  meeting_date: date,
                                } as Meeting)
                              }
                              initialFocus
                            />
                          </PopoverContent>
                        </Popover>
                      </div>
                      <div>
                        <label className="text-xs font-medium text-muted-foreground">
                          Uhrzeit
                        </label>
                        <TimePickerCombobox
                          value={(
                            editingMeeting!.meeting_time || "10:00"
                          ).substring(0, 5)}
                          onChange={(time) =>
                            onSetEditingMeeting({
                              ...editingMeeting!,
                              meeting_time: time,
                            } as Meeting)
                          }
                        />
                      </div>
                    </div>
                    <div>
                      <label className="text-xs font-medium text-muted-foreground">
                        Teilnehmer
                      </label>
                      {meeting.id && (
                        <InlineMeetingParticipantsEditor
                          meetingId={meeting.id}
                        />
                      )}
                    </div>
                    <div className="flex items-center space-x-2 p-2 bg-muted/50 rounded-md">
                      <Checkbox
                        id={`edit_public_${meeting.id}`}
                        checked={editingMeeting?.is_public || false}
                        onCheckedChange={(checked) =>
                          onSetEditingMeeting({
                            ...editingMeeting!,
                            is_public: !!checked,
                          } as Meeting)
                        }
                      />
                      <label
                        htmlFor={`edit_public_${meeting.id}`}
                        className="text-xs cursor-pointer"
                      >
                        Öffentlich
                      </label>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
          {upcomingMeetings.length === 0 && (
            <p className="text-xs text-muted-foreground text-center py-4">
              Keine anstehenden Besprechungen
            </p>
          )}
        </div>
      </div>

      <AlertDialog
        open={meetingToDelete !== null}
        onOpenChange={(open) => {
          if (!open) setMeetingToDelete(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Meeting löschen</AlertDialogTitle>
            <AlertDialogDescription>
              Sind Sie sicher, dass Sie das Meeting "{meetingToDelete?.title}"
              löschen möchten?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Abbrechen</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (meetingToDelete?.id) onDeleteMeeting(meetingToDelete.id);
                setMeetingToDelete(null);
              }}
            >
              <Trash className="mr-2 h-4 w-4" />
              Löschen
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      <CarryoverBufferDialog
        open={showCarryoverBuffer}
        onOpenChange={onSetShowCarryoverBuffer}
        items={carryoverBufferItems}
      />
    </div>
  );
}
