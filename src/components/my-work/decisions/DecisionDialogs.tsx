import { TaskDecisionDetails } from "@/components/task-decisions/TaskDecisionDetails";
import { DecisionEditDialog } from "@/components/task-decisions/DecisionEditDialog";
import { DecisionComments } from "@/components/task-decisions/DecisionComments";
import { DefaultParticipantsDialog } from "@/components/task-decisions/DefaultParticipantsDialog";
import { CaseItemMeetingSelector } from "@/components/my-work/CaseItemMeetingSelector";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { DecisionTabId } from "@/hooks/useMyWorkSettings";

interface DecisionDialogsProps {
  commentsDecisionId: string | null;
  commentsDecisionTitle: string;
  decisionTabOrder: DecisionTabId[];
  defaultParticipantsOpen: boolean;
  deletingDecisionId: string | null;
  editingDecisionId: string | null;
  hiddenDecisionTabs: DecisionTabId[];
  highlightCommentId: string | null;
  highlightResponseId: string | null;
  isDetailsOpen: boolean;
  meetingSelectorOpen: boolean;
  onCloseComments: () => void;
  onCloseDetails: () => void;
  onCommentsAdded: () => void;
  onDeleteConfirm: () => void;
  onDeleteDialogOpenChange: (open: boolean) => void;
  onMeetingOpenChange: (open: boolean) => void;
  onMeetingSelected: (meetingId: string) => Promise<void>;
  onOpenChangeDefaultParticipants: (open: boolean) => void;
  onSelectNextJourFixe: () => Promise<void>;
  onUpdated: () => void;
  selectedDecisionId: string | null;
  setEditingDecisionId: (decisionId: string | null) => void;
  updateDecisionTabSettings: (value: { order: DecisionTabId[]; hiddenTabs: DecisionTabId[] }) => void;
}

export function DecisionDialogs({ commentsDecisionId, commentsDecisionTitle, decisionTabOrder, defaultParticipantsOpen, deletingDecisionId, editingDecisionId, hiddenDecisionTabs, highlightCommentId, highlightResponseId, isDetailsOpen, meetingSelectorOpen, onCloseComments, onCloseDetails, onCommentsAdded, onDeleteConfirm, onDeleteDialogOpenChange, onMeetingOpenChange, onMeetingSelected, onOpenChangeDefaultParticipants, onSelectNextJourFixe, onUpdated, selectedDecisionId, setEditingDecisionId, updateDecisionTabSettings }: DecisionDialogsProps) {
  return (
    <>
      {selectedDecisionId && <TaskDecisionDetails decisionId={selectedDecisionId} isOpen={isDetailsOpen} onClose={onCloseDetails} onArchived={onUpdated} highlightCommentId={highlightCommentId} highlightResponseId={highlightResponseId} />}
      {editingDecisionId && <DecisionEditDialog decisionId={editingDecisionId} isOpen={true} onClose={() => setEditingDecisionId(null)} onUpdated={onUpdated} />}
      {commentsDecisionId && <DecisionComments decisionId={commentsDecisionId} decisionTitle={commentsDecisionTitle} isOpen={!!commentsDecisionId} onClose={onCloseComments} onCommentAdded={onCommentsAdded} />}
      <DefaultParticipantsDialog open={defaultParticipantsOpen} onOpenChange={onOpenChangeDefaultParticipants} decisionTabSettings={{ order: decisionTabOrder, hiddenTabs: hiddenDecisionTabs, onSave: updateDecisionTabSettings }} />
      <AlertDialog open={!!deletingDecisionId} onOpenChange={onDeleteDialogOpenChange}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Entscheidung löschen?</AlertDialogTitle>
            <AlertDialogDescription>Diese Aktion löscht die Entscheidung unwiderruflich mit allen Antworten und Kommentaren.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Abbrechen</AlertDialogCancel>
            <AlertDialogAction onClick={onDeleteConfirm} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Löschen</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      <CaseItemMeetingSelector open={meetingSelectorOpen} onOpenChange={onMeetingOpenChange} onSelect={onMeetingSelected} onMarkForNextJourFixe={onSelectNextJourFixe} />
    </>
  );
}
