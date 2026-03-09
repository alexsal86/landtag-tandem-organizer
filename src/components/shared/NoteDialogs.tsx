import React, { type KeyboardEvent } from "react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Calendar } from "@/components/ui/calendar";
import { CheckSquare, Vote, Calendar as CalendarIcon, RotateCcw, Clock, FileText } from "lucide-react";
import SimpleRichTextEditor from "@/components/ui/SimpleRichTextEditor";
import { MeetingNoteSelector } from "@/components/widgets/MeetingNoteSelector";
import { NoteShareDialog } from "@/components/shared/NoteShareDialog";
import { GlobalNoteShareDialog } from "@/components/shared/GlobalNoteShareDialog";
import { NoteDecisionCreator } from "@/components/shared/NoteDecisionCreator";
import { format, startOfDay } from "date-fns";
import { de } from "date-fns/locale";
import { stripHtml } from "@/hooks/useQuickNotes";
import type { QuickNote } from "@/components/shared/QuickNotesList";

interface NoteDialogsProps {
  // Meeting selector
  meetingSelectorOpen: boolean;
  setMeetingSelectorOpen: (open: boolean) => void;
  noteForMeeting: QuickNote | null;
  addNoteToMeeting: (noteId: string, meetingId: string, meetingTitle: string) => void;
  markForNextJourFixe: (noteId: string) => void;

  // Date picker
  datePickerOpen: boolean;
  setDatePickerOpen: (open: boolean) => void;
  noteForDatePicker: QuickNote | null;
  handleSetFollowUp: (noteId: string, date: Date | null) => void;

  // Edit dialog
  editDialogOpen: boolean;
  setEditDialogOpen: (open: boolean) => void;
  editingNote: QuickNote | null;
  editTitle: string;
  setEditTitle: (val: string) => void;
  editContent: string;
  setEditContent: (val: string) => void;
  handleSaveEdit: () => void;

  // Share
  shareDialogOpen: boolean;
  setShareDialogOpen: (open: boolean) => void;
  noteForShare: QuickNote | null;
  setNoteForShare: (note: QuickNote | null) => void;
  loadNotes: () => void;

  // Global share
  globalShareDialogOpen: boolean;
  setGlobalShareDialogOpen: (open: boolean) => void;

  // Decision
  decisionCreatorOpen: boolean;
  setDecisionCreatorOpen: (open: boolean) => void;
  noteForDecision: QuickNote | null;
  setNoteForDecision: (note: QuickNote | null) => void;

  // Version history
  versionHistoryOpen: boolean;
  setVersionHistoryOpen: (open: boolean) => void;
  versionHistoryNote: QuickNote | null;
  versions: Array<{ id: string; title: string | null; content: string; created_at: string }>;
  restoreVersion: (version: { title: string | null; content: string }) => void;

  // Confirmations
  confirmDeleteTaskNote: QuickNote | null;
  setConfirmDeleteTaskNote: (note: QuickNote | null) => void;
  removeTaskFromNote: (note: QuickNote) => void;

  confirmRemoveDecision: QuickNote | null;
  setConfirmRemoveDecision: (note: QuickNote | null) => void;
  removeDecisionFromNote: (note: QuickNote) => void;

  confirmRemoveCaseItem: QuickNote | null;
  setConfirmRemoveCaseItem: (note: QuickNote | null) => void;
  removeCaseItemFromNote: (note: QuickNote) => void;

  confirmDeleteLinkedNote: QuickNote | null;
  setConfirmDeleteLinkedNote: (note: QuickNote | null) => void;
  deleteLinkedTask: boolean;
  setDeleteLinkedTask: (val: boolean) => void;
  deleteLinkedDecision: boolean;
  setDeleteLinkedDecision: (val: boolean) => void;
  deleteLinkedMeeting: boolean;
  setDeleteLinkedMeeting: (val: boolean) => void;
  handleDeleteNoteWithLinks: () => void;
}

export function NoteDialogs(props: NoteDialogsProps) {
  const handleEditTitleKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
      const mentionMenuOpen = !!document.querySelector('.mentions-menu');
      if (mentionMenuOpen) return;
      e.preventDefault();
      if (stripHtml(props.editTitle) || stripHtml(props.editContent)) {
        void props.handleSaveEdit();
      }
    }
  };

  const handleEditContentKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
      const mentionMenuOpen = !!document.querySelector('.mentions-menu');
      if (mentionMenuOpen) return;
      e.preventDefault();
      if (stripHtml(props.editTitle) || stripHtml(props.editContent)) {
        void props.handleSaveEdit();
      }
    }
  };

  return (
    <>
      {/* Meeting Selector */}
      {props.noteForMeeting && (
        <MeetingNoteSelector
          open={props.meetingSelectorOpen}
          onOpenChange={props.setMeetingSelectorOpen}
          onSelect={(meetingId, meetingTitle) => props.addNoteToMeeting(props.noteForMeeting!.id, meetingId, meetingTitle)}
          onMarkForNextJourFixe={() => props.markForNextJourFixe(props.noteForMeeting!.id)}
        />
      )}

      {/* Date Picker */}
      <Dialog open={props.datePickerOpen} onOpenChange={props.setDatePickerOpen}>
        <DialogContent className="sm:max-w-[350px]">
          <DialogHeader>
            <DialogTitle>Wiedervorlage-Datum wählen</DialogTitle>
            <DialogDescription>Wählen Sie ein Datum für die Wiedervorlage.</DialogDescription>
          </DialogHeader>
          <Calendar
            mode="single"
            selected={props.noteForDatePicker?.follow_up_date ? new Date(props.noteForDatePicker.follow_up_date) : undefined}
            onSelect={(date) => { if (date && props.noteForDatePicker) props.handleSetFollowUp(props.noteForDatePicker.id, date); }}
            disabled={(date) => date < startOfDay(new Date())}
            locale={de}
            className="rounded-md border"
          />
        </DialogContent>
      </Dialog>

      {/* Edit Dialog */}
      <Dialog open={props.editDialogOpen} onOpenChange={props.setEditDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Notiz bearbeiten</DialogTitle>
            <DialogDescription>Bearbeiten Sie Titel und Inhalt der Notiz.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <SimpleRichTextEditor
              key={`title-${props.editDialogOpen ? props.editingNote?.id : 'closed'}`}
              initialContent={props.editTitle}
              onChange={props.setEditTitle}
              onKeyDown={handleEditTitleKeyDown}
              placeholder="Titel (optional)"
              minHeight="46px"
              showToolbar={false}
            />
            <SimpleRichTextEditor
              key={props.editDialogOpen ? props.editingNote?.id : 'closed'}
              initialContent={props.editContent}
              onChange={props.setEditContent}
              onKeyDown={handleEditContentKeyDown}
              placeholder="Inhalt"
              minHeight="150px"
            />
            <p className="text-xs text-muted-foreground">Enter speichert, Shift + Enter erzeugt eine neue Zeile.</p>
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => props.setEditDialogOpen(false)}>Abbrechen</Button>
            <Button onClick={props.handleSaveEdit} disabled={!stripHtml(props.editTitle) && !stripHtml(props.editContent)}>Speichern</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Share Dialog */}
      {props.noteForShare && (
        <NoteShareDialog
          open={props.shareDialogOpen}
          onOpenChange={(open) => {
            props.setShareDialogOpen(open);
            if (!open) { props.setNoteForShare(null); props.loadNotes(); }
          }}
          noteId={props.noteForShare.id}
          noteTitle={props.noteForShare.title || props.noteForShare.content.substring(0, 50)}
        />
      )}

      {/* Global Share Dialog */}
      <GlobalNoteShareDialog open={props.globalShareDialogOpen} onOpenChange={props.setGlobalShareDialogOpen} />

      {/* Decision Creator */}
      {props.noteForDecision && (
        <NoteDecisionCreator
          note={props.noteForDecision}
          open={props.decisionCreatorOpen}
          onOpenChange={(open) => { props.setDecisionCreatorOpen(open); if (!open) props.setNoteForDecision(null); }}
          onDecisionCreated={() => { props.loadNotes(); props.setDecisionCreatorOpen(false); props.setNoteForDecision(null); }}
        />
      )}

      {/* Version History */}
      <Dialog open={props.versionHistoryOpen} onOpenChange={props.setVersionHistoryOpen}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle>Versionshistorie</DialogTitle>
            <DialogDescription>Frühere Versionen dieser Notiz</DialogDescription>
          </DialogHeader>
          <ScrollArea className="flex-1 max-h-[400px]">
            {props.versions.length === 0 ? (
              <p className="text-muted-foreground text-center py-8">Keine früheren Versionen vorhanden</p>
            ) : (
              <div className="space-y-3 pr-4">
                {props.versions.map((version, index) => (
                  <div key={version.id} className="p-3 border rounded-lg">
                    <div className="flex justify-between items-center mb-2">
                      <Badge variant="secondary">Version {props.versions.length - index}</Badge>
                      <span className="text-xs text-muted-foreground">{format(new Date(version.created_at), "dd.MM.yyyy HH:mm", { locale: de })}</span>
                    </div>
                    {version.title && <p className="font-medium text-sm mb-1">{version.title}</p>}
                    <p className="text-sm text-muted-foreground line-clamp-3">{version.content.replace(/<[^>]*>/g, '')}</p>
                    <Button variant="outline" size="sm" className="mt-2" onClick={() => props.restoreVersion(version)}>
                      <RotateCcw className="h-3 w-3 mr-1" />Wiederherstellen
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </ScrollArea>
        </DialogContent>
      </Dialog>

      {/* Confirm Delete Task */}
      <AlertDialog open={!!props.confirmDeleteTaskNote} onOpenChange={(open) => !open && props.setConfirmDeleteTaskNote(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Aufgabe entfernen?</AlertDialogTitle>
            <AlertDialogDescription>Die verknüpfte Aufgabe wird unwiderruflich gelöscht. Die Notiz selbst bleibt erhalten.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Abbrechen</AlertDialogCancel>
            <AlertDialogAction onClick={() => { if (props.confirmDeleteTaskNote) props.removeTaskFromNote(props.confirmDeleteTaskNote); }} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Aufgabe löschen
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Confirm Remove Decision */}
      <AlertDialog open={!!props.confirmRemoveDecision} onOpenChange={(open) => !open && props.setConfirmRemoveDecision(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Entscheidungsanfrage zurücknehmen?</AlertDialogTitle>
            <AlertDialogDescription>Die Entscheidungsanfrage wird archiviert und von dieser Notiz entfernt. Bisherige Antworten bleiben im Archiv erhalten.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Abbrechen</AlertDialogCancel>
            <AlertDialogAction onClick={() => { if (props.confirmRemoveDecision) props.removeDecisionFromNote(props.confirmRemoveDecision); }}>
              Zurücknehmen
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Confirm Delete Note with Links */}
      <AlertDialog open={!!props.confirmDeleteLinkedNote} onOpenChange={(open) => !open && props.setConfirmDeleteLinkedNote(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Notiz mit Verknüpfungen löschen?</AlertDialogTitle>
            <AlertDialogDescription>Diese Notiz hat verknüpfte Elemente. Was soll mit ihnen geschehen?</AlertDialogDescription>
          </AlertDialogHeader>
          <div className="space-y-3 py-4">
            {props.confirmDeleteLinkedNote?.task_id && (
              <div className="flex items-center gap-3">
                <Checkbox id="delete-task" checked={props.deleteLinkedTask} onCheckedChange={(checked) => props.setDeleteLinkedTask(!!checked)} />
                <label htmlFor="delete-task" className="text-sm flex items-center gap-2 cursor-pointer">
                  <CheckSquare className="h-4 w-4 text-blue-600" />Verknüpfte Aufgabe auch löschen
                </label>
              </div>
            )}
            {props.confirmDeleteLinkedNote?.decision_id && (
              <div className="flex items-center gap-3">
                <Checkbox id="delete-decision" checked={props.deleteLinkedDecision} onCheckedChange={(checked) => props.setDeleteLinkedDecision(!!checked)} />
                <label htmlFor="delete-decision" className="text-sm flex items-center gap-2 cursor-pointer">
                  <Vote className="h-4 w-4 text-purple-600" />Verknüpfte Entscheidung auch löschen
                </label>
              </div>
            )}
            {props.confirmDeleteLinkedNote?.meeting_id && (
              <div className="flex items-center gap-3">
                <Checkbox id="delete-meeting" checked={props.deleteLinkedMeeting} onCheckedChange={(checked) => props.setDeleteLinkedMeeting(!!checked)} />
                <label htmlFor="delete-meeting" className="text-sm flex items-center gap-2 cursor-pointer">
                  <CalendarIcon className="h-4 w-4 text-emerald-600" />Vom Jour Fixe entfernen
                </label>
              </div>
            )}
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel>Abbrechen</AlertDialogCancel>
            <AlertDialogAction onClick={props.handleDeleteNoteWithLinks} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Löschen
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
